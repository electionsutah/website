<script lang="ts">
  import Icon from './Icon.svelte';
  import CountUp from './CountUp.svelte';
  import { revealVoteBar } from './lib/vote-animation';
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;
  import { onMount } from 'svelte';
  import type { Map as MapLibreMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
  import counties from './data/utah-county-paths.json';
  import ResultPersonName from './ResultPersonName.svelte';
  import Combobox from './Combobox.svelte';
  import ResultPartyName from './ResultPartyName.svelte';
  import { resultOfficeHref } from './lib/result-links';
  import { color, RESULT_COLORS, type Snapshot } from './lib/results';
  import { chamberLabel, districtResults, pathBounds, resultState, type LegislativeGeometry, type Chamber } from './lib/legislative-map';
  import { UTAH_BOUNDS, lngLatBounds, maskAround, multiPolygon } from './lib/legislative-geo';
  export let data: Snapshot;
  export let explore: (id: string) => void;
  let geometry: LegislativeGeometry | null = null;
  let loading = true;
  let error = '';
  let chamber: Chamber = 'house';
  let county = '';
  let selected = '';
  let hovered = '';
  let showCounties = false;
  $: countyOptions = [{ value: '', label: 'All Utah' }, ...data.counties.map(row => ({ value: row.id, label: row.name }))];
  const countyShapes = counties.map(row => ({ ...row, bounds: pathBounds(row.path) }));
  async function loadGeometry() {
    loading = true; error = '';
    try {
      const response = await fetch('/data/utah-legislative-boundaries.json');
      if (!response.ok) throw new Error('Boundary download failed');
      geometry = await response.json();
    } catch { error = 'District boundaries could not be loaded. Retry the map, or use the results desk below.'; }
    finally { loading = false; }
  }
  onMount(() => { void loadGeometry(); return () => map?.remove(); });
  $: districts = geometry?.chambers[chamber].districts || [];
  $: results = districtResults(data, chamber);
  $: selectedShape = districts.find(row => row.number === Number(selected));
  $: contest = selected ? results.get(Number(selected)) : undefined;
  $: districtHref = resultOfficeHref(`${chamber === 'house' ? 'State House' : 'State Senate'} District ${selected}`);
  $: countyResult = county ? contest?.counties.find(row => row.id === county) : undefined;
  $: currentResult = countyResult || contest;
  $: countyName = data.counties.find(row => row.id === county)?.name;
  $: choices = districts.filter(row => !county || results.get(row.number)?.counties.some(result => result.id === county));
  $: chamberName = chamber === 'house' ? 'House' : 'Senate';
  $: districtOptions = choices.map(district => ({ value: String(district.number), label: `${chamberName} District ${district.number}`, description: resultState(results.get(district.number)), searchText: results.get(district.number)?.options.map(option => `${option.name} ${option.party}`).join(' ') || '' }));
  $: hoveredResult = hovered ? results.get(Number(hovered)) : undefined;
  // Floating label that follows the mouse: "House District 29 (Juab, Millard, Tooele)".
  const shortCounty = (id: string) => data.counties.find(row => row.id === id)?.name.replace(/ County$/, '') ?? id;
  let tip: { x: number; y: number; flip: boolean } | null = null;
  $: tipCounties = hoveredResult ? hoveredResult.counties.map(row => shortCounty(row.id)).sort() : [];
  $: tipTitle = hovered ? `${chamberName} District ${hovered}${tipCounties.length ? ` (${tipCounties.join(', ')})` : ''}` : '';
  $: leaders = [...results.values()].filter(row => row.total && row.options.length && resultState(row) !== 'Tied');
  $: leaderCounts = ['Democratic', 'Republican', 'Forward', 'Other'].map(party => ({ party, count: leaders.filter(row => party === 'Other' ? !['Democratic', 'Republican', 'Forward'].includes(row.options[0].party) : row.options[0].party === party).length }));

  // MapLibre map: MapTiler's OpenMapTiles vector style with hillshade, loaded live (their terms forbid caching tiles).
  const key = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
  let basemapAvailable = !!key;
  let basemapFailed = false;
  let container: HTMLDivElement;
  let map: MapLibreMap | null = null;
  let ready = false;
  let zoom = 1;
  let minZoom = 0;
  const FIT = { padding: 28 };
  // MapLibre can't read CSS variables, so resolve design tokens from app.css when the map is built (client only).
  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  const blankStyle = (): StyleSpecification => ({ version: 8, sources: {}, layers: [{ id: 'Background', type: 'background', paint: { 'background-color': token('paper') } }] });
  const empty = { type: 'FeatureCollection' as const, features: [] };
  $: if (geometry && container && !map) void createMap();
  async function createMap() {
    const [{ Map: MapLibre, setWorkerUrl }, { default: workerUrl }] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'), import('maplibre-gl/dist/maplibre-gl.css')]);
    // MapLibre 6 runs its worker from a separate module file; ship it as an asset and point the library at it.
    setWorkerUrl(workerUrl);
    const instance = new MapLibre({ container, style: key ? `https://api.maptiler.com/maps/dataviz-light/style.json?key=${key}` : blankStyle(), bounds: UTAH_BOUNDS, fitBoundsOptions: FIT, attributionControl: { compact: true }, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxZoom: 13 });
    instance.touchZoomRotate.disableRotation();
    instance.keyboard.disableRotation();
    map = instance;
    instance.on('error', () => {
      // A rejected style (for example, a restricted API key on localhost) must
      // not prevent our locally hosted district boundaries and votes loading.
      if (!ready && basemapAvailable) {
        basemapAvailable = false;
        basemapFailed = true;
        instance.setStyle(blankStyle());
      }
    });
    instance.once('load', () => {
      minZoom = instance.getZoom() - .5;
      instance.setMinZoom(minZoom);
      instance.setMaxBounds([[UTAH_BOUNDS[0][0] - 4, UTAH_BOUNDS[0][1] - 3], [UTAH_BOUNDS[1][0] + 4, UTAH_BOUNDS[1][1] + 3]]);
      // Diagonal stripes for districts with no published result or a tie, as in the legend (--color-page on --color-rule-soft).
      const size = 12, stripes = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const on = (x + y) % 6 < 2, i = (y * size + x) * 4; stripes.set(on ? [248, 248, 246, 230] : [216, 215, 209, 230], i); }
      instance.addImage('no-result', { width: size, height: size, data: stripes });
      // Draw under roads and labels so places stay readable over the districts.
      const before = instance.getStyle().layers.find(layer => layer.id === 'Road network outline' || layer.type === 'symbol')?.id;
      const labels = instance.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
      instance.addSource('districts', { type: 'geojson', data: empty, promoteId: 'number' });
      instance.addSource('counties', { type: 'geojson', data: { type: 'FeatureCollection', features: countyShapes.map(row => ({ type: 'Feature', properties: { id: row.id }, geometry: multiPolygon(row.path) })) } });
      instance.addSource('mask', { type: 'geojson', data: empty });
      instance.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', filter: ['has', 'color'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': .82 } }, before);
      instance.addLayer({ id: 'district-pattern', type: 'fill', source: 'districts', filter: ['!', ['has', 'color']], paint: { 'fill-pattern': 'no-result', 'fill-opacity': .9 } }, before);
      if (basemapAvailable) instance.addSource('hillshade', { type: 'raster', tiles: [`https://api.maptiler.com/tiles/hillshade/{z}/{x}/{y}.webp?key=${key}`], tileSize: 512, maxzoom: 12 });
      if (basemapAvailable) instance.addLayer({ id: 'hillshade', type: 'raster', source: 'hillshade', paint: { 'raster-opacity': .55 } }, before);
      instance.addLayer({ id: 'district-line', type: 'line', source: 'districts', paint: { 'line-color': token('paper'), 'line-width': ['interpolate', ['linear'], ['zoom'], 5, .6, 10, 1.6], 'line-opacity': .9 } }, labels);
      instance.addLayer({ id: 'county-line', type: 'line', source: 'counties', layout: { visibility: 'none' }, paint: { 'line-color': token('ink'), 'line-width': 1, 'line-opacity': .55 } }, labels);
      instance.addLayer({ id: 'county-chosen', type: 'line', source: 'counties', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': token('ink'), 'line-width': 2.2 } }, labels);
      instance.addLayer({ id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': token('ink'), 'fill-opacity': .58 } }, labels);
      instance.addLayer({ id: 'selected-halo', type: 'line', source: 'districts', filter: ['==', ['get', 'number'], -1], paint: { 'line-color': token('ink'), 'line-width': 6 } }, labels);
      instance.addLayer({ id: 'selected-border', type: 'line', source: 'districts', filter: ['==', ['get', 'number'], -1], paint: { 'line-color': token('highlight'), 'line-width': 3 } }, labels);
      instance.addLayer({ id: 'hover-border', type: 'line', source: 'districts', filter: ['==', ['get', 'number'], -1], paint: { 'line-color': token('ink'), 'line-width': 1.6 } }, labels);
      const canvas = instance.getCanvas();
      canvas.setAttribute('aria-label', `${chamberLabel(chamber)} district results map. Use the district list to select a district.`);
      canvas.setAttribute('aria-describedby', 'legislative-map-help');
      ready = true;
    });
    const hit = (point: { x: number; y: number }) => instance.queryRenderedFeatures([point.x, point.y], { layers: ['district-fill', 'district-pattern'] })[0];
    instance.on('mousemove', (event) => {
      const feature = ready ? hit(event.point) : undefined;
      hovered = feature ? String(feature.properties.number) : '';
      instance.getCanvas().style.cursor = feature ? 'pointer' : '';
      tip = feature ? { x: event.point.x, y: event.point.y, flip: event.point.x > container.clientWidth - 330 } : null;
    });
    instance.on('mouseout', () => { hovered = ''; tip = null; });
    instance.on('click', (event) => {
      const feature = ready ? hit(event.point) : undefined;
      if (!feature) return;
      // A second click on the selected district clears it and returns to the previous view.
      if (String(feature.properties.number) === selected) deselect(); else selectDistrict(String(feature.properties.number), true);
    });
    instance.on('zoom', () => { zoom = 2 ** (instance.getZoom() - minZoom - .5); });
    instance.on('dragstart', () => { tip = null; });
  }
  $: features = { type: 'FeatureCollection' as const, features: districts.map(district => { const result = results.get(district.number); const leader = result?.total && resultState(result) !== 'Tied' ? color(result.options[0]) : undefined; return { type: 'Feature' as const, id: district.number, properties: leader ? { number: district.number, color: leader } : { number: district.number }, geometry: multiPolygon(district.path) }; }) };
  $: if (ready && map) (map.getSource('districts') as GeoJSONSource).setData(features);
  $: if (ready && map) (map.getSource('mask') as GeoJSONSource).setData(selectedShape ? { type: 'Feature', properties: {}, geometry: maskAround(selectedShape.path) } : empty);
  $: if (ready && map) for (const id of ['selected-halo', 'selected-border']) map.setFilter(id, ['==', ['get', 'number'], selectedShape ? selectedShape.number : -1]);
  $: if (ready && map) map.setFilter('hover-border', ['==', ['get', 'number'], hovered && hovered !== selected ? Number(hovered) : -1]);
  $: if (ready && map) map.setLayoutProperty('county-line', 'visibility', showCounties ? 'visible' : 'none');
  $: if (ready && map) map.setFilter('county-chosen', ['==', ['get', 'id'], county]);
  function fit(bounds: [[number, number], [number, number]]) { map?.fitBounds(bounds, { ...FIT, padding: 48, maxZoom: 11, duration: 700 }); }
  function setChamber(next: Chamber) {
    chamber = next; selected = ''; hovered = '';
    // Keep the user's county and map position while changing chambers.
  }
  function chooseCounty() {
    selected = ''; hovered = '';
    const shape = countyShapes.find(row => row.id === county);
    if (shape) fit(lngLatBounds(shape.bounds)); else reset();
  }
  /** Select a district; recenter on it when asked (map clicks and list choices outside a county view). */
  function selectDistrict(number: string, recenter = false) {
    selected = number;
    const shape = districts.find(row => row.number === Number(number));
    if (recenter && shape) fit(lngLatBounds(shape.bounds));
  }
  /** Clear the selection and zoom back out to the chosen county, or all of Utah. */
  function deselect() {
    selected = '';
    const shape = countyShapes.find(row => row.id === county);
    if (shape) fit(lngLatBounds(shape.bounds)); else map?.fitBounds(UTAH_BOUNDS, { ...FIT, duration: 700 });
  }
  function reset() { county = ''; selected = ''; hovered = ''; map?.fitBounds(UTAH_BOUNDS, { ...FIT, duration: 700 }); }
  function pan(x: number, y: number) { map?.panBy([x * container.clientWidth, y * container.clientHeight]); }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Home') { event.preventDefault(); reset(); }
    else if (event.key === 'Escape') { selected = ''; hovered = ''; }
  }
