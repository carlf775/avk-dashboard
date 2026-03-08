<script lang="ts">
  import { Handle, type NodeProps, Position } from '@xyflow/svelte';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  let { data }: NodeProps = $props();

  const nodeData = $derived(data as {
    label: string;
    created_at: string;
    isHead: boolean;
    onRestore: (() => void) | null;
    onDelete: (() => void) | null;
  });

  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group rounded-lg min-w-[120px] px-3 py-2 text-center shadow-md transition-colors relative
    {nodeData.isHead
      ? 'bg-primary/20 border-2 border-primary'
      : 'bg-zinc-800 border border-zinc-600 cursor-pointer hover:border-primary/60 hover:bg-zinc-700'}"
  onclick={() => nodeData.onRestore?.()}
>
  <Handle type="target" position={Position.Top} class="!bg-zinc-500 !w-2 !h-2" />

  <div class="text-sm font-bold text-foreground">{nodeData.label}</div>
  <div class="text-[10px] text-muted-foreground mt-0.5">{formatTime(nodeData.created_at)}</div>

  {#if nodeData.onDelete}
    <button
      class="absolute -top-2 -right-2 size-6 rounded-full bg-zinc-700 border border-zinc-500 flex items-center justify-center
        text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-zinc-600 transition-colors"
      onclick={(e) => { e.stopPropagation(); nodeData.onDelete?.(); }}
      title="Delete version"
    >
      <Trash2Icon class="size-3" />
    </button>
  {/if}

  <Handle type="source" position={Position.Bottom} class="!bg-zinc-500 !w-2 !h-2" />
</div>
