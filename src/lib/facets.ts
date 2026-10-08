import { statusLabel, type Filing } from './entities';

/**
 * Drill-down filters over the per-election fields of the Elections Utah
 * person schema ({YYYY}_election: election_type, office, candidate_status,
 * party, city, county, and the published contact fields).
 *
 * Every directory entry (person, office, party, place, election year) owns a
 * list of filings. An entry matches when at least one of its filings satisfies
 * every selected facet: values within a facet are OR'd, facets are AND'd.
 */
export type FacetKey = 'year' | 'electionType' | 'section' | 'status' | 'party' | 'county' | 'city' | 'contact';

export type Selection = Partial<Record<FacetKey, string[]>>;

export type FacetValue = { value: string; count: number; selected: boolean };

export type Facet = { key: FacetKey; label: string; schemaField: string; values: FacetValue[] };

type FacetDefinition = {
  key: FacetKey;
  label: string;
  schemaField: string;
  values: (filing: Filing) => string[];
  sort?: (a: string, b: string) => number;
};

const contactFields = [
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['website', 'Website'],
  ['address', 'Address'],
  ['facebook', 'Facebook'],
  ['twitter', 'X / Twitter'],
  ['instagram', 'Instagram']
] as const;

const notPublished = 'Not published';

const definitions: FacetDefinition[] = [
  { key: 'year', label: 'Election year', schemaField: '{YYYY}_election', values: (filing) => [String(filing.year)], sort: (a, b) => Number(b) - Number(a) },
  { key: 'electionType', label: 'Election type', schemaField: 'election_type', values: (filing) => [filing.electionType ? filing.electionType.charAt(0).toUpperCase() + filing.electionType.slice(1) : notPublished] },
  { key: 'section', label: 'Office type', schemaField: 'office', values: (filing) => [filing.section] },
  { key: 'status', label: 'Candidate status', schemaField: 'candidate_status', values: (filing) => [statusLabel(filing.status)] },
  { key: 'party', label: 'Party', schemaField: 'party', values: (filing) => [filing.partyName] },
  { key: 'county', label: 'County', schemaField: 'county', values: (filing) => [filing.county ? `${filing.county} County` : notPublished] },
  { key: 'city', label: 'City', schemaField: 'city', values: (filing) => [filing.city || notPublished] },
  {
    key: 'contact',
    label: 'Contact published',
    schemaField: 'email · phone · website · …',
    values: (filing) => {
      const published = contactFields.filter(([field]) => filing.contact?.[field]).map(([, label]) => label);
      return published.length ? published : ['None'];
    }
  }
];

export const facetKeys = definitions.map((definition) => definition.key);

// Facet values per filing, computed once; filtering runs on every click.
const valueCache = new WeakMap<Filing, string[][]>();

function filingValues(filing: Filing) {
  let values = valueCache.get(filing);
  if (!values) {
    values = definitions.map((definition) => definition.values(filing));
    valueCache.set(filing, values);
  }
  return values;
}

function filingMatches(filing: Filing, selection: Selection, skip?: FacetKey) {
  const values = filingValues(filing);
  return definitions.every((definition, index) => {
    const selected = selection[definition.key];
    if (definition.key === skip || !selected?.length) return true;
    return values[index].some((value) => selected.includes(value));
  });
}

export function isActive(selection: Selection) {
  return Object.values(selection).some((values) => values?.length);
}

/** Filings of an entry that satisfy the selection. */
export function matchingFilings(filings: Filing[], selection: Selection) {
  return isActive(selection) ? filings.filter((filing) => filingMatches(filing, selection)) : filings;
}

/**
 * Facet values with the number of entries each would leave, given the other
 * selected facets. Values that would leave nothing are hidden unless selected,
 * so every option shown narrows the results instead of emptying them.
 */
export function buildFacets(entries: { filings: Filing[] }[], selection: Selection, keys: FacetKey[] = facetKeys): Facet[] {
  return definitions
    .filter((definition) => keys.includes(definition.key))
    .map((definition) => {
      const index = definitions.indexOf(definition);
      const counts = new Map<string, number>();
      for (const entry of entries) {
        const values = new Set<string>();
        for (const filing of entry.filings) {
          if (filingMatches(filing, selection, definition.key)) for (const value of filingValues(filing)[index]) values.add(value);
        }
        for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      const selected = selection[definition.key] ?? [];
      for (const value of selected) if (!counts.has(value)) counts.set(value, 0);
      const values = [...counts.entries()]
        .map(([value, count]) => ({ value, count, selected: selected.includes(value) }))
        .sort((a, b) =>
          Number(a.value === notPublished || a.value === 'None') - Number(b.value === notPublished || b.value === 'None')
          || (definition.sort ? definition.sort(a.value, b.value) : b.count - a.count || a.value.localeCompare(b.value)));
      return { key: definition.key, label: definition.label, schemaField: definition.schemaField, values };
    })
    // A facet with a single possible value cannot narrow anything.
    .filter((facet) => facet.values.length > 1 || facet.values.some((value) => value.selected));
}

export function toggle(selection: Selection, key: FacetKey, value: string): Selection {
  const current = selection[key] ?? [];
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  return { ...selection, [key]: next };
}

export type View = 'grid' | 'list';

export type Sort = { key: string; direction: 'asc' | 'desc' };

export type IndexState = { selection: Selection; view: View; query: string; sort: Sort | null };

/**
 * Filters, layout, and table sort are kept in two places:
 * - the query string, so a filtered view can be bookmarked or shared;
 * - localStorage, per directory page, so they persist across visits.
 * A link that carries its own filters or layout wins over the saved settings.
 */
const storageKey = 'elections-utah:index-state';
const storageVersion = 2;

type StoredState = { version: number; lastView: View; pages: Record<string, { selection: Selection; view: View; sort?: Sort | null }> };

function readStorage(): StoredState {
  let state: StoredState = { version: storageVersion, lastView: 'list', pages: {} };
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (stored?.version === storageVersion && stored.pages) state = stored;
    // Version 1 saved tiles for every visit while tiles were the default, so
    // keep its filters but not its layouts now that list is the default.
    else if (stored?.version === 1 && stored.pages) {
      const pages = Object.fromEntries(Object.entries(stored.pages as StoredState['pages']).map(([page, saved]) => [page, { selection: saved.selection, view: 'list' as View }]));
      state = { version: storageVersion, lastView: 'list', pages };
    }
  } catch {
    // Unreadable or unavailable storage falls back to defaults.
  }
  // The parties directory was stored under its earlier route name.
  if (state.pages.party) {
    state.pages.parties ??= state.pages.party;
    delete state.pages.party;
  }
  return state;
}

