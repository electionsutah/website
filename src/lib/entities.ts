import currentRows from '../data/2026-candidates.json';
import historicalRows from '../data/historical-candidates.json';
import candidateDocuments from '../data/candidate-documents.json';

type Contact = {
  address: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram?: string;
  twitter: string;
};

export type Filing = {
  recordId: string;
  id: string;
  name: string;
  year: number;
  electionType: string;
  officeName: string;
  officeId: string;
  partyName: string;
  partyId: string;
  rawParty: string;
  status: string;
  sourceStatus: string;
  section: string;
  city: string;
  county: string;
  state: string;
  placeIds: string[];
  personId: string;
  /** Running mate on a ticket filing (Vice President or Lieutenant Governor); '' otherwise. */
  runningMate: string;
  runningMateId: string;
  source: string;
  lastUpdated: string;
  contact?: Contact;
};

export type Person = {
  id: string;
  name: string;
  initials: string;
  filings: Filing[];
  years: number[];
};

export type Office = {
  id: string;
  name: string;
  sections: string[];
  filings: Filing[];
  years: number[];
  placeIds: string[];
  resources: OfficeResource[];
};

export type OfficeResource = {
  label: string;
  description: string;
  url: string;
};

export type Party = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  website: string;
  logo: string;
  recognized: boolean;
  historical: boolean;
  filings: Filing[];
  years: number[];
};

export type Place = {
  id: string;
  name: string;
  type: 'County' | 'City';
  county: string;
  parentId: string;
  description: string;
  filings: Filing[];
  offices: Office[];
  children: Place[];
  years: number[];
};

export type ElectionCycle = {
  year: number;
  title: string;
  description: string;
  source: string;
  sourceLabel: string;
  availability: 'statewide' | 'special' | 'local';
  filings: Filing[];
};

export const activeStatuses = new Set(['general_election', 'primary_election', 'filed', 'elected']);

export function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Source spellings of the same person that the identity key would otherwise keep apart.
const identityAliases: Record<string, string> = {
  josephrbidenjr: 'josephrbiden'
};

export function identityKey(value: string): string {
  const key = slug(value).replaceAll('-', '');
  return identityAliases[key] ?? key;
}

/** The running mate's role on a ticket filing. */
export function runningMateRole(filing: Filing): string {
  return filing.officeName.includes('President') ? 'Vice President' : 'Lieutenant Governor';
}

/** One person's place on a filing: the candidate, or the running mate on a ticket. */
export type Candidacy = { filing: Filing; personId: string; name: string; runningMate: boolean };

/** Each filing's candidate, followed by its running mate when the filing is a ticket. */
export function candidacies(list: Filing[]): Candidacy[] {
  return list.flatMap((filing) => [
    { filing, personId: filing.personId, name: filing.name, runningMate: false },
    ...(filing.runningMate ? [{ filing, personId: filing.runningMateId, name: filing.runningMate, runningMate: true }] : [])
  ]);
}

/** Office types read as a single office on its own pages: "Federal Offices" → "Federal office". */
export function sectionLabel(section: string): string {
  return section.replace(/^(\w+) Offices$/, (_, kind: string) => `${kind} office`);
}

