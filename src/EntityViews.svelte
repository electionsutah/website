<script lang="ts">
  import { tick } from 'svelte';
  import Breadcrumbs from './Breadcrumbs.svelte';
  import Icon from './Icon.svelte';
  import IndexControls from './IndexControls.svelte';
  import SortHeader from './SortHeader.svelte';
  import placeProfiles from './data/place-enrichment.json';
  import personProfiles from './data/person-enrichment.json';
  import EntityViews from './EntityViews.svelte';
  import {
    activeStatuses,
    candidacies,
    offices,
    officesById,
    parties,
    partiesById,
    people,
    peopleById,
    places,
    placesById,
    runningMateRole,
    sectionLabel,
    sourceAvailable,
    sourceLinkLabel,
    statusLabel,
    type Contact,
    type Filing,
    type Person
  } from './lib/entities';
  import { formatCount, formatDate } from './lib/format';
  import { matchesQuery, queryTokens, searchText } from './lib/search';
  import { buildFacets, isActive, matchingFilings, nextSort, persistState, restoreState, sortRows, type Selection, type Sort } from './lib/facets';

  export let section: 'people' | 'offices' | 'parties' | 'places';
  export let id = '';
  export let navigate: (href: string) => void;
  /** Limit the index to people on these filings, rendered inside another record's page (a party's people). */
  export let scope: Filing[] | null = null;
  export let embedded = false;
  /** Where an embedded index remembers its filters, layout, and sort, so each kind of host page keeps its own. */
  export let stateId = '';
  /** Scoped indexes omit columns already described by their host page. */
  export let omitColumns: string[] = [];
  export let showStatus = false;

  let query = '';
  let limit = 36;
  let selection: Selection = {};
  let view: 'grid' | 'list' = 'list';
  let sort: Sort | null = null;
  let loadedIndex = '';
  let resultsList: HTMLElement;

  type PlaceProfile = {
    wikipediaTitle: string;
    wikipediaUrl: string;
    summary: string;
    wikidataId: string;
    wikidataUrl: string;
    officialWebsite: string;
    population: number;
    populationAsOf: string;
    populationSource: 'Wikidata' | 'Wikipedia';
    inceptionDate: string | null;
    inceptionPrecision: number | null;
  };

  const profilesById = placeProfiles as Record<string, PlaceProfile>;
  type PersonProfile = {
    sourceUrl: string;
    lastVerified: string;
    biography: string;
    priorities: string[];
    contact: Partial<Contact>;
    resources: { label: string; description: string; url: string }[];
  };
  const personProfilesById = personProfiles as Record<string, PersonProfile>;

  const labels = {
    people: { singular: 'Person', plural: 'People', intro: 'Every person in the combined Utah election archive.' },
    offices: { singular: 'Office', plural: 'Offices', intro: 'Municipal, federal, legislative, education, and judicial offices across every archived cycle.' },
    parties: { singular: 'Party', plural: 'Parties', intro: 'Political affiliations represented across the 2017–2026 filing data.' },
    places: { singular: 'Place', plural: 'Places', intro: 'Browse archived candidates by their published city and county.' }
  };

  $: person = section === 'people' && id ? peopleById.get(id) : undefined;
  $: personProfile = person ? personProfilesById[person.id] : undefined;
  $: office = section === 'offices' && id ? officesById.get(id) : undefined;
  $: party = section === 'parties' && id ? partiesById.get(id) : undefined;
  $: place = section === 'places' && id ? placesById.get(id) : undefined;
  $: placeProfile = place ? profilesById[place.id] : undefined;
  $: found = !id || Boolean(person || office || party || place);
  $: pageTitle = !found
    ? 'Record not found'
    : person?.name || office?.name || party?.name || place?.name || labels[section].plural;
  $: contactFiling = person?.filings.find((filing) => filing.personId === person.id && filing.contact && Object.values(filing.contact).some(Boolean));
  // Current campaign information has its own source and date; archived contacts stay in the filing data.
  $: contact = personProfile?.contact ?? contactFiling?.contact;
  $: contactItems = contact ? [
    contact.phone && { label: 'Phone', text: contact.phone, href: `tel:${contact.phone}`, icon: 'call', external: false },
    contact.email && { label: 'Email', text: contact.email, href: `mailto:${contact.email}`, icon: 'mail', external: false },
    contact.pressEmail && { label: 'Press email', text: contact.pressEmail, href: `mailto:${contact.pressEmail}`, icon: 'mail', external: false },
    contact.website && { label: 'Website', text: externalUrl(contact.website), href: externalUrl(contact.website), icon: 'arrow_outward', external: true },
    contact.facebook && { label: 'Social', text: 'Facebook', href: externalUrl(contact.facebook), icon: 'arrow_outward', external: true },
    contact.instagram && { label: 'Social', text: 'Instagram', href: externalUrl(contact.instagram), icon: 'arrow_outward', external: true },
    contact.twitter && { label: 'Social', text: 'X / Twitter', href: externalUrl(contact.twitter), icon: 'arrow_outward', external: true },
    contact.bluesky && { label: 'Social', text: 'Bluesky', href: externalUrl(contact.bluesky), icon: 'arrow_outward', external: true }
  ].filter((item) => !!item) : [];

  // Within a scope, each person keeps only the scoped filings, so offices, years, and counts describe that scope.
  function scopedPeople(list: Filing[]): Person[] {
    const included = new Set(list);
    return people
      .filter((person) => person.filings.some((filing) => included.has(filing)))
      .map((person) => {
        const filings = person.filings.filter((filing) => included.has(filing));
        return { ...person, filings, years: [...new Set(filings.map((filing) => filing.year))].sort((a, b) => b - a) };
      });
  }

  $: stateKey = stateId || section;
  // Office and place pages search their candidate list; the search clears when moving to another record.
  let candidateQuery = '';
  let candidateQueryFor = '';
  $: candidateRecord = office ? `offices/${office.id}` : place ? `places/${place.id}` : '';
  $: if (candidateRecord !== candidateQueryFor) {
    candidateQueryFor = candidateRecord;
    candidateQuery = '';
  }
  $: shownCandidacies = candidacies(office?.filings ?? place?.filings ?? [])
    // Match on both ticket names so a ticket's rows stay together.
    .filter(({ filing }) => matchesQuery(`${filing.name} ${filing.runningMate} ${filing.year} ${filing.officeName} ${filing.partyName} ${filing.sourceStatus}`, queryTokens(candidateQuery)));

  $: cards = section === 'people'
    ? (scope ? scopedPeople(scope) : people).map((item) => ({
        id: item.id,
        title: item.name,
        eyebrow: item.filings[0].partyName,
        meta: item.filings[0].officeName,
        count: `${item.filings.length} filing${item.filings.length === 1 ? '' : 's'} · ${item.years.join(', ')}`,
        columns: [item.filings[0].officeName, item.filings[0].partyName],
        filings: item.filings,
        text: searchText.people(item),
        years: item.years,
        initials: item.initials,
        logo: '',
        accent: '',
        officialWebsite: '',
        wikipediaUrl: '',
        wikidataUrl: ''
      }))
    : section === 'offices'
      ? offices.map((item) => ({
          id: item.id,
          title: item.name,
          eyebrow: item.sections.join(' · '),
          meta: `${item.years.length} election year${item.years.length === 1 ? '' : 's'}`,
          count: `${item.filings.length} filings · ${item.years.join(', ')}`,
          columns: [item.sections.join(' · ')],
          filings: item.filings,
          text: searchText.offices(item),
          years: item.years,
          initials: item.name.replace(/[^A-Z0-9]/g, '').slice(0, 2),
          logo: '',
          accent: '',
          officialWebsite: '',
          wikipediaUrl: '',
          wikidataUrl: ''
        }))
      : section === 'parties'
        ? parties.map((item) => ({
            id: item.id,
            title: item.name,
          eyebrow: 'Election affiliation',
            meta: `${new Set(item.filings.map((filing) => filing.officeId)).size} offices`,
            count: `${item.filings.length} filings`,
            columns: [item.recognized ? 'Recognized party' : item.historical ? 'Historical party' : 'Election affiliation', `${new Set(item.filings.map((filing) => filing.officeId)).size} offices`],
            filings: item.filings,
            text: searchText.parties(item),
            years: item.years,
            initials: item.shortName.charAt(0),
            logo: item.logo,
            accent: item.color,
            officialWebsite: '',
            wikipediaUrl: '',
            wikidataUrl: ''
          }))
        : places.map((item) => ({
            id: item.id,
            title: item.name,
            eyebrow: item.type,
          meta: `${item.type}${item.type === 'City' ? ` · ${item.county} County` : ''}`,
            count: `${item.filings.length} filings`,
            columns: [item.type, `${item.county} County`],
            filings: item.filings,
            text: searchText.places(item),
            years: item.years,
            initials: item.name.replace(/[^A-Z0-9]/g, '').slice(0, 2),
            logo: '',
            accent: '',
            officialWebsite: profilesById[item.id]?.officialWebsite ?? '',
            wikipediaUrl: profilesById[item.id]?.wikipediaUrl ?? '',
            wikidataUrl: profilesById[item.id]?.wikidataUrl ?? ''
          }));
  // List-view columns between the name and the year and filing counts; keys appear in the URL as ?sort=.
  $: listColumns = {
    people: [{ key: 'office', label: 'Office' }, { key: 'party', label: 'Party' }, ...(showStatus ? [{ key: 'status', label: 'Status' }] : [])],
    offices: [{ key: 'type', label: 'Office type' }],
    parties: [{ key: 'affiliation', label: 'Affiliation' }, { key: 'offices', label: 'Offices' }],
    places: [{ key: 'type', label: 'Type' }, { key: 'county', label: 'County' }]
  };

  $: tableColumns = [
    { key: 'name', label: labels[section].singular },
    ...listColumns[section],
    { key: 'years', label: 'Election years' },
    { key: 'filings', label: 'Filings' }
  ].filter((column) => !omitColumns.includes(column.key));

  // Restore filters, layout, and sort from the URL whenever the index is (re)entered.
  $: if (id) loadedIndex = '';
  $: if (!id && loadedIndex !== section) {
    loadedIndex = section;
    const state = restoreState(stateKey, cards, tableColumns.map((column) => column.key));
    selection = state.selection;
    query = state.query;
    view = state.view;
    sort = state.sort;
    limit = 36;
  }

  $: searchedCards = cards.filter((card) => matchesQuery(card.text, queryTokens(query)));
  $: filtering = isActive(selection);
  $: matchedCards = searchedCards
    .map((card) => {
      const matching = matchingFilings(card.filings, selection);
      // People are described by their most recent filing; when filtering, by the most recent match.
      const displayFiling = filtering && matching.length ? matching[0] : card.filings[0];
      const columns = section === 'people' ? [displayFiling.officeName, displayFiling.partyName] : card.columns;
      const years = filtering ? [...new Set(matching.map((filing) => filing.year))].sort((a, b) => b - a) : card.years;
      const statuses = [...new Set(matching.map((filing) => filing.sourceStatus))];
      return { ...card, matching, displayFiling, columns, years, statuses };
    })
    .filter((card) => !filtering || card.matching.length);
  $: facets = buildFacets(searchedCards, selection);
  $: sortedCards = sortRows(matchedCards, sort, sortValue, (card) => card.title);
  $: visibleCards = sortedCards.slice(0, limit);

  function sortValue(card: (typeof matchedCards)[number], key: string): string | number {
    if (key === 'name') return card.title;
    if (key === 'years') return card.years[0] ?? 0;
    if (key === 'filings') return card.matching.length;
    if (key === 'status') return card.statuses.join(' · ');
    return card.columns[listColumns[section].findIndex((column) => column.key === key)] ?? '';
  }

  function filingCount(card: { filings: unknown[]; matching: unknown[] }) {
    return filtering ? `${card.matching.length} of ${card.filings.length} filing${card.filings.length === 1 ? '' : 's'}` : `${card.filings.length} filing${card.filings.length === 1 ? '' : 's'}`;
  }

  function cellValue(card: (typeof matchedCards)[number], key: string) {
    if (key === 'filings') return filingCount(card);
    if (key === 'status') return card.statuses.join(' · ');
    return card.columns[listColumns[section].findIndex((column) => column.key === key)] ?? '';
  }

  function cellHref(card: (typeof matchedCards)[number], key: string) {
    if (section !== 'people') return '';
    if (key === 'office') return hrefFor('offices', card.displayFiling.officeId);
    if (key === 'party') return hrefFor('parties', card.displayFiling.partyId);
    return '';
  }

  /** Reveal the next page of records and move focus to the first new one, which renders above the button. */
  async function showMore() {
    const first = limit;
    limit += 36;
    await tick();
    resultsList?.querySelectorAll<HTMLElement>('tbody th a, .card-record-link')[first]?.focus();
  }

  $: tableCaption = `${labels[section].plural}${sort ? `, sorted by ${tableColumns.find((column) => column.key === sort?.key)?.label ?? sort.key} ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`;

  function updateSelection(next: Selection) {
    selection = next;
    limit = 36;
    persistState(stateKey, { selection, view, query, sort });
  }

  function updateView(next: 'grid' | 'list') {
    view = next;
    persistState(stateKey, { selection, view, query, sort });
  }

  function updateSort(key: string) {
    sort = nextSort(sort, key);
    persistState(stateKey, { selection, view, query, sort });
  }

  function updateQuery(next: string) {
    query = next;
    limit = 36;
    persistState(stateKey, { selection, view, query, sort });
  }

  function hrefFor(kind: typeof section, entityId: string) {
    return `/${kind}/${entityId}/`;
  }

  function open(event: MouseEvent, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }

  function externalUrl(value: string) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  function formatInception(profile: PlaceProfile) {
    if (!profile.inceptionDate) return 'Not listed';
    const [year, month, day] = profile.inceptionDate.split('-').map(Number);
    if (!profile.inceptionPrecision || profile.inceptionPrecision <= 9) return String(year);
    if (profile.inceptionPrecision === 10) return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
  }

</script>

<svelte:head>{#if !embedded}<title>{pageTitle} — Elections Utah</title>{/if}</svelte:head>

{#if id}
  {#if !found}
    <section class="entity-not-found">
      <p class="eyebrow">404</p>
      <h1>That record isn’t here.</h1>
      <p>The URL may be outdated, or the record is not part of the combined archive.</p>
      <a href={`/${section}/`} onclick={(event) => open(event, `/${section}/`)}>Browse {labels[section].plural} <Icon name="arrow_forward" /></a>
    </section>
  {:else if person}
    <article class="entity-detail">
      <Breadcrumbs parent={{ label: 'People', href: '/people/' }} current={person.name} {navigate} />
      <header class="detail-hero">
        <div class="detail-avatar" aria-hidden="true">{person.initials}</div>
        <div>
          <p class="eyebrow">Person record</p>
          <h1>{person.name}</h1>
          <p class="detail-summary">{person.filings.length === 1 ? `One recorded candidacy in ${person.years[0]}.` : `${person.filings.length} separate filings across ${person.years.join(', ')}.`}</p>
          {#if contact && (personProfile || contactFiling)}
            <section class="person-contact" aria-label={`${person.name} contact information`}>
              <div class="contact-heading"><span>{personProfile ? 'Campaign contact' : 'Public contact'}</span><small>{#if personProfile}Verified <time datetime={personProfile.lastVerified}>{formatDate(personProfile.lastVerified)}</time>{:else if contactFiling}{contactFiling.year} filing{/if}</small></div>
              <div class="contact-grid">
                {#if contact.address}<a class="contact-item contact-address" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`} target="_blank" rel="noreferrer"><small>{personProfile ? 'Campaign office' : 'Address'}</small><strong>{contact.address}</strong><b><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></b></a>{/if}
                {#if contact.mailingAddress}<div class="contact-item contact-address"><small>Contribution mailing address</small><strong>{contact.mailingAddress}</strong></div>{/if}
                {#each contactItems as item, index}
                  <a class="contact-item" class:wide={index === contactItems.length - 1 && contactItems.length % 2 === 1} href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined}><small>{item.label}</small><strong>{item.text}</strong><b><Icon name={item.icon} />{#if item.external}<span class="sr-only"> (opens in new tab)</span>{/if}</b></a>
                {/each}
              </div>
              {#if personProfile}<a class="contact-source" href={personProfile.sourceUrl} target="_blank" rel="noreferrer">Source: campaign website <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>{/if}
            </section>
          {/if}
        </div>
      </header>
      <section class="detail-stats">
        <div><small>FILINGS</small><strong>{formatCount(person.filings.length)}</strong></div>
        <div><small>ELECTION YEARS</small><strong>{person.years.length}</strong></div>
        <div><small>LATEST CYCLE</small><strong>{person.years[0]}</strong></div>
      </section>
      {#if personProfile}
        <section class="record-section person-profile" aria-labelledby="person-profile-title">
          <div class="record-heading"><p class="eyebrow">Campaign website information</p><h2 id="person-profile-title">About {person.name}</h2></div>
          <p class="person-biography">{personProfile.biography}</p>
          <h3>Published campaign priorities</h3>
          <ul>{#each personProfile.priorities as priority}<li>{priority}</li>{/each}</ul>
          <div class="office-resources" role="group" aria-label={`${person.name} campaign resources`}>{#each personProfile.resources as resource}<a href={resource.url} target="_blank" rel="noreferrer"><strong>{resource.label}</strong><span>{resource.description}</span><b><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></b></a>{/each}</div>
          <p class="profile-source">Summarized from <a href={personProfile.sourceUrl} target="_blank" rel="noreferrer">his campaign website<span class="sr-only"> (opens in new tab)</span></a>, verified <time datetime={personProfile.lastVerified}>{formatDate(personProfile.lastVerified)}</time>.</p>
        </section>
      {/if}
      <section class="record-section">
        <div class="record-heading"><p class="eyebrow">Candidate history</p><h2>All filings</h2></div>
        <div class="filing-list">
          {#each person.filings as filing}
            <div class="filing-card">
              <div class="filing-heading">
                <div class="filing-cycle"><time class="filing-year" datetime={String(filing.year)}>{filing.year}</time><small>{sectionLabel(filing.section)}{#if filing.runningMateId === person.id}{' · '}{runningMateRole(filing)} candidate{/if}</small></div>
                <h3><a href={hrefFor('offices', filing.officeId)} onclick={(event) => open(event, hrefFor('offices', filing.officeId))}>{filing.officeName}</a></h3>
              </div>
              <dl>
                {#if filing.runningMate}<div class="ticket-row"><dt>Running mate</dt><dd>{#if filing.runningMateId === person.id}<a href={hrefFor('people', filing.personId)} onclick={(event) => open(event, hrefFor('people', filing.personId))}>{filing.name}</a>{:else}<a href={hrefFor('people', filing.runningMateId)} onclick={(event) => open(event, hrefFor('people', filing.runningMateId))}>{filing.runningMate}</a>{/if}</dd></div>{/if}
                <div><dt>Party</dt><dd><a href={hrefFor('parties', filing.partyId)} onclick={(event) => open(event, hrefFor('parties', filing.partyId))}>{filing.partyName}</a></dd></div>
                <div><dt>Place</dt><dd>{#if filing.placeIds.length}{#each filing.placeIds as placeId, index}{#if index}<span class="place-separator" aria-hidden="true">/</span>{/if}<a href={hrefFor('places', placeId)} onclick={(event) => open(event, hrefFor('places', placeId))}>{placesById.get(placeId)?.name}</a>{/each}{:else}Not published{/if}</dd></div>
                <div><dt>Status</dt><dd>{filing.sourceStatus}</dd></div>
                <div><dt>Normalized status</dt><dd>{statusLabel(filing.status)}</dd></div>
              </dl>
              {#if filing.source && !sourceAvailable(filing.source)}<p class="source-note">Original source no longer online<span>{new URL(filing.source).hostname.replace(/^www\./, '')}</span></p>{:else if filing.source}<a class="source-link" href={filing.source} target="_blank" rel="noreferrer">{sourceLinkLabel(filing.source)} <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>{/if}
            </div>
          {/each}
        </div>
      </section>
    </article>
  {:else if office}
    <article class="entity-detail">
      <Breadcrumbs parent={{ label: 'Offices', href: '/offices/' }} current={office.name} {navigate} />
      <header class="detail-hero compact-hero"><div><p class="eyebrow">{office.sections.join(' · ')}</p><h1>{office.name}</h1><p class="detail-summary">{office.filings.length} filings across {office.years.join(', ')}.</p>{#if office.resources.length}<div class="office-resources" role="group" aria-label="Official office resources">{#each office.resources as resource}<a href={resource.url} target="_blank" rel="noreferrer"><strong>{resource.label}</strong><span>{resource.description}</span><b><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></b></a>{/each}</div>{/if}</div></header>
      <section class="detail-stats">
        <div><small>TOTAL FILINGS</small><strong>{formatCount(office.filings.length)}</strong></div>
        <div><small>PEOPLE</small><strong>{new Set(candidacies(office.filings).map((candidacy) => candidacy.personId)).size}</strong></div>
        <div><small>ELECTION YEARS</small><strong>{office.years.length}</strong></div>
      </section>
      <section class="record-section split-detail">
        <div class="record-heading"><p class="eyebrow">Candidate locations</p><h2>Places</h2>{#if office.placeIds.length}{#each office.placeIds as placeId}<a class="place-callout" href={hrefFor('places', placeId)} onclick={(event) => open(event, hrefFor('places', placeId))}>{placesById.get(placeId)?.name}<span>Browse candidates <Icon name="arrow_forward" /></span></a>{/each}{:else}<p class="missing-place">The source data does not publish city or county values for this office’s candidates.</p>{/if}</div>
        <div><div class="filed-heading"><p class="eyebrow">Candidate field</p><label><Icon name="search" /><input bind:value={candidateQuery} placeholder="Search candidates…" aria-label={`Search ${office.name} candidates`} /></label></div><div class="candidate-list">
          {#each shownCandidacies as { filing, personId, name, runningMate }}
            <a class="candidate-row" class:running-mate-row={runningMate} href={hrefFor('people', personId)} onclick={(event) => open(event, hrefFor('people', personId))}>
              <span class="mini-avatar" aria-hidden="true">{peopleById.get(personId)?.initials}</span><span><strong>{name}</strong><small>{filing.year} · {filing.partyName}{#if runningMate}{' · '}Running mate{:else if filing.runningMate}{' · '}with {filing.runningMate}{/if}</small></span><b class:inactive={!activeStatuses.has(filing.status)}>{filing.sourceStatus}</b>
            </a>
          {:else}<p class="no-records">No matching candidates.</p>
          {/each}
        </div></div>
      </section>
    </article>
  {:else if party}
    <article class="entity-detail" style={`--party-color:${party.color}`}>
      <Breadcrumbs parent={{ label: 'Parties', href: '/parties/' }} current={party.name} {navigate} />
      <header class="detail-hero party-hero">{#if party.logo}<div class="party-logo" class:inverse-logo={party.id === 'utah-republican-party'}><img src={party.logo} alt={`${party.name} logo`} /></div>{:else}<div class="party-mark" aria-hidden="true">{party.shortName.charAt(0)}</div>{/if}<div><p class="eyebrow">{party.recognized ? 'Recognized Utah political party' : party.historical ? 'Historical Utah political party' : 'Election affiliation'}</p><h1>{party.name}</h1><p>{party.filings.length ? `${party.filings.length} candidate filings across ${party.years.join(', ')}.` : 'No candidates from this party appear in the archived filing datasets.'}</p>{#if party.website}<a class="source-link" href={party.website} target="_blank" rel="noreferrer">Official party information <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>{/if}</div></header>
      <section class="detail-stats">
        <div><small>TOTAL FILINGS</small><strong>{formatCount(party.filings.length)}</strong></div>
        <div><small>PEOPLE</small><strong>{new Set(candidacies(party.filings).map((candidacy) => candidacy.personId)).size}</strong></div>
        <div><small>ELECTION YEARS</small><strong>{party.years.length}</strong></div>
      </section>
      <section class="record-section"><div class="record-heading"><p class="eyebrow">Candidate history</p><h2>People</h2></div>{#if party.filings.length}{#key party.id}<EntityViews section="people" scope={party.filings} embedded stateId="party-people" omitColumns={['party']} {navigate} />{/key}{:else}<div class="empty-slate"><strong>No archived candidate filings</strong><p>This party still has an individual directory page because it is recognized by the State of Utah.</p></div>{/if}</section>
    </article>
  {:else if place}
    <article class="entity-detail">
      <Breadcrumbs parent={{ label: 'Places', href: '/places/' }} current={place.name} {navigate} />
      <header class="detail-hero compact-hero place-hero">
        <div class="place-hero-detail"><p class="eyebrow">{place.type}{#if place.type === 'City'} · <a class="place-county-link" href={hrefFor('places', place.parentId)} onclick={(event) => open(event, hrefFor('places', place.parentId))}>{placesById.get(place.parentId)?.name ?? `${place.county} County`}</a>{/if}</p><h1>{place.name}</h1><p>{place.description}</p><p class="archive-context"><strong>Archived candidate years: {place.years.slice().reverse().join(', ')}.</strong> Office links reflect these filings and their historical districts.</p></div>
        {#if placeProfile}
          <section class="place-profile" aria-labelledby="place-profile-title">
            <div class="place-summary">
              <p class="eyebrow">Place profile</p>
              <h2 id="place-profile-title">About {place.name}</h2>
              <p>{placeProfile.summary}</p>
              <a href={placeProfile.wikipediaUrl} target="_blank" rel="noreferrer">Wikipedia <span><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></span></a>
            </div>
            <div class="place-facts">
              <article class="population-card">
                <small>{placeProfile.populationAsOf === '2020-04-01' ? '2020 census population' : `${placeProfile.populationAsOf.slice(0, 4)} population`}</small>
                <strong>{placeProfile.population.toLocaleString('en-US')}</strong>
                <p>Reported figure · {placeProfile.populationAsOf.slice(0, 4)}</p>
                <a href={placeProfile.populationSource === 'Wikidata' ? placeProfile.wikidataUrl : placeProfile.wikipediaUrl} target="_blank" rel="noreferrer">{placeProfile.populationSource} <span><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></span></a>
              </article>
              <article class="inception-card">
                <small>Founded / established</small>
                <strong>{formatInception(placeProfile)}</strong>
                {#if !placeProfile.inceptionDate}<p>No inception date is currently recorded.</p>{/if}
                <a href={placeProfile.wikidataUrl} target="_blank" rel="noreferrer">Wikidata <span><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></span></a>
              </article>
              <article class="website-card">
                <small>Official Website</small>
                <strong><a href={placeProfile.officialWebsite} target="_blank" rel="noreferrer">{new URL(placeProfile.officialWebsite).hostname.replace(/^www\./, '')}<span class="sr-only"> (opens in new tab)</span></a></strong>
                <p>{place.type === 'County' ? 'County government website' : 'Local government website'}</p>
                <a href={placeProfile.officialWebsite} target="_blank" rel="noreferrer">Visit website <span><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></span></a>
              </article>
            </div>
          </section>
        {/if}
      </header>
      <section class="detail-stats">
        <div><small>OFFICES</small><strong>{place.offices.length}</strong></div>
        <div><small>FILINGS</small><strong>{formatCount(place.filings.length)}</strong></div>
        <div><small>ELECTION YEARS</small><strong>{place.years.length}</strong></div>
      </section>
      <section class="record-section split-detail">
        <div class="record-heading"><p class="eyebrow">Archived locations</p>{#if place.children.length}<h2>Cities in the archive</h2>{#each place.children as city}<a class="office-link" href={hrefFor('places', city.id)} onclick={(event) => open(event, hrefFor('places', city.id))}>{city.name}<span>{city.filings.length} filings <Icon name="arrow_forward" /></span></a>{/each}{/if}<h2 class:office-group-heading={place.children.length > 0}>Offices in archived filings</h2>{#each place.offices as item}<a class="office-link" href={hrefFor('offices', item.id)} onclick={(event) => open(event, hrefFor('offices', item.id))}>{item.name}<span>{item.filings.length} filings <Icon name="arrow_forward" /></span></a>{/each}</div>
        <div>
          <div class="filed-heading"><p class="eyebrow">Filed candidates</p><label><Icon name="search" /><input bind:value={candidateQuery} placeholder="Search candidates…" aria-label={`Search ${place.name} candidates`} /></label></div>
          <div class="candidate-list">{#each shownCandidacies as { filing, personId, name, runningMate }}<a class="candidate-row" href={hrefFor('people', personId)} onclick={(event) => open(event, hrefFor('people', personId))}><span class="mini-avatar" aria-hidden="true">{peopleById.get(personId)?.initials}</span><span><strong>{name}</strong><small>{filing.year} · {filing.officeName}{#if runningMate}{' · '}Running mate{/if}</small></span><b>{filing.partyName}</b></a>{:else}<p class="no-records">No matching candidates.</p>{/each}</div>
        </div>
      </section>
    </article>
  {/if}
{:else}
  <section class="entity-index" class:places-index={section === 'places'} class:embedded-index={embedded}>
    {#if !embedded}<header>
      <div><p class="eyebrow">Election archive</p><h1>{labels[section].plural}</h1></div>
      <p>{labels[section].intro}</p>
    </header>{/if}
    <IndexControls
      {facets}
      {selection}
      {view}
      {query}
      searchLabel={`Search ${labels[section].plural.toLowerCase()}`}
      resultLabel={`${formatCount(matchedCards.length)} of ${formatCount(cards.length)} ${labels[section].plural.toLowerCase()}`}
      resultCount={matchedCards.length}
      resultSingular={labels[section].singular.toLowerCase()}
      resultPlural={labels[section].plural.toLowerCase()}
      onSelection={updateSelection}
      onView={updateView}
      onQuery={updateQuery}
    />
    {#if section === 'people'}<p class="index-note">People are counted once in this list, including running mates. A filing is one archived candidacy or ticket record; one person can appear in several filings.</p>{/if}
    {#if view === 'list'}
      <div class="entity-table-wrap" bind:this={resultsList}>
        <table class="entity-table">
          <caption class="sr-only">{tableCaption}</caption>
          <thead><tr>{#each tableColumns as column (column.key)}<SortHeader key={column.key} label={column.label} {sort} numeric={column.key === 'filings'} onSort={updateSort} />{/each}</tr></thead>
          <tbody>
            {#each visibleCards as card (card.id)}
              <tr>
                <th scope="row"><a href={hrefFor(section, card.id)} onclick={(event) => open(event, hrefFor(section, card.id))}>{#if card.logo}<span class="table-logo" class:inverse-logo={card.id === 'utah-republican-party'} style={card.accent ? `--card-accent:${card.accent}` : ''}><img src={card.logo} alt="" /></span>{:else}<span class="mini-avatar" aria-hidden="true">{card.initials || card.title.charAt(0)}</span>{/if}<span>{card.title}</span></a></th>
                {#each tableColumns.slice(1) as column (column.key)}
                  <td data-label={column.label} class:numeric={column.key === 'filings'}>
                    {#if column.key === 'years'}
                      <span class="election-year-links">{#each card.years as year, index}{#if index}{', '}{/if}<a href={`/elections/${year}/`} onclick={(event) => open(event, `/elections/${year}/`)}>{year}</a>{/each}</span>
                    {:else if cellHref(card, column.key)}
                      <a href={cellHref(card, column.key)} onclick={(event) => open(event, cellHref(card, column.key))}>{cellValue(card, column.key)}</a>
                    {:else}
                      {cellValue(card, column.key)}
                    {/if}
                  </td>
                {/each}
              </tr>
            {:else}
              <tr><td class="no-records" colspan={tableColumns.length}>No matching {labels[section].plural.toLowerCase()}.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="entity-grid" bind:this={resultsList}>
        {#each visibleCards as card}
          <article class="entity-card" style={card.accent ? `--card-accent:${card.accent}` : ''}>
            {#if section === 'places' && (card.officialWebsite || card.wikidataUrl || card.wikipediaUrl)}
              <div class="place-source-links" role="group" aria-label={`${card.title} reference links`}>
                {#if card.officialWebsite}
                  <a href={card.officialWebsite} target="_blank" rel="noreferrer" aria-label={`${card.title} official website (opens in new tab)`} title="Official website">
                    <Icon name="language" />
                  </a>
                {/if}
                {#if card.wikidataUrl}
                  <a href={card.wikidataUrl} target="_blank" rel="noreferrer" aria-label={`${card.title} on Wikidata (opens in new tab)`} title="Wikidata">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5h2v14H2zM5 5h1v14H5zM7 5h3v14H7zM11 5h1v14h-1zM13 5h2v14h-2zM16 5h1v14h-1zM18 5h4v14h-4z" /></svg>
                  </a>
                {/if}
                {#if card.wikipediaUrl}
                  <a href={card.wikipediaUrl} target="_blank" rel="noreferrer" aria-label={`${card.title} on Wikipedia (opens in new tab)`} title="Wikipedia">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.1 6.5c.7 0 1.3.4 1.7 1.3L9.5 19h.9l2.3-5.4 2.2 5.4h.9l4.8-11.2c.4-.9.9-1.3 1.6-1.3V5h-5.3v1.5c1.2 0 1.7.3 1.3 1.3l-2.9 7-1.6-3.8 1.4-3.2c.4-.9.9-1.3 1.6-1.3V5h-5v1.5c1.2 0 1.6.4 1.2 1.3l-.2.5-.2-.5c-.4-.9 0-1.3 1.1-1.3V5H7.8v1.5c.7 0 1.2.4 1.6 1.3l2.3 5.3-1.1 2.7-3.4-8c-.4-.9.1-1.3 1.4-1.3V5H3.1z" /></svg>
                  </a>
                {/if}
              </div>
            {/if}
            <a class="card-record-link" href={hrefFor(section, card.id)} onclick={(event) => open(event, hrefFor(section, card.id))}>
              {#if card.logo}<span class="card-logo" class:inverse-logo={card.id === 'utah-republican-party'}><img src={card.logo} alt={`${card.title} logo`} /></span>{:else}<span class="card-avatar" aria-hidden="true">{card.initials || card.title.charAt(0)}</span>{/if}
              {#if !omitColumns.includes('party')}<small>{section === 'people' ? card.columns[1] : card.eyebrow}</small>{/if}<h2>{card.title}</h2><p>{section === 'people' ? card.columns[0] : card.meta}</p>{#if showStatus}<p class="candidate-status">Status: {card.statuses.join(' · ')}</p>{/if}<div class="card-footer"><span>{section === 'people' || filtering ? filingCount(card) : card.count}{#if !omitColumns.includes('years') && section === 'people'} · {card.years.join(', ')}{/if}</span><b>View record <Icon name="arrow_forward" /></b></div>
            </a>
          </article>
        {:else}
          <p class="no-records">No matching {labels[section].plural.toLowerCase()}.</p>
        {/each}
      </div>
    {/if}
    {#if visibleCards.length < sortedCards.length}<button class="load-more" onclick={showMore}>Show more <span>{formatCount(sortedCards.length - visibleCards.length)} remaining</span></button>{/if}
  </section>
{/if}
