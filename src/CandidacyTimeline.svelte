<script lang="ts">
  import { placesById, sourceAvailable } from './lib/entities';
  import { candidacyEvents, type CandidacyHistory, type FilingResult } from './lib/candidacy-history';
  import { timelineDate } from './lib/timeline-date';
  import TimelineDate from './TimelineDate.svelte';
  import Icon from './Icon.svelte';
  export let history: CandidacyHistory;
  export let result: FilingResult | undefined = undefined;
  export let navigate: (href: string) => void;
  export let otherResults: FilingResult[] = [];
  $: events = candidacyEvents(history, result, otherResults);
  function open(event: MouseEvent, href: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(href);
  }
</script>

<ol class="candidacy-timeline" aria-label="Candidacy timeline">
  {#each events as event, index}
    <li class:matching-result={index === events.length - 1} class:terminal={event.terminal} class:dated={!!timelineDate(event.date)}>
      <div class="event-marker"><TimelineDate value={event.date} /></div>
      <div class="event-content">
        <div class="event-heading">
          <h5>{event.title}</h5>
          {#if event.summary}<p class="event-votes">{event.summary}</p>{/if}
        </div>
        {#if event.placeIds.length}<p>{#each event.placeIds as id, index}{#if index}{' / '}{/if}<a href={`/places/${id}/`} onclick={(event) => open(event, `/places/${id}/`)}>{placesById.get(id)?.name ?? id}</a>{/each}</p>{/if}
        {#if event.source && sourceAvailable(event.source)}<a class="event-source" href={event.source} target="_blank" rel="noreferrer"><span class="event-source-label">{event.sourceLabel}</span> <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>{:else if event.source}<p class="event-source">Original source no longer online</p>{/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .candidacy-timeline{list-style:none;margin:var(--space-5) 0 0;padding:0}
  li{position:relative;display:grid;grid-template-columns:var(--timeline-marker-width,48px) minmax(0,1fr);gap:var(--timeline-column-gap,var(--space-3));margin:0;padding-inline:var(--space-3);padding-bottom:var(--space-6)}
  li:last-child{padding-bottom:0}
  li:not(:last-child)::before{content:'';position:absolute;left:calc(23px + var(--space-3));top:10px;bottom:-10px;width:1px;background:var(--color-rule-strong)}
  .event-marker{position:relative;min-height:14px;display:grid;align-content:start}
  li:not(.dated) .event-marker::after{content:'';position:relative;width:9px;height:9px;margin:6px auto 0;border-radius:50%;background:var(--color-blue);box-shadow:0 0 0 4px var(--color-paper)}
  li.terminal .event-content{background:var(--color-page);box-shadow:0 0 0 var(--space-3) var(--color-page)}
  li.matching-result{background:var(--color-blue-tint);padding-block:var(--space-3)}
  li.matching-result .event-content{background:transparent;box-shadow:none}
  li.terminal:not(.dated) .event-marker::after{background:var(--color-muted);border-radius:0}
  .event-content{min-width:0}.event-content h5{margin:0;font:700 var(--text-base)/1.4 var(--font-sans)}
  .event-heading{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:var(--space-1) var(--space-3);margin-bottom:var(--space-2)}
  .event-heading .event-votes{margin:0;margin-left:auto;text-align:right}
  p{margin:var(--space-1) 0 var(--space-2);font-size:var(--text-sm);color:var(--color-muted)}
  a{color:var(--color-blue);text-decoration:underline;text-underline-offset:3px}
  .event-source{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px;font-size:var(--text-xs)}
  a.event-source{text-decoration:none}
  .event-source-label{text-decoration:underline;text-underline-offset:3px}
  .event-source :global(.icon){font-size:14px}.event-votes{font-variant-numeric:tabular-nums}
</style>