/** Link text for a filing's source: a filing PDF, a pamphlet page, or an archived capture. */
export function sourceLinkLabel(url: string): string {
  const archived = url.startsWith('https://web.archive.org/');
  if (/\.pdf#page=\d+$/i.test(url)) return 'View voter pamphlet entry (PDF)';
  if (/\.pdf$/i.test(url)) return archived ? 'View archived candidate filing (PDF)' : 'View candidate filing (PDF)';
  return archived ? 'View archived source record' : 'View source record';
}

export function statusLabel(status: string): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function cleanOfficeName(value: string): string {
  return value
    .replace(/\s+\(Multi[- ]County\)/gi, '')
    .replace('Distrct', 'District')
    .replace('Distirct', 'District')
    .replace(/^US Congressional/, 'U.S. House')
    .replace(/^(U\.S\. House|State Senate|State House|State School Board) (\d+)/, '$1 District $2');
}

function partyDetails(rawParty: string, section: string) {
  if (section === 'State Judicial' || (section === 'Municipal Offices' && !rawParty)) {
    return { name: 'Nonpartisan', shortName: 'Nonpartisan', color: '#668f7f' };
  }
  const details: Record<string, { name: string; shortName: string; color: string }> = {
    Democratic: { name: 'Utah Democratic Party', shortName: 'Democratic', color: '#4d75b7' },
    Republican: { name: 'Utah Republican Party', shortName: 'Republican', color: '#c94f43' },
    Forward: { name: 'Forward Party Utah', shortName: 'Forward', color: '#8b5aa6' },
    Constitution: { name: 'Utah Constitution Party', shortName: 'Constitution', color: '#a36d38' },
    'Constitution Party': { name: 'Utah Constitution Party', shortName: 'Constitution', color: '#a36d38' },
    Green: { name: 'Green Party of Utah', shortName: 'Green', color: '#43845a' },
    'Green Party of Utah': { name: 'Green Party of Utah', shortName: 'Green', color: '#43845a' },
    Libertarian: { name: 'Utah Libertarian Party', shortName: 'Libertarian', color: '#c8961d' },
    'Independent American': { name: 'Independent American Party', shortName: 'Independent American', color: '#5b7f65' },
    'Independent American Party': { name: 'Independent American Party', shortName: 'Independent American', color: '#5b7f65' },
    'United Utah': { name: 'United Utah Party', shortName: 'United Utah', color: '#5e8592' },
    'United Utah Party': { name: 'United Utah Party', shortName: 'United Utah', color: '#5e8592' },
    Unaffiliated: { name: 'Unaffiliated', shortName: 'Unaffiliated', color: '#68736f' },
    '': { name: 'Not reported', shortName: 'Not reported', color: '#8b918e' }
  };
  return details[rawParty] ?? { name: rawParty || 'Not reported', shortName: rawParty || 'Not reported', color: '#8b918e' };
}

function placeIds(county: string, city: string) {
  if (!county) return [];
  const countyId = slug(county);
  return city ? [countyId, `${countyId}/${slug(city)}`] : [countyId];
}

const documentsByRecord: Record<string, string> = candidateDocuments;

/** Mirror of key_part() in scripts/generate_candidate_documents.py. */
function documentKeyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function candidateDocument(year: number, row: { name: string; office: string; party: string; sourceStatus: string }): string | undefined {
  return documentsByRecord[[year, ...[row.name, row.office, row.party, row.sourceStatus].map(documentKeyPart)].join('|')];
}

// Source labels that name the same status differently across years.
const sourceStatusAliases: Record<string, string> = {
  'Write In': 'Write-In',
  Primary: 'Primary Election Candidate',
  'Election Candidate': 'General Election Candidate'
};

function displayStatus(value: string): string {
  return sourceStatusAliases[value] ?? value;
}

/**
 * A few source names are entirely upper- or lowercase; show them in title case,
 * keeping a leading ʻokina or apostrophe ("'alama" → "'Alama").
 */
export function displayName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  return name.toLowerCase().replace(/(^|[\s-])(['ʻ‘]?)(\p{L})/gu, (_, start, mark, letter) => `${start}${mark}${letter.toUpperCase()}`);
}

// Pre-2020 municipal pages that have since gone offline and were never captured by the Wayback Machine.
const unavailableSources = [
  'http://www.parkcity.org/government/document-central/',
  'http://www.saratogaspringscity.com/',
  'https://www.voteprovo.com/copy-of-candidate-information',
  'http://www.marriott-slaterville.org/'
];

export function sourceAvailable(url: string): boolean {
  return !unavailableSources.some((prefix) => url.startsWith(prefix));
}

export const filings: Filing[] = [
  ...historicalRows.map((row) => {
    const officeName = cleanOfficeName(row.office);
    const party = partyDetails(row.party, row.section);
    const personId = slug(row.name);
    return {
      recordId: `${row.year}-${row.id}-${slug(officeName)}-${slug(party.name)}`,
      id: row.id,
      name: displayName(row.name),
      year: row.year,
      electionType: row.electionType,
      officeName,
      officeId: slug(officeName),
      partyName: party.name,
      partyId: slug(party.name),
      rawParty: row.party,
      status: row.status,
      sourceStatus: displayStatus(row.sourceStatus),
      section: row.section,
      city: row.city,
      county: row.county,
      state: row.state,
      placeIds: placeIds(row.county, row.city),
      personId,
      runningMate: displayName(row.runningMate ?? ''),
      runningMateId: slug(row.runningMate ?? ''),
      source: candidateDocument(row.year, row) ?? row.source,
      lastUpdated: row.lastUpdated,
      contact: row.contact
    } satisfies Filing;
  }),
  ...currentRows.map((row) => {
    const officeName = cleanOfficeName(row.office);
    const party = partyDetails(row.party, row.section);
    const personId = slug(row.name);
    return {
      recordId: `2026-${row.id}-${slug(officeName)}-${slug(party.name)}`,
      id: row.id,
      name: displayName(row.name),
      year: 2026,
      electionType: row.status === 'general_election' ? 'general' : 'primary',
      officeName,
      officeId: slug(officeName),
      partyName: party.name,
      partyId: slug(party.name),
      rawParty: row.party,
      status: row.status,
      sourceStatus: displayStatus(row.sourceStatus),
      section: row.section,
      city: '',
      county: '',
      state: 'UT',
      placeIds: [],
      personId,
      runningMate: '',
      runningMateId: '',
      source: candidateDocument(2026, row) ?? 'https://vote.utah.gov/2026-candidate-filings/',
      lastUpdated: '2026-07-20'
    } satisfies Filing;
  })
];

export const currentDatasetUpdated = filings.filter((filing) => filing.year === 2026)
  .map((filing) => filing.lastUpdated).sort().at(-1) ?? '';

function naturalSort<T>(items: T[], getter: (item: T) => string): T[] {
  const collator = new Intl.Collator(undefined, { numeric: true, ignorePunctuation: true });
  return items.sort((a, b) => collator.compare(getter(a), getter(b)));
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)].sort((a, b) => b - a);
}

function officeResources(name: string): OfficeResource[] {
  const house = name.match(/^State House District (\d+)/);
  if (house) {
    const district = house[1].padStart(2, '0');
    return [
      {
        label: '2022 demographic profile (PDF)',
        description: `Census and American Community Survey profile for House District ${Number(house[1])}.`,
        url: `https://le.utah.gov/Documents/demographic/profiles/2022/House_Dist${district}.pdf`
      },
      {
        label: 'House district boundary law',
        description: 'Utah Code establishing the current House district boundaries.',
        url: 'https://le.utah.gov/xcode/Title36/Chapter1/36-1-S201.5.html'
      }
    ];
  }

  const senate = name.match(/^State Senate District (\d+)/);
  if (senate) {
    const district = senate[1].padStart(2, '0');
    return [
      {
        label: '2022 demographic profile (PDF)',
        description: `Census and American Community Survey profile for Senate District ${Number(senate[1])}.`,
        url: `https://le.utah.gov/Documents/demographic/profiles/2022/Senate_Dist${district}.pdf`
      },
      {
        label: 'Senate district boundary law',
        description: 'Utah Code establishing the current Senate district boundaries.',
        url: 'https://le.utah.gov/xcode/Title36/Chapter1/36-1-S101.5.html'
      }
    ];
  }

  if (/^U\.S\. House District \d+/.test(name)) {
    return [{
      label: 'Congressional district boundary law',
      description: 'Utah Code establishing the four congressional districts and their boundaries.',
      url: 'https://le.utah.gov/xcode/Title20A/Chapter13/20A-13-S101.5.html'
    }];
  }

  if (name === 'U.S. Senate') {
    return [{
      label: 'Federal office election law',
      description: 'Utah Election Code governing elections to federal offices.',
      url: 'https://le.utah.gov/xcode/Title20A/Chapter13/20A-13.html'
    }];
  }

  if (/^State School Board District \d+/.test(name)) {
    return [{
      label: 'State School Board boundary law',
      description: 'Utah Code establishing State Board of Education districts and boundaries.',
      url: 'https://le.utah.gov/xcode/Title20A/Chapter14/20A-14-S101.5.html'
    }];
  }

  if (/^(Judge|Justice) of /.test(name)) {
    return [{
      label: 'Judicial retention election law',
      description: 'Utah Election Code governing judicial retention elections.',
      url: 'https://le.utah.gov/xcode/Title20A/Chapter12/20A-12-S201.html'
    }];
  }

  return [];
}

const initialsOf = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part.replace(/[^A-Za-z]/g, '').charAt(0)).join('');

