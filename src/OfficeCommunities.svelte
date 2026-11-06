<script lang="ts">
  import type { OfficeProfile } from './lib/entity-profiles';
  import { anchoredPopover } from './lib/anchored-popover';
  import Icon from './Icon.svelte';
  export let profile: OfficeProfile;
  export let navigate: (href: string) => void;
  $: popoverId = `jurisdiction-sources-${profile.scope.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  function open(event: MouseEvent, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(href);
  }
</script>
<section class="record-section office-communities" aria-labelledby="office-communities-title">
  <div class="record-heading jurisdiction-heading">
    <h2 id="office-communities-title">Jurisdiction</h2>
    <button class="place-election-toggle coverage-toggle" popovertarget={popoverId}><Icon name="info" /><span>Sources &amp; coverage</span></button>
  </div>
  <div class="community-subheading"><p class="community-scope">{profile.scope}</p>{#if profile.boundaryPeriod}<span class="community-badge">{profile.boundaryPeriod}</span>{/if}</div>
  <p>{profile.note}</p>
  {#if profile.communities.length}
    <div class="community-grid">
      {#each profile.communities as community}
        <div class="community-item"><span class="community-name">{#if community.placeId}<a href={`/places/${community.placeId}/`} onclick={(event)=>open(event, `/places/${community.placeId}/`)}>{community.name}</a>{:else}{community.name}{/if}</span>{#if community.partial}<span class="community-badge">Partial</span>{/if}</div>
      {/each}
    </div>
  {/if}
  <div class="evidence-popover" id={popoverId} popover="auto" use:anchoredPopover={popoverId} aria-labelledby={`${popoverId}-title`}>
    <header><strong id={`${popoverId}-title`}>Jurisdiction sources &amp; coverage</strong><button popovertarget={popoverId} popovertargetaction="hide" aria-label="Close jurisdiction sources"><Icon name="close" /></button></header>
    <p>{profile.note}</p>
    <p>Current boundaries may differ from those in historical elections. Municipal lists are a geographic guide, not a complete list of neighborhoods or settlements. Boundary intersections smaller than one hectare are omitted as possible map slivers. Confirm eligibility for a particular address with the election office.</p>
    {#each profile.sources as source}<a class="coverage-source" href={source.url} target="_blank" rel="noreferrer">{source.label}<span class="sr-only"> (opens in new tab)</span></a>{/each}
  </div>
</section>
<style>
  .office-communities{padding:var(--space-6) clamp(24px,7vw,108px);margin:0;border-bottom:1px solid var(--color-rule)}
  .jurisdiction-heading{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);margin:0 0 var(--space-4)}
  p{max-width:80ch;margin:var(--space-3) 0;line-height:1.6}
  .community-scope{font-weight:700}
  .community-subheading{display:flex;align-items:center;flex-wrap:wrap;gap:var(--space-2);margin:var(--space-3) 0}
  .community-subheading .community-scope{margin:0}
  .coverage-toggle{display:inline-flex;align-items:center;gap:var(--space-2)}
  .community-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:var(--space-4) var(--space-3);margin:var(--space-5) 0 var(--space-5)}
  .community-item{display:flex;align-items:center;flex-wrap:wrap;gap:var(--space-1-5);min-width:0}
  .community-name{min-width:0;overflow-wrap:anywhere}
  .community-name a{display:inline-block;padding:var(--space-1) 0}
  .community-badge{flex:none;padding:var(--space-0-5) var(--space-2);background:var(--color-warm-white);color:var(--color-muted);font:600 var(--text-2xs)/1.5 var(--font-sans)}
  a{color:var(--color-blue);text-decoration:underline;text-underline-offset:3px}
  .coverage-source{display:block;margin-top:var(--space-2)}
</style>
