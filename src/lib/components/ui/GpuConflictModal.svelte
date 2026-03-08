<script lang="ts">
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
  import Button from '$lib/components/ui/button/button.svelte';

  let {
    holder,
    action,
    onpause,
    oncancel,
  }: {
    holder: string;
    action: string;
    onpause: () => void;
    oncancel: () => void;
  } = $props();

  const holderLabels: Record<string, string> = {
    pipeline: 'Production pipeline',
    annotation: 'Annotation (SAM3)',
    training: 'Training',
  };

  let pausing = $state(false);

  async function handlePause() {
    pausing = true;
    onpause();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
  onkeydown={(e) => e.key === 'Escape' && oncancel()}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-full max-w-md bg-zinc-900 border border-border rounded-xl shadow-2xl p-6 flex flex-col gap-4"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="flex items-center gap-3">
      <div class="size-10 rounded-full bg-amber-500/10 flex items-center justify-center">
        <AlertTriangleIcon class="size-5 text-amber-400" />
      </div>
      <div>
        <h3 class="text-sm font-semibold text-foreground">GPU in use</h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          {holderLabels[holder] ?? holder} is currently using the GPU.
        </p>
      </div>
    </div>

    <p class="text-sm text-zinc-300">
      Pause production to {action}?
    </p>

    <div class="flex items-center justify-end gap-2 mt-2">
      <Button
        variant="outline"
        size="sm"
        class="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
        onclick={oncancel}
      >
        Cancel
      </Button>
      {#if holder === 'pipeline'}
        <Button
          size="sm"
          onclick={handlePause}
          disabled={pausing}
        >
          {#if pausing}
            Pausing...
          {:else}
            Pause & Continue
          {/if}
        </Button>
      {/if}
    </div>
  </div>
</div>
