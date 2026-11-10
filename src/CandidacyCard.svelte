<script lang="ts">
  import { onMount } from 'svelte';
  import FilingOfficeHeader from './FilingOfficeHeader.svelte';
  import type { CandidacyHistory, FilingResult } from './lib/candidacy-history';
  import FilingResults from './FilingResults.svelte';
  import CandidacyTimeline from './CandidacyTimeline.svelte';
  import { hasFilingResults, resultsForFiling } from './lib/filing-results';
  export let history: CandidacyHistory;
  export let navigate: (href: string) => void;
  export let personId = history.filing.personId;
  let otherResults: FilingResult[] = [];
  onMount(() => {
    let active = true;
    Promise.all(history.records.filter(row => row.recordId !== history.filing.recordId && row.status !== 'filed').map(row => resultsForFiling(row).catch(() => undefined)))
      .then(items => { if (active) otherResults = items.filter((item): item is FilingResult => !!item); });
    return () => { active = false; };
  });
  let result: FilingResult | undefined;
  $: filing = history.filing;
  function open(event: MouseEvent, href: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();navigate(href);
  }
</script>

<div class="filing-card">
  <div class="filing-info">
    <FilingOfficeHeader {filing} {personId} {navigate} />

    <h4 class="timeline-heading">Candidate Timeline</h4>
    <CandidacyTimeline {history} {result} {otherResults} {navigate} />
  </div>
  {#if hasFilingResults(filing)}<FilingResults {filing} {navigate} onresult={(next) => result = next} />{/if}
</div>

<style>
  .filing-info{--timeline-marker-width:48px;--timeline-column-gap:var(--space-3);container-type:inline-size}
  .timeline-heading{margin:var(--space-5) 0 0;padding-top:var(--space-5);border-top:1px solid var(--color-rule);font:700 var(--text-base)/1.4 var(--font-sans)}
</style>
