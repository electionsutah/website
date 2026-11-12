import type { ElectionCycle, Office, Party, Person, Place } from './entities';

/** Other names people search for a place by, keyed by its official name. */
const placeAliases: Record<string, string[]> = {
  'Mount Pleasant': ['Mt Pleasant', 'Mt. Pleasant'],
  'Salt Lake City': ['SLC'],
  'West Valley City': ['WVC', 'WVS', 'West Valley'],
  'South Salt Lake': ['SSL'],
  'North Salt Lake': ['NSL'],
  'West Jordan': ['WJ'],
  'South Jordan': ['SJ', 'SoJo'],
  'American Fork': ['AF'],
  'Pleasant Grove': ['PG'],
  'Spanish Fork': ['SF'],
  'St. George': ['St George', 'Saint George'],
  'Salt Lake County': ['SLCo', 'SL Co'],
  'Utah County': ['UTCo', 'UT Co']
};
const placeSearchNames = (name: string) => {
  const county = name.endsWith(' County') ? name.slice(0, -' County'.length) : '';
  return [name, ...(placeAliases[name] ?? []), ...(county ? [`${county} Co`, `${county.replace(/\s/g, '')}Co`] : [])];
};
export const withPlaceAliases = (name: string) => placeSearchNames(name).join(' ');
const countySearchText = (county: string) => county ? withPlaceAliases(`${county} County`) : '';

/**
 * Searchable text for each directory, shared by the site-wide search modal and
 * the directory index pages so "View all" lands on exactly the same matches.
 */
export const searchText = {
  elections: (election: ElectionCycle) => `${election.year} ${election.title} ${election.description}`,
  people: (person: Person) => `${person.name} ${(person.aliases ?? []).join(' ')} ${person.filings.map((filing) => `${filing.year} ${filing.officeName} ${filing.partyName} ${filing.sourceStatus} ${withPlaceAliases(filing.city)} ${countySearchText(filing.county)}`).join(' ')}`,
  offices: (office: Office) => `${office.name} ${office.sections.join(' ')} ${office.filings.map((filing) => `${filing.name} ${filing.year}`).join(' ')}`,
  parties: (party: Party) => `${party.name} ${party.shortName} ${party.localCaucus ? `Local nonpartisan caucus ${party.localCaucus.place}` : ''} ${party.filings.map((filing) => `${filing.name} ${filing.year}`).join(' ')}`,
  places: (place: Place) => `${withPlaceAliases(place.name)} ${place.type} ${countySearchText(place.county)} ${place.offices.map((office) => office.name).join(' ')} ${place.filings.map((filing) => filing.name).join(' ')}`
};

export function queryTokens(query: string) {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** Every word of the query must appear somewhere in the text, in any order. */
export function matchesQuery(text: string, tokens: string[]) {
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/** Prefer an entity's own title over related records; keep existing order within each tier. */
export function rankByTitle<T>(items: T[], tokens: string[], title: (item: T) => string): T[] {
  if (!tokens.length) return items;
  const phrase = tokens.join(' ');
  return items.map((item) => {
    const normalized = title(item).toLowerCase().trim().replace(/\s+/g, ' ');
    const titleText = withPlaceAliases(title(item)).toLowerCase().trim().replace(/\s+/g, ' ');
    const matchedWords = tokens.filter((token) => titleText.includes(token)).length;
    const exactName = placeSearchNames(title(item)).some(name => name.toLowerCase().trim().replace(/\s+/g, ' ') === phrase);
    const rank = normalized === phrase || exactName ? 3 : matchedWords === tokens.length ? 2 : matchedWords ? 1 : 0;
    return { item, rank };
  }).sort((a, b) => b.rank - a.rank).map(({ item }) => item);
}

/** Directory index URL that opens with the given search applied. */
export function browseUrl(path: string, query: string) {
  const trimmed = query.trim();
  return trimmed ? `${path}?${new URLSearchParams({ search: trimmed })}` : path;
}
