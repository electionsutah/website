<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import SearchField from './SearchField.svelte';
  import Combobox from './Combobox.svelte';
  import { toggle, type Facet, type FacetKey, type Selection } from './lib/facets';
  import { formatCount } from './lib/format';

  export let facets: Facet[];
  export let selection: Selection;
  export let view: 'grid' | 'list';
  export let query = '';
  export let searchLabel: string;
  export let resultLabel: string;
  export let resultCount: number;
  export let resultSingular = 'record';
  export let resultPlural = 'records';
  export let onSelection: (selection: Selection) => void;
  export let onView: (view: 'grid' | 'list') => void;
  export let onQuery: (query: string) => void = () => {};

  const collapsedSize = 8;
  let panelOpen = false;
  let filterToggle: HTMLButtonElement;
  let expanded: Partial<Record<FacetKey, boolean>> = {};
  let transitionDuration = 220;

  $: active = facets.flatMap((facet) => facet.values.filter((value) => value.selected).map((value) => ({ key: facet.key, label: facet.label, value: value.value })));
  $: panelId = `filters-${searchLabel.replace(/\W+/g, '-').toLowerCase()}`;

  function closePanel() {
    panelOpen = false;
  }

  function openPanel() {
    transitionDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
    panelOpen = true;
  }

  function drawer(node: HTMLDialogElement) {
    // A nonmodal dialog lets wheel and touch scrolling reach the page outside the drawer.
    node.show();
    node.querySelector<HTMLButtonElement>('.filter-close')?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onEscape);
    return {
      destroy() {
        window.removeEventListener('keydown', onEscape);
        node.close();
        filterToggle?.focus();
      }
    };
  }
</script>

<div class="index-controls">
  <div class="index-tools">
    <SearchField value={query} label={searchLabel} {onQuery} />
    <div class="index-actions">
      <button class="filter-toggle" class:open={panelOpen} bind:this={filterToggle} aria-expanded={panelOpen} aria-controls={panelId} aria-haspopup="dialog" onclick={openPanel}>
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
    <dialog class="filter-overlay" id={panelId} aria-labelledby={`${panelId}-title`} use:drawer transition:fade={{ duration: transitionDuration }} onclick={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
    <div class="filter-panel" transition:fly={{ x: 480, duration: transitionDuration }}>
      <div class="filter-panel-header">
        <h2 id={`${panelId}-title`}>Filters{#if active.length}<span>{active.length} active</span>{/if}</h2>
        <button type="button" class="filter-close" aria-label="Close filters" title="Close filters" onclick={closePanel}><Icon name="close" /></button>
      </div>
      <div class="filter-panel-body">
      {#each facets as facet (facet.key)}
        {#if facet.key === 'county' || facet.key === 'city'}
          <div class="facet facet-combobox">
            <Combobox
              id={`${panelId}-${facet.key}`}
              label={facet.label}
              options={facet.values.filter((option) => !option.selected && option.count > 0).map((option) => ({ value: option.value, label: option.value, description: `${formatCount(option.count)} ${option.count === 1 ? resultSingular : resultPlural}` })).sort((a, b) => a.label.localeCompare(b.label))}
              placeholder={facet.key === 'county' ? 'Search counties…' : 'Search cities…'}
              itemLabel={facet.key}
              itemsLabel={facet.key === 'county' ? 'counties' : 'cities'}
              hint="Type to search. Select one or more."
              emptyMessage={`No matching ${facet.key === 'county' ? 'counties' : 'cities'} available.`}
              clearable={false}
              onSelect={(value) => { if (value) onSelection(toggle(selection, facet.key, value)); }}
            />
            {#if facet.values.some((option) => option.selected)}
              <div class="facet-values facet-selected" role="group" aria-label={`Selected ${facet.label.toLowerCase()} filters`}>
                {#each facet.values.filter((option) => option.selected) as option (option.value)}
                  <button class="facet-chip" aria-label={`Remove ${option.value} filter`} onclick={() => onSelection(toggle(selection, facet.key, option.value))}>
                    {option.value}<Icon name="close" />
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
        <fieldset class="facet">
          <legend>{facet.label}</legend>
          <div class="facet-values">
            {#each expanded[facet.key] ? facet.values : facet.values.slice(0, collapsedSize) as option (option.value)}
              <button class="facet-chip" aria-pressed={option.selected} disabled={!option.count && !option.selected} onclick={() => onSelection(toggle(selection, facet.key, option.value))}>
                {option.value}<span><span class="sr-only">, </span>{formatCount(option.count)}<span class="sr-only"> {option.count === 1 ? resultSingular : resultPlural}</span></span>
              </button>
            {/each}
            {#if facet.values.length > collapsedSize}
              <button class="facet-more" aria-expanded={Boolean(expanded[facet.key])} onclick={() => expanded = { ...expanded, [facet.key]: !expanded[facet.key] }}>
                {expanded[facet.key] ? 'Show fewer' : `Show ${facet.values.length - collapsedSize} more`}<Icon name="expand_more" />
              </button>
            {/if}
          </div>
        </fieldset>
        {/if}
      {:else}
        <p class="facet-empty">No filters apply to these records.</p>
      {/each}
      </div>
      <div class="filter-panel-footer">
        <button class="filter-reset" disabled={!active.length} onclick={() => onSelection({})}>Clear all</button>
        <button class="filter-done" onclick={closePanel}>Show {formatCount(resultCount)} {resultCount === 1 ? 'result' : 'results'}</button>
      </div>
    </div>
    </dialog>
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
