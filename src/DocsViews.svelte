<script lang="ts">
  import Breadcrumbs from './Breadcrumbs.svelte';
  import Icon from './Icon.svelte';
  import SearchField from './SearchField.svelte';
  export let id = '';
  export let navigate: (href: string) => void;

  let glossaryQuery = '';

  const schema = `person
  id
  full_name
  first_names
  last_names
  gender
  identifiers
  image
  {YYYY}_election
    election_type
    incumbent: { yes }
    office
    candidate_status: {
                        filed
                        defeated
                        disqualified
                        elected
                        general_election
                        primary_election
                        withdrew
                      }
    address
    latitude
    longitude
    city
    county
    state
    zip
    phone
    donate
    email
    facebook
    twitter
    website
    youtube
    party
    documents
      document_{###}
    endorsements
      endorsement_{###}
    source
  last_updated`;

  const glossary = [
    ['Absentee Results', 'Voters unable or unwilling to vote at polling stations on Election Day can vote via absentee ballots. One source of absentee ballots is the population of Americans living outside the United States.'],
    ['Certified Election Results', 'Certification occurs after a local or state canvassing board finalizes the election results and declares an official winner. State statutes may authorize local canvassing boards to issue certificates of election for local offices. State canvassing boards or other state officials issue certificates of election for multi-district, state, and federal offices.'],
    ['Congressional', 'Congressional is an umbrella term that means the U.S. House and U.S. Senate. House and Senate refer to the specific chamber.'],
    ['Congressional District Reporting Level', 'Results tabulated by congressional district for a state-wide or federal race. A congressional district is an electoral constituency that elects a single member of congress.'],
    ['County Reporting Level', 'Results tabulated by county for a federal, state-wide or district race.'],
    ['Direct Link', 'A link to the page where election results data for a specific race can be accessed.'],
    ['End Date', 'The date an election ends. Most elections, but not all of them, begin and end on a single day.'],
    ['FEC Clearinghouse', 'The Federal Election Commission site that provides an overview of election policies, activities, and (for our purposes) a page that links to each state’s local elections management entity where election results are archived. Detailed information about each one is provided, including address and all primary contacts.'],
    ['FOIA — Freedom of Information Act or similar', 'A FOIA request is a formal public records request, which we may need to make in certain states to get access to elections data. In some states such requests are known by different names.'],
    ['General Election', 'An election that usually determines the occupant of a seat. Usually held in November.'],
    ['Governor', 'The governor heads the executive branch in each state or territory and, depending on the individual jurisdiction, may have considerable control over government budgeting, the power of appointment of many officials (including many judges), and a significant role in legislation.'],
    ['Open Primary', 'A primary election in which candidates appear on a single ballot, regardless of party affiliation, and voters are allowed to vote for any candidate. In many cases, the top two vote-getters, possibly of the same party, advance to the general election. In some instances, a candidate who receives more than 50 percent becomes the winner.'],
    ['Portal Link', 'A link to the page on a state’s official election website that has an overview of election results (if there are several levels of pages, use the page that is one level above where you can access the results for a specific race).'],
    ['Precinct Reporting Level', 'Results tabulated by precinct for a federal, state-wide or district race. A precinct is the most granular level or reporting.'],
    ['Primary Election', 'An election that narrows the field of candidates before an election for office. Most, but not all, primaries are held among candidates of the same political party.'],
    ['Provisional Results', 'Provisional ballots are for would-be voters who assert that they are registered but whose names cannot be found in the official list available at a polling place. The voter completes a written ballot, which is placed in a sealed envelope. The ballot is opened and counted only if the voter is subsequently found to be registered.'],
    ['Race Type', 'The possible types of elections: Primary, Runoff, General and Recall. Special primaries, generals and runoffs are often held outside of the normal election cycle when a seat becomes vacant (See “Special Election” for more details).'],
    ['Race-wide Reporting Level', 'Overall totals for a race, regardless of its geographical boundaries.'],
    ['Recall Election', 'A recall election (also called a recall referendum or representative recall) is a procedure by which voters can remove an elected official from office through a direct vote before his or her term has ended. Recalls are initiated when sufficient voters sign a petition.'],
    ['Runoff Election', 'An election that serves as a second round if no candidate attains a majority in the first round. Runoffs can exist for primary and, in rare cases, for general elections.'],
    ['Special Election', 'An election held to fill a political office that has become vacant in between regularly scheduled elections.'],
    ['Start Date', 'The date an election begins. Most elections begin and end on a single day.'],
    ['State Officers', 'Executive-level statewide offices (in addition to governor). Some examples include Attorney General, Treasurer and Secretary of State, although office titles can vary by state. Usually elected on the same date as the governor.'],
    ['State Legislative Reporting Level', 'Results tabulated by state legislative district for a state-wide or federal race. A state legislative district elects one or more members of the state legislature.'],
    ['State Legislature', 'A state legislature is a generic term referring to the legislative body of any of the country’s 50 states. The formal name varies from state to state. In 25 states, the legislature is simply called the Legislature, or the State Legislature, while in 19 states, the legislature is called the “General Assembly”. In Massachusetts and New Hampshire, the legislature is called the General Court, while North Dakota and Oregon designate the legislature as the Legislative Assembly. Most states have two chambers, but Nebraska has just one.'],
    ['Straight Party or Straight Ticket Votes', 'The number of ballots cast where every vote was for the same party. This is provided in some states’ results files.'],
    ['U.S. House', 'The United States House of Representatives is one of the two houses of the United States Congress (a bicameral legislature). It is frequently referred to as the House. The other chamber is the Senate.'],
    ['U.S. Senate', 'The United States Senate is the upper house of the bicameral legislature of the United States, and together with the United States House of Representatives makes up the United States Congress.'],
    ['Unofficial Election Results', 'Results that are not certified by an official election authority.']
  ] as const;

  const slug = (term: string) => term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  $: filteredGlossary = glossary.filter(([term, definition]) => `${term} ${definition}`.toLowerCase().includes(glossaryQuery.trim().toLowerCase()));
  const found = !id || id === 'data-schema' || id === 'glossary';
  const title = id === 'data-schema' ? 'Data schema' : id === 'glossary' ? 'Glossary' : found ? 'Documentation' : 'Documentation not found';

  function open(event: MouseEvent, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
</script>

<svelte:head><title>{title} — Elections Utah</title></svelte:head>

{#if !found}
  <section class="entity-not-found">
    <p class="eyebrow">404</p>
    <h1>That documentation page isn’t here.</h1>
    <p>Browse the project documentation, data schema, and election glossary.</p>
    <a href="/docs/" onclick={(event) => open(event, '/docs/')}>Browse documentation <Icon name="arrow_forward" /></a>
  </section>
{:else if id === 'data-schema'}
  <article class="docs-page">
    <Breadcrumbs parent={{ label: 'Documentation', href: '/docs/' }} current="Data schema" {navigate} />
    <header class="docs-hero"><div><p class="eyebrow">Reference</p><h1>Data schema</h1><p>The original Elections Utah person record structure, including identity fields, election-year filings, contact details, documents, endorsements, and source metadata.</p></div></header>
    <section class="docs-content schema-layout">
      <aside class="docs-aside"><p class="eyebrow">On this page</p><a href="#person">Person</a></aside>
      <div class="docs-article">
        <h2 id="person">Person</h2>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to reach and scroll the code block.) -->
        <pre tabindex="0" role="region" aria-label="Person data schema"><code>{schema}</code></pre>
      </div>
    </section>
  </article>
{:else if id === 'glossary'}
  <article class="docs-page">
    <Breadcrumbs parent={{ label: 'Documentation', href: '/docs/' }} current="Glossary" {navigate} />
    <header class="docs-hero"><div><p class="eyebrow">Reference</p><h1>Election glossary</h1><p>Terms used within Elections Utah administration and throughout the project.</p></div></header>
    <section class="docs-content glossary-layout">
      <aside class="docs-aside glossary-aside">
        <SearchField className="glossary-search" bind:value={glossaryQuery} placeholder="Filter terms…" label="Filter glossary terms" />
        <p class="eyebrow" role="status">{filteredGlossary.length} {filteredGlossary.length === 1 ? 'term' : 'terms'}</p>
        {#each filteredGlossary as [term]}<a href={`#${slug(term)}`}>{term}</a>{/each}
      </aside>
      {#if filteredGlossary.length}
        <dl class="glossary-list">{#each filteredGlossary as [term, definition]}<div id={slug(term)}><dt>{term}</dt><dd>{definition}</dd></div>{/each}</dl>
      {:else}
        <div class="glossary-empty"><strong>No matching terms</strong><p>Try a broader election or reporting term.</p></div>
      {/if}
    </section>
  </article>
{:else}
  <article class="docs-page docs-index">
    <header class="docs-hero"><div><p class="eyebrow">Documentation</p><h1>Understand the<br /><em>project.</em></h1><p>Welcome to the Elections Utah documentation. This section introduces the project’s goals, explains how its records are structured, and shows how to help.</p></div></header>
    <section class="docs-directory" aria-label="Documentation pages">
      <a href="/docs/data-schema/" onclick={(event) => open(event, '/docs/data-schema/')}><small>01 · Structure</small><h2>Data schema</h2><p>See the fields that make up a person record and each year’s election filing.</p><b>Explore schema <Icon name="arrow_forward" /></b></a>
      <a href="/docs/glossary/" onclick={(event) => open(event, '/docs/glossary/')}><small>02 · Definitions</small><h2>Glossary</h2><p>Learn the election and reporting terminology used throughout the project.</p><b>Browse terms <Icon name="arrow_forward" /></b></a>
    </section>
    <section class="docs-license"><p class="eyebrow light">Open by default</p><h2>Public-domain<br />election data.</h2><p>Elections Utah releases these datasets under the <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">Creative Commons CC0 1.0 Universal Public Domain data license<span class="sr-only"> (opens in new tab)</span></a>. You can copy, modify, distribute, and perform the work—even commercially—without asking permission.</p></section>
  </article>
{/if}
