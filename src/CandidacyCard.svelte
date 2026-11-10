<script lang="ts">
  import { onMount } from 'svelte';
  import { partiesById, sectionLabel, runningMateRole } from './lib/entities';
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
    <div class="filing-heading">
      <div class="filing-cycle"><a class="filing-year" href={`/elections/${filing.year}/`} onclick={(event) => open(event, `/elections/${filing.year}/`)} aria-label={`${filing.year} election`}><time datetime={String(filing.year)}>{filing.year}</time></a><small>{sectionLabel(filing.section)}{#if filing.runningMateId === personId}{' · '}{runningMateRole(filing)} candidate{/if}</small></div>
      <h3><a href={`/offices/${filing.officeId}/`} onclick={(event) => open(event, `/offices/${filing.officeId}/`)}>{filing.officeName}</a></h3>
    <dl><div class="party-row"><dt>Party</dt><dd><a class="filing-party-link" href={`/parties/${filing.partyId}/`} onclick={(event) => open(event, `/parties/${filing.partyId}/`)}>{#if partiesById.get(filing.partyId)?.logo}<span class="filing-party-logo" class:inverse-logo={filing.partyId === 'utah-republican-party'} style:--party-color={partiesById.get(filing.partyId)?.color}><img src={partiesById.get(filing.partyId)?.logo} alt="" loading="lazy" decoding="async" /></span>{/if}<span>{filing.partyName}</span></a></dd></div>{#if filing.runningMate}<div><dt>Running mate</dt><dd><a href={`/people/${filing.runningMateId === personId ? filing.personId : filing.runningMateId}/`} onclick={(event) => open(event, `/people/${filing.runningMateId === personId ? filing.personId : filing.runningMateId}/`)}>{filing.runningMateId === personId ? filing.name : filing.runningMate}</a></dd></div>{/if}</dl>
    </div>

    <h4 class="timeline-heading">Candidate Timeline</h4>
    <CandidacyTimeline {history} {result} {otherResults} {navigate} />
  </div>
  {#if hasFilingResults(filing)}<FilingResults {filing} {navigate} onresult={(next) => result = next} />{/if}
</div>

<style>
  .filing-info{--timeline-marker-width:48px;--timeline-column-gap:var(--space-3)}
  .filing-card .filing-info dl>.party-row{grid-template-columns:var(--timeline-marker-width) minmax(0,1fr);gap:var(--timeline-column-gap);align-items:center;border-top:0;padding-top:0}
  .filing-card .filing-heading h3{margin-bottom:var(--space-2)}
  .party-row dt{font-weight:700;color:var(--color-ink)}
  .timeline-heading{margin:var(--space-5) 0 0;padding-top:var(--space-5);border-top:1px solid var(--color-rule);font:700 var(--text-base)/1.4 var(--font-sans)}
</style>
