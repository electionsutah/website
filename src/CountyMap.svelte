<script lang="ts">
  import boundaries from './data/utah-county-paths.json';
  import { color, leader, percent, type Contest } from './lib/results';
  export let contest: Contest;
  export let selected = '';
  export let choose: (id: string) => void;
  export let hover: (id: string) => void = () => {};
  $: results = new Map(contest.counties.map(row => [row.id, row]));
  function description(id: string, name: string) {
    const row = results.get(id);
    return row ? `${name}: ${leader(row)}${row.options[0] ? `, ${percent(row.options[0].votes, row.total)}` : ''}. Select county results.` : `${name}: no results for this contest.`;
  }
</script>

<div class="county-map">
  <!-- County paths span x=2.26–241.99, y=6.10–316.33; leave 12 units around the full map. -->
  <svg viewBox="-10 -6 264 334" aria-label={`County results for ${contest.name}`}>
    <title>{contest.name}: county vote leaders</title>
    {#each boundaries as county}
      {@const row = results.get(county.id)}
      <path d={county.path} fill={row?.total && leader(row) !== 'Tied' ? color(row.options[0]) : '#e8e5df'}
        class:selected={selected === county.id} class:available={!!row}
        role="button" tabindex={row ? 0 : -1} aria-disabled={!row} aria-pressed={selected === county.id}
        aria-label={description(county.id, county.name)}
        onclick={() => row && choose(selected === county.id ? '' : county.id)}
        onkeydown={(event) => { if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(selected === county.id ? '' : county.id); } }}
        onmouseenter={() => row && hover(county.id)} onmouseleave={() => hover('')}
        onfocus={() => row && hover(county.id)} onblur={() => hover('')}><title>{description(county.id, county.name)}</title></path>
    {/each}
  </svg>
</div>

<style>
  .county-map{width:100%;min-width:0;display:grid;place-items:center}
  svg{display:block;width:100%;max-width:240px;height:auto;overflow:hidden}
  path{stroke:#fff;stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  path.available{cursor:pointer}
  path.available:hover,path:focus-visible,path.selected{stroke:#171c23;stroke-width:2;outline:none;filter:brightness(1.08)}
</style>
