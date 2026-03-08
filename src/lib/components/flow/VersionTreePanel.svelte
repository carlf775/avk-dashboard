<script lang="ts">
  import {
    SvelteFlow,
    SvelteFlowProvider,
    Background,
    type Node,
    type Edge,
    type NodeTypes,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import XIcon from '@lucide/svelte/icons/x';
  import VersionNode from './VersionNode.svelte';
  import type { createProgramStore } from '$lib/stores/program.svelte';
  import type { VersionMeta } from '$lib/types/program';

  let {
    store,
    onclose,
  }: {
    store: ReturnType<typeof createProgramStore>;
    onclose: () => void;
  } = $props();

  const nodeTypes: NodeTypes = { version: VersionNode } as NodeTypes;

  // Delete confirmation state
  let confirmDelete = $state<{ vid: number; label: string } | null>(null);

  function requestDelete(vid: number, label: string) {
    confirmDelete = { vid, label };
  }

  function executeDelete() {
    if (confirmDelete) {
      store.deleteVersion(confirmDelete.vid);
      confirmDelete = null;
    }
  }

  // Compute tree layout from flat version list
  function layoutTree(
    versions: VersionMeta[],
    headId: number | null,
    restoreFn: (vid: number) => void,
    deleteFn: (vid: number, label: string) => void,
  ): { nodes: Node[]; edges: Edge[] } {
    if (versions.length === 0) return { nodes: [], edges: [] };

    const byId = new Map<number, VersionMeta>();
    const childrenMap = new Map<number | null, VersionMeta[]>();

    for (const v of versions) {
      byId.set(v.id, v);
      const kids = childrenMap.get(v.parent_id) ?? [];
      kids.push(v);
      childrenMap.set(v.parent_id, kids);
    }

    // Find roots (parent_id === null)
    const roots = childrenMap.get(null) ?? [];

    const X_GAP = 160;
    const Y_GAP = 90;
    const positioned: Node[] = [];
    const treeEdges: Edge[] = [];
    let leafIndex = 0;

    function dfs(v: VersionMeta, depth: number): number {
      const children = childrenMap.get(v.id) ?? [];

      if (children.length === 0) {
        const x = leafIndex * X_GAP;
        leafIndex++;
        positioned.push({
          id: String(v.id),
          type: 'version',
          position: { x, y: depth * Y_GAP },
          data: {
            label: v.label,
            created_at: v.created_at,
            isHead: v.id === headId,
            onRestore: v.id !== headId ? () => restoreFn(v.id) : null,
            onDelete: v.id !== headId ? () => deleteFn(v.id, v.label) : null,
          },
        });
        return x;
      }

      const childXs: number[] = [];
      for (const child of children) {
        childXs.push(dfs(child, depth + 1));
        treeEdges.push({
          id: `e-${v.id}-${child.id}`,
          source: String(v.id),
          target: String(child.id),
          type: 'smoothstep',
        });
      }

      const x = Math.round((Math.min(...childXs) + Math.max(...childXs)) / 2);
      positioned.push({
        id: String(v.id),
        type: 'version',
        position: { x, y: depth * Y_GAP },
        data: {
          label: v.label,
          created_at: v.created_at,
          isHead: v.id === headId,
          onRestore: v.id !== headId ? () => restoreFn(v.id) : null,
          onDelete: v.id !== headId ? () => deleteFn(v.id, v.label) : null,
        },
      });
      return x;
    }

    for (const root of roots) {
      dfs(root, 0);
    }

    return { nodes: positioned, edges: treeEdges };
  }

  const tree = $derived(
    layoutTree(store.versions, store.currentVersionId, (vid) => store.restoreVersion(vid), requestDelete),
  );
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  onkeydown={(e) => e.key === 'Escape' && (confirmDelete ? (confirmDelete = null) : onclose())}
  onclick={onclose}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-[90vw] h-[85vh] bg-zinc-900 border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
      <span class="text-sm font-semibold text-foreground">Version History</span>
      <button class="text-muted-foreground hover:text-foreground transition-colors" onclick={onclose}>
        <XIcon class="size-5" />
      </button>
    </div>
    <div class="flex-1 relative">
      <SvelteFlowProvider>
        <SvelteFlow
          nodes={tree.nodes}
          edges={tree.edges}
          {nodeTypes}
          colorMode="dark"
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
        >
          <Background />
        </SvelteFlow>
      </SvelteFlowProvider>
    </div>
  </div>
</div>

{#if confirmDelete}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
    onclick={() => (confirmDelete = null)}
    onkeydown={(e) => {
      if (e.key === 'Escape') confirmDelete = null;
      if (e.key === 'Enter') executeDelete();
    }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-zinc-900 border border-border rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4"
      onclick={(e) => e.stopPropagation()}
    >
      <h3 class="text-sm font-semibold text-foreground mb-2">Delete version</h3>
      <p class="text-sm text-muted-foreground mb-5">
        Are you sure you want to delete <span class="font-mono text-foreground">{confirmDelete.label}</span>? Child versions will be re-parented.
      </p>
      <div class="flex justify-end gap-2">
        <button
          class="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-zinc-800 transition-colors"
          onclick={() => (confirmDelete = null)}
        >
          Cancel
        </button>
        <button
          class="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
          onclick={executeDelete}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}
