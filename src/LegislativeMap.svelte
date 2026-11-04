<script lang="ts">
  import Icon from './Icon.svelte';
  import CountUp from './CountUp.svelte';
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;
  import { onMount } from 'svelte';
  import counties from './data/utah-county-paths.json';
  import ResultPersonName from './ResultPersonName.svelte';
  import Combobox from './Combobox.svelte';
  import ResultPartyName from './ResultPartyName.svelte';
  import { resultOfficeHref } from './lib/result-links';
  import { color, count, percent, type Snapshot } from './lib/results';
  import { STATE_VIEW, MAX_ZOOM, chamberLabel, districtResults, pathBounds, pathCentroid, constrainView, zoomView, fitBounds, resultState, type LegislativeGeometry, type Chamber, type MapView } from './lib/legislative-map';
  export let data: Snapshot;
  export let explore: (id: string) => void;
  let geometry: LegislativeGeometry | null = null;
  let loading = true;
  let error = '';
  let chamber: Chamber = 'house';
  let county = '';
  let selected = '';
  let hovered = '';
  let focused = '';
  let view: MapView = { ...STATE_VIEW };
  let svg: SVGSVGElement;
  let showCounties = false;
  let drag: { clientX: number; clientY: number; view: MapView; scale: number; district: string; pointer: number } | null = null;
  let suppressClick = false;
  $: countyOptions = [{ value: '', label: 'All Utah' }, ...data.counties.map(row => ({ value: row.id, label: row.name }))];
  const countyShapes = counties.map(row => ({ ...row, bounds: pathBounds(row.path), centroid: pathCentroid(row.path) }));
  async function loadGeometry() {
    loading = true; error = '';
    try {
      const response = await fetch('/data/utah-legislative-boundaries.json');
      if (!response.ok) throw new Error('Boundary download failed');
      geometry = await response.json();
    } catch { error = 'District boundaries could not be loaded. Retry the map, or use the results desk below.'; }
    finally { loading = false; }
  }
  onMount(() => { void loadGeometry(); });
  $: districts = geometry?.chambers[chamber].districts || [];
  $: results = districtResults(data, chamber);
  $: zoom = STATE_VIEW.width / view.width;
  $: highlightedShapes = districts.filter(row => String(row.number) === selected || String(row.number) === focused);
  $: selectedShape = districts.find(row => row.number === Number(selected));
  $: contest = selected ? results.get(Number(selected)) : undefined;
  $: districtHref = resultOfficeHref(`${chamber === 'house' ? 'State House' : 'State Senate'} District ${selected}`);
  $: countyResult = county ? contest?.counties.find(row => row.id === county) : undefined;
  $: currentResult = countyResult || contest;
  $: selectedCounty = countyShapes.find(row => row.id === county);
  $: countyName = data.counties.find(row => row.id === county)?.name;
  $: choices = districts.filter(row => !county || results.get(row.number)?.counties.some(result => result.id === county));
  $: districtOptions = choices.map(district => ({ value: String(district.number), label: `District ${district.number}`, description: resultState(results.get(district.number)), searchText: results.get(district.number)?.options.map(option => `${option.name} ${option.party}`).join(' ') || '' }));
  $: hoveredResult = hovered ? results.get(Number(hovered)) : undefined;
  // Floating label that follows the mouse: "House District 29 (Juab, Millard, Tooele)".
  const shortCounty = (id: string) => data.counties.find(row => row.id === id)?.name.replace(/ County$/, '') ?? id;
  let stage: HTMLDivElement;
  let tip: { x: number; y: number; flip: boolean } | null = null;
  function trackTip(event: PointerEvent) {
    if (event.pointerType === 'touch' || !stage) { tip = null; return; }
    const box = stage.getBoundingClientRect();
    const x = event.clientX - box.left, y = event.clientY - box.top;
    tip = { x, y, flip: x > box.width - 330 };
  }
  $: tipCounties = hoveredResult ? hoveredResult.counties.map(row => shortCounty(row.id)).sort() : [];
  $: tipTitle = hovered ? `${chamber === 'house' ? 'House' : 'Senate'} District ${hovered}${tipCounties.length ? ` (${tipCounties.join(', ')})` : ''}` : '';
  $: leaders = [...results.values()].filter(row => row.total && row.options.length && resultState(row) !== 'Tied');
  $: leaderCounts = ['Democratic', 'Republican', 'Forward', 'Other'].map(party => ({ party, count: leaders.filter(row => party === 'Other' ? !['Democratic', 'Republican', 'Forward'].includes(row.options[0].party) : row.options[0].party === party).length }));
  function setChamber(next: Chamber) {
    chamber = next; selected = ''; hovered = ''; focused = '';
    // Keep the user's county and map position while changing chambers.
  }
  function chooseCounty() {
    selected = ''; hovered = '';
    const shape = countyShapes.find(row => row.id === county);
    view = shape ? fitBounds(shape.bounds, shape.centroid) : { ...STATE_VIEW };
  }
  function selectDistrict(number: string, fit = false) {
    selected = number;
    if (fit) {
      const shape = districts.find(row => row.number === Number(number));
      if (shape) view = fitBounds(shape.bounds, pathCentroid(shape.path));
    }
  }
  function reset() { view = { ...STATE_VIEW }; county = ''; selected = ''; hovered = ''; focused = ''; }
  function pan(x: number, y: number) { view = constrainView({ ...view, x: view.x + x * view.width, y: view.y + y * view.height }); }
  function onKeydown(event: KeyboardEvent) {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-.18, 0], ArrowRight: [.18, 0], ArrowUp: [0, -.18], ArrowDown: [0, .18] };
    if (directions[event.key]) { event.preventDefault(); pan(...directions[event.key]); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); view = zoomView(view, 1.5); }
    else if (event.key === '-') { event.preventDefault(); view = zoomView(view, 1 / 1.5); }
    else if (event.key === 'Home') { event.preventDefault(); reset(); }
    else if (event.key === 'Escape') { selected = ''; hovered = ''; }
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    suppressClick = false;
    drag = { clientX: event.clientX, clientY: event.clientY, view: { ...view }, scale: matrix.a, district: (event.target as SVGElement).dataset?.district || '', pointer: event.pointerId };
    svg.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.clientX, dy = event.clientY - drag.clientY;
    if (Math.hypot(dx, dy) > 4) suppressClick = true;
    if (suppressClick) view = constrainView({ ...drag.view, x: drag.view.x - dx / drag.scale, y: drag.view.y - dy / drag.scale });
  }
  function pointerUp(event: PointerEvent) {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!suppressClick && drag.district) selectDistrict(drag.district);
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    drag = null;
  }
