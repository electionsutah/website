<script lang="ts">
  import boundaries from './data/utah-county-paths.json';
  import { color, leader, percent, seatsOf, type Contest } from './lib/results';
  import { contestTitle } from './lib/result-people';
  export let contest: Contest;
  export let selected = '';
  export let choose: (id: string) => void;
  export let hover: (id: string) => void = () => {};
  $: results = new Map(contest.counties.map(row => [row.id, row]));
  let focused = '';
  // Draw the selection on top so neighbouring counties can't cover its border.
  $: highlighted = boundaries.filter(county => county.id === selected || county.id === focused);
  function description(id: string, name: string) {
    const row = results.get(id);
    return row ? `${name}: ${leader(row, seatsOf(contest))}${row.options[0] && seatsOf(contest) === 1 ? `, ${percent(row.options[0].votes, row.total)}` : ''}. Select county results.` : `${name}: no results for this contest.`;
  }
</script>

<div class="county-map">
  <!-- County paths span x=2.26–241.99, y=6.10–316.33; leave 12 units around the full map. -->
  <svg viewBox="-10 -6 264 334" aria-label={`County results for ${contestTitle(contest)}`}>
    <title>{contestTitle(contest)}: county vote leaders</title>
    {#each boundaries as county}
      {@const row = results.get(county.id)}
      <path class="county" d={county.path} fill={row?.total && leader(row) !== 'Tied' ? color(row.options[0]) : '#e8e5df'}
        class:available={!!row}
        role="button" tabindex={row ? 0 : undefined} aria-disabled={!row} aria-pressed={selected === county.id}
        aria-label={description(county.id, county.name)}
        onclick={() => row && choose(selected === county.id ? '' : county.id)}
        onkeydown={(event) => { if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(selected === county.id ? '' : county.id); } }}
        onmouseenter={() => row && hover(county.id)} onmouseleave={() => hover('')}
        onfocus={(event) => { if (row) { hover(county.id); if (event.currentTarget.matches(':focus-visible')) focused = county.id; } }} onblur={() => { hover(''); focused = ''; }}><title>{description(county.id, county.name)}</title></path>
    {/each}
    <g aria-hidden="true" class="map-selection-layer">{#each highlighted as county (county.id)}<path class="map-selection-halo" d={county.path} /><path class="map-selection-border" d={county.path} />{/each}</g>
  </svg>
</div>

<style>
  .county-map{width:100%;min-width:0;display:grid;place-items:center}
  svg{display:block;width:100%;max-width:240px;height:auto;overflow:hidden}
  path.county{stroke:#fff;stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  path.county:not(.available){pointer-events:none}
  path.county.available{cursor:pointer;outline:none}
  path.county.available:hover{filter:brightness(1.08)}
</style>
