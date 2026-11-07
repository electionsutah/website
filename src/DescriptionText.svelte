<script lang="ts">
  import { descriptionLinks } from './lib/description-links';
  export let text: string;
  export let self = '';
  export let navigate: (href: string) => void;
  function open(event: MouseEvent, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
</script>

{#each descriptionLinks(text, self) as part}{#if part.href}<a href={part.href} onclick={(event) => open(event, part.href!)}>{part.text}</a>{:else}{part.text}{/if}{/each}