</script>

<section class="legislative-section" id="statewide-map" aria-labelledby="legislative-title">
  <div class="labs-section-heading"><div><p class="labs-kicker">The state legislature</p><h2 id="legislative-title">Utah, district by district.</h2></div><p>Explore House and Senate results. Zoom into a county, then select a district to see its vote.</p></div>
  <div class="legislative-toolbar"><div class="chamber-toggle" role="group" aria-label="Legislative chamber"><button aria-pressed={chamber === 'senate'} onclick={() => setChamber('senate')}>Utah Senate</button><button aria-pressed={chamber === 'house'} onclick={() => setChamber('house')}>Utah House</button></div><Combobox id="legislative-county-select" label="Zoom to a county" value={county} options={countyOptions} placeholder="Find a county…" itemLabel="county" itemsLabel="counties" hint="Type a county name." emptyMessage="No matching counties. Try another name." onSelect={(value) => { county = value; chooseCounty(); }} /><label class="county-overlay"><input type="checkbox" bind:checked={showCounties} /> County boundaries</label></div>
  <div class="legislative-summary" role="status"><strong>{results.size} of {chamber === 'house' ? 75 : 29} districts have published 2026 results</strong><span>{#each leaderCounts.filter(row => row.count) as row}<span><ResultPartyName name={row.party} />: <b>{row.count}</b> leading</span>{/each}</span></div>
  {#if loading}<p class="labs-message" role="status">Loading Utah’s legislative map…</p>{:else if error}<div class="labs-message" role="alert"><p>{error}</p><button onclick={loadGeometry}>Retry map</button><a href="#all-results">Browse results</a></div>{:else}
  <div class="legislative-layout">
    <div class="legislative-map-panel">
      <!-- Pointer tracking only positions the decorative hover label; the live status line below carries the same text. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="legislative-map-stage" bind:this={stage} onpointermove={trackTip} onpointerleave={() => tip = null}>
        <!-- The focusable map group owns documented keyboard pan/zoom shortcuts; district paths are separate buttons. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <svg bind:this={svg} class:dragging={!!drag && suppressClick} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="group" tabindex="0" aria-label={`${chamberLabel(chamber)} district results map`} aria-describedby="legislative-map-help"
          onkeydown={onKeydown} onpointerdown={pointerDown} onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={() => drag = null}>
          <title>{chamberLabel(chamber)} results across Utah</title>
          <defs><pattern id="legislative-no-result" patternUnits="userSpaceOnUse" width={6 / zoom} height={6 / zoom} patternTransform="rotate(35)"><rect width={6 / zoom} height={6 / zoom} fill="#e8e5df" /><rect width={2 / zoom} height={6 / zoom} fill="#faf9f6" /></pattern></defs>
          {#each districts as district (district.number)}
            {@const result = results.get(district.number)}
            {@const state = resultState(result)}
            <path class="legislative-district" class:active={selected === String(district.number)} data-district={district.number} d={district.path} fill={result?.total && state !== 'Tied' ? color(result.options[0]) : 'url(#legislative-no-result)'} fill-rule="evenodd" role="button" tabindex="0" aria-pressed={selected === String(district.number)} aria-label={`${chamberLabel(chamber)} District ${district.number}: ${state}. Select for details.`}
              onclick={() => { if (!suppressClick) selectDistrict(String(district.number)); }}
              onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); selectDistrict(String(district.number)); } }}
              onmouseenter={() => hovered = String(district.number)} onmouseleave={() => hovered = ''} onfocus={() => { hovered = String(district.number); focused = String(district.number); }} onblur={() => { hovered = ''; focused = ''; }}><title>{chamberLabel(chamber)} District {district.number}: {state}</title></path>
          {/each}
          {#if showCounties}{#each countyShapes as shape}<path class="legislative-county-border" class:chosen={county === shape.id} d={shape.path} />{/each}{/if}
          <g aria-hidden="true" class="legislative-selection-layer">{#each highlightedShapes as district (district.number)}<path class="legislative-selection-halo" d={district.path} /><path class="legislative-selection-border" d={district.path} />{/each}</g>
          {#if selectedCounty}<text class="legislative-county-label" x={selectedCounty.centroid[0]} y={selectedCounty.centroid[1]} font-size={8 / zoom} text-anchor="middle" dominant-baseline="middle">{countyName}</text>{/if}
        </svg>
        <div class="map-zoom-controls" role="group" aria-label="Map zoom controls"><button aria-label="Zoom in" disabled={zoom >= MAX_ZOOM - .01} onclick={() => view = zoomView(view, 1.5)}><Icon name="add" /></button><button aria-label="Zoom out" disabled={zoom <= 1.01} onclick={() => view = zoomView(view, 1 / 1.5)}><Icon name="remove" /></button><button class="map-reset" aria-label="Reset map to all Utah" onclick={reset}><Icon name="zoom_out_map" /></button></div>
        {#if zoom > 1.01}<div class="map-pan-controls" role="group" aria-label="Pan map"><button aria-label="Pan left" onclick={() => pan(-.2, 0)}><Icon name="arrow_back" /></button><button aria-label="Pan up" onclick={() => pan(0, -.2)}><Icon name="arrow_upward" /></button><button aria-label="Pan down" onclick={() => pan(0, .2)}><Icon name="arrow_downward" /></button><button aria-label="Pan right" onclick={() => pan(.2, 0)}><Icon name="arrow_forward" /></button></div>{/if}
        {#if hovered && tip && !(drag && suppressClick)}<div class="map-tooltip" aria-hidden="true" style={`left:${tip.x}px;top:${tip.y}px;transform:translate(${tip.flip ? 'calc(-100% - 14px)' : '14px'}, calc(-100% - 10px))`}><strong>{tipTitle}</strong><span>{resultState(hoveredResult)}</span></div>{/if}
        <span class="map-zoom-level" aria-live="polite">{zoom.toFixed(1)}×</span>
      </div>
      <p class="map-hover-status" aria-live="polite">{hovered ? `${chamberLabel(chamber)} District ${hovered} · ${resultState(hoveredResult)}` : 'Select a district on the map or choose one from the list.'}</p>
      <div class="map-legend legislative-legend"><span><i style="background:#2675aa"></i><ResultPartyName name="Democratic" /> leader</span><span><i style="background:#bc443d"></i><ResultPartyName name="Republican" /> leader</span><span><i style="background:#79629d"></i><ResultPartyName name="Forward" /> leader</span><span><i style="background:#626870"></i>Other leader</span><span><i class="map-pattern"></i>No result / tied</span></div>
      <p class="map-note" id="legislative-map-help">Drag to pan after zooming, or use the arrow buttons. Keyboard: +/− to zoom, arrow keys to pan, Home to reset. District colors show full-district leaders, including when zoomed into a county.</p>
    </div>
    <aside class="legislative-details" aria-label="Selected legislative district">
      {#key `${chamber}:${county}`}<Combobox id="legislative-district-select" label={county ? 'Choose a race reporting in this county' : 'Choose a district'} value={selected} valueLabel={selected ? `District ${selected}` : ''} options={districtOptions} placeholder="Select a district…" onSelect={(number) => selectDistrict(number, !!number && !county)} />{/key}
      {#if selectedShape}<div class="district-detail-heading"><p class="labs-kicker">{chamberLabel(chamber)}</p><h3>{#if districtHref}<a class="result-office-link" href={districtHref}>District {selected}</a>{:else}District {selected}{/if}</h3></div>
        {#if contest && currentResult}<p class="district-total-scope">{countyResult ? `${countyName} votes in this district` : 'Full district results'}</p><p class="district-current-leader">{resultState(contest)} <small>District-wide</small></p><div class="vote-bar" aria-hidden="true">{#each currentResult.options as option}<span style={`width:${currentResult.total ? option.votes / currentResult.total * 100 : 0}%;background:${color(option)}`}></span>{/each}</div>
          {#each currentResult.options as option}<div class="candidate-result"><span class="party-dot" style={`background:${color(option)}`}></span><div><strong><ResultPersonName name={option.name} {contest} /></strong><small><ResultPartyName name={option.party} fallback="Unaffiliated / write-in" /></small></div><b>{#if currentResult.total}<CountUp value={option.votes / currentResult.total * 100} format={formatPercent} />{:else}—{/if}<small><CountUp value={option.votes} /> votes</small></b></div>{/each}
          <p class="votes-total"><CountUp value={currentResult.total} /> votes reported</p><div class="district-detail-actions"><button onclick={() => explore(contest.id)}>Explore full race <Icon name="arrow_forward" /></button><a href={contest.source}>Official results <Icon name="arrow_outward" /></a></div>
        {:else}<p class="district-empty">No 2026 result is published for this district. Senate seats have staggered elections; this may be a seat not on this year’s ballot. No incumbent-party result is inferred.</p>{/if}
      {:else}<div class="district-intro"><p class="labs-kicker">{countyName || 'Start exploring'}</p><h3>{countyName ? 'Your county’s races.' : 'Find your district.'}</h3><p>Select a district for candidate names, vote counts, and a link to the full race.</p></div>
        <div class="county-race-list" aria-label={countyName ? `${countyName} races` : `${chamberLabel(chamber)} races`}>{#each choices.filter(row => results.has(row.number)) as district}{@const result = results.get(district.number)!}<button onclick={() => selectDistrict(String(district.number))}><strong>District {district.number}</strong><span>{resultState(result)}</span></button>{:else}<p>No {chamberLabel(chamber)} results are published for this county.</p>{/each}</div>
      {/if}
    </aside>
  </div>
  {/if}
  <div class="map-note legislative-source"><p>{data.official ? 'Official' : 'Unofficial'} 2026 results · Colors show vote leaders, not projected winners or legislative control. Patterns indicate no published result or a tie.</p><p>Districts can cross county lines. Boundaries: <a href="https://gis.utah.gov/products/sgid/political/state-house-districts/">Utah House</a> / <a href="https://gis.utah.gov/products/sgid/political/state-senate-districts/">Utah Senate</a>, 2022–2032 plans. Simplified for visualization; use official tools for address lookup.</p></div>
</section>
