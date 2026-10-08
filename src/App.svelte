<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import candidateYamlUrl from './data/2026-candidates.yml?url';
  import historicalDataUrl from './data/historical-candidates.json?url';
  import ElectionViews from './ElectionViews.svelte';
  import EntityViews from './EntityViews.svelte';
  import DocsViews from './DocsViews.svelte';
  import SearchPalette from './SearchPalette.svelte';
  import { offices as officeEntities, parties as partyEntities, people as peopleEntities, totals } from './lib/entities';
  import { formatCount } from './lib/format';

  let menuOpen = false;
  let menuButton: HTMLButtonElement;
  let query = '';
  let directory = 'People';
  let searchOpen = false;
  // The control that opened the search modal, so focus can return to it on close.
  let searchTrigger: HTMLElement | null = null;
  // Earlier route names, so existing bookmarks and shared links still resolve.
  const legacySegments: Record<string, string> = { party: 'parties', office: 'offices' };

  function canonicalPath(pathname: string) {
    return pathname.replace(/^\/([^/]+)/, (segment, name: string) => legacySegments[name] ? `/${legacySegments[name]}` : segment);
  }

  /** Read the current location, rewriting a legacy path in the address bar. */
  function currentPath() {
    const pathname = canonicalPath(window.location.pathname);
    if (pathname !== window.location.pathname) history.replaceState(history.state, '', `${pathname}${window.location.search}${window.location.hash}`);
    return pathname;
  }

  let path = typeof window === 'undefined' ? '/' : currentPath();

  // `ends` is the last day of each milestone; once it has passed the milestone is shown as completed.
  const milestones = [
    { date: 'Jan 02–08', ends: '2026-01-08', title: 'Candidate declaration period', text: 'Partisan, local school board, and local district board candidates file declarations of candidacy.' },
    { date: 'Mar 09–13', ends: '2026-03-13', title: 'U.S. House filing period', text: 'The special 2026 declaration window for Utah congressional candidates.' },
    { date: 'Jun 23', ends: '2026-06-23', title: 'Regular primary election', text: 'Primary Election Day for races that require a party nominee.' },
    { date: 'Jul 01–15', ends: '2026-07-15', title: 'Judicial retention filing', text: 'Utah judges and justices file declarations to stand for retention.' },
    { date: 'Aug 31', ends: '2026-08-31', title: 'Write-in declaration deadline', text: 'Last day for a write-in candidate to declare candidacy with the election officer.' },
    { date: 'Nov 03', ends: '2026-11-03', title: 'Regular general election', text: 'General Election Day. Mail ballots must be received by 8 p.m.' }
  ];
  const today = new Date().toLocaleDateString('en-CA');
  const deadlines = milestones.map((item) => ({ ...item, past: item.ends < today }));
  // The next milestone still to come is highlighted.
  const featured = deadlines.find((item) => !item.past)?.title;

  const homePeople = peopleEntities.map((person) => ({
    id: person.id,
    href: `/people/${person.id}/`,
    name: person.name,
    meta: `${person.filings[0].officeName} · ${person.filings[0].partyName}`,
    status: person.filings[0].sourceStatus
  }));
  const homeOffices = officeEntities.map((office) => ({
    id: office.id,
    href: `/offices/${office.id}/`,
    name: office.name,
    meta: office.sections.join(' · '),
    status: `${office.filings.length} filings`
  }));

  const nav = [
    { label: 'About', href: '/#about' },
    { label: 'Elections', href: '/elections/' },
    { label: 'Offices', href: '/offices/' },
    { label: 'Parties', href: '/parties/' },
    { label: 'People', href: '/people/' },
    { label: 'Places', href: '/places/' },
    { label: 'Docs', href: '/docs/' }
  ];

  $: segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  $: routeSection = (segments[0] ?? '') as 'people' | 'offices' | 'parties' | 'places' | 'elections' | 'docs' | '';
  $: routeId = routeSection === 'places' ? segments.slice(1).join('/') : (segments[1] ?? '');
  $: isHome = !segments.length;
  $: isKnownRoute = isHome || ['people', 'offices', 'parties', 'places', 'elections', 'docs'].includes(routeSection);

  $: source = directory === 'People' ? homePeople : homeOffices;
  $: filtered = source.filter((item) => `${item.name} ${item.meta} ${item.status}`.toLowerCase().includes(query.toLowerCase()));
  $: visible = filtered.slice(0, 12);

  function navigate(href: string) {
    const url = new URL(href, window.location.origin);
    path = canonicalPath(url.pathname);
    history.pushState({}, '', `${path}${url.search}${url.hash}`);
    menuOpen = false;
    if (url.hash) {
      setTimeout(() => {
        const target = document.getElementById(url.hash.slice(1));
        target?.scrollIntoView({ behavior: 'smooth' });
        if (target) focusElement(target);
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      focusPage();
    }
  }

  function focusElement(element: HTMLElement) {
    if (!element.matches('a[href], button, input, [tabindex]')) element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
  }

  /** After a client-side route change, move focus to the new page's heading so it is announced. */
  async function focusPage() {
    await tick();
    const heading = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('main');
    if (heading) focusElement(heading);
  }

  function onPopState() {
    path = currentPath();
    focusPage();
  }

  function openSearch() {
    searchTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    searchOpen = true;
  }

  /** Close the search modal; focus returns to its trigger unless a result moved focus to a new page. */
  async function closeSearch(restoreFocus = true) {
    const trigger = searchTrigger;
    searchOpen = false;
    searchTrigger = null;
    // Wait for the page to stop being inert before focusing back into it.
    await tick();
    if (restoreFocus) trigger?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && menuOpen && !searchOpen) {
      menuOpen = false;
      menuButton?.focus();
    }
  }

  function open(event: MouseEvent, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }

</script>

<svelte:window onpopstate={onPopState} onkeydown={onKeydown} />

<svelte:head>
  {#if isHome}<title>Elections Utah — Open civic data</title>{:else if !isKnownRoute}<title>Page not found — Elections Utah</title>{/if}
</svelte:head>

<a class="skip-link" href="#top" inert={searchOpen}>Skip to content</a>

<header class="site-header" inert={searchOpen}>
  <a class="brand" href="/" onclick={(event) => open(event, '/')}>
    <span class="mark" aria-hidden="true"><span>UT</span></span>
    <span>Elections <b>Utah</b></span>
  </a>
  <button class="menu" aria-label="Menu" aria-expanded={menuOpen} aria-controls="main-nav" bind:this={menuButton} onclick={() => menuOpen = !menuOpen}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
  <nav id="main-nav" class:open={menuOpen} aria-label="Main navigation">
    {#each nav as item}
      {@const current = routeSection !== '' && routeSection === item.href.split('/')[1]}
      <a class:active={current} aria-current={current ? 'page' : undefined} href={item.href} onclick={(event) => open(event, item.href)}>{item.label}</a>
    {/each}
  </nav>
  <div class="header-actions"><button class="site-search" aria-label="Search the site" aria-haspopup="dialog" onclick={openSearch}><span><Icon name="search" /></span> Search</button><a class="donate" href="https://venmo.com/user/todrobbins" target="_blank" rel="noreferrer">Donate <span><Icon name="arrow_outward" /></span><span class="sr-only"> (opens in new tab)</span></a></div>
</header>

{#if searchOpen}<SearchPalette {navigate} close={closeSearch} />{/if}

{#if isHome}
<main id="top" tabindex="-1" inert={searchOpen}>
  <section class="hero" id="about">
    <picture>
      <source srcset="/images/capitol-building.webp" type="image/webp" />
      <img src="/images/capitol-building.jpg" width="1440" height="576" alt="Utah State Capitol building beneath a clear sky" />
    </picture>
    <div class="hero-shade"></div>
    <div class="hero-content">
      <p class="eyebrow">Utah's open election archive</p>
      <h1>Civic data,<br /><em>made clear.</em></h1>
      <p class="intro">Explore the people, places, offices, and public records that have shaped Utah elections.</p>
      <div class="hero-actions">
        <button class="primary" aria-haspopup="dialog" onclick={openSearch}>Search the data <span><Icon name="arrow_forward" /></span></button>
        <a class="text-button" href="/docs/" onclick={(event) => open(event, '/docs/')}>Read the documentation</a>
      </div>
    </div>
    <div class="hero-stat"><strong>CC0</strong><span>Public domain<br />civic data</span></div>
  </section>

  <section class="archive-note">
    <span>2017–2026</span>
    <p>{formatCount(totals.filings)} filing records across Utah’s available election archives, joined into {formatCount(totals.people)} people while preserving every distinct race.</p>
  </section>

  <section class="deadlines section" aria-labelledby="deadline-title">
    <div class="section-heading">
      <div><p class="eyebrow">2026 election cycle</p><h2 id="deadline-title">Election<br /><em>milestones</em></h2></div>
      <div class="date-block"><span>General election</span><strong>NOV 03</strong><small>2026</small></div>
    </div>
    <div class="timeline">
      {#each deadlines as item}
        <article class:featured={item.title === featured} class:past={item.past}>
          <div class="timeline-date">{item.date}</div>
          <div class="dot"></div>
          <div><h3>{item.title}{#if item.past}<small class="milestone-status">Completed</small>{:else if item.title === featured}<small class="milestone-status">Next up</small>{/if}</h3><p>{item.text}</p></div>
        </article>
      {/each}
    </div>
    <div class="secondary-dates">
      <div><small>REGULAR PRIMARY</small><strong>June 23, 2026</strong></div>
      <div><small>REGULAR GENERAL</small><strong>November 3, 2026</strong></div>
    </div>
  </section>

  <section class="data section" id="data">
    <div class="section-heading compact">
      <div><p class="eyebrow light">Open records</p><h2>Download the<br /><em>source data.</em></h2></div>
      <p>Machine-readable 2026 records normalized from Utah’s official filing workbook. Free to copy, modify, and distribute.</p>
    </div>
    <div class="data-grid">
      <article><span>01</span><small>2026</small><h3>Current<br />Listings</h3><p>{formatCount(totals.currentFilings)} federal, legislative, school-board, and judicial-retention records in the Elections Utah schema.</p><div><a href={candidateYamlUrl} download="elections-utah-2026-candidates.yml">YAML <Icon name="download" /></a></div></article>
      <article><span>02</span><small>2017–24</small><h3>Historical<br />Listings</h3><p>{formatCount(totals.historicalFilings)} normalized records from the original archive and official Utah sources.</p><div><a href={historicalDataUrl} download="elections-utah-2017-2024-candidates.json">JSON <Icon name="download" /></a></div></article>
      <article><span>03</span><small>LIVE</small><h3>Official<br />Source</h3><p>The Utah Lieutenant Governor’s current filing table and downloadable workbook.</p><div><a href="https://vote.utah.gov/2026-candidate-filings/" target="_blank" rel="noreferrer">VIEW <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a><a href="https://vote.utah.gov/wp-content/uploads/2026/06/Candidate-Filing-2026.xlsx" target="_blank" rel="noreferrer">XLSX <Icon name="download" /><span class="sr-only"> (opens in new tab)</span></a></div></article>
    </div>
  </section>

  <section class="directory section" id="directory">
    <div class="directory-intro">
      <p class="eyebrow">Browse the archive</p>
      <h2>Find the records<br />that <em>matter.</em></h2>
      <p>Search the combined 2017–2026 archive. Repeat candidates link to one person record with every distinct race listed by year.</p>
      <div class="party-list" role="group" aria-label="Political parties">
        {#each partyEntities as party}<a href={`/parties/${party.id}/`} onclick={(event) => open(event, `/parties/${party.id}/`)}>{party.name}</a>{/each}
      </div>
    </div>
    <div class="finder">
      <div class="tabs" role="group" aria-label="Search in"><button class:active={directory === 'People'} aria-pressed={directory === 'People'} onclick={() => directory = 'People'}>People</button><button class:active={directory === 'Offices'} aria-pressed={directory === 'Offices'} onclick={() => directory = 'Offices'}>Offices</button></div>
      <label><span><Icon name="search" /></span><input bind:value={query} placeholder={`Search ${directory.toLowerCase()}…`} aria-label={`Search ${directory.toLowerCase()}`} /></label>
      <div class="results">
        {#each visible as item}
          <a class="result" href={item.href} onclick={(event) => open(event, item.href)}><span class="initial" aria-hidden="true">{item.name.charAt(0)}</span><div><strong>{item.name}</strong><small>{item.meta}</small></div><b>{item.status}</b></a>
        {:else}<p class="empty">No matching records found.</p>{/each}
      </div>
      <div class="all-records"><span role="status">Showing {visible.length} of {formatCount(filtered.length)} matching {directory.toLowerCase()}</span><a href="https://vote.utah.gov/2026-candidate-filings/" target="_blank" rel="noreferrer">Verify at Vote.Utah.gov <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a></div>
    </div>
  </section>

  <section class="resources section" id="resources">
    <div class="eligibility">
      <p class="eyebrow">Voting eligibility</p><h2>Who can vote<br />in <em>Utah?</em></h2>
      <p>Current requirements from Vote.Utah.gov. Check the official site before registering or voting.</p>
    </div>
    <ol>
      <li><span>01</span><p>Be a citizen of the <strong>United States of America</strong></p></li>
      <li><span>02</span><p>Have resided in Utah for <strong>30 days</strong> before the election</p></li>
      <li><span>03</span><p>Be at least <strong>18 years old</strong> on or before Election Day</p></li>
      <li><span>04</span><p>If convicted of a felony, not be currently serving a <strong>jail or prison sentence</strong></p></li>
    </ol>
  </section>

</main>
{:else if routeSection === 'elections'}
  <main class="entity-main" id="top" tabindex="-1" inert={searchOpen}><ElectionViews id={routeId} {navigate} /></main>
{:else if routeSection === 'docs'}
  <main class="entity-main" id="top" tabindex="-1" inert={searchOpen}><DocsViews id={routeId} {navigate} /></main>
{:else if ['people', 'offices', 'parties', 'places'].includes(routeSection)}
  <main class="entity-main" id="top" tabindex="-1" inert={searchOpen}><EntityViews section={routeSection as 'people' | 'offices' | 'parties' | 'places'} id={routeId} {navigate} /></main>
{:else}
  <main class="entity-main" id="top" tabindex="-1" inert={searchOpen}><section class="entity-not-found"><p class="eyebrow">404</p><h1>Page not found.</h1><p>This route is not part of the Elections Utah directory.</p><a href="/" onclick={(event) => open(event, '/')}>Return home <Icon name="arrow_forward" /></a></section></main>
{/if}

<footer inert={searchOpen}>
  <div class="footer-brand"><span class="mark" aria-hidden="true"><span>UT</span></span><span>Elections <b>Utah</b></span></div>
  <p>Open election data for a more informed Utah.</p>
  <div class="footer-links"><a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0 1.0 Public Domain<span class="sr-only"> (opens in new tab)</span></a><a href={isHome ? '#top' : '/'} onclick={(event) => { if (!isHome) open(event, '/'); }}>{isHome ? 'Back to top' : 'Home'} <Icon name="arrow_upward" /></a></div>
</footer>
