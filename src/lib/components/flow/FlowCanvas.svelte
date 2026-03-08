<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    useSvelteFlow,
    type Node,
    type Edge,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import FlowSidebar from './FlowSidebar.svelte';
  import { nodeTypes, createDefaultData, moduleRegistry } from '$lib/modules/registry';
  import { onMount, onDestroy } from 'svelte';
  import type { CameraNodeData, Sam3NodeData, Sam3State, DiscoveredCamera } from '$lib/types/flow';
  import type { createProgramStore } from '$lib/stores/program.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';

  let { store, isModuleEnabled = (_type: string) => true }: { store: ReturnType<typeof createProgramStore>; isModuleEnabled?: (type: string) => boolean } = $props();

  let localNodes = $state<Node[]>([]);
  let localEdges = $state<Edge[]>([]);
  let nodeId = $state(0);

  // Track the store snapshot we last synced from, to avoid looping
  let lastStoreNodes: Node[] = [];
  let lastStoreEdges: Edge[] = [];

  // Modal state: { [modalKey]: nodeId }
  let openModals = $state<Record<string, string | null>>({});

  // GPU conflict modal state
  let gpuConflict = $state<{ holder: string; action: string; resolve: () => void } | null>(null);

  function handleGpuConflict(action: string): (holder: string) => Promise<void> {
    return (holder: string) => {
      return new Promise<void>((resolve) => {
        gpuConflict = { holder, action, resolve };
      });
    };
  }

  async function handleGpuPause() {
    if (!gpuConflict) return;
    const { resolve } = gpuConflict;
    try {
      await fetch('/api/pipeline/stop', { method: 'POST' });
    } catch { /* ignore */ }
    gpuConflict = null;
    resolve();
  }

  function handleGpuCancel() {
    gpuConflict = null;
  }

  function openModal(name: string, nodeId: string) {
    openModals = { ...openModals, [name]: nodeId };
  }

  function closeModal(name: string) {
    openModals = { ...openModals, [name]: null };
  }

  function getModalNode(name: string) {
    const id = openModals[name];
    return id ? localNodes.find(n => n.id === id) : null;
  }

  // ---- Camera callbacks ----
  function onDiscover(nodeId: string) {
    openModal('discover', nodeId);
  }

  function onSettings(nodeId: string) {
    openModal('settings', nodeId);
  }

  function onDataChange(nodeId: string, newData: Partial<CameraNodeData>) {
    localNodes = localNodes.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...newData, onDataChange, onDiscover, onSettings } } : n
    );
    pushToStore();
  }

  function handleCameraSelect(camera: DiscoveredCamera) {
    const nid = openModals['discover'];
    if (nid) {
      onDataChange(nid, {
        cameraId: camera.id,
        vendor: camera.vendor,
        model: camera.model,
        serialNumber: camera.serial_number,
        userName: camera.user_name,
        status: 'connected',
      });
    }
    closeModal('discover');
  }

  // ---- SAM3 callbacks ----
  async function onStateChange(nodeId: string, state: Sam3State) {
    if (state === 'collecting') {
      const cameraId = findConnectedCameraId(nodeId);
      if (!cameraId) {
        const hasEdge = localEdges.some(e => e.target === nodeId && e.targetHandle === 'image');
        const errorMsg = hasEdge
          ? 'Connected camera has not been discovered yet'
          : 'Connect a camera node first';
        localNodes = localNodes.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, collectionError: errorMsg, ...sam3Callbacks } } : n
        );
        localNodes = [...localNodes];
        return;
      }

      localNodes = localNodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, state: 'collecting' as Sam3State, isStartingPipeline: true, collectionError: undefined, ...sam3Callbacks } } : n
      );
      pushToStore();

      try {
        await store.save();
        const programId = store.currentProgram?.id;
        if (programId != null) {
          const res = await fetch('/api/pipeline/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ program_id: programId }),
          });
          if (res.status === 409) {
            const data = await res.json().catch(() => ({})) as Record<string, string>;
            if (data.holder) {
              // GPU conflict — show modal and retry
              await handleGpuConflict('start image collection')(data.holder);
              const retry = await fetch('/api/pipeline/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ program_id: programId }),
              });
              if (!retry.ok) {
                const retryData = await retry.json().catch(() => null);
                const errMsg = (retryData as Record<string, string>)?.error ?? 'Failed to start pipeline';
                localNodes = localNodes.map(n =>
                  n.id === nodeId ? { ...n, data: { ...n.data, state: 'needs_data' as Sam3State, collectionError: errMsg, isStartingPipeline: false, ...sam3Callbacks } } : n
                );
                localNodes = [...localNodes];
                pushToStore();
                return;
              }
            } else {
              const errMsg = data.error ?? 'Failed to start pipeline';
              localNodes = localNodes.map(n =>
                n.id === nodeId ? { ...n, data: { ...n.data, state: 'needs_data' as Sam3State, collectionError: errMsg, isStartingPipeline: false, ...sam3Callbacks } } : n
              );
              localNodes = [...localNodes];
              pushToStore();
              return;
            }
          } else if (!res.ok) {
            const data = await res.json().catch(() => null);
            const errMsg = (data as Record<string, string>)?.error ?? 'Failed to start pipeline';
            localNodes = localNodes.map(n =>
              n.id === nodeId ? { ...n, data: { ...n.data, state: 'needs_data' as Sam3State, collectionError: errMsg, isStartingPipeline: false, ...sam3Callbacks } } : n
            );
            localNodes = [...localNodes];
            pushToStore();
            return;
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Failed to start pipeline';
        localNodes = localNodes.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, state: 'needs_data' as Sam3State, collectionError: errMsg, isStartingPipeline: false, ...sam3Callbacks } } : n
        );
        localNodes = [...localNodes];
        pushToStore();
        return;
      }

      localNodes = localNodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, isStartingPipeline: false, ...sam3Callbacks } } : n
      );
      localNodes = [...localNodes];
      return;
    }

    localNodes = localNodes.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, state, collectionError: undefined, ...sam3Callbacks } } : n
    );
    pushToStore();
  }

  function onSam3DataChange(nodeId: string, newData: Partial<Sam3NodeData>) {
    localNodes = localNodes.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...newData, ...sam3Callbacks } } : n
    );
    pushToStore();
  }

  function onOpenAnnotator(nodeId: string) {
    openModal('annotate', nodeId);
  }

  function onTrain(nodeId: string) {
    openModal('train', nodeId);
  }

  async function deinitSam3() {
    try {
      await fetch('/api/sam3/deinit', { method: 'POST' });
    } catch { /* ignore */ }
  }

  const sam3Callbacks = {
    onStateChange,
    onOpenAnnotator,
    onTrain,
    onDataChange: onSam3DataChange,
  };

  const cameraCallbacks = {
    onDataChange,
    onDiscover,
    onSettings,
  };

  // ---- Callback injection by node type ----
  const callbackMap: Record<string, Record<string, unknown>> = {
    sam3_ad: sam3Callbacks,
    camera: cameraCallbacks,
  };

  function findConnectedCameraId(sam3NodeId: string): string | undefined {
    for (const edge of localEdges) {
      if (edge.target === sam3NodeId && edge.targetHandle === 'image') {
        const sourceNode = localNodes.find(n => n.id === edge.source);
        if (sourceNode?.type === 'camera') {
          return (sourceNode.data as CameraNodeData).cameraId || undefined;
        }
      }
    }
    return undefined;
  }

  function injectCallbacks(nodes: Node[]): Node[] {
    return nodes.map(n => {
      const callbacks = callbackMap[n.type ?? ''] ?? cameraCallbacks;
      return { ...n, data: { ...n.data, ...callbacks } };
    });
  }

  // Sync from store to local state when store data changes (load/restore)
  $effect(() => {
    const sn = store.nodes;
    const se = store.edges;
    if (sn === lastStoreNodes && se === lastStoreEdges) return;
    lastStoreNodes = sn;
    lastStoreEdges = se;
    localNodes = injectCallbacks(sn);
    localEdges = [...se];
    let maxId = 0;
    for (const n of sn) {
      const parts = n.id.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxId) maxId = num;
    }
    nodeId = maxId;
  });

  // Listen for pipeline status to update SAM3 image counts
  let pipelineWs: WebSocket | null = null;

  onMount(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    pipelineWs = new WebSocket(wsUrl);
    pipelineWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pipeline' && msg.nodes) {
          let changed = false;
          for (const pipeNode of msg.nodes) {
            if (pipeNode.node_type !== 'sam3_ad') continue;
            const localNode = localNodes.find(n => n.id === pipeNode.id);
            if (!localNode) continue;
            const d = localNode.data as Sam3NodeData;
            if ((d.imageCount ?? 0) !== pipeNode.image_count) {
              localNode.data = { ...d, imageCount: pipeNode.image_count, ...sam3Callbacks };
              changed = true;
            }
          }
          if (changed) localNodes = [...localNodes];
        }
      } catch { /* ignore */ }
    };
    pipelineWs.onerror = () => pipelineWs?.close();
  });

  onDestroy(() => {
    pipelineWs?.close();
    pipelineWs = null;
  });

  function pushToStore() {
    lastStoreNodes = localNodes;
    lastStoreEdges = localEdges;
    store.setNodes(localNodes);
    store.setEdges(localEdges);
  }

  function syncPositions() {
    lastStoreNodes = localNodes;
    store.setNodesQuiet(localNodes);
  }

  const { screenToFlowPosition } = useSvelteFlow();

  function ondragover(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function ondrop(event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer) return;

    const type = event.dataTransfer.getData('application/svelteflow');
    if (!type) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    nodeId++;
    const id = `${type}-${nodeId}`;

    const defaultData = createDefaultData(type, nodeId);
    if (!defaultData) return;

    const callbacks = callbackMap[type] ?? {};
    const data = { ...defaultData, ...callbacks };

    const newNode: Node = { id, type, position, data };

    localNodes = [...localNodes, newNode];
    pushToStore();
  }

  // Reactive modal nodes
  const discoverNode = $derived(getModalNode('discover'));
  const settingsNode = $derived(getModalNode('settings'));
  const annotateNode = $derived(getModalNode('annotate'));
  const trainNode = $derived(getModalNode('train'));
