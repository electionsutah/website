<script lang="ts">
  import IndexControls from './IndexControls.svelte';
  import CandidacyCard from './CandidacyCard.svelte';
  import { type Filing } from './lib/entities';
  import { candidacyHistory } from './lib/candidacy-history';
  import { buildFacets, matchingFilings, type Selection } from './lib/facets';
  import { matchesQuery, queryTokens } from './lib/search';
  import { formatCount } from './lib/format';

  export let filings: Filing[];
  export let personId: string;
  export let navigate: (href: string) => void;
  let query = '';
  let selection: Selection = {};
  let view: 'grid' | 'list' = 'grid';
  $: histories = candidacyHistory(filings);
  $: entries = histories.map(history => ({ history, filings: history.records,
    text: history.records.map(row => `${row.name} ${row.year} ${row.officeName} ${row.partyName} ${row.sourceStatus} ${row.city} ${row.county}`).join(' ') }));
  $: searched = entries.filter(entry => matchesQuery(entry.text, queryTokens(query)));
  $: facets = buildFacets(searched, selection, ['year', 'electionType', 'section', 'party', 'status', 'county', 'city']);
  // Match source records, but keep each consolidated timeline intact in the displayed card.
  $: shown = searched.filter(entry => matchingFilings(entry.filings, selection).length);
</script>

<div class="candidacy-history-list">
  <IndexControls {facets} {selection} {view} {query} searchLabel="Search candidacies"
    resultLabel={`${formatCount(shown.length)} of ${formatCount(histories.length)} candidacies`} resultCount={shown.length}
    resultSingular="candidacy" resultPlural="candidacies"
    onSelection={(next) => selection = next} onView={(next) => view = next} onQuery={(next) => query = next} />
  <div class="filing-list" class:stacked={view === 'list'}>
    {#each shown as { history } (history.filing.recordId)}
      <CandidacyCard {history} {navigate} {personId} />
    {:else}
      <p class="no-records" role="status">No candidacies match these filters.</p>
    {/each}
  </div>
</div>

<style>
  .filing-list.stacked { grid-template-columns: minmax(0, 1fr); }
  .no-records { grid-column: 1 / -1; }
</style>
