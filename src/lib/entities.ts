import placeLinkEnrichment from '../data/place-link-enrichment.json';
import placeProfileData from '../data/place-enrichment.json';
import placeDirectory from '../data/place-directory.json';
import personProfileData from '../data/person-enrichment.json';
import personLinkEnrichment from '../data/person-link-enrichment.json';
import partyEnrichment from '../data/party-enrichment.json';
import partyReferenceLinks from '../data/party-reference-links.json';
import officeEnrichment from '../data/office-enrichment.json';
import { placeEntityLinks, type EntityLink } from './entity-links';
import currentRows from '../data/2026-candidates.json';
import historicalRows from '../data/historical-candidates.json';
import resultRows from '../data/result-candidates.json';
import newspaperRows from '../data/newspaper-candidates.json';
// County, municipal, school-board, and special-district candidates from the state results feed (2024 on).
import localRows from '../data/local-candidates.json';
// Reviewed source records outside the state results feed; kept separate so refreshes preserve them.
import researchedRows from '../data/researched-candidates.json';
import candidateDocuments from '../data/candidate-documents.json';
import { applyFilingChanges, applyPlaceSocial, applyEntityLinks, entityContact, editorialData, importedPersonLinks, migratePersonLinks, type PersonProfile } from './editorial';
import type { ContactAddress } from './contact-addresses';
import { applyStructure } from './editor-structure';
import { formatOfficeName } from './office-names';

export type Contact = {
  address: string | ContactAddress[];
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram?: string;
  twitter: string;
  bluesky?: string;
  youtube?: string;
  linkedin?: string;
  threads?: string;
  tiktok?: string;
  mastodon?: string;
  truthsocial?: string;
  rumble?: string;
  substack?: string;
};

export type Filing = {
  recordId: string;
  id: string;
  name: string;
  year: number;
  electionType: string;
  officeName: string;
  rawOfficeName?: string;
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
  /** Verified event dates; never inferred from lastUpdated. */
  filingDate?: string;
  electionDate?: string;
  statusDate?: string;
  contact?: Contact;
};

export type Person = {
  lastVerified?: string;
  links?: EntityLink[];
  id: string;
  name: string;
  initials: string;
  filings: Filing[];
  years: number[];
};

export type Office = {
  contact?: Partial<Contact>;
  id: string;
  name: string;
  sections: string[];
  filings: Filing[];
  years: number[];
  placeIds: string[];
  resources: OfficeResource[];
  links: EntityLink[];
};

export type OfficeResource = {
  label: string;
  description: string;
  url: string;
};

export type Party = {
  contact?: Partial<Contact>;
  id: string;
  name: string;
  shortName: string;
  color: string;
  website: string;
  logo: string;
  recognized: boolean;
  historical: boolean;
  links?: EntityLink[];
  localCaucus?: {
    place: string;
    history: string;
    source: string;
  };
  filings: Filing[];
  years: number[];
};

export type Place = {
  contact?: Partial<Contact>;
  links?: EntityLink[];
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

export function partyLabel(party: Party): string {
  return party.localCaucus ? `Local nonpartisan caucus · ${party.localCaucus.place}`
    : party.recognized ? 'Recognized party' : party.historical ? 'Historical party' : 'Election affiliation';
}

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
  josephrbidenjr: 'josephrbiden',
  aletataylor: 'aletaandersentaylor',
  johnwestwood: 'johnrwestwood',
  justinfawson: 'justinlfawson',
  kathieljohnson: 'kathielynnjohnson',
  markwoolley: 'marktwoolley',
  amymorgan: 'amysteedmorgan',
  angelawalker: 'angelanicolewalker',
  bradwilson: 'bradrwilson',
  bradleydaw: 'bradleymdaw',
  braddaw: 'bradleymdaw',
  carlalbrecht: 'carlralbrecht',
  christinefwatkins: 'christinefacerwatkins',
  codystromberg: 'codywstromberg',
  davidelse: 'davidaelse',
  davidfair: 'davidbfair',
  davidphinkins: 'davidparleyhinkins',
  davidhinkins: 'davidparleyhinkins',
  derkptimothy: 'derkpowelltimothy',
  dirkburton: 'dirksburton',
  elisemorgan: 'elisedelunamorgan',
  elizabethweight: 'elizabethlweight',
  jamesmossjr: "jamesrexmossjr",
  jeffersonmoss: "jeffersonrmoss",
  johndougall: "johnfrugaldougall",
  kayjchristofferson: "kayjefferychristofferson",
  kimrolfe: "kimvrolfe",
  kirkpearson: "kirkdpearson",
  lynnhemingway: "lynnnhemingway",
  margaretbourke: "margaretellenbourke",
  paulglover: "paulcglover",
  raymondward: "raymondpward",
  richcunningham: "richlcunningham",
  robertspendlove: "robertmspendlove",
  scottbneilson: "scottbrandonneilson",
  susanduckworth: "susandduckworth"
};

