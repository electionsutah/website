<script lang="ts">
  import Breadcrumbs from './Breadcrumbs.svelte';
  import Icon from './Icon.svelte';
  import IndexControls from './IndexControls.svelte';
  import EntityViews from './EntityViews.svelte';
  import SortHeader from './SortHeader.svelte';
  import { elections, electionsByYear, type ElectionCycle } from './lib/entities';
  import { formatCount } from './lib/format';
  import { matchesQuery, queryTokens, searchText } from './lib/search';
  import { buildFacets, isActive, matchingFilings, nextSort, persistState, restoreState, sortRows, type Selection, type Sort } from './lib/facets';

  export let id = '';
  export let navigate: (href: string) => void;

  let indexQuery = '';
  let selection: Selection = {};
  let view: 'grid' | 'list' = 'list';
  let sort: Sort | null = null;

  // List-view columns; keys appear in the URL as ?sort=.
  const tableColumns = [
    { key: 'year', label: 'Year' },
    { key: 'election', label: 'Election' },
    { key: 'coverage', label: 'Coverage' },
    { key: 'filings', label: 'Filings' }
  ];
  let indexLoaded = false;

  $: tableCaption = `Election years${sort ? `, sorted by ${tableColumns.find((column) => column.key === sort?.key)?.label ?? sort.key} ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`;

  $: numericYear = /^\d{4}$/.test(id) ? Number(id) : 0;
  $: election = numericYear ? electionsByYear.get(numericYear) : undefined;
  $: found = !id || Boolean(election);
  $: officeCount = election ? new Set(election.filings.map((filing) => filing.officeId)).size : 0;
  $: partyCount = election ? new Set(election.filings.map((filing) => filing.partyId)).size : 0;

  // Restore filters and layout from the URL whenever the index is (re)entered.
  $: if (id) indexLoaded = false;
  $: if (!id && !indexLoaded) {
    indexLoaded = true;
    const state = restoreState('elections', elections, tableColumns.map((column) => column.key));
    selection = state.selection;
    indexQuery = state.query;
    view = state.view;
    sort = state.sort;
  }

  $: searchedCycles = elections.filter((cycle) => matchesQuery(searchText.elections(cycle), queryTokens(indexQuery)));
  $: filtering = isActive(selection);
  $: matchedCycles = searchedCycles
    .map((cycle) => ({ ...cycle, matching: matchingFilings(cycle.filings, selection) }))
    .filter((cycle) => !filtering || cycle.matching.length);
  $: facets = buildFacets(searchedCycles, selection);
  $: sortedCycles = sortRows(matchedCycles, sort, sortValue, (cycle) => String(cycle.year));

  function sortValue(cycle: (typeof matchedCycles)[number], key: string): string | number {
    if (key === 'year') return cycle.year;
    if (key === 'election') return cycle.title;
    if (key === 'coverage') return coverage(cycle);
    return cycle.matching.length;
  }

  function updateSort(key: string) {
    sort = nextSort(sort, key);
    persistState('elections', { selection, view, query: indexQuery, sort });
  }

  function coverage(cycle: ElectionCycle) {
    return cycle.availability === 'special' ? 'Special election' : cycle.availability === 'local' ? 'Local cycle' : 'Statewide cycle';
  }

  function filingCount(cycle: ElectionCycle & { matching: unknown[] }) {
    const total = `${formatCount(cycle.filings.length)} filing${cycle.filings.length === 1 ? '' : 's'}`;
    return filtering ? `${formatCount(cycle.matching.length)} of ${total}` : total;
  }

  function updateSelection(next: Selection) {
    selection = next;
    persistState('elections', { selection, view, query: indexQuery, sort });
  }

  function updateView(next: 'grid' | 'list') {
    view = next;
    persistState('elections', { selection, view, query: indexQuery, sort });
  }

  function updateQuery(next: string) {
    indexQuery = next;
    persistState('elections', { selection, view, query: indexQuery, sort });
  }

  function open(event: MouseEvent, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
</script>

<svelte:head><title>{election?.title ?? (found ? 'Election years' : 'Election year not found')} — Elections Utah</title></svelte:head>

{#if !found}
  <section class="entity-not-found">
    <p class="eyebrow">404</p>
    <h1>That election year isn’t here.</h1>
    <p>Election-year pages cover 2017 through 2026.</p>
    <a href="/elections/" onclick={(event) => open(event, '/elections/')}>Browse election years <Icon name="arrow_forward" /></a>
  </section>
{:else if election}
  <article class="entity-detail election-detail">
    <Breadcrumbs parent={{ label: 'Election years', href: '/elections/' }} current={String(election.year)} {navigate} />
    <header class="detail-hero compact-hero election-hero">
      <div>
        <p class="eyebrow">{election.availability === 'special' ? 'Special election' : election.availability === 'local' ? 'Locally administered cycle' : 'Statewide archive'}</p>
        <h1>{election.year}</h1>
        <p class="detail-summary">{election.description}</p>
        <a class="source-link" href={election.source} target="_blank" rel="noreferrer">{election.sourceLabel} <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>
      </div>
    </header>
    <section class="detail-stats">
      <div><small>FILINGS</small><strong>{formatCount(election.filings.length)}</strong></div>
      <div><small>OFFICES</small><strong>{officeCount}</strong></div>
      <div><small>AFFILIATIONS</small><strong>{partyCount}</strong></div>
    </section>
    <section class="record-section">
      <div class="record-heading"><p class="eyebrow">Cycle records</p><h2>Candidates</h2></div>
      {#if election.filings.length}
        {#key election.year}<EntityViews section="people" scope={election.filings} embedded stateId="election-people" {navigate} />{/key}
      {:else}
        <div class="empty-slate cycle-empty"><strong>No statewide candidate table published</strong><p>{election.description} Follow the official source above for the records Utah does make available for this cycle.</p></div>
      {/if}
    </section>
  </article>
{:else}
  <section class="entity-index election-index">
    <header><div><p class="eyebrow">2017–2026 archive</p><h1>Election years</h1></div><p>Browse every cycle in the archive. Statewide records are included where Utah published a candidate table, workbook, pamphlet, or canvass; locally administered cycles are clearly identified.</p></header>
    <IndexControls
      {facets}
      {selection}
      {view}
      query={indexQuery}
      searchLabel="Search election years"
      resultLabel={`${matchedCycles.length} of ${elections.length} election years`}
      resultCount={matchedCycles.length}
      onSelection={updateSelection}
      onView={updateView}
      onQuery={updateQuery}
    />
    {#if view === 'list'}
      <div class="entity-table-wrap">
        <table class="entity-table">
          <caption class="sr-only">{tableCaption}</caption>
          <thead><tr>{#each tableColumns as column (column.key)}<SortHeader key={column.key} label={column.label} {sort} numeric={column.key === 'filings'} onSort={updateSort} />{/each}</tr></thead>
          <tbody>
            {#each sortedCycles as cycle (cycle.year)}
              <tr>
                <th scope="row"><a href={`/elections/${cycle.year}/`} onclick={(event) => open(event, `/elections/${cycle.year}/`)}><span>{cycle.year}</span></a></th>
                <td data-label="Election">{cycle.title}</td>
                <td data-label="Coverage">{coverage(cycle)}</td>
                <td data-label="Filings" class="numeric">{filingCount(cycle)}</td>
              </tr>
            {:else}
              <tr><td class="no-records" colspan="4">No matching election years.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="entity-grid election-grid">
        {#each sortedCycles as cycle (cycle.year)}
          <article class="entity-card election-card">
            <a class="card-record-link" href={`/elections/${cycle.year}/`} onclick={(event) => open(event, `/elections/${cycle.year}/`)}>
              <small>{coverage(cycle)}</small>
              <h2>{cycle.year}</h2>
              <p>{cycle.title}</p>
              <div class="card-footer"><span>{filingCount(cycle)}</span><b>View year <Icon name="arrow_forward" /></b></div>
            </a>
          </article>
        {:else}
          <p class="no-records">No matching election years.</p>
        {/each}
      </div>
    {/if}
  </section>
{/if}
