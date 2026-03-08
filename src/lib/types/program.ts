export interface ProgramMeta {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  head_version_id: number | null;
}

export interface ProgramDocument {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

export interface SerializedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface VersionMeta {
  id: number;
  parent_id: number | null;
  label: string;
  created_at: string;
}