// Explicitly reviewed names stay stable even when a newer source abbreviates them.
const preferredPersonNames: Record<string, string> = {
  aletaandersentaylor: 'Aleta Andersen Taylor',
  johnrwestwood: 'John R. Westwood',
  justinlfawson: 'Justin L. Fawson',
  kathielynnjohnson: 'Kathie Lynn Johnson',
  marktwoolley: 'Mark T. Woolley',
  amysteedmorgan: 'Amy Steed Morgan',
  angelanicolewalker: 'Angela Nicole Walker',
  bradrwilson: 'Brad R Wilson',
  bradleymdaw: 'Bradley M. Daw',
  carlralbrecht: 'Carl R. Albrecht',
  christinefacerwatkins: 'Christine Facer Watkins',
  codywstromberg: 'Cody W. Stromberg',
  davidaelse: 'David A Else',
  davidbfair: 'David B Fair',
  davidparleyhinkins: 'David Parley Hinkins',
  derkpowelltimothy: 'Derk Powell Timothy',
  dirksburton: 'Dirk S. Burton',
  elisedelunamorgan: 'Elise Deluna Morgan',
  elizabethlweight: 'Elizabeth L. Weight',
  jamesrexmossjr: "James Rex Moss, Jr.",
  jeffersonrmoss: "Jefferson R Moss",
  johnfrugaldougall: "John \"Frugal\" Dougall",
  kayjefferychristofferson: "Kay Jeffery Christofferson",
  kimvrolfe: "Kim V. Rolfe",
  kirkdpearson: "Kirk D Pearson",
  lynnnhemingway: "Lynn N. Hemingway",
  margaretellenbourke: "Margaret Ellen Bourke",
  paulcglover: "Paul C. Glover",
  raymondpward: "Raymond P. Ward",
  richlcunningham: "Rich L. Cunningham",
  robertmspendlove: "Robert M. Spendlove",
  scottbrandonneilson: "Scott Brandon Neilson",
  susandduckworth: "Susan D. Duckworth"
};

/** Punctuate standalone middle initials without altering source filing names or URL IDs. */
export function personDisplayName(value: string): string {
  const words = displayName(value).split(' ');
  return words.map((word, index) => index > 0 && index < words.length - 1 && /^[A-Za-z]$/.test(word) ? `${word.toUpperCase()}.` : word).join(' ');
}

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

// Offices that are elected on nonpartisan ballots; candidates without a party read as nonpartisan.
const nonpartisanSections = new Set(['Municipal Offices', 'School Board Offices', 'Special District Offices']);

// Preserve existing party routes and filing IDs when expanding historical labels.
const historicalPartyIds: Record<string, string> = { 'Natural Law Party': 'natural-law', 'Justice Party': 'justice' };
const partyIdForName = (name: string) => historicalPartyIds[name] ?? slug(name);

