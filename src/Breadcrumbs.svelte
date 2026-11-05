<script lang="ts">
  import Icon from './Icon.svelte';

  type Crumb = { label: string; href: string };
  /** One parent link, or several from the top down (e.g. Places › Duchesne County). */
  export let parent: Crumb | Crumb[];
  export let current: string;
  export let navigate: (href: string) => void;

  $: trail = Array.isArray(parent) ? parent : [parent];

  function open(event: MouseEvent, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <ol>
    {#each trail as crumb (crumb.href)}<li><a href={crumb.href} onclick={(event) => open(event, crumb.href)}>{crumb.label}</a><Icon name="chevron_right" /></li>{/each}
    <li aria-current="page"><b>{current}</b></li>
  </ol>
</nav>