</script>

<div class="h-full w-full flex overflow-hidden">
  <FlowSidebar {isModuleEnabled} />
  <div class="flex-1 relative">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="absolute inset-0" {ondragover} {ondrop}>
      <SvelteFlow
        bind:nodes={localNodes}
        bind:edges={localEdges}
        onnodedragstop={() => syncPositions()}
        {nodeTypes}
        colorMode={themeStore.theme}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </SvelteFlow>
    </div>
  </div>
</div>

<!-- Camera modals -->
{#if openModals['discover']}
  {#await import('$nodes/camera/ui/DiscoverModal.svelte') then { default: DiscoverModal }}
    <DiscoverModal
      currentCameraId={(discoverNode?.data as CameraNodeData)?.cameraId ?? ''}
      onselect={handleCameraSelect}
      onclose={() => closeModal('discover')}
    />
  {/await}
{/if}

{#if openModals['settings'] && settingsNode}
  {#await import('$nodes/camera/ui/SettingsModal.svelte') then { default: SettingsModal }}
    {@const nodeData = settingsNode.data as CameraNodeData}
    <SettingsModal
      cameraId={nodeData.cameraId}
      label={nodeData.label}
      vendor={nodeData.vendor}
      model={nodeData.model}
      initialSettings={nodeData.settings ?? {}}
      onsave={(updatedSettings) => {
        onDataChange(openModals['settings']!, { settings: updatedSettings });
        closeModal('settings');
      }}
      onclose={() => closeModal('settings')}
    />
  {/await}
{/if}

<!-- SAM3 modals -->
{#if openModals['annotate'] && annotateNode}
  {#await import('$nodes/sam3/ui/AnnotationModal.svelte') then { default: AnnotationModal }}
    {@const sam3Data = annotateNode.data as Sam3NodeData}
    <AnnotationModal
      programId={store.currentProgram?.id}
      nodeId={openModals['annotate']!}
      cameraId={findConnectedCameraId(openModals['annotate']!)}
      annotations={sam3Data.annotations ?? []}
      labels={sam3Data.labels ?? []}
      ongpuconflict={handleGpuConflict('annotate images')}
      onsave={async (updated, updatedLabels) => {
        await deinitSam3();
        localNodes = localNodes.map(n => {
          if (n.id !== openModals['annotate']) return n;
          const d = n.data as Sam3NodeData;
          let newState = d.state;
          if (updated.length > 0 && (d.state === 'needs_data' || d.state === 'annotating')) {
            newState = 'ready_to_train';
          }
          return { ...n, data: { ...d, annotations: updated, labels: updatedLabels, state: newState, ...sam3Callbacks } };
        });
        pushToStore();
        closeModal('annotate');
      }}
      onclose={async () => {
        await deinitSam3();
        closeModal('annotate');
      }}
    />
  {/await}
{/if}

{#if openModals['train'] && trainNode}
  {#await import('$nodes/sam3/ui/TrainingModal.svelte') then { default: TrainingModal }}
    {@const sam3Data = trainNode.data as Sam3NodeData}
    <TrainingModal
      nodeId={openModals['train']!}
      label={sam3Data.label}
      annotations={sam3Data.annotations ?? []}
      trainingConfig={sam3Data.trainingConfig}
      existingPredictions={sam3Data.predictions}
      ongpuconflict={handleGpuConflict('start training')}
      onclose={() => closeModal('train')}
      onsave={(modelId, trainedImageSize, predictions) => {
        localNodes = localNodes.map(n => {
          if (n.id !== openModals['train']) return n;
          const d = n.data as Sam3NodeData;
          return { ...n, data: { ...d, state: 'ready' as Sam3State, modelId, predictions, trainingConfig: { ...d.trainingConfig, imageSize: trainedImageSize }, ...sam3Callbacks } };
        });
        pushToStore();
      }}
    />
  {/await}
{/if}

{#if gpuConflict}
  {#await import('$lib/components/ui/GpuConflictModal.svelte') then { default: GpuConflictModal }}
    <GpuConflictModal
      holder={gpuConflict.holder}
      action={gpuConflict.action}
      onpause={handleGpuPause}
      oncancel={handleGpuCancel}
    />
  {/await}
{/if}