function partyDetails(rawParty: string, section: string) {
  if (section === 'State Judicial' || (nonpartisanSections.has(section) && !rawParty)) {
    return { name: 'Nonpartisan', shortName: 'Nonpartisan', color: '#55786a' };
  }
  const details: Record<string, { name: string; shortName: string; color: string }> = {
    Democratic: { name: 'Utah Democratic Party', shortName: 'Democratic', color: '#2675aa' },
    Republican: { name: 'Utah Republican Party', shortName: 'Republican', color: '#bc443d' },
    Forward: { name: 'Forward Party of Utah', shortName: 'Forward', color: '#79629d' },
    'Utah Forward': { name: 'Forward Party of Utah', shortName: 'Forward', color: '#79629d' },
    'Forward Party Utah': { name: 'Forward Party of Utah', shortName: 'Forward', color: '#79629d' },
    'Forward Party of Utah': { name: 'Forward Party of Utah', shortName: 'Forward', color: '#79629d' },
    Constitution: { name: 'Utah Constitution Party', shortName: 'Constitution', color: '#986634' },
    'Constitution Party': { name: 'Utah Constitution Party', shortName: 'Constitution', color: '#986634' },
    Green: { name: 'Green Party of Utah', shortName: 'Green', color: '#407d55' },
    'Green Party of Utah': { name: 'Green Party of Utah', shortName: 'Green', color: '#407d55' },
    Justice: { name: 'Justice Party', shortName: 'Justice', color: '#5f5e59' },
    'Justice Party': { name: 'Justice Party', shortName: 'Justice', color: '#5f5e59' },
    'Natural Law': { name: 'Natural Law Party', shortName: 'Natural Law', color: '#5f5e59' },
    'Natural Law Party': { name: 'Natural Law Party', shortName: 'Natural Law', color: '#5f5e59' },
    Libertarian: { name: 'Utah Libertarian Party', shortName: 'Libertarian', color: '#886e13' },
    'Independent American': { name: 'Independent American Party', shortName: 'Independent American', color: '#567860' },
    'Independent American Party': { name: 'Independent American Party', shortName: 'Independent American', color: '#567860' },
    'United Utah': { name: 'United Utah Party', shortName: 'United Utah', color: '#547682' },
    'United Utah Party': { name: 'United Utah Party', shortName: 'United Utah', color: '#547682' },
    Unaffiliated: { name: 'Unaffiliated', shortName: 'Unaffiliated', color: '#68736f' },
    Pinecone: { name: 'Pinecone', shortName: 'Pinecone', color: '#805a37' },
    Sagebrush: { name: 'Sagebrush', shortName: 'Sagebrush', color: '#526c56' },
    '': { name: 'Not reported', shortName: 'Not reported', color: '#5f5e59' }
  };
  return details[rawParty] ?? { name: rawParty || 'Not reported', shortName: rawParty || 'Not reported', color: '#5f5e59' };
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

type ArchiveRow = (typeof historicalRows)[number];

// Preserve editorial/filing records; add every newly discovered ballot candidate and stage.
const archiveRows = [...historicalRows, ...(localRows as ArchiveRow[]), ...(researchedRows as ArchiveRow[]), ...(newspaperRows as ArchiveRow[])];
const resultKey = (row: { year: number; name: string; office: string; party: string; county?: string; city?: string }) =>
  JSON.stringify([row.year, identityKey(row.name), identityKey(cleanOfficeName(row.office)), identityKey(row.county ?? ''), identityKey(row.city ?? '')]);
const existingStages = new Map<string, Set<string>>();
for (const row of [...archiveRows, ...currentRows.map(row => ({ ...row, year: 2026, electionType: row.status === 'general_election' ? 'general' : 'primary' }))]) {
  const stages = existingStages.get(resultKey(row)) ?? new Set<string>();
  stages.add(row.status === 'filed' ? '*' : row.electionType);
  existingStages.set(resultKey(row), stages);
}
const supplementalResults = (resultRows as ArchiveRow[]).filter(row => {
  const stages = existingStages.get(resultKey(row));
  return !stages?.has('*') && !stages?.has(row.electionType);
});
const supplementalSet = new Set(supplementalResults);

export const importedFilings: Filing[] = [
  ...[...archiveRows, ...supplementalResults].map((row) => {
    const officeName = cleanOfficeName(row.office);
    const party = partyDetails(row.party, row.section);
    const personId = slug(row.name);
    return {
      // Preserve established editorial keys; distinguish newly reviewed older primaries.
      recordId: supplementalSet.has(row)
        ? `${row.year}-${row.electionType}-${row.id}-${slug(officeName)}-${partyIdForName(party.name)}-${slug(row.county)}-${slug(row.city)}`
        : (row.year < 1994 && row.source.startsWith('https://vote.utah.gov/wp-content/uploads/'))
        ? `${row.year}-${row.electionType}-${row.id}-${slug(officeName)}-${partyIdForName(party.name)}`
        : `${row.year}-${row.id}-${slug(officeName)}-${partyIdForName(party.name)}`,
      id: row.id,
      name: displayName(row.name),
      year: row.year,
      electionType: row.electionType,
      officeName: formatOfficeName(officeName),
      rawOfficeName: row.office,
      officeId: slug(officeName),
      partyName: party.name,
      partyId: partyIdForName(party.name),
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
      statusDate: (row as { statusDate?: string }).statusDate,
      filingDate: (row as { filingDate?: string }).filingDate,
      electionDate: (row as { electionDate?: string }).electionDate,
      contact: row.contact
    } satisfies Filing;
  }),
  ...currentRows.map((row) => {
    const officeName = cleanOfficeName(row.office);
    const party = partyDetails(row.party, row.section);
    const personId = slug(row.name);
    return {
      recordId: `2026-${row.id}-${slug(officeName)}-${partyIdForName(party.name)}`,
      id: row.id,
      name: displayName(row.name),
      year: 2026,
      electionType: row.status === 'general_election' ? 'general' : 'primary',
      officeName: formatOfficeName(officeName),
      rawOfficeName: row.office,
      officeId: slug(officeName),
      partyName: party.name,
      partyId: partyIdForName(party.name),
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
      lastUpdated: '2026-07-20',
      statusDate: (row as { statusDate?: string }).statusDate,
      filingDate: (row as { filingDate?: string }).filingDate,
      electionDate: (row as { electionDate?: string }).electionDate
    } satisfies Filing;
  })
];

export const filings: Filing[] = importedFilings.map(filing => applyFilingChanges(filing, editorialData.filings[filing.recordId]));

export const currentDatasetUpdated = importedFilings.filter((filing) => filing.year === 2026)
  .map((filing) => filing.lastUpdated).sort().at(-1) ?? '';

function naturalSort<T>(items: T[], getter: (item: T) => string): T[] {
  const collator = new Intl.Collator(undefined, { numeric: true, ignorePunctuation: true });
  return items.sort((a, b) => collator.compare(getter(a), getter(b)));
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)].sort((a, b) => b - a);
}

