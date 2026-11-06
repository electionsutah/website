<script lang="ts">
  import Icon from './Icon.svelte';
  import { anchoredPopover } from './lib/anchored-popover';
  import type { Snapshot } from './lib/results';
  import { count } from './lib/results';
  import { raceComparison, congressCountyComparisons, boundarySource, congressBoundarySource, type HistoricalSnapshot, type ShiftComparison } from './lib/shifts';
  import ShiftArrow from './ShiftArrow.svelte';
  export let data: Snapshot;
  export let history: HistoricalSnapshot[];
  export let loading = false;
  export let error = '';
  export let explore: (id: string) => void;
  let mode = 'State House';
  let county = '';
  let query = '';
  let order = 'largest';
  let page = 1;
  type Row = { id: string; name: string; comparison: ShiftComparison; source: string; county: boolean };
  $: raceRows = data.contests.filter(row => !row.county && ['State House', 'State Senate', 'School board'].includes(row.category) && (!county || row.counties.some(result => result.id === county))).map(contest => ({ id: contest.id, name: contest.name.replace(' (Multi-County)', ''), comparison: raceComparison(contest, history, county), source: contest.source, county: false, category: contest.category }));
  $: countyRows = congressCountyComparisons(data, history.find(snapshot => snapshot.electionDate.startsWith('2024'))).map(row => ({ ...row, source: data.source, county: true, category: 'Congress by county' }));
  $: allRows = [...raceRows, ...countyRows];
  $: rows = allRows.filter(row => row.category === mode && (!query || row.name.toLowerCase().includes(query.toLowerCase())) && (mode !== 'Congress by county' || !county || row.id === county));
  /** Largest absolute shift first; rows without a comparison go last, in name order. */
  function byShiftSize(a: Row, b: Row) {
    const x = a.comparison.shift, y = b.comparison.shift;
    if (x === null || y === null) return x === y ? a.name.localeCompare(b.name, undefined, { numeric: true }) : x === null ? 1 : -1;
    return Math.abs(y) - Math.abs(x);
  }
  $: ordered = [...rows].sort((a, b) => order === 'largest' ? byShiftSize(a, b) : a.name.localeCompare(b.name, undefined, { numeric: true }));
  $: scale = Math.max(1, ...allRows.flatMap(row => row.comparison.shift === null ? [] : [Math.abs(row.comparison.shift)]));
  $: eligible = rows.filter(row => row.comparison.shift !== null).length;
  $: { mode; county; query; order; page = 1; }
  $: pages = Math.max(1, Math.ceil(ordered.length / 15));
  $: visible = ordered.slice((page - 1) * 15, page * 15) as Row[];
  const share = (value: number | undefined) => value === undefined ? '—' : `${value.toFixed(1)}%`;

</script>