// A ticket filing belongs to both the candidate and the running mate, so each appears on the other's record.
const personMap = new Map<string, Person>();
const filingPeople = filings.flatMap((filing) => [filing.name, filing.runningMate].filter(Boolean).map((name) => ({ filing, name })));
for (const { filing, name } of filingPeople) {
  const matchKey = identityKey(name);
  const person = personMap.get(matchKey) ?? { id: slug(name), name, initials: initialsOf(name), filings: [], years: [] };
  person.filings.push(filing);
  if (filing.year >= Math.max(...person.filings.map((item) => item.year))) {
    person.name = name;
    person.id = slug(name);
    person.initials = initialsOf(name);
  }
  person.years = uniqueNumbers(person.filings.map((item) => item.year));
  personMap.set(matchKey, person);
}
for (const person of personMap.values()) {
  person.filings.sort((a, b) => b.year - a.year || a.officeName.localeCompare(b.officeName, undefined, { numeric: true }));
}
for (const filing of filings) {
  filing.personId = personMap.get(identityKey(filing.name))!.id;
  if (filing.runningMate) filing.runningMateId = personMap.get(identityKey(filing.runningMate))!.id;
}
export const people = naturalSort([...personMap.values()], (person) => person.name);

const officeMap = new Map<string, Office>();
for (const filing of filings) {
  const office = officeMap.get(filing.officeId) ?? {
    id: filing.officeId,
    name: filing.officeName,
    sections: [],
    filings: [],
    years: [],
    placeIds: [],
    resources: officeResources(filing.officeName)
  };
  office.filings.push(filing);
  office.sections = [...new Set(office.filings.map((item) => sectionLabel(item.section)))];
  office.years = uniqueNumbers(office.filings.map((item) => item.year));
  office.placeIds = [...new Set(office.filings.flatMap((item) => item.placeIds))];
  officeMap.set(filing.officeId, office);
}
for (const office of officeMap.values()) office.filings.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
export const offices = naturalSort([...officeMap.values()], (office) => office.name);