</script>

<section class="legislative-section" id="statewide-map" aria-labelledby="legislative-title">
  <div class="labs-section-heading"><div><p class="labs-kicker">The state legislature</p><h2 id="legislative-title">Utah, district by district.</h2></div><p>Explore House and Senate results. Zoom into a county, then select a district to see its vote.</p></div>
  <div class="legislative-summary" role="status"><strong>{results.size} of {chamber === 'house' ? 75 : 29} districts have published 2026 results</strong><span>{#each leaderCounts.filter(row => row.count) as row}<span><ResultPartyName name={row.party} />: <b>{row.count}</b> leading</span>{/each}</span></div>
  {#if loading}<p class="labs-message" role="status">Loading Utah’s legislative map…</p>{:else if error}<div class="labs-message" role="alert"><p>{error}</p><button onclick={loadGeometry}>Retry map</button><a href="#all-results">Browse results</a></div>{:else}
  <div class="legislative-layout">
    <div class="legislative-map-panel">
      <!-- Home and Escape add to MapLibre's own keyboard controls (arrow keys pan, +/− zoom) on the focused map. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="legislative-map-stage" onkeydown={onKeydown}>
        <div class="legislative-map-canvas" bind:this={container}></div>
        <div class="map-zoom-controls" role="group" aria-label="Map zoom controls"><button aria-label="Zoom in" title="Zoom in (+)" disabled={!ready} onclick={() => map?.zoomIn()}><Icon name="add" /></button><button aria-label="Zoom out" title="Zoom out (−)" disabled={!ready || zoom <= 1.01} onclick={() => map?.zoomOut()}><Icon name="remove" /></button><button class="map-reset" aria-label="Reset map to all Utah" title="Reset map to all Utah (Home)" onclick={reset}><Icon name="zoom_out_map" /></button></div>
        {#if zoom > 1.01}<div class="map-pan-controls" role="group" aria-label="Pan map"><button aria-label="Pan left" title="Pan left (←)" onclick={() => pan(-.2, 0)}><Icon name="arrow_back" /></button><button aria-label="Pan up" title="Pan up (↑)" onclick={() => pan(0, -.2)}><Icon name="arrow_upward" /></button><button aria-label="Pan down" title="Pan down (↓)" onclick={() => pan(0, .2)}><Icon name="arrow_downward" /></button><button aria-label="Pan right" title="Pan right (→)" onclick={() => pan(.2, 0)}><Icon name="arrow_forward" /></button></div>{/if}
        {#if hovered && tip}<div class="map-tooltip" aria-hidden="true" style={`left:${tip.x}px;top:${tip.y}px;transform:translate(${tip.flip ? 'calc(-100% - 14px)' : '14px'}, calc(-100% - 10px))`}><strong>{tipTitle}</strong><span>{resultState(hoveredResult)}</span></div>{/if}
        {#if basemapAvailable && ready}<a class="maptiler-logo" href="https://www.maptiler.com/" target="_blank" rel="noreferrer"><img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler" /></a>{/if}
      </div>
      {#if basemapFailed}<p class="map-note" role="status">The base map is unavailable. District boundaries and election results are still shown.</p>{/if}
      <p class="map-hover-status" aria-live="polite">{hovered ? `${chamberLabel(chamber)} District ${hovered} · ${resultState(hoveredResult)}` : 'Select a district on the map or choose one from the list.'}</p>
      <div class="map-legend legislative-legend"><span><i style:background={RESULT_COLORS.Democratic}></i><ResultPartyName name="Democratic" /> leader</span><span><i style:background={RESULT_COLORS.Republican}></i><ResultPartyName name="Republican" /> leader</span><span><i style:background={RESULT_COLORS.Forward}></i><ResultPartyName name="Forward" /> leader</span><span><i style:background={RESULT_COLORS.other}></i>Other leader</span><span><i class="map-pattern"></i>No result / tied</span></div>
      <p class="map-note" id="legislative-map-help">Drag to pan, or use the arrow buttons. Hold Ctrl (⌘ on Mac) and scroll to zoom, or use two fingers on touch screens. Keyboard: +/− to zoom, arrow keys to pan, Home to reset, Escape to clear the selection. District colors show full-district leaders, including when zoomed into a county.</p>
    </div>
    <aside class="legislative-details" aria-label="Selected legislative district">
      {#if !selectedShape}<div class="district-intro"><p class="labs-kicker">{countyName || 'Start exploring'}</p><h3>{countyName ? 'Your county’s races.' : 'Find your district.'}</h3></div>{/if}
      <div class="chamber-toggle" role="group" aria-label="Legislative chamber"><button aria-pressed={chamber === 'senate'} onclick={() => setChamber('senate')}>Utah Senate</button><button aria-pressed={chamber === 'house'} onclick={() => setChamber('house')}>Utah House</button></div>
      {#if !selectedShape}<p class="district-intro-text">Select a district for candidate names, vote counts, and a link to the full race.</p>{/if}
      {#key `${chamber}:${county}`}<Combobox id="legislative-district-select" label={county ? `Choose a ${chamberName} district in this county` : `Choose a ${chamberName} district`} value={selected} valueLabel={selected ? `${chamberName} District ${selected}` : ''} options={districtOptions} placeholder="Select a district…" onSelect={(number) => selectDistrict(number, !!number)} />{/key}
      <div class="legislative-toolbar"><Combobox id="legislative-county-select" label="Zoom to a county" value={county} options={countyOptions} placeholder="Find a county…" itemLabel="county" itemsLabel="counties" hint="Type a county name." emptyMessage="No matching counties. Try another name." onSelect={(value) => { county = value; chooseCounty(); }} /><label class="county-overlay"><input type="checkbox" bind:checked={showCounties} /> County boundaries</label></div>
      {#if selectedShape}<div class="district-detail-heading"><p class="labs-kicker">{chamberLabel(chamber)}</p><h3>{#if districtHref}<a class="result-office-link" href={districtHref}>District {selected}</a>{:else}District {selected}{/if}</h3></div>
        {#if contest && currentResult}<p class="district-total-scope">{countyResult ? `${countyName} votes in this district` : 'Full district results'}</p><p class="district-current-leader">{resultState(contest)} <small>District-wide</small></p><div class="vote-bar" aria-hidden="true" use:revealVoteBar={currentResult}>{#each currentResult.options as option}<span style={`width:${currentResult.total ? option.votes / currentResult.total * 100 : 0}%;background:${color(option)}`}></span>{/each}</div>
          {#each currentResult.options as option}<div class="candidate-result"><span class="party-dot" style={`background:${color(option)}`}></span><div><strong><ResultPersonName name={option.name} {contest} /></strong><small><ResultPartyName name={option.party} fallback="Unaffiliated / write-in" /></small></div><b>{#if currentResult.total}<CountUp value={option.votes / currentResult.total * 100} format={formatPercent} />{:else}—{/if}<small><CountUp value={option.votes} /> votes</small></b></div>{/each}
          <p class="votes-total"><CountUp value={currentResult.total} /> votes reported</p><div class="district-detail-actions"><button onclick={() => explore(contest.id)}>Explore full race <Icon name="arrow_forward" /></button><a href={contest.source}>Official results <Icon name="arrow_outward" /></a></div>
        {:else}<p class="district-empty">No 2026 result is published for this district. Senate seats have staggered elections; this may be a seat not on this year’s ballot. No incumbent-party result is inferred.</p>{/if}
      {:else}{#if county && !choices.some(row => results.has(row.number))}<p class="district-empty">No {chamberLabel(chamber)} results are published for this county.</p>{/if}
      {/if}
    </aside>
  </div>
  {/if}
  <div class="map-note legislative-source"><p>Colors show vote leaders, not projected winners or legislative control. Patterns indicate no published result or a tie.</p><p>Districts can cross county lines. Boundaries: <a href="https://gis.utah.gov/products/sgid/political/state-house-districts/">Utah House</a> / <a href="https://gis.utah.gov/products/sgid/political/state-senate-districts/">Utah Senate</a>, 2022–2032 plans. Simplified for visualization; use official tools for address lookup. Base map and terrain: <a href="https://www.maptiler.com/copyright/">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>.</p></div>
</section>
