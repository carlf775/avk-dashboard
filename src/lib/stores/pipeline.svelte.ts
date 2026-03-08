export interface PipelineNodeStatus {
  id: string;
  node_type: string;
  label: string;
  status: string;
  frame_count: number;
  last_frame_time: number;
  image_count: number;
  // Live inference fields
  has_frame?: boolean;
  score?: number;
  is_anomalous?: boolean;
  has_heatmap?: boolean;
  detection_count?: number;
}

export interface PipelineStatus {
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  program_id: number | null;
  nodes: PipelineNodeStatus[];
}

const PIPELINE_API = '/api/pipeline';

export function createPipelineStore(opts?: { modulesStore?: { handleMessage: (msg: { type: string; modules?: unknown[] }) => void } }) {
  let status = $state<PipelineStatus>({
    state: 'idle',
    program_id: null,
    nodes: [],
  });
  let gpuHolder = $state<'none' | 'pipeline' | 'annotation' | 'training'>('none');
  let error = $state<string | null>(null);
  let ws = $state<WebSocket | null>(null);
  let reconnectTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  async function parseJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function start(programId: number) {
    error = null;
    try {
      const res = await fetch(`${PIPELINE_API}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        error = (data?.error as string) ?? `Failed to start pipeline (${res.status})`;
      }
    } catch (e) {
      error = String(e);
    }
  }

  async function stop() {
    error = null;
    try {
      const res = await fetch(`${PIPELINE_API}/stop`, { method: 'POST' });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        error = (data?.error as string) ?? `Failed to stop pipeline (${res.status})`;
      }
    } catch (e) {
      error = String(e);
    }
  }

  async function fetchStatus() {
    try {
      const res = await fetch(`${PIPELINE_API}/status`);
      if (!res.ok) return;
      const data = await parseJsonSafe(res);
      if (data) {
        status = data as unknown as PipelineStatus;
      }
    } catch {
      // Ignore fetch errors, WS will handle updates
    }
  }

  function connectWebSocket() {
    if (ws) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pipeline') {
          status = {
            state: msg.state,
            program_id: msg.program_id,
            nodes: msg.nodes ?? [],
          };
        }
        if (msg.type === 'gpu_lock') {
          gpuHolder = msg.holder;
        }
        if (msg.type === 'modules') {
          opts?.modulesStore?.handleMessage(msg);
        }
      } catch {
        // Ignore parse errors
      }
    };

    socket.onclose = () => {
      ws = null;
      // Auto-reconnect after 2 seconds
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
      }, 2000);
    };

    socket.onerror = () => {
      socket.close();
    };

    ws = socket;
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  return {
    get status() { return status; },
    get gpuHolder() { return gpuHolder; },
    get error() { return error; },
    start,
    stop,
    fetchStatus,
    connectWebSocket,
    disconnect,
  };
}