const partyMap = new Map<string, Party>();
const partyLogos: Record<string, string> = {
  'Utah Constitution Party': '/party-logos/constitution-party.png',
  'Utah Democratic Party': '/party-logos/utah-democratic-party.webp',
  'Forward Party Utah': '/party-logos/forward-party-utah.png',
  'Green Party of Utah': '/party-logos/green-party-utah.png',
  'Independent American Party': '/party-logos/independent-american-party.png',
  'Utah Libertarian Party': '/party-logos/utah-libertarian-party.png',
  'Peoples’ Freedom Party': '/party-logos/peoples-freedom-party.jpg',
  'Utah Republican Party': '/party-logos/utah-republican-party.png',
  'United Utah Party': '/party-logos/united-utah-party.png'
};
const recognizedParties = [
  { name: 'Utah Constitution Party', shortName: 'Constitution', color: '#a36d38', website: 'https://www.constitutionpartyofutah.com/' },
  { name: 'Utah Democratic Party', shortName: 'Democratic', color: '#4d75b7', website: 'https://www.utahdemocrats.org/' },
  { name: 'Forward Party Utah', shortName: 'Forward', color: '#8b5aa6', website: 'https://www.utahforwardparty.org/' },
  { name: 'Green Party of Utah', shortName: 'Green', color: '#43845a', website: 'https://greenpartyofutah.org/' },
  { name: 'Independent American Party', shortName: 'Independent American', color: '#5b7f65', website: 'https://iaput.org/' },
  { name: 'Utah Libertarian Party', shortName: 'Libertarian', color: '#c8961d', website: 'https://www.libertarianutah.org/' },
  { name: 'Peoples’ Freedom Party', shortName: 'Peoples’ Freedom', color: '#906164', website: 'https://www.instagram.com/peoplesfreedompartyut/' },
  { name: 'Utah Republican Party', shortName: 'Republican', color: '#c94f43', website: 'https://www.utgop.org/' }
];
for (const party of recognizedParties) {
  partyMap.set(slug(party.name), { id: slug(party.name), ...party, logo: partyLogos[party.name] ?? '', recognized: true, historical: false, filings: [], years: [] });
}
for (const filing of filings) {
  const details = partyDetails(filing.rawParty, filing.section);
  const party = partyMap.get(filing.partyId) ?? {
    id: filing.partyId,
    name: details.name,
    shortName: details.shortName,
    color: details.color,
    website: '',
    logo: partyLogos[details.name] ?? '',
    recognized: false,
    historical: details.name === 'United Utah Party',
    filings: [],
    years: []
  };
  party.filings.push(filing);
  party.years = uniqueNumbers(party.filings.map((item) => item.year));
  partyMap.set(filing.partyId, party);
}
for (const party of partyMap.values()) party.filings.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
export const parties = naturalSort([...partyMap.values()], (party) => party.name);