<section class="shift-section" id="political-shift" aria-labelledby="shift-title">
  <div class="labs-section-heading"><div><p class="labs-kicker">How the vote has changed</p><h2 id="shift-title">The political shift.</h2></div><p>Compare the 2026 party margin with the previous available election in the same geography.</p></div>
  <p class="shift-intro">Blue arrows point toward Democrats; red arrows point toward Republicans. A <strong>D+10</strong> shift means the Democratic–Republican margin moved 10 percentage points toward Democrats—even if a Republican still leads.</p>
  <div class="category-filters" role="group" aria-label="Political shift race type">{#each ['State House', 'State Senate', 'School board', 'Congress by county'] as item}<button aria-pressed={mode === item} onclick={() => mode = item}>{item}</button>{/each}</div>
  <div class="shift-controls"><label>Find a {mode === 'Congress by county' ? 'county' : 'district'}<input type="search" bind:value={query} placeholder={mode === 'Congress by county' ? 'County name…' : 'District name or number…'} /></label><label>County<select bind:value={county}><option value="">{mode === 'Congress by county' ? 'All counties' : 'Full district totals'}</option>{#each data.counties as row}<option value={row.id}>{row.name}</option>{/each}</select></label><label>Order<select bind:value={order}><option value="largest">Largest shifts first</option><option value="district">{mode === 'Congress by county' ? 'County name' : 'District number'}</option></select></label></div>
  {#if loading}<p class="results-count" role="status">Loading historical results…</p>{:else if error}<p class="shift-warning" role="status">{error}</p>{/if}
  {#if mode === 'Congress by county'}<p class="shift-context">Congressional districts changed for 2026. These rows combine votes from <strong>all U.S. House districts within each county</strong> in 2024 and 2026. They compare the county’s congressional vote, rather than matching district numbers. <a href={congressBoundarySource}>Boundary history <Icon name="arrow_outward" /></a></p>{:else}<p class="shift-context">{county ? `Showing only each district’s votes within ${data.counties.find(row => row.id === county)?.name}.` : 'Showing full district results.'} Baselines use 2024 where the seat was on the ballot, otherwise the imported 2022 multi-county canvass. <a href={boundarySource}>State district boundary vintages <Icon name="arrow_outward" /></a></p>{/if}
  <p class="results-count" role="status">{eligible} of {rows.length} displayed {mode === 'Congress by county' ? 'counties' : 'races'} have a comparable contested baseline. {data.official ? '2026 results are official.' : '2026 results are unofficial and shifts may change.'}</p>
  <div class="shift-table-scroll"><table class="shift-table"><caption class="sr-only">2026 Democratic and Republican vote shares and change in their margin from the prior comparable election</caption><thead><tr><th scope="col">{mode === 'Congress by county' ? 'County' : 'Race'}</th><th scope="col" class="democratic">Democrats<small>2026 share</small></th><th scope="col" class="republican">Republicans<small>2026 share</small></th><th scope="col">Shift<small>Percentage points</small></th></tr></thead><tbody>
  {#each visible as row (row.id)}<tr><th scope="row">{#if row.county}{row.name}{:else}<button class="shift-race-link" onclick={() => explore(row.id)}>{row.name}</button>{/if}{#if row.comparison.year}<small>From {row.comparison.year}</small>{/if}</th><td class="democratic" class:party-leading={!!row.comparison.current && row.comparison.current.democraticShare > row.comparison.current.republicanShare}>{share(row.comparison.current?.democraticShare)}</td><td class="republican" class:party-leading={!!row.comparison.current && row.comparison.current.republicanShare > row.comparison.current.democraticShare}>{share(row.comparison.current?.republicanShare)}</td><td>
    {#if row.comparison.shift !== null}<ShiftArrow value={row.comparison.shift} {scale} />{:else}<span class="shift-unavailable">Not comparable</span>{/if}
    <button class="shift-evidence-toggle" popovertarget={`shift-pop-${row.id}`} aria-label={`${row.comparison.shift === null ? 'Why is this not comparable' : 'Compare votes'}: ${row.name}`}>{row.comparison.shift === null ? 'Why?' : 'Compare votes'}</button>
  </td></tr>{:else}<tr><td colspan="4">No results match this search.</td></tr>{/each}
  </tbody></table></div>
  {#each visible as row (row.id)}{@const popId = `shift-pop-${row.id}`}
    <div class="evidence-popover shift-popover" id={popId} popover="auto" use:anchoredPopover={popId}>
      <header><strong>{row.name}</strong><button popovertarget={popId} popovertargetaction="hide" aria-label="Close"><Icon name="close" /></button></header>
      {#if row.comparison.reason}<p>{row.comparison.reason}</p>{/if}
      {#if row.comparison.previous && row.comparison.current}<table><caption class="sr-only">Vote shares in {row.comparison.year} and 2026</caption><thead><tr><th scope="col">Year</th><th scope="col" class="democratic">D</th><th scope="col" class="republican">R</th><th scope="col">Votes</th></tr></thead><tbody>
        <tr><th scope="row">{row.comparison.year}</th><td class="democratic">{share(row.comparison.previous.democraticShare)}</td><td class="republican">{share(row.comparison.previous.republicanShare)}</td><td>{count(row.comparison.previous.total)}</td></tr>
        <tr><th scope="row">2026</th><td class="democratic">{share(row.comparison.current.democraticShare)}</td><td class="republican">{share(row.comparison.current.republicanShare)}</td><td>{count(row.comparison.current.total)}</td></tr>
      </tbody></table>{/if}
      <p class="shift-popover-sources"><a href={row.source} target="_blank" rel="noopener">2026 source <Icon name="arrow_outward" /></a>{#if row.comparison.previousSource}<a href={row.comparison.previousSource} target="_blank" rel="noopener">{row.comparison.year} source <Icon name="arrow_outward" /></a>{/if}</p>
    </div>
  {/each}
  {#if pages > 1}<div class="results-pagination"><button disabled={page === 1} onclick={() => page--}><Icon name="arrow_back" /> Previous shifts</button><span>Page {page} of {pages}</span><button disabled={page === pages} onclick={() => page++}>Next shifts <Icon name="arrow_forward" /></button></div>{/if}
  <p class="map-note">Arrows share a 0–{scale.toFixed(1)} percentage-point scale. Shares use all reported contest votes, including other parties and write-ins, so D and R may not sum to 100%. Highlighted cells show which of those two parties has the larger share.</p>
  <details class="shift-methodology"><summary>Methodology and comparison limits</summary><p>Shift = (2026 Democratic share − 2026 Republican share) − (prior Democratic share − prior Republican share). This is a change in the party margin, not a change in one party’s share or evidence that individual voters switched parties.</p><p>State House, State Senate, and State School Board comparisons use the 2022–2032 district boundary vintages documented by Utah’s GIS office. Congressional district comparisons are withheld because the 2026 map changed. Local races, judicial retention, and ballot measures are not assigned a D–R shift.</p><p>Both parties must receive votes in each election. We do not substitute an older contested result for a newer uncontested result. Missing or inconsistent source data produces an explanation instead of a numeric shift. The 2022 state canvass publishes multi-county races; missing single-county baselines remain unavailable.</p><p>Countywide congressional comparisons add all published U.S. House contests in that county once per year. These totals can reflect changes in turnout, candidates, and district competitiveness as well as political preference. Comparing a midterm election with a presidential election adds turnout differences.</p><p>Historical sources: <a href="https://electionresults.utah.gov/results/public/Utah/general11052024">2024 certified results</a> · <a href="https://vote.utah.gov/wp-content/uploads/2022/12/Signed-2022-General-Election-State-Canvass-Certification.pdf">2022 certified state canvass (PDF)</a>. <a href="/data/2024-results.json" download>Download 2024 data</a> · <a href="/data/2022-shift-baseline.json" download>Download 2022 baselines</a>.</p></details>
</section>