function parseView(value: unknown): View | null {
  return value === 'list' || value === 'grid' ? value : null;
}

/** Drop saved values the data no longer contains, so old settings can't strand a page on zero results. */
function knownSelection(selection: Selection, entries: { filings: Filing[] }[]): Selection {
  const known = definitions.map(() => new Set<string>());
  for (const entry of entries) for (const filing of entry.filings) filingValues(filing).forEach((values, index) => values.forEach((value) => known[index].add(value)));
  const result: Selection = {};
  definitions.forEach((definition, index) => {
    const values = (selection[definition.key] ?? []).filter((value) => typeof value === 'string' && known[index].has(value));
    if (values.length) result[definition.key] = values;
  });
  return result;
}

function parseSort(key: unknown, direction: unknown, sortKeys: string[]): Sort | null {
  if (typeof key !== 'string' || !sortKeys.includes(key)) return null;
  return { key, direction: direction === 'desc' ? 'desc' : 'asc' };
}

/** Clicking a column sorts it ascending; clicking the sorted column again reverses it. */
export function nextSort(current: Sort | null, key: string): Sort {
  return current?.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' };
}

// Punctuation is ignored so names like "“CJ” Christina" and "'alama" sort by their letters.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base', ignorePunctuation: true });

/** Sort rows by a column value; numbers compare numerically, text naturally ("District 2" before "District 10"). */
export function sortRows<T>(rows: T[], sort: Sort | null, value: (row: T, key: string) => string | number, tiebreak: (row: T) => string): T[] {
  if (!sort) return rows;
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = value(a, sort.key);
    const right = value(b, sort.key);
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left), String(right));
    return order * factor || collator.compare(tiebreak(a), tiebreak(b));
  });
}

export function restoreState(page: string, entries: { filings: Filing[] }[], sortKeys: string[] = []): IndexState {
  const params = new URLSearchParams(window.location.search);
  const stored = readStorage();
  const saved = stored.pages[page];
  const linked = facetKeys.some((key) => params.has(key)) || params.has('view');
  // `q` was the parameter's earlier name.
  const query = params.get('search') ?? params.get('q') ?? '';
  // A search handed over from the site-wide search modal ("View all") should
  // show every match, so saved filters sit out that visit without being erased.
  const searchOnly = !linked && Boolean(query);
  let selection: Selection = {};
  if (linked) {
    for (const key of facetKeys) if (params.getAll(key).length) selection[key] = params.getAll(key);
  } else if (!searchOnly) {
    selection = saved?.selection ?? {};
  }
  const state = {
    selection: knownSelection(selection, entries),
    // List is the default and never written to the URL, so a link without a layout keeps the visitor's own.
    view: parseView(params.get('view')) ?? parseView(saved?.view) ?? stored.lastView,
    query,
    // Sorting only reorders, so a saved sort applies unless the link sets its own.
    sort: params.has('sort') ? parseSort(params.get('sort'), params.get('order'), sortKeys) : parseSort(saved?.sort?.key, saved?.sort?.direction, sortKeys)
  };
  persistState(page, state, { remember: !searchOnly });
  return state;
}

export function persistState(page: string, { selection, view, query, sort }: IndexState, { remember = true } = {}) {
  const params = new URLSearchParams();
  for (const key of facetKeys) for (const value of selection[key] ?? []) params.append(key, value);
  if (query) params.set('search', query);
  if (view === 'grid') params.set('view', 'grid');
  if (sort) params.set('sort', sort.key);
  if (sort?.direction === 'desc') params.set('order', 'desc');
  const search = params.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) history.replaceState(history.state, '', url);

  if (!remember) return;
  // Search text is a one-off lookup, so only filters, layout, and sort are remembered.
  const stored = readStorage();
  stored.pages[page] = { selection, view, sort };
  stored.lastView = view;
  try {
    localStorage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable (private browsing); the URL still carries the state.
  }
}
