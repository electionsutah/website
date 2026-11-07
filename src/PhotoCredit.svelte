<script lang="ts">
  export let image: { title: string; artist: string; license: string; licenseUrl: string; sourceUrl: string; via?: string };
  export let label = 'Photo';
  export let className = 'place-photo-credit';
  $: via = image.via ?? (image.sourceUrl.includes('commons.wikimedia.org') ? 'Wikimedia Commons' : '');
</script>

{#if image.title || image.artist || image.license || image.sourceUrl}
  <p class={className}>{label}: {#if image.sourceUrl}<a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.title || 'Image source'}<span class="sr-only"> (opens in new tab)</span></a>{:else}{image.title}{/if}{#if image.artist} by {image.artist}{/if}{#if image.license}, {#if image.licenseUrl}<a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license}<span class="sr-only"> (opens in new tab)</span></a>{:else}{image.license}{/if}{/if}{#if via}, via {via}{/if}.</p>
{/if}