const placeMap = new Map<string, Place>();
for (const filing of filings) {
  if (!filing.county) continue;
  const countyId = slug(filing.county);
  const county = placeMap.get(countyId) ?? {
    id: countyId,
    name: `${filing.county} County`,
    type: 'County' as const,
    county: filing.county,
    parentId: '',
    description: `${filing.county} County candidate records from the Elections Utah archive.`,
    filings: [], offices: [], children: [], years: []
  };
  county.filings.push(filing);
  county.years = uniqueNumbers(county.filings.map((item) => item.year));
  placeMap.set(countyId, county);

  if (filing.city) {
    const cityId = `${countyId}/${slug(filing.city)}`;
    const city = placeMap.get(cityId) ?? {
      id: cityId,
      name: filing.city,
      type: 'City' as const,
      county: filing.county,
      parentId: countyId,
      description: `${filing.city} candidate records in ${filing.county} County from the Elections Utah archive.`,
      filings: [], offices: [], children: [], years: []
    };
    city.filings.push(filing);
    city.years = uniqueNumbers(city.filings.map((item) => item.year));
    placeMap.set(cityId, city);
  }
}
for (const place of placeMap.values()) {
  place.filings.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  place.offices = naturalSort([...new Set(place.filings.map((filing) => filing.officeId))].map((id) => officeMap.get(id)!).filter(Boolean), (office) => office.name);
  if (place.type === 'County') {
    place.children = naturalSort([...placeMap.values()].filter((candidate) => candidate.parentId === place.id), (candidate) => candidate.name);
  }
}
export const places = naturalSort([...placeMap.values()], (place) => `${place.type === 'County' ? '0' : '1'}-${place.county}-${place.name}`);

export const peopleById = new Map(people.map((person) => [person.id, person]));
export const officesById = new Map(offices.map((office) => [office.id, office]));
export const partiesById = new Map(parties.map((party) => [party.id, party]));
export const placesById = new Map(places.map((place) => [place.id, place]));

const cycleDetails: Omit<ElectionCycle, 'filings'>[] = [
  { year: 2026, title: '2026 regular election', description: 'Archived declarations for federal, state, legislative, school-board, and judicial-retention offices.', source: 'https://vote.utah.gov/2026-candidate-filings/', sourceLabel: 'Official 2026 candidate filings', availability: 'statewide' },
  { year: 2025, title: '2025 municipal elections', description: 'Municipal candidates file with local clerks. Utah publishes county canvass links, but no comparable statewide candidate-filing table.', source: 'https://vote.utah.gov/county-canvass-certifications-and-results/', sourceLabel: 'Official county canvass directory', availability: 'local' },
  { year: 2024, title: '2024 regular election', description: 'State candidate filings covering federal, constitutional, legislative, school-board, and judicial offices.', source: 'https://vote.utah.gov/2024-candidate-filings/', sourceLabel: 'Official 2024 candidate filings', availability: 'statewide' },
  { year: 2023, title: '2023 congressional special election', description: 'Candidates who filed for Utah’s special election in U.S. House District 2.', source: 'https://vote.utah.gov/2023-candidate-filings/', sourceLabel: 'Official 2023 candidate filings', availability: 'special' },
  { year: 2022, title: '2022 regular election', description: 'General-election candidates published in Utah’s official voter information pamphlet and statewide canvass.', source: 'https://vote.utah.gov/2022-2023-election-records/', sourceLabel: 'Official 2022 election records', availability: 'statewide' },
  { year: 2021, title: '2021 municipal elections', description: 'Municipal candidates filed with local election officers; the state archive has no comparable statewide candidate table for this cycle.', source: 'https://vote.utah.gov/historical-election-records-and-documents/', sourceLabel: 'Official historical records index', availability: 'local' },
  { year: 2020, title: '2020 regular election', description: 'Primary and general-election candidates recovered from Utah’s official statewide canvass workbooks.', source: 'https://vote.utah.gov/2020-election-records/', sourceLabel: 'Official 2020 election records', availability: 'statewide' },
  { year: 2019, title: '2019 municipal elections', description: 'Municipal filing records retained from the original Elections Utah archive.', source: 'https://vote.utah.gov/2019-election-records/', sourceLabel: 'Official 2019 election records', availability: 'local' },
  { year: 2018, title: '2018 regular election', description: 'Federal, legislative, and state school-board candidate records retained from the original Elections Utah archive.', source: 'https://vote.utah.gov/2018-election-records/', sourceLabel: 'Official 2018 election records', availability: 'statewide' },
  { year: 2017, title: '2017 municipal and special elections', description: 'Municipal candidate filings and the congressional special-election record retained from the original Elections Utah archive.', source: 'https://vote.utah.gov/historical-election-records-and-documents/', sourceLabel: 'Official historical records index', availability: 'local' }
];

export const elections: ElectionCycle[] = cycleDetails.map((cycle) => ({
  ...cycle,
  filings: filings.filter((filing) => filing.year === cycle.year)
}));
export const electionsByYear = new Map(elections.map((election) => [election.year, election]));

export const totals = {
  people: people.length,
  offices: offices.length,
  parties: parties.length,
  places: places.length,
  filings: filings.length,
  currentFilings: currentRows.length,
  historicalFilings: historicalRows.length
};
