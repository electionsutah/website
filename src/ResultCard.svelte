<script lang="ts">
  import CountyMap from './CountyMap.svelte';
  import ShiftArrow from './ShiftArrow.svelte';
  import { raceComparison, type HistoricalSnapshot } from './lib/shifts';
  import ResultPersonName from './ResultPersonName.svelte';
  import ResultPartyName from './ResultPartyName.svelte';
  import { resultOfficeHref } from './lib/result-links';
  import { resultPerson, retainedJudgeName, personHref } from './lib/result-people';
  import { count, color, percent, leader, type Contest } from './lib/results';
  export let contest: Contest;
  export let countyNames: Map<string, string>;
  export let detailed = false;
  export let history: HistoricalSnapshot[] = [];
  export let historyLoading = false;
  let selected = '';
  let hovered = '';
  $: if (contest) { selected = ''; hovered = ''; }
  $: officeHref = resultOfficeHref(contest.name);
  $: judgeName = retainedJudgeName(contest);
  $: judge = judgeName ? resultPerson(judgeName, contest) : undefined;
  $: active = contest.counties.find(row => row.id === (hovered || selected));
  $: result = active || contest;
  $: comparison = raceComparison(contest, history, active?.id || '');
  $: options = detailed ? result.options : result.options.slice(0, 2);
</script>

<article class="result-card" class:detailed>
  <header><p>{contest.category}{contest.county ? ` · ${countyNames.get(contest.county)}` : ''}</p><h3>{#if officeHref}<a class="result-office-link" href={officeHref}>{contest.name.replace(' (Multi-County)', '')}</a>{:else}{contest.name.replace(' (Multi-County)', '')}{/if}</h3>{#if judge}<a class="judge-profile" href={personHref(judge)}>View {judge.name}’s person record ↗</a>{/if}</header>
  <div class="card-visual">
    <CountyMap {contest} {selected} choose={(id) => selected = id} hover={(id) => hovered = id} />
    <div class="card-results">
      <p class="result-area" aria-live="polite">{active ? countyNames.get(active.id) : contest.county ? countyNames.get(contest.county) : 'District total'}</p>
      <p class="leader-label">{leader(result)}</p>
      <div class="vote-bar" aria-hidden="true">{#each result.options as option}<span style={`width:${result.total ? option.votes / result.total * 100 : 0}%;background:${color(option)}`}></span>{/each}</div>
      <div class="candidate-results">
        {#each options as option}
          <div class="candidate-result"><span class="party-dot" style={`background:${color(option)}`}></span><div><strong><ResultPersonName name={option.name} {contest} /></strong><small><ResultPartyName name={option.party} /></small></div><b>{percent(option.votes, result.total)}<small>{count(option.votes)} votes</small></b></div>
        {/each}
      </div>
      {#if !detailed && result.options.length > 2}<p class="others">+ {result.options.length - 2} other candidates · {count(result.options.slice(2).reduce((sum, row) => sum + row.votes, 0))} votes</p>{/if}
      <p class="votes-total">{count(result.total)} votes reported{#if selected}<button onclick={() => selected = ''}>Reset county</button>{/if}</p>
    </div>
  </div>
  {#if detailed}
    <section class="race-shift" aria-label="Historical party margin comparison"><h4>Political shift{comparison.year ? ` from ${comparison.year}` : ''}{active ? ` · ${countyNames.get(active.id)}` : ''}</h4>
      {#if historyLoading}<p role="status">Loading the historical baseline…</p>{:else if comparison.shift !== null}<ShiftArrow value={comparison.shift} scale={100} /><p>Change in the Democratic–Republican margin, using all reported votes. {historyLoading ? '' : '2026 snapshot results may still change.'} <a href={comparison.previousSource || '#political-shift'}>Historical source ↗</a></p>{:else}<p>{comparison.reason}</p>{#if contest.category === 'U.S. House'}<p><a href="#political-shift">Explore countywide congressional shifts</a></p>{/if}{/if}
    </section>
    <label class="county-picker">Explore a county<select bind:value={selected}><option value="">{contest.county ? 'County total' : 'All participating counties'}</option>{#each contest.counties as row}<option value={row.id}>{countyNames.get(row.id)}</option>{/each}</select></label>
    <details class="county-table"><summary>County results table ({contest.counties.length})</summary><div class="table-scroll"><table><caption>{contest.name} by county</caption><thead><tr><th scope="col">County</th><th scope="col">Leading candidate / response</th><th scope="col">Share</th><th scope="col">Votes reported</th></tr></thead><tbody>{#each contest.counties as row}<tr><th scope="row">{countyNames.get(row.id)}</th><td>{#if row.total && row.options[0] && leader(row) !== 'Tied'}<ResultPersonName name={row.options[0].name} {contest} /> {row.options[0].winner ? 'elected' : 'leads'}{:else}{leader(row)}{/if}</td><td>{row.options[0] ? percent(row.options[0].votes, row.total) : '—'}</td><td>{count(row.total)}</td></tr>{/each}</tbody></table></div></details>
  {/if}
  <footer><span>{contest.reporting ? `${contest.reporting.reportingUnits}/${contest.reporting.totalUnits} ${contest.county ? 'precincts' : 'counties'} reporting` : 'Reporting status unavailable'}</span><a href={contest.source} target="_blank" rel="noreferrer">Official source ↗<span class="sr-only"> (opens in new tab)</span></a></footer>
</article>
