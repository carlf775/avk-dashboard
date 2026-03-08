<script lang="ts">
  import './app.css';
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import AppSidebar from '$lib/components/AppSidebar.svelte';
  import FlowCanvas from '$lib/components/flow/FlowCanvas.svelte';
  import FlowToolbar from '$lib/components/flow/FlowToolbar.svelte';
  import VersionTreePanel from '$lib/components/flow/VersionTreePanel.svelte';
  import RunTab from '$lib/components/run/RunTab.svelte';
  import AnalyticsTab from '$lib/components/analytics/AnalyticsTab.svelte';
  import DatasetTab from '$lib/components/analytics/DatasetTab.svelte';
  import { createProgramStore } from '$lib/stores/program.svelte';
  import { createModulesStore } from '$lib/stores/modules.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';

  const store = createProgramStore();
  const modulesStore = createModulesStore();
  let showVersionTree = $state(false);
  let activeTab = $state<'editor' | 'run' | 'analytics' | 'dataset'>('editor');

  onMount(async () => {
    try {
      await store.fetchPrograms();
      if (store.programs.length > 0) {
        await store.loadProgram(store.programs[0].id);
      } else {
        const id = await store.createProgram('Untitled Program');
        await store.loadProgram(id);
      }
    } catch {
      // Error already captured in store.error
    }
  });
</script>

<div class="h-screen flex bg-background overflow-hidden print:h-auto print:overflow-visible {themeStore.theme === 'light' ? 'light' : ''}">
  <div class="print:hidden contents">
    <AppSidebar bind:activeTab />
  </div>

  <div class="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:block">
    {#if activeTab === 'editor'}
      <div class="print:hidden contents">
        <FlowToolbar {store} bind:showVersionTree />
      </div>
      <div class="flex-1 flex min-h-0 overflow-hidden print:hidden">
        <div class="flex-1 relative min-h-0">
          <SvelteFlowProvider>
            <FlowCanvas {store} isModuleEnabled={modulesStore.isEnabled} />
          </SvelteFlowProvider>
        </div>
      </div>
    {:else if activeTab === 'run'}
      <div class="print:hidden contents">
        <RunTab {store} {modulesStore} />
      </div>
    {:else if activeTab === 'analytics'}
      <AnalyticsTab />
    {:else}
      <DatasetTab />
    {/if}
  </div>
</div>

{#if showVersionTree}
  <VersionTreePanel {store} onclose={() => (showVersionTree = false)} />
{/if}
