<script lang="ts">
  /** Material Symbols ligature name; the self-hosted font is subset, see the @font-face note in app.css. */
  export let name: string;
</script>

{#if name === 'copy_content'}
  <!-- Inline outline keeps this icon available without changing the font subset. -->
  <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" /></svg>
{:else if name === 'flag'}
  <svg class="flag-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m14 6-1-2H4v17h2v-7h5l1 2h7V6h-5Zm3 8h-3.76l-1-2H6V6h5.76l1 2H17v6Z" /></svg>
{:else if name === 'info'}
  <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" /></svg>
{:else if name === 'verified'}
  <svg class="verified-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m23 12-2.44-2.79.34-3.69-3.61-.82L15.4 1.5 12 2.96 8.6 1.5 6.71 4.69 3.1 5.51l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12Zm-12.91 4.72L5.85 12.5l1.41-1.41 2.83 2.83 6.65-6.65 1.41 1.41-8.06 8.04Z" /></svg>
{:else}
  <i class="icon" aria-hidden="true">{name}</i>
{/if}

<style>
  .flag-icon { display: inline-block; width: 1.25em; height: 1.25em; flex: none; vertical-align: -.2em; }
  .info-icon { display: block; width: 1.25em; height: 1.25em; flex: none; }
  .verified-icon { display: inline-block; width: 1.25em; height: 1.25em; flex: none; }
  .copy-icon { display: inline-block; width: 1.25em; height: 1.25em; vertical-align: -.2em; }
</style>
