<script lang="ts">
  import { onMount } from 'svelte';
  import FilingOfficeHeader from './FilingOfficeHeader.svelte';
  import Icon from './Icon.svelte';
  import { anchoredPopover } from './lib/anchored-popover';
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
    const stages = new Set<string>();
    const otherStages = history.records.filter(row => {
      if (row.status === 'filed' || row.electionType === history.filing.electionType || stages.has(row.electionType)) return false;
      stages.add(row.electionType); return true;
    });
    Promise.all(otherStages.map(row => resultsForFiling(row).catch(() => undefined)))
      .then(items => { if (active) otherResults = items.filter((item): item is FilingResult => !!item); });
    return () => { active = false; };
  });
  let result: FilingResult | undefined;
  $: filing = history.filing;
  $: resultFilings = [...history.records]
    .sort((a, b) => ['presidential-primary', 'primary', 'general'].indexOf(a.electionType) - ['presidential-primary', 'primary', 'general'].indexOf(b.electionType))
    .filter((row, index, rows) => row.status !== 'filed' && hasFilingResults(row) && rows.findIndex(candidate => candidate.status !== 'filed' && hasFilingResults(candidate) && candidate.electionType === row.electionType) === index);
  $: sourcesId = `candidacy-sources-${filing.recordId}-${personId}`;
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
    {#if history.reviewId && history.records.length > 1}
      <button class="candidacy-sources" popovertarget={sourcesId}>{history.records.length} source records <Icon name="info" /></button>
      <div class="evidence-popover" id={sourcesId} popover="auto" use:anchoredPopover={sourcesId} aria-labelledby={`${sourcesId}-title`}>
        <header><strong id={`${sourcesId}-title`}>Sources for this candidacy</strong><button popovertarget={sourcesId} popovertargetaction="hide" aria-label="Close candidacy sources"><Icon name="close" /></button></header>
        <p>These records describe the same candidacy. County feeds are reporting sources; they do not establish residence or separate races. Original source records are retained.</p>
        <ul class="evidence-source-list">{#each history.records as row}<li><a href={row.source} target="_blank" rel="noreferrer">{row.officeName}{row.county ? ` · ${row.county} reporting feed` : ''}<span class="sr-only"> (opens in new tab)</span></a><br /><small>{row.sourceStatus}</small></li>{/each}</ul>
      </div>
    {/if}
  </div>
  {#if resultFilings.length}
    <div class="candidacy-results">
      {#each resultFilings as stage (stage.recordId)}
        <FilingResults filing={stage} {navigate} onresult={(next) => { if (stage.electionType === filing.electionType) result = next; }} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .filing-info{--timeline-marker-width:48px;--timeline-column-gap:var(--space-3);container-type:inline-size}
  .candidacy-results{min-width:0;display:grid;gap:var(--space-6)}
  .candidacy-results :global(.filing-results + .filing-results){padding-top:var(--space-5);border-top:1px solid var(--color-rule)}
  .timeline-heading{margin:var(--space-5) 0 0;padding-top:var(--space-5);border-top:1px solid var(--color-rule);font:700 var(--text-base)/1.4 var(--font-sans)}
  .candidacy-sources{display:inline-flex;align-items:center;gap:var(--space-1);margin-top:var(--space-4);padding:var(--space-1) 0;border:0;background:none;color:var(--color-blue-dark);font:600 var(--text-xs)/1.5 var(--font-sans);text-decoration:underline;text-underline-offset:3px}
  .evidence-source-list small{overflow-wrap:anywhere}
</style>
