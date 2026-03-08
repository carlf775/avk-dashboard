import type { Node, Edge } from '@xyflow/svelte';
import type { ProgramMeta, ProgramDocument, VersionMeta } from '$lib/types/program';

import { TRANSIENT_KEYS } from '$lib/modules/registry';

const API = '/api/programs';

function stripTransientData(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!TRANSIENT_KEYS.has(k) && typeof v !== 'function') {
      clean[k] = v;
    }
  }
  return clean;
}

export function createProgramStore() {
  let programs = $state<ProgramMeta[]>([]);
  let currentProgram = $state<ProgramMeta | null>(null);
  let versions = $state<VersionMeta[]>([]);
  let currentVersionId = $state<number | null>(null);
  let nodes = $state<Node[]>([]);
  let edges = $state<Edge[]>([]);
  let isDirty = $state(false);
  let isLoading = $state(false);
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  async function fetchPrograms() {
    try {
      const res = await fetch(API);
      programs = await res.json();
    } catch (e) {
      error = 'Cannot reach server';
      programs = [];
    }
  }

  async function createProgram(name: string): Promise<number> {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    await fetchPrograms();
    return data.id;
  }

  async function loadProgram(id: number) {
    isLoading = true;
    error = null;
    try {
      const [progRes, versRes] = await Promise.all([
        fetch(`${API}/${id}`),
        fetch(`${API}/${id}/versions`),
      ]);

      const prog = await progRes.json();
      const vers: VersionMeta[] = await versRes.json();

      currentProgram = {
        id: prog.id,
        name: prog.name,
        created_at: prog.created_at,
        updated_at: prog.updated_at,
        head_version_id: prog.head_version_id,
      };
      versions = vers;
      currentVersionId = prog.head_version_id;

      const doc: ProgramDocument = prog.document ?? { nodes: [], edges: [] };
      nodes = doc.nodes.map((n) => ({ ...n } as Node));
      edges = doc.edges.map((e) => ({ ...e } as Edge));
      isDirty = false;
    } catch (e) {
      error = String(e);
    } finally {
      isLoading = false;
    }
  }

  async function updateProgramName(name: string) {
    if (!currentProgram) return;
    await fetch(`${API}/${currentProgram.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    currentProgram = { ...currentProgram, name };
  }

  async function deleteProgram(id: number) {
    await fetch(`${API}/${id}`, { method: 'DELETE' });
    if (currentProgram?.id === id) {
      currentProgram = null;
      versions = [];
      currentVersionId = null;
      nodes = [];
      edges = [];
      isDirty = false;
    }
    await fetchPrograms();
  }

  async function save() {
    if (!currentProgram) return;
    isSaving = true;
    error = null;
    try {
      const document: ProgramDocument = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type ?? 'default',
          position: n.position,
          data: stripTransientData(n.data),
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
          ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
        })),
      };

      const res = await fetch(`${API}/${currentProgram.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document }),
      });
      const data = await res.json();

      currentVersionId = data.version_id;
      currentProgram = { ...currentProgram, head_version_id: data.version_id };
      isDirty = false;

      // Refresh versions for tree
      const versRes = await fetch(`${API}/${currentProgram.id}/versions`);
      versions = await versRes.json();
    } catch (e) {
      error = String(e);
    } finally {
      isSaving = false;
    }
  }

  async function restoreVersion(vid: number) {
    if (!currentProgram) return;
    isLoading = true;
    error = null;
    try {
      const res = await fetch(`${API}/${currentProgram.id}/restore/${vid}`, {
        method: 'POST',
      });
      const data = await res.json();

      const doc: ProgramDocument = data.document ?? { nodes: [], edges: [] };
      nodes = doc.nodes.map((n) => ({ ...n } as Node));
      edges = doc.edges.map((e) => ({ ...e } as Edge));
      currentVersionId = data.version_id;
      currentProgram = { ...currentProgram, head_version_id: data.version_id };
      isDirty = false;
    } catch (e) {
      error = String(e);
    } finally {
      isLoading = false;
    }
  }

  async function cancelChanges() {
    if (!currentProgram) return;
    await loadProgram(currentProgram.id);
  }

  async function deleteVersion(vid: number) {
    if (!currentProgram) return;
    try {
      await fetch(`${API}/${currentProgram.id}/versions/${vid}`, { method: 'DELETE' });
      // Refresh versions for tree
      const versRes = await fetch(`${API}/${currentProgram.id}/versions`);
      versions = await versRes.json();
    } catch (e) {
      error = String(e);
    }
  }

  function setNodes(newNodes: Node[]) {
    nodes = newNodes;
    isDirty = true;
  }

  function setEdges(newEdges: Edge[]) {
    edges = newEdges;
    isDirty = true;
  }

  /** Update node positions without marking dirty (e.g. after dragging) */
  function setNodesQuiet(newNodes: Node[]) {
    nodes = newNodes;
  }

  return {
    get programs() { return programs; },
    get currentProgram() { return currentProgram; },
    get versions() { return versions; },
    get currentVersionId() { return currentVersionId; },
    get nodes() { return nodes; },
    get edges() { return edges; },
    get isDirty() { return isDirty; },
    get isLoading() { return isLoading; },
    get isSaving() { return isSaving; },
    get error() { return error; },
    fetchPrograms,
    createProgram,
    loadProgram,
    updateProgramName,
    deleteProgram,
    save,
    cancelChanges,
    restoreVersion,
    deleteVersion,
    setNodes,
    setEdges,
    setNodesQuiet,
  };
}
