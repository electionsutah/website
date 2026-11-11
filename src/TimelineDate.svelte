<script lang="ts">
  import { timelineDate } from './lib/timeline-date';
  export let value: string | null | undefined = undefined;
  $: date = timelineDate(value);
</script>

{#if date}
  <time class="timeline-date" datetime={date.value} aria-label={date.label}>
    {#if date.month}<span class="month">{date.month}</span>{/if}
    {#if date.day}<strong>{date.day}</strong>{/if}
    <span class="year">{date.year}</span>
  </time>
{/if}

<style>
  .timeline-date{position:relative;display:grid;justify-items:center;gap:1px;width:48px;padding:var(--space-1-5) 3px;border:1px solid var(--color-rule-strong);background:var(--color-page);color:var(--color-text);font-family:var(--font-sans);line-height:1.15;font-variant-numeric:tabular-nums}
  .month{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
  strong{font-size:21px;font-weight:700}.year{font-size:var(--text-2xs)}
</style>
