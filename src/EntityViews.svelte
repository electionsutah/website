<script lang="ts">
  import { tick } from 'svelte';
  import Breadcrumbs from './Breadcrumbs.svelte';
  import Icon from './Icon.svelte';
  import EntityLinks from './EntityLinks.svelte';
  import { placeEntityLinks, resolveEntityLinks, type EntityLink } from './lib/entity-links';
  import { anchoredPopover } from './lib/anchored-popover';
  import { sentenceExcerpt } from './lib/sentence-excerpt';
  import SearchField from './SearchField.svelte';
  import IndexControls from './IndexControls.svelte';
  import IndexHeader from './IndexHeader.svelte';
  import indexHeaderImages from './data/index-header-images.json';
  import SortHeader from './SortHeader.svelte';
  import placeProfiles from './data/place-enrichment.json';
  import placeImageData from './data/place-images.json';
  import placeEmblemData from './data/place-emblems.json';
  import personProfiles from './data/person-enrichment.json';
  import EntityViews from './EntityViews.svelte';
  import { officeMap, placeMap } from './lib/boundary-maps';
  import BoundaryMap from './BoundaryMap.svelte';
  import PhotoCredit from './PhotoCredit.svelte';
  import PersonAvatar from './PersonAvatar.svelte';
  import personPhotoData from './data/person-photos.json';
  import voterRegistration from './data/voter-registration.json';
  import voterParticipation from './data/voter-participation.json';
  import {
    activeStatuses,
    candidacies,
    offices,
    officesById,
    parties,
    partiesById,
    partyLabel,
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
  import { matchesQuery, queryTokens, rankByTitle, searchText } from './lib/search';
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
    population?: number;
    populationAsOf?: string;
    populationSource?: string;
    /** Set when the figure comes from somewhere other than the Wikidata/Wikipedia page. */
    populationSourceUrl?: string;
    inceptionDate?: string | null;
    inceptionPrecision?: number | null;
  };

  const profilesById = placeProfiles as Record<string, PlaceProfile>;
  /** Wikidata image (P18) per place, from scripts/fetch-place-images.py. */
  type PlaceImage = { src: string; title: string; artist: string; license: string; licenseUrl: string; sourceUrl: string };
  const placeImages = placeImageData as Record<string, PlaceImage>;
  /** County and city seals, logos, and flags from Wikimedia Commons (scripts/fetch-place-emblems.py). */
  const placeEmblems = placeEmblemData as Record<string, PlaceImage & { kind: string; file: string }>;
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
  $: placePopoverId = `place-election-${place?.id ?? ''}`;
  $: placeImage = place ? placeImages[place.id] ?? placeImages[place.parentId] : undefined;
  $: placeImageFallback = !!place && !placeImages[place.id] && !!placeImage;
  $: personPhoto = person ? (personPhotoData as Record<string, PlaceImage & { via: string }>)[person.id] : undefined;
  $: placeEmblem = place ? placeEmblems[place.id] : undefined;
  // Municipal pages show explicitly labeled county context; these are never city counts.
  $: voterCountyId = place ? (place.type === 'County' ? place.id : place.parentId) : '';
  $: placeVoters = (voterRegistration.counties as Record<string, { name: string; active: number; parties: Record<string, number> }>)[voterCountyId];
  $: placeParticipation = (voterParticipation.counties as Record<string, { activeRegistered: number; ballotsCast: number; turnoutPercent: number }>)[voterCountyId];
  // Municipal offices (mayor, council) show their city's photo and county offices their county's. District
  // offices list candidates' home cities, which only partly overlap the district, so they keep the plain hero.
  $: officeCity = office?.sections.includes('Municipal office') ? office.placeIds.map((id) => placesById.get(id)).filter((row) => row && row.type !== 'County')
    : office?.sections.includes('County office') ? office.placeIds.map((id) => placesById.get(id)).filter((row) => row?.type === 'County') : [];
  $: officeImage = officeCity.length === 1 ? placeImages[officeCity[0]!.id] : undefined;
  // Cities sit under their county in the breadcrumb: Places › Duchesne County › Roosevelt.
  $: placeCounty = place?.type !== 'County' && place?.parentId ? placesById.get(place.parentId) : undefined;
  $: boundary = office ? officeMap(office, placesById) : place ? placeMap(place) : null;
  $: found = !id || Boolean(person || office || party || place);
  $: pageTitle = !found
    ? 'Record not found'
    : person?.name || office?.name || party?.name || place?.name || labels[section].plural;
  $: contactFiling = person?.filings.find((filing) => filing.personId === person.id && filing.contact && Object.values(filing.contact).some(Boolean));
  // Current campaign information has its own source and date; archived contacts stay in the filing data.
  $: contact = personProfile?.contact ?? contactFiling?.contact;
  $: contactItems = contact ? [
    contact.phone && { label: 'Phone', text: contact.phone, href: `tel:${contact.phone}`, icon: 'call', external: false },
    contact.email && { label: 'Email', text: contact.email, href: `mailto:${contact.email}`, icon: 'send', external: false },
    contact.pressEmail && { label: 'Press email', text: contact.pressEmail, href: `mailto:${contact.pressEmail}`, icon: 'send', external: false }
  ].filter((item) => !!item) : [];
  $: contactLinks = contact ? [
    { url: contact.website || '' }, { url: contact.facebook || '' },
    { url: contact.instagram || '' }, { url: contact.twitter || '' },
    { url: contact.bluesky || '' }
  ] satisfies EntityLink[] : [];

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
            eyebrow: partyLabel(item),
            meta: `${new Set(item.filings.map((filing) => filing.officeId)).size} offices`,
            count: `${item.filings.length} filings`,
            columns: [partyLabel(item), `${new Set(item.filings.map((filing) => filing.officeId)).size} offices`],
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
            logo: placeEmblems[item.id]?.src ?? '',
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
  $: sortedCards = sort ? sortRows(matchedCards, sort, sortValue, (card) => card.title)
    : rankByTitle(matchedCards, queryTokens(query), (card) => card.title);
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

  /** Reveal the next 100 records and move focus to the first new one, which renders above the button. */
  async function showMore() {
    const first = limit;
    limit += 100;
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
        <PersonAvatar personId={person.id} className="detail-avatar" tag="div" />
        <div>
          <p class="eyebrow">Person record</p>
          <h1>{person.name}</h1>
          <p class="detail-summary">{person.filings.length === 1 ? `One recorded candidacy in ${person.years[0]}.` : `${person.filings.length} separate filings across ${person.years.join(', ')}.`}</p>
          {#if personPhoto}<PhotoCredit image={personPhoto} className="emblem-credit" />{/if}
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
              {#if resolveEntityLinks(contactLinks).length}
                <div class="contact-links-row">
                  <small>Links</small>
                  <EntityLinks links={contactLinks} entityName={person.name} />
                </div>
              {/if}
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
          <div class="record-heading"><p class="eyebrow compact">Campaign website information</p><h2 id="person-profile-title">About {person.name}</h2></div>
          <p class="person-biography">{personProfile.biography}</p>
          <h3>Published campaign priorities</h3>
          <ul>{#each personProfile.priorities as priority}<li>{priority}</li>{/each}</ul>
          <div class="office-resources" role="group" aria-label={`${person.name} campaign resources`}>{#each personProfile.resources as resource}<a href={resource.url} target="_blank" rel="noreferrer"><strong>{resource.label}</strong><span>{resource.description}</span><b><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></b></a>{/each}</div>
          <p class="profile-source">Summarized from <a href={personProfile.sourceUrl} target="_blank" rel="noreferrer">the candidate’s campaign website<span class="sr-only"> (opens in new tab)</span></a>, verified <time datetime={personProfile.lastVerified}>{formatDate(personProfile.lastVerified)}</time>.</p>
        </section>
      {/if}
      <section class="record-section">
        <div class="record-heading"><p class="eyebrow compact">Candidate history</p><h2>All filings</h2></div>
        <div class="filing-list">
          {#each person.filings as filing}
            <div class="filing-card">
              <div class="filing-heading">
                <div class="filing-cycle"><time class="filing-year" datetime={String(filing.year)}>{filing.year}</time><small>{sectionLabel(filing.section)}{#if filing.runningMateId === person.id}{' · '}{runningMateRole(filing)} candidate{/if}</small></div>
                <h3><a href={hrefFor('offices', filing.officeId)} onclick={(event) => open(event, hrefFor('offices', filing.officeId))}>{filing.officeName}</a></h3>
              </div>
              <dl>
                {#if filing.runningMate}<div class="ticket-row"><dt>Running mate</dt><dd>{#if filing.runningMateId === person.id}<a href={hrefFor('people', filing.personId)} onclick={(event) => open(event, hrefFor('people', filing.personId))}>{filing.name}</a>{:else}<a href={hrefFor('people', filing.runningMateId)} onclick={(event) => open(event, hrefFor('people', filing.runningMateId))}>{filing.runningMate}</a>{/if}</dd></div>{/if}
                <div><dt>Party</dt><dd><a class="filing-party-link" href={hrefFor('parties', filing.partyId)} onclick={(event) => open(event, hrefFor('parties', filing.partyId))}>{#if partiesById.get(filing.partyId)?.logo}<span class="filing-party-logo" class:inverse-logo={filing.partyId === 'utah-republican-party'} style:--party-color={partiesById.get(filing.partyId)?.color}><img src={partiesById.get(filing.partyId)?.logo} alt="" loading="lazy" decoding="async" /></span>{/if}<span>{filing.partyName}</span></a></dd></div>
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
      <header class="detail-hero compact-hero" class:has-boundary={!!boundary} class:has-photo={!!officeImage} style:--place-photo={officeImage ? `url("${officeImage.src}")` : undefined}><div class="office-hero-detail"><p class="eyebrow">{office.sections.join(' · ')}</p><div class="entity-heading-row"><h1>{office.name}</h1></div><p class="detail-summary">{office.filings.length} filings across {office.years.join(', ')}.</p>{#if office.resources.length}<div class="office-resources" role="group" aria-label="Official office resources">{#each office.resources as resource}<a href={resource.url} target="_blank" rel="noreferrer"><strong>{resource.label}</strong><span>{resource.description}</span><b><Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></b></a>{/each}</div>{/if}</div>{#if boundary}<BoundaryMap map={boundary} className="office-boundary" />{/if}{#if officeImage}<PhotoCredit image={officeImage} />{/if}</header>
      <section class="detail-stats">
        <div><small>TOTAL FILINGS</small><strong>{formatCount(office.filings.length)}</strong></div>
        <div><small>PEOPLE</small><strong>{new Set(candidacies(office.filings).map((candidacy) => candidacy.personId)).size}</strong></div>
        <div><small>ELECTION YEARS</small><strong>{office.years.length}</strong></div>
      </section>
      <section class="record-section split-detail">
        <div class="record-heading"><p class="eyebrow compact">Candidate locations</p><h2>Places</h2>{#if office.placeIds.length}{#each office.placeIds as placeId}<a class="place-callout" href={hrefFor('places', placeId)} onclick={(event) => open(event, hrefFor('places', placeId))}>{placesById.get(placeId)?.name}<span>Browse candidates <Icon name="arrow_forward" /></span></a>{/each}{:else}<p class="missing-place">The source data does not publish city or county values for this office’s candidates.</p>{/if}</div>
        <div><div class="filed-heading"><p class="eyebrow flush">Candidate field</p><SearchField bind:value={candidateQuery} placeholder="Search candidates…" label={`Search ${office.name} candidates`} /></div><div class="candidate-list">
          {#each shownCandidacies as { filing, personId, name, runningMate }}
            <a class="candidate-row" class:running-mate-row={runningMate} href={hrefFor('people', personId)} onclick={(event) => open(event, hrefFor('people', personId))}>
              <PersonAvatar {personId} className="mini-avatar" /><span><strong>{name}</strong><small>{filing.year} · {filing.partyName}{#if runningMate}{' · '}Running mate{:else if filing.runningMate}{' · '}with {filing.runningMate}{/if}</small></span><b class:inactive={!activeStatuses.has(filing.status)}>{filing.sourceStatus}</b>
            </a>
          {:else}<p class="no-records">No matching candidates.</p>
          {/each}
        </div></div>
      </section>
    </article>
  {:else if party}
    <article class="entity-detail" style={`--party-color:${party.color}`}>
      <Breadcrumbs parent={{ label: 'Parties', href: '/parties/' }} current={party.name} {navigate} />
      <header class="detail-hero party-hero">{#if party.logo}<div class="party-logo" class:inverse-logo={party.id === 'utah-republican-party'}><img src={party.logo} alt={`${party.name} ${party.localCaucus ? 'symbol' : 'logo'}`} /></div>{:else}<div class="party-mark" aria-hidden="true">{party.shortName.charAt(0)}</div>{/if}<div class="party-hero-detail"><p class="eyebrow">{partyLabel(party)}</p><div class="entity-heading-row"><h1>{party.name}</h1><EntityLinks links={[{ url: party.website }]} entityName={party.name} /></div><p class="detail-summary">{party.filings.length ? `${party.filings.length} candidate filings across ${party.years.join(', ')}.` : 'No candidates from this party appear in the archived filing datasets.'}</p>
        {#if party.localCaucus}
          <section class="party-caucus-history" aria-labelledby="party-history-title">
            <p class="eyebrow compact">A Fruit Heights tradition</p>
            <h2 id="party-history-title">Two rooms, one local election</h2>
            <p>{party.localCaucus.history}</p>
            <p>Residents choose the Pinecone or Sagebrush caucus, each of which nominates candidates for city office. These are local nonpartisan groups; neither represents the Democratic or Republican Party.</p>
            <p class="party-symbol-note">Illustration from Fruit Heights City’s May 2023 election guide.</p>
            <a class="source-link" href={party.localCaucus.source} target="_blank" rel="noreferrer">Read the city’s history <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>
            <a class="source-link" href="https://www.fruitheights.gov/313/Elections" target="_blank" rel="noreferrer">Fruit Heights elections <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>
          </section>
        {/if}
      </div></header>
      <section class="detail-stats">
        <div><small>TOTAL FILINGS</small><strong>{formatCount(party.filings.length)}</strong></div>
        <div><small>PEOPLE</small><strong>{new Set(candidacies(party.filings).map((candidacy) => candidacy.personId)).size}</strong></div>
        <div><small>ELECTION YEARS</small><strong>{party.years.length}</strong></div>
      </section>
      <section class="record-section"><div class="record-heading"><p class="eyebrow compact">Candidate history</p><h2>People</h2></div>{#if party.filings.length}{#key party.id}<EntityViews section="people" scope={party.filings} embedded stateId="party-people" omitColumns={['party']} {navigate} />{/key}{:else}<div class="empty-slate"><strong>No archived candidate filings</strong><p>This party still has an individual directory page because it is recognized by the State of Utah.</p></div>{/if}</section>
    </article>
  {:else if place}
    <article class="entity-detail">
      <Breadcrumbs parent={[{ label: 'Places', href: '/places/' }, ...(placeCounty ? [{ label: placeCounty.name, href: hrefFor('places', placeCounty.id) }] : [])]} current={place.name} {navigate} />
      <header class="detail-hero compact-hero place-hero">
        <div class="place-hero-detail" class:has-photo={!!placeImage} style:--place-photo={placeImage ? `url("${placeImage.src}")` : undefined}><p class="eyebrow">{place.type}{#if place.type === 'City'} · <a class="place-county-link" href={hrefFor('places', place.parentId)} onclick={(event) => open(event, hrefFor('places', place.parentId))}>{placesById.get(place.parentId)?.name ?? `${place.county} County`}</a>{/if}</p><h1>{place.name}</h1><p>{place.description}</p><p class="archive-context"><strong>Archived candidate years: {place.years.slice().reverse().join(', ')}.</strong> Office links reflect these filings and their historical districts.</p>{#if placeImage}<PhotoCredit image={placeImage} label={placeImageFallback ? `${place.county} County photo` : 'Photo'} />{/if}</div>
          <section class="place-profile" aria-labelledby="place-profile-title">
            <div class="place-summary">
              <p class="eyebrow compact">Place profile</p>
              <div class="place-profile-heading entity-heading-row">
                <h2 id="place-profile-title">About {place.name}</h2>
                <EntityLinks links={placeEntityLinks(placeProfile)} entityName={place.name} />
              </div>
              <p class="place-intro" use:sentenceExcerpt={placeProfile?.summary ?? `${place.name} is represented in the ${place.county} County election archive. A sourced local profile is not yet available.`}></p>
              {#if placeEmblem}<PhotoCredit image={placeEmblem} label={placeEmblem.kind.charAt(0).toUpperCase() + placeEmblem.kind.slice(1)} className="emblem-credit" />{/if}
            </div>
            <div class="place-data-grid">
              <div class="place-headline-facts">
                {#if placeProfile?.population != null}
                  <article>
                    <small>Population</small>
                    <strong>{formatCount(placeProfile.population)}</strong>
                    <p>{place.name}{placeProfile.populationAsOf ? ` · ${placeProfile.populationAsOf.slice(0, 4)}${placeProfile.populationAsOf === '2020-04-01' ? ' census' : ''}` : ''}</p>
                  </article>
                {/if}
                {#if placeVoters}
                  <article>
                    <small>Active voters</small>
                    <strong>{formatCount(placeVoters.active)}</strong>
                    <p>{placeVoters.name} · {formatDate(voterRegistration.asOf)}</p>
                  </article>
                {/if}
                {#if placeParticipation}
                  <article>
                    <small>2024 turnout</small>
                    <strong>{placeParticipation.turnoutPercent.toFixed(2)}%</strong>
                    <p>{place.county} County · general election</p>
                  </article>
                {/if}
              </div>
              <div class="place-profile-body" class:has-boundary={!!boundary}>
                {#if boundary}<BoundaryMap map={boundary} fit="fill" className="place-boundary" />{/if}
                <article class="place-town-info" aria-label={`${place.name} facts`}>
                  <div class="place-town-content">
                    {#if placeProfile?.inceptionDate}
                      <div class="place-town-fact">
                        <small>Founded / established</small>
                        <strong>{formatInception(placeProfile)}</strong>
                      </div>
                    {/if}
                    {#if place.type !== 'County' && (placeVoters || placeParticipation)}<p class="place-county-context">Voter registration and turnout are countywide figures; city figures are not available in these reports.</p>{/if}
                  </div>
                  <div class="place-election-details">
                    <button class="place-election-toggle" popovertarget={placePopoverId}>Election details &amp; sources</button>
                    <div class="evidence-popover place-election-popover" id={placePopoverId} popover="auto" use:anchoredPopover={placePopoverId} aria-labelledby={`${placePopoverId}-title`}>
                      <header><strong id={`${placePopoverId}-title`}>Election details &amp; sources · {place.name}</strong><button popovertarget={placePopoverId} popovertargetaction="hide" aria-label="Close election details"><Icon name="close" /></button></header>
                      <div class="place-source-content">
                        {#if placeVoters}
                          <p>Active registration: {formatDate(voterRegistration.asOf)}, Lt. Governor's office.{place.type !== 'County' ? ' City registration counts are not published in this report.' : ''}</p>
                          <a href={voterRegistration.sources.statistics} target="_blank" rel="noreferrer">Voter registration report <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>
                          <details class="voter-parties"><summary>Registration by party</summary><dl>{#each Object.entries(placeVoters.parties).sort((a, b) => b[1] - a[1]) as [party, count]}<div><dt>{party}</dt><dd>{formatCount(count)}</dd></div>{/each}</dl></details>
                        {/if}
                        {#if placeParticipation}
                          <p>2024 general election turnout: {formatCount(placeParticipation.ballotsCast)} ballots cast / {formatCount(placeParticipation.activeRegistered)} active registered voters. Certified November 25, 2024.{place.type !== 'County' ? ' Countywide context, not city turnout.' : ''}</p>
                          <a href={voterParticipation.sourceUrl} target="_blank" rel="noreferrer">Certified canvass <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>
                        {/if}
                        {#if placeProfile?.population != null}
                          <p>Population: {placeProfile.populationSourceUrl ? 'Approximate figure' : 'Reported figure'}{placeProfile.populationAsOf ? ` · ${placeProfile.populationAsOf.slice(0, 4)}` : ''}. <a href={placeProfile.populationSourceUrl ?? (placeProfile.populationSource === 'Wikidata' ? placeProfile.wikidataUrl : placeProfile.wikipediaUrl)} target="_blank" rel="noreferrer">{placeProfile.populationSource} <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a></p>
                        {/if}
                        {#if placeProfile?.inceptionDate}<p>Founded / established: <a href={placeProfile.wikidataUrl} target="_blank" rel="noreferrer">Wikidata <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a></p>{/if}
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
      </header>
      <section class="detail-stats">
        <div><small>OFFICES</small><strong>{place.offices.length}</strong></div>
        <div><small>FILINGS</small><strong>{formatCount(place.filings.length)}</strong></div>
        <div><small>ELECTION YEARS</small><strong>{place.years.length}</strong></div>
      </section>
      <section class="record-section split-detail">
        <div class="record-heading"><p class="eyebrow compact">Archived locations</p>{#if place.children.length}<h2>Cities in the archive</h2>{#each place.children as city}<a class="office-link" href={hrefFor('places', city.id)} onclick={(event) => open(event, hrefFor('places', city.id))}>{city.name}<span>{city.filings.length} filings <Icon name="arrow_forward" /></span></a>{/each}{/if}<h2 class:office-group-heading={place.children.length > 0}>Area offices</h2>{#each place.offices as item}<a class="office-link" href={hrefFor('offices', item.id)} onclick={(event) => open(event, hrefFor('offices', item.id))}>{item.name}<span>{item.filings.length} filings <Icon name="arrow_forward" /></span></a>{/each}</div>
        <div>
          <div class="filed-heading"><p class="eyebrow flush">Filed candidates</p><SearchField bind:value={candidateQuery} placeholder="Search candidates…" label={`Search ${place.name} candidates`} /></div>
          <div class="candidate-list">{#each shownCandidacies as { filing, personId, name, runningMate }}<a class="candidate-row" href={hrefFor('people', personId)} onclick={(event) => open(event, hrefFor('people', personId))}><PersonAvatar {personId} className="mini-avatar" /><span><strong>{name}</strong><small>{filing.year} · {filing.officeName}{#if runningMate}{' · '}Running mate{/if}</small></span><b>{filing.partyName}</b></a>{:else}<p class="no-records">No matching candidates.</p>{/each}</div>
        </div>
      </section>
    </article>
  {/if}
{:else}
  <section class="entity-index" class:places-index={section === 'places'} class:embedded-index={embedded}>
    {#if !embedded}<IndexHeader title={labels[section].plural} intro={labels[section].intro} photo={indexHeaderImages[section]} />{/if}
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
                <th scope="row"><a href={hrefFor(section, card.id)} onclick={(event) => open(event, hrefFor(section, card.id))}>{#if card.logo}<span class="table-logo" class:inverse-logo={card.id === 'utah-republican-party'} class:emblem-logo={section === 'places'} style={card.accent ? `--card-accent:${card.accent}` : ''}><img src={card.logo} alt="" /></span>{:else if section === 'places' && placeImages[card.id]}<span class="mini-avatar photo-avatar"><img src={placeImages[card.id].src} alt="" loading="lazy" decoding="async" /></span>{:else}{#if section === 'people'}<PersonAvatar personId={card.id} className="mini-avatar" />{:else if section === 'places' || section === 'offices'}<span class="mini-avatar icon-avatar" aria-hidden="true"><Icon name={section === 'places' ? 'location_on' : 'workspace_premium'} /></span>{:else}<span class="mini-avatar" aria-hidden="true">{card.initials || card.title.charAt(0)}</span>{/if}{/if}<span>{card.title}</span></a></th>
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
          {@const tileImage = section === 'places' ? placeImages[card.id] : undefined}
          <article class="entity-card" class:place-tile={section === 'places'} class:has-photo={!!tileImage} style={card.accent ? `--card-accent:${card.accent}` : ''} style:--place-photo={tileImage ? `url("${tileImage.src}")` : undefined}>
            <a class="card-record-link" href={hrefFor(section, card.id)} onclick={(event) => open(event, hrefFor(section, card.id))}>
              {#if section === 'places'}
                {#if tileImage}
                  <span class="place-card-photo" aria-hidden="true"></span>
                {:else}
                  <span class="place-card-photo place-card-placeholder" aria-hidden="true"><Icon name="location_on" /></span>
                {/if}
                <div class="place-card-content">
                  {#if card.logo}<span class="card-logo emblem-logo"><img src={card.logo} alt={`${card.title} logo`} /></span>{/if}
                  <h2>{card.title}</h2>
                  {#if card.meta.startsWith('City · ')}<p>{card.meta.slice(7)}</p>{/if}
                  <div class="card-footer"><span>{filtering ? filingCount(card) : card.count}</span><b>View record <Icon name="arrow_forward" /></b></div>
                </div>
              {:else}
              {#if card.logo}<span class="card-logo" class:inverse-logo={card.id === 'utah-republican-party'}><img src={card.logo} alt={`${card.title} logo`} /></span>{:else}{#if section === 'people'}<PersonAvatar personId={card.id} className="card-avatar" />{:else if section === 'offices'}<span class="card-avatar icon-avatar" aria-hidden="true"><Icon name="workspace_premium" /></span>{:else}<span class="card-avatar" aria-hidden="true">{card.initials || card.title.charAt(0)}</span>{/if}{/if}
              {#if !omitColumns.includes('party')}<small>{section === 'people' ? card.columns[1] : card.eyebrow}</small>{/if}<h2>{card.title}</h2><p>{section === 'people' ? card.columns[0] : card.meta}</p>{#if showStatus}<p class="candidate-status">Status: {card.statuses.join(' · ')}</p>{/if}<div class="card-footer"><span>{section === 'people' || filtering ? filingCount(card) : card.count}{#if !omitColumns.includes('years') && section === 'people'} · {card.years.join(', ')}{/if}</span><b>View record <Icon name="arrow_forward" /></b></div>
              {/if}
            </a>
            {#if section === 'places'}
              <div class="place-card-utilities">
                {#if tileImage}
                  <details class="tile-photo-credit">
                    <summary>Photo credit<span class="sr-only"> for {card.title}</span></summary>
                    <PhotoCredit image={tileImage} className="tile-photo-credit-content" />
                  </details>
                {/if}
                <EntityLinks links={placeEntityLinks(card)} entityName={card.title} />
              </div>
            {/if}
          </article>
        {:else}
          <p class="no-records">No matching {labels[section].plural.toLowerCase()}.</p>
        {/each}
      </div>
    {/if}
    {#if visibleCards.length < sortedCards.length}<button class="btn btn-secondary load-more" onclick={showMore}>Show more <span>{formatCount(sortedCards.length - visibleCards.length)} remaining</span></button>{/if}
  </section>
{/if}
