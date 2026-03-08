import type { Component } from 'svelte';

export interface ModuleManifest {
  nodeType: string;
  label: string;
  icon: Component;
  category: string;
  nodeComponent: Component;
  runPanel?: Component;
  transientKeys: string[];
  createDefaultData: (nodeId: number) => Record<string, unknown>;
  modals?: ModalDefinition[];
}

export interface ModalDefinition {
  name: string;
  component: Component;
}
