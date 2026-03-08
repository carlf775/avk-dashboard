<script lang="ts">
  import SaveIcon from '@lucide/svelte/icons/save';
  import UndoIcon from '@lucide/svelte/icons/undo-2';
  import GitBranchIcon from '@lucide/svelte/icons/git-branch';
  import type { createProgramStore } from '$lib/stores/program.svelte';

  let {
    store,
    showVersionTree = $bindable(false),
  }: {
    store: ReturnType<typeof createProgramStore>;
    showVersionTree: boolean;
  } = $props();

  let editingName = $state(false);
  let nameInput = $state('');

  function startEdit() {
    nameInput = store.currentProgram?.name ?? '';
    editingName = true;
  }

  function commitName() {
    editingName = false;
    if (nameInput && nameInput !== store.currentProgram?.name) {
      store.updateProgramName(nameInput);
    }
  }

  const versionLabel = $derived(() => {
    if (!store.currentProgram) return '';
    const ver = store.versions.find((v) => v.id === store.currentVersionId);
    const label = ver?.label ?? 'unsaved';
    return store.isDirty ? `${label}*` : label;
  });
</script>

<header class="h-12 shrink-0 flex items-center justify-between border-b border-border bg-zinc-900 light:bg-white px-4">
  <div class="flex items-center gap-2">
    {#if store.currentProgram}
      {#if editingName}
        <input
          class="text-sm font-semibold bg-zinc-800 light:bg-zinc-100 border border-primary rounded-md text-foreground outline-none px-2 py-1 w-40"
          bind:value={nameInput}
          onblur={commitName}
          onkeydown={(e) => e.key === 'Enter' && commitName()}
          autofocus
        />
      {:else}
        <button
          class="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate max-w-48 bg-zinc-800 light:bg-zinc-100 rounded-md px-2 py-1"
          onclick={startEdit}
          title="Click to rename"
        >
          {store.currentProgram.name}
        </button>
      {/if}

      <button
        class="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md transition-colors
          {showVersionTree
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800 light:hover:bg-zinc-100'}"
        onclick={() => (showVersionTree = !showVersionTree)}
        title="Toggle version history"
      >
        <GitBranchIcon class="size-3.5" />
        {versionLabel()}
      </button>
    {:else}
      <span class="text-sm font-semibold text-muted-foreground">
        {store.isLoading ? 'Loading…' : store.error ? store.error : 'Flows'}
      </span>
    {/if}
  </div>

  {#if store.currentProgram}
    <div class="flex items-center gap-2">
      <button
        class="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors
          {!store.isDirty || store.isLoading
            ? 'text-zinc-600 cursor-not-allowed'
            : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800 light:hover:bg-zinc-100'}"
        onclick={() => store.cancelChanges()}
        disabled={!store.isDirty || store.isLoading}
        title="Discard changes"
      >
        <UndoIcon class="size-3.5" />
        Cancel
      </button>

      <button
        class="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors
          {!store.isDirty || store.isSaving
            ? 'text-zinc-600 cursor-not-allowed'
            : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800 light:hover:bg-zinc-100'}"
        onclick={() => store.save()}
        disabled={!store.isDirty || store.isSaving}
        title="Save version"
      >
        <SaveIcon class="size-3.5" />
        {store.isSaving ? 'Saving…' : 'Save'}
      </button>
    </div>
  {/if}
</header>
