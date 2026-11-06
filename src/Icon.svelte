<script lang="ts">
  /** Material Symbols ligature name; the self-hosted font is subset, see the @font-face note in app.css. */
  export let name: string;
</script>

{#if name === 'copy_content'}
  <!-- Inline outline keeps this icon available without changing the font subset. -->
  <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" /></svg>
{:else}
  <i class="icon" aria-hidden="true">{name}</i>
{/if}

<style>
  .copy-icon { display: inline-block; width: 1.25em; height: 1.25em; vertical-align: -.2em; }
</style>
