<script lang="ts">
  import Icon from './Icon.svelte';
  import { toggle, type Facet, type FacetKey, type Selection } from './lib/facets';
  import { formatCount } from './lib/format';

  export let facets: Facet[];
  export let selection: Selection;
  export let view: 'grid' | 'list';
  export let query = '';
  export let searchLabel: string;
  export let resultLabel: string;
  export let resultCount: number;
  export let onSelection: (selection: Selection) => void;
  export let onView: (view: 'grid' | 'list') => void;
  export let onQuery: (query: string) => void = () => {};

  const collapsedSize = 8;
  let panelOpen = false;
  let filterToggle: HTMLButtonElement;
  let expanded: Partial<Record<FacetKey, boolean>> = {};

  $: active = facets.flatMap((facet) => facet.values.filter((value) => value.selected).map((value) => ({ key: facet.key, label: facet.label, value: value.value })));
  $: panelId = `filters-${searchLabel.replace(/\W+/g, '-').toLowerCase()}`;
</script>

<div class="index-controls">
  <div class="index-tools">
    <label><span><Icon name="search" /></span><input value={query} oninput={(event) => onQuery(event.currentTarget.value)} placeholder={`${searchLabel}…`} aria-label={searchLabel} /></label>
    <div class="index-actions">
      <button class="filter-toggle" class:open={panelOpen} bind:this={filterToggle} aria-expanded={panelOpen} aria-controls={panelId} onclick={() => panelOpen = !panelOpen}>
        <Icon name="filter_list" /> Filters{#if active.length}<b>{active.length}</b>{/if}
      </button>
      <div class="view-toggle" role="group" aria-label="Layout">
        <button aria-pressed={view === 'grid'} aria-label="Tile view" title="Tile view" onclick={() => onView('grid')}><Icon name="grid_view" /></button>
        <button aria-pressed={view === 'list'} aria-label="List view" title="List view" onclick={() => onView('list')}><Icon name="view_list" /></button>
      </div>
      <strong role="status">{resultLabel}</strong>
    </div>
  </div>

  {#if panelOpen}
    <div class="filter-panel" id={panelId}>
      {#each facets as facet (facet.key)}
        <fieldset class="facet">
          <legend>{facet.label}<small>{facet.schemaField}</small></legend>
          <div class="facet-values">
            {#each expanded[facet.key] ? facet.values : facet.values.slice(0, collapsedSize) as option (option.value)}
              <button class="facet-chip" aria-pressed={option.selected} disabled={!option.count && !option.selected} onclick={() => onSelection(toggle(selection, facet.key, option.value))}>
                {option.value}<span><span class="sr-only">, </span>{formatCount(option.count)}<span class="sr-only"> {option.count === 1 ? 'record' : 'records'}</span></span>
              </button>
            {/each}
            {#if facet.values.length > collapsedSize}
              <button class="facet-more" aria-expanded={Boolean(expanded[facet.key])} onclick={() => expanded = { ...expanded, [facet.key]: !expanded[facet.key] }}>
                {expanded[facet.key] ? 'Show fewer' : `Show ${facet.values.length - collapsedSize} more`}<Icon name="expand_more" />
              </button>
            {/if}
          </div>
        </fieldset>
      {:else}
        <p class="facet-empty">No filters apply to these records.</p>
      {/each}
      <!-- On narrow screens the panel is taller than the viewport; this closes it to reveal the results. -->
      <button class="filter-done" onclick={() => { panelOpen = false; filterToggle.focus(); }}>Show {formatCount(resultCount)} {resultCount === 1 ? 'result' : 'results'}</button>
    </div>
  {/if}

  {#if active.length}
    <div class="active-filters" role="group" aria-label="Active filters">
      {#each active as item (`${item.key}:${item.value}`)}
        <button onclick={() => onSelection(toggle(selection, item.key, item.value))}>
          <span class="sr-only">Remove filter </span><small>{item.label}<span class="sr-only">:</span></small> {item.value}<Icon name="close" />
        </button>
      {/each}
      <button class="clear-filters" onclick={() => onSelection({})}>Clear all</button>
    </div>
  {/if}
</div>
