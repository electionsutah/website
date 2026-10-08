<script lang="ts">
  import Icon from './Icon.svelte';

  export let parent: { label: string; href: string };
  export let current: string;
  export let navigate: (href: string) => void;

  function open(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(parent.href);
  }
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <ol>
    <li><a href={parent.href} onclick={open}>{parent.label}</a><Icon name="chevron_right" /></li>
    <li aria-current="page"><b>{current}</b></li>
  </ol>
</nav>