export function officeResources(name: string): OfficeResource[] {
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
    person.name = personDisplayName(preferredPersonNames[matchKey] ?? name);
    person.id = slug(person.name);
    person.initials = initialsOf(person.name);
  }
  person.years = uniqueNumbers(person.filings.map((item) => item.year));
  personMap.set(matchKey, person);
}
for (const filing of filings) {
  filing.personId = personMap.get(identityKey(filing.name))!.id;
  if (filing.runningMate) filing.runningMateId = personMap.get(identityKey(filing.runningMate))!.id;
}
for (const person of personMap.values()) {
  const enrichment = (personLinkEnrichment as Record<string, { verifiedOn: string; links: EntityLink[] }>)[person.id];
  person.filings.sort((a, b) => b.year - a.year || a.officeName.localeCompare(b.officeName, undefined, { numeric: true }));
  // A reviewed link disposition supersedes old campaign contacts recovered with archived filings.
  const sourceLinks = enrichment ? enrichment.links : importedPersonLinks(person, personProfileData as Record<string, PersonProfile>);
  const changes = migratePersonLinks(editorialData.people[person.id], sourceLinks);
  person.links = applyEntityLinks('people', sourceLinks, changes);
  person.lastVerified = [enrichment?.verifiedOn, ...person.links.map(link => link.verifiedOn)].filter(Boolean).sort().at(-1);
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
    resources: officeResources(filing.officeName),
    links: (officeEnrichment as Record<string, { links: EntityLink[] }>)[filing.officeId]?.links ?? []
  };
  office.contact = entityContact('offices', (officeEnrichment as Record<string, { contact?: Partial<Contact> }>)[office.id]?.contact, editorialData.offices?.[office.id]);
  office.filings.push(filing);
  office.sections = [...new Set(office.filings.map((item) => sectionLabel(item.section)))];
  office.years = uniqueNumbers(office.filings.map((item) => item.year));
  office.placeIds = [...new Set(office.filings.flatMap((item) => item.placeIds))];
  officeMap.set(filing.officeId, office);
}
for (const office of officeMap.values()) {
  const changes = editorialData.offices?.[office.id];
  office.links = applyEntityLinks('offices', office.links, changes);
  if (changes?.resources) office.resources = changes.resources as OfficeResource[];
  office.filings.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
}
export const offices = naturalSort([...officeMap.values()], (office) => office.name);

