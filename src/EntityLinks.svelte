<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import { resolveEntityLinks, type EntityLink } from './lib/entity-links';

  export let links: EntityLink[] = [];
  export let entityName: string;
  let active: string | null = null;
  let shift = 0;
  let below = false;
  $: resolved = resolveEntityLinks(links);

  async function show(event: MouseEvent | FocusEvent, url: string) {
    const anchor = event.currentTarget as HTMLAnchorElement;
    active = url;
    shift = 0;
    below = false;
    await tick();
    if (active !== url || !anchor.isConnected) return;
    const tip = anchor.querySelector<HTMLElement>('[role="tooltip"]');
    if (!tip) return;
    const box = tip.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    shift = box.left < 12 ? 12 - box.left : box.right > viewportWidth - 12 ? viewportWidth - 12 - box.right : 0;
    below = box.top < 12;
  }

  function leave(event: MouseEvent) {
    if (document.activeElement !== event.currentTarget) active = null;
  }

  function blur(event: FocusEvent) {
    if (!(event.currentTarget as HTMLElement).matches(':hover')) active = null;
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') active = null; }} />

{#if resolved.length}
  <nav class="entity-links" aria-label={`${entityName} external links`}>
    {#each resolved as link (link.url)}
      <a class="entity-link" href={link.url} target="_blank" rel="noreferrer"
        aria-label={`${link.label} · ${link.detail} for ${entityName} (opens in new tab)`}
        onmouseenter={(event) => show(event, link.url)} onmouseleave={leave}
        onfocus={(event) => show(event, link.url)} onblur={blur}>
        {#if link.platform === 'website'}
          <span class="website-icon"><Icon name="language" /></span>
        {:else if link.platform === 'wikipedia'}
          <svg class="wikipedia-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.1 6.5c.7 0 1.3.4 1.7 1.3L9.5 19h.9l2.3-5.4 2.2 5.4h.9l4.8-11.2c.4-.9.9-1.3 1.6-1.3V5h-5.3v1.5c1.2 0 1.7.3 1.3 1.3l-2.9 7-1.6-3.8 1.4-3.2c.4-.9.9-1.3 1.6-1.3V5h-5v1.5c1.2 0 1.6.4 1.2 1.3l-.2.5-.2-.5c-.4-.9 0-1.3 1.1-1.3V5H7.8v1.5c.7 0 1.2.4 1.6 1.3l2.3 5.3-1.1 2.7-3.4-8c-.4-.9.1-1.3 1.4-1.3V5H3.1z" /></svg>
        {:else}
          <img src={`/icons/external/${link.platform}.svg`} alt="" aria-hidden="true" />
        {/if}
        <span class="entity-link-tooltip" class:below hidden={active !== link.url} role="tooltip" style={`--tooltip-shift:${shift}px`}>
          <strong>{link.label}</strong><span>{link.detail}</span>
        </span>
      </a>
    {/each}
  </nav>
{/if}

<style>
  .entity-links{display:flex;align-items:center;flex-wrap:wrap;gap:2px}
  .entity-link{position:relative;display:grid;place-items:center;width:var(--entity-link-size,40px);height:40px;border-radius:4px;text-decoration:none}
  .entity-link:hover,.entity-link:focus-visible{background:var(--color-blue-tint)}
  .entity-link:focus-visible{outline:3px solid var(--color-blue);outline-offset:2px}
  .entity-link img,.entity-link>svg{display:block;width:24px;height:24px;object-fit:contain}
  .website-icon{color:var(--color-blue);font-size:24px;line-height:1}
  .website-icon :global(.icon){font-size:24px;vertical-align:0}
  .wikipedia-icon{fill:var(--color-ink)}
  .entity-link-tooltip{position:absolute;z-index:20;bottom:calc(100% + 8px);left:50%;transform:translateX(calc(-50% + var(--tooltip-shift)));width:max-content;max-width:min(300px,calc(100vw - 24px));padding:8px 12px;background:var(--color-ink);color:var(--color-paper);border-radius:4px;box-shadow:var(--shadow-md);font:400 12px/1.5 var(--font-sans);text-align:left;overflow-wrap:anywhere}
  .entity-link-tooltip[hidden]{display:none}
  .entity-link-tooltip:after{content:'';position:absolute;left:0;right:0;top:100%;height:10px}
  .entity-link-tooltip.below{bottom:auto;top:calc(100% + 8px)}
  .entity-link-tooltip.below:after{top:auto;bottom:100%}
  .entity-link-tooltip strong,.entity-link-tooltip>span{display:block}
  @media(pointer:coarse){.entity-link{width:44px;height:44px}}
</style>
