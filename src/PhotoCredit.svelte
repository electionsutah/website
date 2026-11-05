<script lang="ts">
  /** Wikimedia Commons credit for a place photo (see scripts/fetch-place-images.py). */
  export let image: { title: string; artist: string; license: string; licenseUrl: string; sourceUrl: string; via?: string };
  /** "Photo" over a hero image; "Emblem" for a seal, logo, or flag credited in the page body. */
  export let label = 'Photo';
  export let className = 'place-photo-credit';
</script>

<p class={className}>{label}: <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.title}<span class="sr-only"> (opens in new tab)</span></a> by {image.artist}, {#if image.licenseUrl}<a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license}<span class="sr-only"> (opens in new tab)</span></a>{:else}{image.license}{/if}, via {image.via ?? 'Wikimedia Commons'}.</p>
