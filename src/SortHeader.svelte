<script lang="ts">
  import Icon from './Icon.svelte';
  import type { Sort } from './lib/facets';

  export let key: string;
  export let label: string;
  export let sort: Sort | null;
  export let numeric = false;
  export let onSort: (key: string) => void;

  $: active = sort?.key === key;
  $: direction = active ? sort!.direction : null;
</script>

<th scope="col" class:numeric aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
  <button class="sort-button" class:active onclick={() => onSort(key)} title={active && direction === 'asc' ? `Sort ${label} Z–A` : `Sort ${label} A–Z`}>
    {label}<Icon name={direction === 'asc' ? 'arrow_upward' : direction === 'desc' ? 'arrow_downward' : 'unfold_more'} />
  </button>
</th>