const partyMap = new Map<string, Party>();
const localCaucuses: Record<string, NonNullable<Party['localCaucus']>> = {
  Pinecone: {
    place: 'Fruit Heights',
    history: 'After Fruit Heights incorporated in 1939, the town council chose a nonpartisan caucus system. According to the city’s history, Forest Barker suggested “Pinecone” because pine trees surrounded his property.',
    source: 'https://www.fruitheights.gov/DocumentCenter/View/2723/caucus2023'
  },
  Sagebrush: {
    place: 'Fruit Heights',
    history: 'After Fruit Heights incorporated in 1939, the town council chose a nonpartisan caucus system. According to the city’s history, sheepherder Brig Harvey suggested “Sagebrush” for the sagebrush growing on his open land.',
    source: 'https://www.fruitheights.gov/DocumentCenter/View/2723/caucus2023'
  }
};
const partyLogos: Record<string, string> = {
  'Natural Law Party': '/party-logos/natural-law-party.png',
  'Justice Party': '/party-logos/justice-party.png',
  Pinecone: '/party-logos/pinecone.svg',
  Sagebrush: '/party-logos/sagebrush.svg',
  'Utah Constitution Party': '/party-logos/constitution-party.png',
  'Utah Democratic Party': '/party-logos/utah-democratic-party.webp',
  'Forward Party of Utah': '/party-logos/forward-party-utah.png',
  'Green Party of Utah': '/party-logos/green-party-utah.png',
  'Independent American Party': '/party-logos/independent-american-party.png',
  'Utah Libertarian Party': '/party-logos/utah-libertarian-party.png',
  'Peoples’ Freedom Party': '/party-logos/peoples-freedom-party.jpg',
  'Utah Republican Party': '/party-logos/utah-republican-party.png',
  'United Utah Party': '/party-logos/united-utah-party.png'
};
const recognizedParties = [
  { name: 'Utah Constitution Party', shortName: 'Constitution', color: '#986634', website: 'https://www.constitutionpartyofutah.com/' },
  { name: 'Utah Democratic Party', shortName: 'Democratic', color: '#2675aa', website: 'https://www.utahdemocrats.org/' },
  { name: 'Forward Party of Utah', shortName: 'Forward', color: '#79629d', website: 'https://www.utahforwardparty.org/' },
  { name: 'Green Party of Utah', shortName: 'Green', color: '#407d55', website: 'https://greenpartyofutah.org/' },
  { name: 'Independent American Party', shortName: 'Independent American', color: '#567860', website: 'https://iaput.org/' },
  { name: 'Utah Libertarian Party', shortName: 'Libertarian', color: '#886e13', website: 'https://www.libertarianutah.org/' },
  { name: 'Peoples’ Freedom Party', shortName: 'Peoples’ Freedom', color: '#906164', website: 'https://www.instagram.com/peoplesfreedompartyut/' },
  { name: 'Utah Republican Party', shortName: 'Republican', color: '#bc443d', website: 'https://www.utgop.org/' }
];
for (const party of recognizedParties) {
  partyMap.set(partyIdForName(party.name), { id: partyIdForName(party.name), ...party, logo: partyLogos[party.name] ?? '', recognized: true, historical: false, filings: [], years: [] });
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
    historical: ['United Utah Party', 'Natural Law Party', 'Justice Party'].includes(details.name),
    localCaucus: localCaucuses[details.name],
    filings: [],
    years: []
  };
  party.filings.push(filing);
  party.years = uniqueNumbers(party.filings.map((item) => item.year));
  partyMap.set(filing.partyId, party);
}
export const importedPartyProperties: Record<string, Pick<Party, 'shortName' | 'color' | 'logo' | 'recognized' | 'historical'>> = {};
for (const party of partyMap.values()) {
  importedPartyProperties[party.id] = { shortName: party.shortName, color: party.color, logo: party.logo, recognized: party.recognized, historical: party.historical };
  const enrichment = (partyEnrichment as Record<string, { officialWebsite: string; links: EntityLink[] }>)[party.id];
  party.contact = entityContact('parties', (partyEnrichment as Record<string, { contact?: Partial<Contact> }>)[party.id]?.contact, editorialData.parties?.[party.id]);
  const references = (partyReferenceLinks as Record<string, { links: EntityLink[] }>)[party.id];
  party.links = applyEntityLinks('parties', [...(enrichment?.links ?? (party.website ? [{ url: party.website }] : [])), ...(references?.links ?? [])], editorialData.parties?.[party.id]);
  if (enrichment) party.website = enrichment.officialWebsite;
  for (const key of ['shortName', 'color', 'logo', 'recognized', 'historical'] as const) {
    const value = editorialData.parties?.[party.id]?.[key];
    if (value !== undefined) Object.assign(party, { [key]: value });
  }
  if (editorialData.parties?.[party.id]?.website !== undefined) party.website = editorialData.parties[party.id].website as string;
  party.filings.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
}
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
// Verified municipalities can appear before a candidate roster has been archived.
for (const entry of placeDirectory) {
  const parentId = slug(entry.county);
  const id = `${parentId}/${slug(entry.name)}`;
  if (!placeMap.has(id)) placeMap.set(id, {
    id, name: entry.name, type: 'City', county: entry.county, parentId,
    description: `${entry.name} is a town in ${entry.county} County. No candidate filings are currently archived for this place.`,
    filings: [], offices: [], children: [], years: []
  });
}
export const importedPlaceDescriptions: Record<string, string> = {};
for (const place of placeMap.values()) {
  importedPlaceDescriptions[place.id] = place.description;
  const profile = (placeProfileData as Record<string, { officialWebsite: string; wikipediaUrl: string; wikidataUrl: string }>)[place.id];
  const enrichment = (placeLinkEnrichment as Record<string, { links: EntityLink[] }>)[place.id];
  place.contact = entityContact('places', (placeLinkEnrichment as Record<string, { contact?: Partial<Contact> }>)[place.id]?.contact ?? (placeProfileData as Record<string, { contact?: Partial<Contact> }>)[place.id]?.contact, editorialData.places?.[place.id]);
  if (editorialData.places?.[place.id]?.description !== undefined) place.description = editorialData.places[place.id].description as string;
  place.links = applyPlaceSocial(placeEntityLinks(profile, enrichment?.links ?? []), editorialData.places?.[place.id]);
  place.filings.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  place.offices = naturalSort([...new Set(place.filings.map((filing) => filing.officeId))].map((id) => officeMap.get(id)!).filter(Boolean), (office) => office.name);
  if (place.type === 'County') {
    place.children = naturalSort([...placeMap.values()].filter((candidate) => candidate.parentId === place.id), (candidate) => candidate.name);
  }
}
export const places = naturalSort([...placeMap.values()], (place) => `${place.type === 'County' ? '0' : '1'}-${place.county}-${place.name}`);

