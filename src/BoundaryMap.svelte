<script lang="ts">
  import { onMount } from 'svelte';
  import { utahOutline, type BoundaryMap } from './lib/boundary-maps';
  export let map: BoundaryMap;
  /** 'fill' sizes the frame from its container (place pages); 'natural' uses the map's own shape. */
  export let fit: 'fill' | 'natural' = 'natural';
  export let className = '';

  // MapTiler hillshade is loaded live from their API (their terms forbid baking it into our files).
  const key = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
  const TILE = 512;
  const MAX_ZOOM = 12;

  let frame: HTMLDivElement;
  let drawing = { width: 0, height: 0 };
  let tiles: { src: string; left: number; top: number; size: number; sizeY: number }[] = [];
  let terrain = false;

  $: [west, north, east, south] = map.bounds;
  $: aspect = map.width / map.height;
  // Locator inset, matching the spot the generator keeps clear of labels: 20% of the map's width tall, 12 map pixels in from the top right.
  $: unit = drawing.width / map.width || 0;
  $: insetHeight = map.width * 0.2 * unit;
  $: insetWidth = insetHeight * utahOutline.width / utahOutline.height;
  $: [utahWest, utahNorth, utahEast, utahSouth] = utahOutline.bounds;
  $: crop = { left: (west - utahWest) / (utahEast - utahWest) * 100, top: (north - utahNorth) / (utahSouth - utahNorth) * 100, width: (east - west) / (utahEast - utahWest) * 100, height: (south - north) / (utahSouth - utahNorth) * 100 };

  /** Contain-fit the map in the frame, so nothing is cropped. */
  function measure() {
    if (!frame) return;
    const { clientWidth: w, clientHeight: h } = frame;
    drawing = w / h > aspect ? { width: h * aspect, height: h } : { width: w, height: w / aspect };
    if (key && drawing.width) tiles = cover(drawing.width * Math.min(devicePixelRatio || 1, 2));
  }

  /** Hillshade tiles covering the map's bounds, at about one tile pixel per screen pixel. */
  function cover(pixels: number) {
    const zoom = Math.max(0, Math.min(MAX_ZOOM, Math.ceil(Math.log2(pixels / (TILE * (east - west))))));
    const n = 2 ** zoom, spanX = east - west, spanY = south - north;
    const list = [];
    for (let x = Math.floor(west * n); x < Math.ceil(east * n); x++)
      for (let y = Math.floor(north * n); y < Math.ceil(south * n); y++)
        list.push({ src: `https://api.maptiler.com/tiles/hillshade/${zoom}/${x}/${y}.webp?key=${key}`, left: (x / n - west) / spanX * 100, top: (y / n - north) / spanY * 100, size: 100 / n / spanX, sizeY: 100 / n / spanY });
    return list;
  }

  onMount(() => {
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  });
</script>

<figure class="boundary-map {className}" class:fill={fit === 'fill'}>
  <div class="boundary-frame" bind:this={frame} style:--aspect="{map.width} / {map.height}">
    <div class="boundary-drawing" class:terrain style:width={drawing.width ? `${drawing.width}px` : '100%'} style:height={drawing.height ? `${drawing.height}px` : '100%'}>
      {#if tiles.length}<div class="boundary-terrain" aria-hidden="true">{#each tiles as tile (tile.src)}<img src={tile.src} alt="" loading="lazy" decoding="async" style:left="{tile.left}%" style:top="{tile.top}%" style:width="{tile.size}%" style:height="{tile.sizeY}%" onload={() => terrain = true} onerror={() => tiles = tiles.filter((other) => other !== tile)} />{/each}</div>{/if}
      <img class="boundary-shape" src={map.src} alt={`Map of ${map.title}`} width={map.width} height={map.height} />
      {#if map.locator && unit}<div class="boundary-locator" aria-hidden="true" style:top="{12 * unit}px" style:right="{12 * unit}px" style:width="{insetWidth}px" style:height="{insetHeight}px" style:padding="{6 * unit}px"><div><img src={utahOutline.src} alt="" /><i style:left="{crop.left}%" style:top="{crop.top}%" style:width="max(3px, {crop.width}%)" style:height="max(3px, {crop.height}%)"></i></div></div>{/if}
      {#if terrain}<a class="maptiler-logo" href="https://www.maptiler.com/" target="_blank" rel="noreferrer"><img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler" /></a>{/if}
    </div>
  </div>
  <figcaption>{map.note} Boundaries: <a href="https://gis.utah.gov/" target="_blank" rel="noreferrer">Utah UGRC<span class="sr-only"> (opens in new tab)</span></a>.{#if terrain}{' '}Terrain: <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">© MapTiler<span class="sr-only"> (opens in new tab)</span></a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors<span class="sr-only"> (opens in new tab)</span></a>.{/if}</figcaption>
</figure>
