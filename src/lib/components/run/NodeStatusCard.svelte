<script lang="ts">
  import CameraIcon from '@lucide/svelte/icons/camera';
  import BrainIcon from '@lucide/svelte/icons/brain';
  import type { PipelineNodeStatus } from '$lib/stores/pipeline.svelte';

  let { node }: { node: PipelineNodeStatus } = $props();

  const isActive = $derived(node.status === 'ticking' || node.status === 'inferring');
  const isSam3 = $derived(node.node_type === 'sam3_ad');

  const formattedFrameCount = $derived(node.frame_count.toLocaleString());
  const formattedImageCount = $derived((node.image_count ?? 0).toLocaleString());

  const formattedTime = $derived(() => {
    if (!node.last_frame_time) return '--';
    const date = new Date(node.last_frame_time * 1000);
    return date.toLocaleTimeString('en-US', { hour12: false });
  });
</script>

<div class="rounded-lg border border-border bg-zinc-900 p-4 min-w-[180px]">
  <div class="flex items-center gap-2 mb-3">
    {#if isSam3}
      <BrainIcon class="size-4 text-violet-400" />
    {:else}
      <CameraIcon class="size-4 text-muted-foreground" />
    {/if}
    <span class="text-sm font-medium text-foreground truncate">{node.label}</span>
  </div>

  <div class="flex items-center gap-1.5 mb-2">
    <span class="size-2 rounded-full {isActive ? 'bg-green-500' : 'bg-zinc-600'}"></span>
    <span class="text-xs text-muted-foreground">{node.status}</span>
  </div>

  <div class="text-xs text-muted-foreground space-y-1">
    <div>Frames: <span class="text-foreground font-mono">{formattedFrameCount}</span></div>
    {#if isSam3 && (node.image_count ?? 0) > 0}
      <div>Collected: <span class="text-blue-400 font-mono">{formattedImageCount} images</span></div>
    {/if}
    {#if node.score != null}
      <div>Score: <span class="font-mono {node.is_anomalous ? 'text-red-400' : 'text-green-400'}">{(node.score * 100).toFixed(0)}%</span></div>
    {/if}
    {#if node.has_frame}
      <div class="text-green-400">Live</div>
    {/if}
    <div class="font-mono text-foreground">{formattedTime()}</div>
  </div>
</div>
