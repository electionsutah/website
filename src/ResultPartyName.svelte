<script lang="ts">
  import { resultPartyHref } from './lib/result-links';
  export let name: string;
  export let fallback = 'Ballot response';
  $: href = resultPartyHref(name);
</script>

{#if href}<a class="result-party-link" {href}>{name}</a>{:else}{name || fallback}{/if}
