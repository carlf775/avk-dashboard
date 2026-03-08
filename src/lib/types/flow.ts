import type { Component } from 'svelte';

// Re-export module-specific types from their respective modules
export type { CameraNodeData, DiscoveredCamera } from '$nodes/camera/ui/types';
export type {
  Sam3State, Sam3Point, Sam3Mask, AnnotationLabel, Sam3Annotation,
  Sam3NodeData, Sam3Detection, Sam3Prediction,
} from '$nodes/sam3/ui/types';

export type FlowNodeType = string;

export interface NodeCatalogEntry {
  type: string;
  label: string;
  icon: Component;
  category: string;
}
