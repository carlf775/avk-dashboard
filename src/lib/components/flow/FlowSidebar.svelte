<script lang="ts">
  import { catalog } from '$lib/modules/registry';

  let { isModuleEnabled = (_type: string) => true }: { isModuleEnabled?: (type: string) => boolean } = $props();

  const enabledCatalog = $derived(catalog.filter(c => isModuleEnabled(c.type)));

  function ondragstart(event: DragEvent, nodeType: string) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('application/svelteflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }
</script>

<div class="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-zinc-900 light:bg-white pt-2">
  {#each enabledCatalog as entry (entry.type)}
    <button
      class="group relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      draggable="true"
      ondragstart={(e) => ondragstart(e, entry.type)}
      title={entry.label}
    >
      <entry.icon class="size-5" strokeWidth={1.25} />
      <span
        class="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100"
      >
        {entry.label}
      </span>
    </button>
  {/each}
</div>