export const importedEntityStructure = {
  people: people.map(({ id, name }) => ({ id, name })),
  offices: offices.map(({ id, name }) => ({ id, name })),
  parties: parties.map(({ id, name }) => ({ id, name })),
  places: places.map(({ id, name, type, parentId, county }) => ({ id, name, type, parentId, county })),
  filings: filings.map(({ recordId, personId, runningMateId, officeId, partyId, placeIds, year }) => ({ id: recordId, personId, runningMateId, officeId, partyId, placeIds, year }))
};
applyStructure({ people, offices, parties, places, filings }, editorialData);
// Apply the same display rule to editorial office names and their related filings.
for (const office of offices) office.name = formatOfficeName(office.name);
for (const filing of filings) filing.officeName = formatOfficeName(filing.officeName);

export const peopleById = new Map(people.map((person) => [person.id, person]));
export const officesById = new Map(offices.map((office) => [office.id, office]));
export const partiesById = new Map(parties.map((party) => [party.id, party]));
export const placesById = new Map(places.map((place) => [place.id, place]));

const cycleDetails: Omit<ElectionCycle, 'filings'>[] = [
  { year: 2026, title: '2026 regular election', description: 'Archived declarations for federal, state, legislative, school-board, and judicial-retention offices, plus county, local school-board, and special-district candidates from the state results system.', source: 'https://vote.utah.gov/2026-candidate-filings/', sourceLabel: 'Official 2026 candidate filings', availability: 'statewide' },
  { year: 2025, title: '2025 municipal elections', description: 'Mayor, city and town council, and local district candidates from the primary and general ballots in Utah’s election results system.', source: 'https://electionresults.utah.gov/results/public/Utah/General11042025', sourceLabel: 'Official 2025 municipal results', availability: 'local' },
  { year: 2024, title: '2024 regular election', description: 'State candidate filings covering federal, constitutional, legislative, school-board, and judicial offices, plus county, local school-board, and special-district candidates from the state results system.', source: 'https://vote.utah.gov/2024-candidate-filings/', sourceLabel: 'Official 2024 candidate filings', availability: 'statewide' },
  { year: 2023, title: '2023 municipal and special elections', description: 'Candidates who filed for Utah’s special election in U.S. House District 2, plus mayor, city and town council, and local district candidates from the municipal primary and general ballots in Utah’s election results system.', source: 'https://vote.utah.gov/2023-candidate-filings/', sourceLabel: 'Official 2023 candidate filings', availability: 'local' },
  { year: 2022, title: '2022 regular election', description: 'General-election candidates published in Utah’s official voter information pamphlet and statewide canvass.', source: 'https://vote.utah.gov/2022-2023-election-records/', sourceLabel: 'Official 2022 election records', availability: 'statewide' },
  { year: 2021, title: '2021 municipal elections', description: 'Municipal candidates filed with local election officers; the state archive has no comparable statewide candidate table for this cycle.', source: 'https://vote.utah.gov/historical-election-records-and-documents/', sourceLabel: 'Official historical records index', availability: 'local' },
  { year: 2020, title: '2020 regular election', description: 'Primary and general-election candidates recovered from Utah’s official statewide canvass workbooks.', source: 'https://vote.utah.gov/2020-election-records/', sourceLabel: 'Official 2020 election records', availability: 'statewide' },
  { year: 2019, title: '2019 municipal elections', description: 'Municipal filing records retained from the original Elections Utah archive.', source: 'https://vote.utah.gov/2019-election-records/', sourceLabel: 'Official 2019 election records', availability: 'local' },
  { year: 2018, title: '2018 regular election', description: 'Federal, legislative, and state school-board candidate records retained from the original Elections Utah archive.', source: 'https://vote.utah.gov/2018-election-records/', sourceLabel: 'Official 2018 election records', availability: 'statewide' },
  { year: 2017, title: '2017 municipal and special elections', description: 'Municipal candidate filings and the congressional special-election record retained from the original Elections Utah archive.', source: 'https://vote.utah.gov/historical-election-records-and-documents/', sourceLabel: 'Official historical records index', availability: 'local' },
  { year: 2016, title: '2016 regular election', description: 'Primary and general-election ballot candidates for federal, state, legislative, state school-board, and judicial-retention offices recovered from official statewide canvasses. These ballot rosters do not include every person who filed or withdrew.', source: 'https://vote.utah.gov/historical-election-results/', sourceLabel: 'Official statewide canvasses', availability: 'statewide' },
  { year: 2015, title: '2015 municipal elections', description: 'Primary and general-election ballot candidates for mayor and council offices in Salt Lake County’s official municipal results. Coverage is limited to Salt Lake County; other counties and candidates absent from the ballots are not included.', source: 'https://www.saltlakecounty.gov/clerk/elections/election-results/', sourceLabel: 'Official Salt Lake County election results', availability: 'local' },
  { year: 2014, title: '2014 regular election', description: 'Primary and general-election ballot candidates for federal, state, legislative, state school-board, and judicial-retention offices recovered from official statewide canvasses. These ballot rosters do not include every person who filed or withdrew.', source: 'https://vote.utah.gov/historical-election-results/', sourceLabel: 'Official statewide canvasses', availability: 'statewide' },
  { year: 2013, title: '2013 municipal elections', description: 'Primary and general-election ballot candidates for mayor and council offices in Salt Lake County’s official municipal results. Coverage is limited to Salt Lake County; other counties and candidates absent from the ballots are not included.', source: 'https://www.saltlakecounty.gov/clerk/elections/election-results/', sourceLabel: 'Official Salt Lake County election results', availability: 'local' },
  ...Array.from({ length: 19 }, (_, index) => 2012 - index).map(year => ({
    year,
    title: `${year} ${year % 2 ? 'municipal elections' : 'regular election'}`,
    description: year === 1995
      ? 'Existing municipal candidate records from contemporary unofficial Deseret News returns across Utah. Coverage follows the published contests; outcomes are unverified.'
      : year % 2
        ? 'Primary and general-election mayor and council ballot rosters from official Salt Lake County results. Other counties are not included; some published names are abbreviated.'
        : year < 2007
          ? 'Reviewed primary ballots and selected general-election rosters from official state canvasses. Legislative and judicial coverage varies by source; these are not complete statewide filing lists.'
          : 'Primary and general-election ballot rosters from official statewide canvasses. These are not complete filing lists. Some tickets publish surnames only; justice-court rosters are excluded.',
    source: year === 1995 ? newspaperRows.find(row => row.year === 1995)!.source : year % 2 ? 'https://www.saltlakecounty.gov/clerk/elections/election-results/' : 'https://vote.utah.gov/historical-election-results/',
    sourceLabel: year === 1995 ? 'Unofficial contemporary newspaper returns' : year % 2 ? 'Official Salt Lake County election results' : 'Official statewide canvasses',
    availability: year % 2 ? 'local' as const : 'statewide' as const
  })),
  ...[...new Set([...newspaperRows.map(row => row.year), ...historicalRows.map(row => row.year)].filter(year => year < 1994 || year > 2026))].sort((a, b) => b - a).map(year => {
    const stateCoverage = historicalRows.some(row => row.year === year);
    return {
      year,
      title: `${year} ${stateCoverage ? 'regular election' : 'municipal elections'}`,
      description: stateCoverage
        ? 'Reviewed ballot-candidate rosters recovered from official historical state canvasses. Coverage follows the named contests in each document and does not establish a complete statewide filing list.'
        : 'Municipal candidates across Utah from contemporary unofficial Deseret News returns. Coverage follows the places and contests published in the source; outcomes are unverified.',
      source: stateCoverage ? 'https://vote.utah.gov/historical-election-results/' : newspaperRows.find(row => row.year === year)!.source,
      sourceLabel: stateCoverage ? 'Official historical state canvass' : 'Unofficial contemporary newspaper returns',
      availability: stateCoverage ? 'statewide' as const : 'local' as const
    };
  }),
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
  historicalFilings: historicalRows.length,
  localFilings: localRows.length,
  researchedFilings: researchedRows.length
};
