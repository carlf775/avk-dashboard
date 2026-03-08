import type { ModuleManifest } from './types';
import type { NodeTypes } from '@xyflow/svelte';

// Explicit module imports — add new modules here
import cameraModule from '$nodes/camera/ui/index';
import sam3Module from '$nodes/sam3/ui/index';

const modules: ModuleManifest[] = [cameraModule, sam3Module];

/** Map from nodeType string to its manifest */
export const moduleRegistry = new Map<string, ModuleManifest>(
  modules.map(m => [m.nodeType, m])
);

/** SvelteFlow nodeTypes object built from all modules */
export const nodeTypes: NodeTypes = Object.fromEntries(
  modules.map(m => [m.nodeType, m.nodeComponent])
) as NodeTypes;

/** Union of all module transient keys (for stripping before save) */
export const TRANSIENT_KEYS = new Set<string>(
  modules.flatMap(m => m.transientKeys)
);

/** Catalog entries for the sidebar */
export const catalog = modules.map(m => ({
  type: m.nodeType,
  label: m.label,
  icon: m.icon,
  category: m.category,
}));

/** Get default data for a node type */
export function createDefaultData(nodeType: string, nodeId: number): Record<string, unknown> | null {
  const manifest = moduleRegistry.get(nodeType);
  if (!manifest) return null;
  return manifest.createDefaultData(nodeId);
}

/** Get the run panel component for a node type */
export function getRunPanel(nodeType: string) {
  return moduleRegistry.get(nodeType)?.runPanel ?? null;
}

export { modules };
