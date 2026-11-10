<script lang="ts">
  import { onMount } from 'svelte';
  import TimelineDate from './TimelineDate.svelte';
  import CountUp from './CountUp.svelte';
  import { revealVoteBar } from './lib/vote-animation';
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;
  import { identityKey, type Filing } from './lib/entities';
  import { resultsForFiling } from './lib/filing-results';
  import type { FilingResult } from './lib/candidacy-history';
  import { resultPerson, personHref } from './lib/result-people';
  import { resultPartyHref } from './lib/result-links';
  import { color, count, updated, type Snapshot, type Contest } from './lib/results';

  export let filing: Filing;
  export let navigate: (href: string) => void;
  export let onresult: ((result: FilingResult) => void) | undefined = undefined;
  function openCandidate(event: MouseEvent, href: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
  let snapshot: Snapshot | null = null;
  let failed = false;
  let contest: Contest | undefined;
  onMount(() => {
    let active = true;
    resultsForFiling(filing).then(result => { if (active && result) { snapshot = result.snapshot; contest = result.contest; onresult?.(result); } })
      .catch(() => { if (active) failed = true; });
    return () => { active = false; };
  });

</script>

{#if contest && snapshot}
  <section class="filing-results" aria-label={`${filing.year} ${contest.electionType ?? "general"} election results for ${filing.officeName}`}>
    <div class="mini-heading"><div class="mini-title"><TimelineDate value={contest.electionDate || snapshot.electionDate || filing.electionDate} /><h4>{contest.electionType === 'presidential-primary' ? 'Presidential primary' : contest.electionType === 'primary' ? 'Primary election' : 'General election'} results</h4></div><div class="mini-actions"><a href={contest.source} target="_blank" rel="noreferrer">{(contest.official ?? snapshot.official) ? 'Official' : 'Unofficial'}<span class="sr-only"> results source (opens in new tab)</span></a></div></div>
    {#if contest.county}<p class="mini-scope">{snapshot.counties.find(county => county.id === contest?.county)?.name ?? contest.county} report{#if contest.city}{' · '}{contest.city}{/if}</p>{/if}
    <ul>
      {#each contest.options as option}
        {@const candidate = resultPerson(option.name, contest)}
        {@const partyHref = resultPartyHref(option.party)}
        {@const matching = candidate?.id === filing.personId || identityKey(option.name.split(', ')[0]) === identityKey(filing.name)}
        <li class:matching-result={matching}>
          <div class="mini-label" class:matching={matching}>
            <span>{#if candidate}<a href={personHref(candidate)} onclick={(event) => openCandidate(event, personHref(candidate))}>{option.name}</a>{:else}{option.name}{/if}{#if option.party}<span class="mini-party">{' - '}{#if partyHref}<a href={partyHref} onclick={(event) => openCandidate(event, partyHref)}>{option.party}</a>{:else}{option.party}{/if}</span>{/if}</span>
            <div class="mini-totals">
              <small>{option.votesPublished === false ? 'Votes not published' : `${count(option.votes)} votes`}</small>
              {#if contest.votesPublished !== false && contest.optionTotalsReconcile !== false && contest.totalBasis !== 'listed named-candidate votes'}<strong>{#if contest.total}<CountUp value={option.votes / contest.total * 100} format={formatPercent} />{:else}—{/if}</strong>{/if}
            </div>
          </div>
          {#if contest.votesPublished !== false && contest.optionTotalsReconcile !== false && contest.totalBasis !== 'listed named-candidate votes'}<div class="mini-track" style:--share={`${contest.total ? option.votes / contest.total * 100 : 0}%`}><div class="mini-fill" aria-hidden="true" use:revealVoteBar={`${contest.id}:${option.name}:${option.votes}:${contest.total}`} style:width="var(--share)" style:background={color(option)}></div></div>{/if}
        </li>
      {/each}
    </ul>
    {#if contest.votesPublished === false}<p>Vote totals are not fully published for this contest.</p>{:else if !contest.total}<p>No votes reported.</p>{/if}
    {#if contest.optionTotalsReconcile === false}<p>Published option totals differ from the contest total. Percentages are withheld.</p>{/if}
    {#if contest.totalBasis === 'listed named-candidate votes'}<p>Published named-candidate votes shown; unnamed write-ins and other contests are outside this import. Percentages are withheld.</p>{/if}
    {#if contest.totalBasis === 'first-round votes'}<p>Ranked-choice election: first-round votes shown.</p>{/if}
    {#if (contest.seats ?? 1) > 1}<p>Vote for {contest.seats}. Shares are of votes cast, not voters.</p>{/if}
    {#if contest.reporting?.asOf || contest.asOf || snapshot.asOf}<p class="mini-source"><span>Updated {updated(contest.reporting?.asOf || contest.asOf || snapshot.asOf)}</span></p>{/if}
  </section>
{:else if failed}
  <p class="mini-unavailable">Election results could not be loaded.</p>
{/if}

<style>
  .filing-results{min-width:0;padding-top:var(--space-5);border-top:1px solid var(--color-rule)}
  @media(min-width:900px){.filing-results{padding-top:0;padding-left:var(--space-6);border-top:0;border-left:1px solid var(--color-rule)}}
  .mini-heading{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--space-2)}
  .mini-title{display:flex;align-items:center;gap:var(--space-3);min-width:0;flex:1}
  .mini-title :global(.timeline-date){flex:none}
  h4{margin:0;font:700 var(--text-xs) var(--font-sans);letter-spacing:.08em;text-transform:uppercase}
  .mini-actions,small,p{font-size:var(--text-xs);color:var(--color-muted)}
  .mini-actions{display:flex;align-items:baseline;gap:var(--space-3)}
  .mini-label a,.mini-actions a{color:var(--color-blue);text-decoration:underline;text-underline-offset:3px}
  ul{list-style:none;padding:0;margin:var(--space-4) 0;display:grid;gap:var(--space-3)}
  .matching-result{background:var(--color-blue-tint);padding:var(--space-3);margin-inline:calc(-1 * var(--space-3))}
  .mini-label{display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-3);font-size:var(--text-sm)}
  .mini-label span{overflow-wrap:anywhere}
  .mini-label strong{min-width:65px;font-size:var(--text-xl);line-height:1.1;white-space:nowrap;font-variant-numeric:tabular-nums}
  .mini-totals{display:flex;flex-shrink:0;align-items:baseline;justify-content:flex-end;gap:var(--space-2);text-align:right;font-variant-numeric:tabular-nums}
  .mini-totals small{white-space:nowrap;font-weight:400}
  .mini-party{font-weight:400;color:var(--color-muted)}
  .mini-party a{color:inherit;font-weight:400}
  .mini-scope{margin:var(--space-2) 0;color:var(--color-muted);font-size:var(--text-xs)}
  .mini-label.matching,.mini-label.matching .mini-party,.mini-label.matching a{font-weight:700}
  .mini-track{height:12px;background:var(--color-rule);margin:6px 0 3px}
  .mini-fill{height:100%;transform-origin:left center;transform:scaleX(var(--vote-progress,1))}
  .mini-source{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--space-2);line-height:1.5;margin-bottom:0}
  .mini-unavailable{font-size:var(--text-sm);color:var(--color-muted)}
</style>
