<script lang="ts">
  import Icon from './Icon.svelte';
  import { onMount } from 'svelte';
  import ResultCard from './ResultCard.svelte';
  import Combobox from './Combobox.svelte';
  import ShiftExplorer from './ShiftExplorer.svelte';
  import LegislativeMap from './LegislativeMap.svelte';
  import type { HistoricalSnapshot } from './lib/shifts';
  import ResultPersonName from './ResultPersonName.svelte';
  import ResultPartyName from './ResultPartyName.svelte';
  import { resultPerson, retainedJudgeName, personHref, contestTitle } from './lib/result-people';
  import { count, color, margin, percent, leader, hasSingleLeader, seatsOf, updated, type Snapshot, type Contest } from './lib/results';
  import { tidySnapshot } from './lib/result-names';
  import './labs.css';
  let data: Snapshot | null = null;
  let error = '';
  let historyData: HistoricalSnapshot[] = [];
  let historyLoading = true;
  let historyError = '';
  async function loadHistory() {
    const results = await Promise.allSettled(['/data/2024-results.json', '/data/2022-shift-baseline.json'].map(async (url) => {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error(url);
      return await response.json() as HistoricalSnapshot;
    }));
    historyData = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    historyError = results.some(result => result.status === 'rejected') ? 'Some historical data could not be loaded. Comparisons requiring that data are unavailable; reload the page to retry.' : '';
    historyLoading = false;
  }
  let loading = true;
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  let query = params.get('q') || '';
  const categories = ['All contests', 'U.S. House', 'State Senate', 'State House', 'School board', 'Judicial retention', 'Local & measures'];
  let category = categories.includes(params.get('category') || '') ? params.get('category')! : 'All contests';
  let county = params.get('county') || '';
  let sort = params.get('sort') === 'margin' ? 'margin' : 'ballot';
  let selectedId = params.get('race') || '';
  let page = 1;
  async function load() {
    loading = true; error = '';
    try {
      const response = await fetch('/data/2026-results.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('The results snapshot could not be loaded.');
      data = tidySnapshot(await response.json() as Snapshot);
      // Drop URL values that don't match this snapshot instead of keeping them silently.
      if (selectedId && !data.contests.some(row => row.id === selectedId)) selectedId = '';
      if (county && !data.counties.some(row => row.id === county)) county = '';
    } catch { error = 'We couldn’t load the results. Please try again or visit the official source.'; }
    finally { loading = false; }
  }
  onMount(() => { void load(); void loadHistory(); });
  // Highlight the section being read in the sticky bar.
  const sections = [['congress', 'U.S. House'], ['statewide-map', 'Utah legislature'], ['political-shift', 'Political shift'], ['all-results', 'All contests'], ['race-detail', 'County explorer']] as const;
  let nav: HTMLElement;
  let current = '';
  let frame = 0;
  function updateCurrent() {
    frame = 0;
    if (!nav) return;
    // A section is current once its top passes just below the sticky bar. Jump links
    // land sections 100px from the top (scroll-margin-top in labs.css), so allow for that.
    const line = Math.max(nav.getBoundingClientRect().height + 24, 120);
    let next = '';
    for (const [id] of [...sections, ['about-results']]) {
      const top = document.getElementById(id)?.getBoundingClientRect().top;
      if (top !== undefined && top <= line) next = id;
    }
    // At the very bottom, short final sections never reach the line.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) next = 'about-results';
    if (next === current) return;
    current = next;
    // Keep the active link visible when the bar scrolls sideways on narrow screens.
    nav.querySelector<HTMLElement>(`a[href="#${current}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const scheduleCurrent = () => { if (!frame) frame = requestAnimationFrame(updateCurrent); };
  $: if (data && typeof window !== 'undefined') scheduleCurrent();
  $: countyNames = new Map((data?.counties || []).map(row => [row.id, row.name]));
  $: contestOptions = (data?.contests || []).map(contest => ({ value: contest.id, label: `${contest.county ? `${countyNames.get(contest.county)} · ` : ''}${contestTitle(contest)}`, description: `${contest.category} · ${leader(contest, seatsOf(contest))}`, searchText: `${contest.name} ${contest.options.map(option => `${option.name} ${option.party}`).join(' ')} ${contest.counties.map(row => countyNames.get(row.id)).join(' ')}` }));
  $: house = data?.contests.filter(row => row.category === 'U.S. House' && !row.county) || [];
  $: filtered = (data?.contests || []).filter(row => (category === 'All contests' || row.category === category) && (!county || row.counties.some(c => c.id === county)) && `${row.name} ${contestTitle(row)} ${row.options.map(c => `${c.name} ${c.party}`).join(' ')} ${row.county ? countyNames.get(row.county) : ''}`.toLowerCase().includes(query.toLowerCase()));
  $: sorted = sort === 'margin' ? [...filtered].sort((a, b) => margin(a, seatsOf(a)) - margin(b, seatsOf(b))) : filtered;
  $: { query; category; county; sort; page = 1; }
  $: pages = Math.max(1, Math.ceil(sorted.length / 20));
  $: visible = sorted.slice((page - 1) * 20, page * 20);
  $: selected = data?.contests.find(row => row.id === selectedId) || house[1] || data?.contests[0];
  $: if (typeof window !== 'undefined' && data) {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (category !== 'All contests') next.set('category', category);
    if (county) next.set('county', county);
    if (sort !== 'ballot') next.set('sort', sort);
    if (selectedId) next.set('race', selectedId);
    history.replaceState(history.state, '', `${window.location.pathname}${next.toString() ? `?${next}` : ''}${window.location.hash}`);
  }
  function show(contest: Contest) {
    selectedId = contest.id;
    document.getElementById('race-detail')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    document.getElementById('detail-title')?.focus({ preventScroll: true });
  }
</script>

<svelte:window onscroll={scheduleCurrent} onresize={scheduleCurrent} />

<svelte:head><title>2026 Utah election results — Elections Utah Labs</title><meta name="description" content="Explore Utah’s 2026 general election results with interactive county maps, candidate vote totals, and searchable statewide and local contests." /></svelte:head>

<div class="labs">
  <div class="labs-masthead"><a href="/labs/">Elections Utah <span>LABS</span></a><p>Experiments in open civic data</p></div>
  <section class="labs-hero">
    <div><p class="labs-kicker">November 3, 2026 · General election</p><h1>Utah, <em>by the vote.</em></h1><p class="labs-deck">A closer look at the results. Explore the races, follow the count, and see how your county voted.</p></div>
    <div class="election-stamp" aria-hidden="true"><span>ELECTION</span><strong>20<br />26</strong><span>UTAH / USA</span></div>
  </section>
  <nav class="labs-nav" aria-label="Results sections" bind:this={nav}>{#each sections as [id, label]}<a href={`#${id}`} aria-current={current === id ? 'location' : undefined}>{label}{#if id === 'congress'} <span>04</span>{/if}</a>{/each}<a href="#about-results" aria-current={current === 'about-results' ? 'location' : undefined}>About the data <Icon name="arrow_downward" /></a></nav>

  {#if loading && !data}<p class="labs-message" role="status">Loading the official results snapshot…</p>{/if}
  {#if error}<div class="labs-message" role="alert"><p>{error}</p><button onclick={load}>Try again</button><a href="https://electionresults.utah.gov/results/public/Utah">Official results <Icon name="arrow_outward" /></a></div>{/if}
  {#if data}
    <div class="results-status"><div><span class="status-dot"></span><strong>{data.official ? 'Official results' : 'Unofficial results'}</strong><span>State updated {updated(data.asOf)}</span></div></div>
    <p class="snapshot-note">Saved snapshot · Retrieved {updated(data.fetchedAt)}. Results do not update automatically. Votes may still be counted.</p>
    <section class="congress-section" id="congress" aria-labelledby="congress-title">
      <div class="labs-section-heading"><div><p class="labs-kicker">The race for Congress</p><h2 id="congress-title">Four districts. Every vote.</h2></div><p>County maps show who leads in each part of a district.<br />Hover or select a county to explore.</p></div>
      <div class="map-legend"><span><i style="background:#2675aa"></i><ResultPartyName name="Democratic" /></span><span><i style="background:#bc443d"></i><ResultPartyName name="Republican" /></span><span><i style="background:#626870"></i>Other</span><span><i style="background:#e8e5df"></i>No contest results / tied</span></div>
      <div class="house-grid">{#each house as contest}<div><ResultCard {contest} {countyNames} history={historyData} {historyLoading} /><button class="explore-race" onclick={() => show(contest)}>Explore district {contest.name.match(/\d+/)?.[0]} <Icon name="arrow_forward" /></button></div>{/each}</div>
      <p class="map-note">County boundaries, not district boundaries. Colored counties include only votes cast in this contest; a district may cover part of a county. Leaders are not projected winners.</p>
    </section>
    <div class="labs-numbers"><div><strong>{count(data.contests.length)}</strong><span>Published contests</span></div><div><strong>29</strong><span>Utah counties</span></div><div><strong>01</strong><span>Official state source</span></div><p>From Congress to your community.<br /><em>The whole ballot, in one place.</em></p></div>
    <LegislativeMap {data} explore={(id) => { const contest = data?.contests.find(row => row.id === id); if (contest) show(contest); }} />
    <ShiftExplorer {data} history={historyData} loading={historyLoading} error={historyError} explore={(id) => { const contest = data?.contests.find(row => row.id === id); if (contest) show(contest); }} />
    <section id="all-results" class="all-results" aria-labelledby="all-title">
      <div class="labs-section-heading"><div><p class="labs-kicker">Find your race</p><h2 id="all-title">The results desk.</h2></div><a href="/data/2026-results.json" download="utah-2026-results.json">Download results JSON <Icon name="download" /></a></div>
      <div class="results-controls"><label class="race-search">Search contests or candidates<input type="search" bind:value={query} placeholder="Try a name, district, or county…" /></label><label>County<select bind:value={county}><option value="">All counties</option>{#each data.counties as row}<option value={row.id}>{row.name}</option>{/each}</select></label><label>Sort by<select bind:value={sort}><option value="ballot">Ballot order</option><option value="margin">Closest races</option></select></label></div>
      <div class="category-filters" role="group" aria-label="Contest category">{#each categories as item}<button aria-pressed={category === item} onclick={() => category = item}>{item}</button>{/each}</div>
      <p class="results-count" role="status">{count(filtered.length)} matching contests{county ? ` with results in ${countyNames.get(county)}` : ''} · Totals below cover the full contest.</p>
      <div class="contest-list">{#each visible as contest}
        {@const judgeName = retainedJudgeName(contest)}
        {@const judge = judgeName ? resultPerson(judgeName, contest) : undefined}
        <div class="contest-row" class:selected={selected?.id === contest.id}>
          <div><small>{contest.category}{contest.county ? ` · ${countyNames.get(contest.county)}` : ''}</small><button class="contest-open" aria-pressed={selected?.id === contest.id} onclick={() => show(contest)}>{contestTitle(contest)}<span class="sr-only"> — explore county results</span></button>{#if judge}<a class="judge-profile" href={personHref(judge)}>View {judge.name}’s person record <Icon name="arrow_forward" /></a>{/if}</div>
          <div><span class="row-leader"><i style={`background:${color(contest.options[0])}`}></i><span>{#if hasSingleLeader(contest, seatsOf(contest))}<ResultPersonName name={contest.options[0].name} {contest} /> {contest.options[0].winner ? 'elected' : 'leads'}{:else}{leader(contest, seatsOf(contest))}{/if}</span></span><small>{#if seatsOf(contest) === 1}{contest.options[0] ? percent(contest.options[0].votes, contest.total) : '—'} · {/if}{count(contest.total)} votes reported</small></div>
          <button class="contest-arrow" aria-label={`Explore county results for ${contestTitle(contest)}`} onclick={() => show(contest)}><Icon name="arrow_forward" /></button>
        </div>
      {:else}<div class="labs-message"><p>No contests match these filters.</p><button onclick={() => { query = ''; county = ''; category = 'All contests'; }}>Clear filters</button></div>{/each}</div>
      {#if pages > 1}<div class="results-pagination"><button disabled={page === 1} onclick={() => page--}><Icon name="arrow_back" /> Previous</button><span>Page {page} of {pages}</span><button disabled={page === pages} onclick={() => page++}>Next <Icon name="arrow_forward" /></button></div>{/if}
    </section>
    <section id="race-detail" class="race-detail" aria-labelledby="detail-title"><div class="explorer-intro"><p class="labs-kicker">Look a little closer</p><h2 id="detail-title" tabindex="-1">Every county<br />has a story.</h2><p>Select a race at the results desk, then explore its county vote totals.</p><Combobox id="results-contest-select" label="Choose a contest" value={selected?.id || ''} options={contestOptions} placeholder="Search contests…" itemLabel="contest" itemsLabel="contests" hint="Type a race, district, county, or candidate name." emptyMessage="No matching contests. Try another race or candidate name." clearable={false} onSelect={(value) => selectedId = value} /><div class="explorer-note"><strong>Reading the map</strong><p>Each county takes the color of its leading candidate or ballot response. Select a county to see every candidate’s votes and share. Gray means no results for this contest, or a tie.</p><p>“Reporting” means a county or precinct has submitted results. It does not mean every ballot has been counted.</p></div></div><div>{#if selected}{#key selected.id}<ResultCard contest={selected} {countyNames} detailed history={historyData} {historyLoading} />{/key}{/if}</div></section>
    <section class="about-results" id="about-results"><p class="labs-kicker">Transparent by design</p><h2>Public data. Clear context.</h2><div><p>Results come from the <a href={data.source}>Utah Lieutenant Governor’s official results site</a>. This independent Elections Utah Labs page includes all {count(data.contests.filter(row => !row.county).length)} state-published contests and {count(data.contests.filter(row => row.county).length)} additional local contests from the county feeds.</p><p>This is a saved snapshot, not a live feed. State and county publications may have different update times. Percentages use each contest’s reported vote total. No race calls or turnout estimates are added. Download the JSON for source timestamps and links.</p></div><p class="boundary-credit">County geometry: <a href="https://github.com/plotly/datasets/blob/master/geojson-counties-fips.json">Plotly county GeoJSON (U.S. Census boundaries)</a>. Maps present county aggregates and do not depict the 2026 electoral district boundaries.</p></section>
  {/if}
</div>
