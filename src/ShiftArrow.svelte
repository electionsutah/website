<script lang="ts">
  import { shiftLabel } from './lib/shifts';
  export let value: number;
  export let scale = 100;
  $: length = Math.abs(value) / Math.max(scale, 0.1) * 78;
  $: direction = value > 0 ? -1 : 1;
  $: end = 100 + direction * length;
  $: headLength = Math.min(9, length);
  $: changed = Math.abs(value) >= 0.05;
</script>

<span class="shift-arrow" class:democratic={changed && value > 0} class:republican={changed && value < 0}>
  <svg viewBox="0 0 200 30" aria-hidden="true">
    <line x1="100" y1="3" x2="100" y2="27" style="stroke:var(--color-rule-soft)" stroke-width="1" />
    {#if changed}<line x1="100" y1="15" x2={end - direction * headLength} y2="15" stroke="currentColor" stroke-width="2" />
      <polygon points={`${end},15 ${end - direction * headLength},9 ${end - direction * headLength},21`} fill="currentColor" />{/if}
    <circle cx="100" cy="15" r="4" fill="currentColor" />
  </svg>
  <strong>{shiftLabel(value)}{#if changed}<small> pp</small>{/if}</strong>
  <span class="sr-only">{changed ? `toward ${value > 0 ? 'Democrats' : 'Republicans'}, a ${Math.abs(value).toFixed(1)} percentage-point change in the Democratic minus Republican vote margin` : 'in the party margin, rounded to one decimal place'}</span>
</span>
