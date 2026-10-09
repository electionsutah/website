<script lang="ts">
  import Icon from './Icon.svelte';
  import SearchField from './SearchField.svelte';
  import { onMount } from 'svelte';
  import { elections, offices, parties, people, places } from './lib/entities';
  import { formatCount } from './lib/format';
  import { browseUrl, matchesQuery, queryTokens, searchText } from './lib/search';

  export let navigate: (href: string) => void;
  /** Pass false when navigating away, so focus goes to the new page instead of back to the trigger. */
  export let close: (restoreFocus?: boolean) => void;

  let query = '';
  let searchInput: HTMLInputElement | undefined;
  let dialog: HTMLElement;

  const groups = [
    {
      label: 'Election years',
      browseHref: '/elections/',
      items: elections.map((election) => ({
        id: String(election.year),
        title: String(election.year),
        text: searchText.elections(election),
        displayMeta: `${election.filings.length ? `${formatCount(election.filings.length)} filings` : 'Not archived'} · ${election.title}`,
        href: `/elections/${election.year}/`,
        initials: 'YR'
      }))
    },
    {
      label: 'People',
      browseHref: '/people/',
      items: people.map((person) => ({
        id: person.id,
        title: person.name,
        text: searchText.people(person),
        displayMeta: person.filings[0].officeName,
        href: `/people/${person.id}/`,
        initials: person.initials
      }))
    },
    {
      label: 'Offices',
      browseHref: '/offices/',
      items: offices.map((office) => ({
        id: office.id,
        title: office.name,
        text: searchText.offices(office),
        displayMeta: `${office.sections.join(' · ')} · ${office.filings.length} filings`,
        href: `/offices/${office.id}/`,
        initials: 'OF'
      }))
    },
    {
      label: 'Parties',
      browseHref: '/parties/',
      items: parties.map((party) => ({
        id: party.id,
        title: party.name,
        text: searchText.parties(party),
        displayMeta: party.recognized ? `Recognized party · ${party.filings.length} filings` : `${party.filings.length} filings`,
        href: `/parties/${party.id}/`,
        initials: party.shortName.charAt(0)
      }))
    },
    {
      label: 'Places',
      browseHref: '/places/',
      items: places.map((place) => ({
        id: place.id,
        title: place.name,
        text: searchText.places(place),
        displayMeta: `${place.type}${place.type === 'City' ? ` · ${place.county} County` : ''} · ${place.filings.length} filings`,
        href: `/places/${place.id}/`,
        initials: 'PL'
      }))
    }
  ];

  $: tokens = queryTokens(query);
  $: results = groups.map((group) => {
    const matches = tokens.length ? group.items.filter((item) => matchesQuery(item.text, tokens)) : [];
    return { ...group, matches, visible: matches.slice(0, 6), viewAllHref: browseUrl(group.browseHref, query) };
  });
  $: total = results.reduce((sum, group) => sum + group.matches.length, 0);

  onMount(() => {
    searchInput?.focus();
    // The page behind the modal is inert (see App.svelte); it shouldn't scroll either.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => document.body.style.overflow = overflow;
  });

  function choose(href: string) {
    navigate(href);
    close(false);
  }

  /** Keep Tab and Shift+Tab cycling within the dialog. */
  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button, input')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open(event: MouseEvent, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    choose(href);
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') close(); }} />

<div class="search-overlay" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) close(); }}>
  <div class="search-popout" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="site-search-title" bind:this={dialog} onkeydown={trapFocus}>
    <div class="search-head">
      <div><p class="eyebrow">Search every election year</p><h2 id="site-search-title">Find a record</h2></div>
      <button class="search-close" aria-label="Close search" onclick={() => close()}><Icon name="close" /></button>
    </div>
    <SearchField className="global-search-input" bind:input={searchInput} bind:value={query} label="Search a year, person, office, party, or place" shortcut="ESC" />
    <p class="sr-only" role="status">{tokens.length ? `${formatCount(total)} matching records` : ''}</p>

    {#if tokens.length}
      <div class="search-summary" aria-hidden="true"><strong>{formatCount(total)}</strong> matching records</div>
      {#if total}
        <div class="search-groups">
          {#each results as group}
            {#if group.visible.length}
              <section class="search-group">
                <header><h3>{group.label}</h3><a href={group.viewAllHref} onclick={(event) => open(event, group.viewAllHref)}>View all {formatCount(group.matches.length)}<span class="sr-only"> {group.label.toLowerCase()}</span> <Icon name="arrow_forward" /></a></header>
                <div>
                  {#each group.visible as item}
                    <a class="search-result" href={item.href} onclick={(event) => open(event, item.href)}>
                      <span aria-hidden="true">{item.initials}</span><div><strong>{item.title}</strong><small>{item.displayMeta}</small></div><b><Icon name="arrow_forward" /></b>
                    </a>
                  {/each}
                </div>
                {#if group.matches.length > group.visible.length}<small class="more-matches">+ {formatCount(group.matches.length - group.visible.length)} more {group.label.toLowerCase()} match</small>{/if}
              </section>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="search-empty"><strong>No records found</strong><p>Try a candidate name, district number, political party, or office title.</p></div>
      {/if}
    {:else}
      <div class="search-start">
        <p>Search across the combined 2017–2026 directory.</p>
        <div>{#each groups as group}<a href={group.browseHref} onclick={(event) => open(event, group.browseHref)}><strong>{formatCount(group.items.length)}</strong><span>{group.label}</span></a>{/each}</div>
      </div>
    {/if}
  </div>
</div>
