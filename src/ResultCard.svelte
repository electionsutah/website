<script lang="ts">
  import Icon from './Icon.svelte';
  import CountyMap from './CountyMap.svelte';
  import CountUp from './CountUp.svelte';
  import { revealVoteBar } from './lib/vote-animation';
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;
  import ShiftArrow from './ShiftArrow.svelte';
  import { raceComparison, type HistoricalSnapshot } from './lib/shifts';
  import ResultPersonName from './ResultPersonName.svelte';
  import ResultPartyName from './ResultPartyName.svelte';
  import { resultOfficeHref } from './lib/result-links';
  import { resultPerson, retainedJudgeName, personHref, contestTitle } from './lib/result-people';
  import { count, color, percent, leader, hasSingleLeader, seatsOf, type Contest } from './lib/results';
  export let contest: Contest;
  export let countyNames: Map<string, string>;
  export let detailed = false;
  export let history: HistoricalSnapshot[] = [];
  export let historyLoading = false;
  let selected = '';
  let hovered = '';
  $: if (contest) { selected = ''; hovered = ''; }
  $: officeHref = resultOfficeHref(contest.name);
  $: title = contestTitle(contest);
  $: judgeName = retainedJudgeName(contest);
  $: judge = judgeName ? resultPerson(judgeName, contest) : undefined;
  $: active = contest.counties.find(row => row.id === (hovered || selected));
  $: result = active || contest;
  $: comparison = raceComparison(contest, history, active?.id || '');
  $: seats = seatsOf(contest);
  $: options = detailed ? result.options : result.options.slice(0, Math.max(3, seats));
  $: remaining = result.options.slice(options.length);
</script>

<article class="result-card" class:detailed>
  <header><p>{contest.category}{contest.county ? ` · ${countyNames.get(contest.county)}` : ''}</p><h3>{#if officeHref}<a class="result-office-link" href={officeHref}>{title}</a>{:else}{title}{/if}</h3>{#if judge}<a class="judge-profile" href={personHref(judge)}>View {judge.name}’s person record <Icon name="arrow_forward" /></a>{/if}</header>
  <div class="card-visual">
    <CountyMap {contest} {selected} choose={(id) => selected = id} hover={(id) => hovered = id} />
    <div class="card-results">
      <p class="result-area" aria-live="polite">{active ? countyNames.get(active.id) : contest.county ? countyNames.get(contest.county) : 'District total'}</p>
      <p class="leader-label">{leader(result, seats)}</p>{#if seats > 1}<p class="multi-seat-note">Vote for {seats}. The top {seats} candidates win. Each voter could pick up to {seats}, so shares are of all votes cast, not of voters.</p>{/if}
      <div class="vote-bar" aria-hidden="true" use:revealVoteBar={result}>{#each result.options as option}<span style={`width:${result.total ? option.votes / result.total * 100 : 0}%;background:${color(option)}`}></span>{/each}</div>
      <div class="candidate-results">
        {#each options as option}
          <div class="candidate-result"><span class="party-dot" style={`background:${color(option)}`}></span><div><strong><ResultPersonName name={option.name} {contest} /></strong><small><ResultPartyName name={option.party} /></small></div><b>{#if result.total}<CountUp value={option.votes / result.total * 100} format={formatPercent} />{:else}—{/if}<small><CountUp value={option.votes} /> votes</small></b></div>
        {/each}
      </div>
      {#if !detailed && remaining.length}<p class="others">+ {remaining.length} other {remaining.length === 1 ? 'candidate' : 'candidates'} · {count(remaining.reduce((sum, row) => sum + row.votes, 0))} votes</p>{/if}
      <p class="votes-total"><CountUp value={result.total} /> votes reported{#if selected}<button onclick={() => selected = ''}>Reset county</button>{/if}</p>
    </div>
  </div>
  {#if detailed}
    <section class="race-shift" aria-label="Historical party margin comparison"><h4>Political shift{comparison.year ? ` from ${comparison.year}` : ''}{active ? ` · ${countyNames.get(active.id)}` : ''}</h4>
      {#if historyLoading}<p role="status">Loading the historical baseline…</p>{:else if comparison.shift !== null}<ShiftArrow value={comparison.shift} scale={100} /><p>Change in the Democratic–Republican margin, using all reported votes. {historyLoading ? '' : '2026 snapshot results may still change.'} <a href={comparison.previousSource || '#political-shift'}>Historical source <Icon name="arrow_outward" /></a></p>{:else}<p>{comparison.reason}</p>{#if contest.category === 'U.S. House'}<p><a href="#political-shift">Explore countywide congressional shifts</a></p>{/if}{/if}
    </section>
    <label class="county-picker">Explore a county<select bind:value={selected}><option value="">{contest.county ? 'County total' : 'All participating counties'}</option>{#each contest.counties as row}<option value={row.id}>{countyNames.get(row.id)}</option>{/each}</select></label>
    <details class="county-table"><summary>County results table ({contest.counties.length})</summary><div class="table-scroll"><table><caption>{title} by county</caption><thead><tr><th scope="col">County</th><th scope="col">Leading candidate / response</th><th scope="col">Share</th><th scope="col">Votes reported</th></tr></thead><tbody>{#each contest.counties as row}<tr><th scope="row">{countyNames.get(row.id)}</th><td>{#if hasSingleLeader(row, seats)}<ResultPersonName name={row.options[0].name} {contest} /> {row.options[0].winner ? 'elected' : 'leads'}{:else}{leader(row, seats)}{/if}</td><td>{row.options[0] ? percent(row.options[0].votes, row.total) : '—'}</td><td>{count(row.total)}</td></tr>{/each}</tbody></table></div></details>
  {/if}
  <footer><span>{contest.reporting ? `${contest.reporting.reportingUnits}/${contest.reporting.totalUnits} ${contest.county ? 'precincts' : 'counties'} reporting` : 'Reporting status unavailable'}</span><a href={contest.source} target="_blank" rel="noreferrer">Official source <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a></footer>
</article>
