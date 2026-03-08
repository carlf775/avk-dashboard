export interface ModuleInfo {
  id: string;
  node_type: string;
  enabled: boolean;
}

export function createModulesStore() {
  let modules = $state<ModuleInfo[]>([]);
  let loaded = $state(false);

  function handleMessage(msg: { type: string; modules?: ModuleInfo[] }) {
    if (msg.type === 'modules' && msg.modules) {
      modules = msg.modules;
      loaded = true;
    }
  }

  function isEnabled(nodeType: string): boolean {
    const m = modules.find(mod => mod.node_type === nodeType);
    return m?.enabled ?? true;
  }

  return {
    get modules() { return modules; },
    get loaded() { return loaded; },
    handleMessage,
    isEnabled,
  };
}
