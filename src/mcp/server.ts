import { officeProfile, partyProfile } from '../lib/entity-profiles';
// Read-only MCP server for Elections Utah. It reuses the site's own data
// libraries, so tools return the same records the website shows.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import results2026 from '../../public/data/2026-results.json';
import results2024 from '../../public/data/2024-results.json';
import baseline2022 from '../../public/data/2022-shift-baseline.json';
import { currentDatasetUpdated, offices, officesById, parties, partiesById, partyLabel, people, peopleById, places, placesById, statusLabel, type Filing } from '../lib/entities';
import { contestTitle } from '../lib/result-people';
import { tidySnapshot } from '../lib/result-names';
import { withPlaceAliases } from '../lib/search';
import { raceSlugs } from '../lib/contest-slugs';
import { count, leader, percent, seatsOf, type Contest, type Snapshot } from '../lib/results';
import { raceComparison, shiftLabel, type HistoricalSnapshot } from '../lib/shifts';

export const SITE_URL = 'https://www.electionsutah.org';
const snapshot = tidySnapshot(results2026 as Snapshot);
const history = [results2024, baseline2022] as unknown as HistoricalSnapshot[];
const countyNames = new Map(snapshot.counties.map(row => [row.id, row.name]));
const contestsById = new Map(snapshot.contests.map(row => [row.id, row]));
const slugs = raceSlugs(snapshot.contests);
// Contests are addressed by readable slug ("us-house-district-1"); legacy ids and a "contest:" prefix also resolve.
const findContest = (value: string) => { const id = slugs.id(value.trim().replace(/^contest:/, '')); return id ? contestsById.get(id) : undefined; };
const categories = ['U.S. House', 'State Senate', 'State House', 'School board', 'Judicial retention', 'Local & measures'] as const;

const resultsStatus = () => snapshot.official
  ? `Official results as of ${snapshot.asOf}.`
  : `Unofficial results, subject to change until the canvass is certified. Last updated by the state ${snapshot.asOf}; retrieved ${snapshot.fetchedAt}.`;
const contestLabel = (contest: Contest) => `${contest.county ? `${countyNames.get(contest.county)} · ` : ''}${contestTitle(contest)}`;
const contestUrl = (contest: Contest) => `${SITE_URL}/labs/?race=${slugs.slug(contest.id)}#all-results`;

// ---- Search index -------------------------------------------------------

type Kind = 'person' | 'office' | 'party' | 'place' | 'contest';
type Doc = { id: string; kind: Kind; title: string; url: string; text: string };
// Drop periods so abbreviations read as one word ("U.S." -> "us", not "u s").
const normalize = (value: string) => value.toLowerCase().replace(/\./g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const docs = ([
  ...people.map(person => ({ id: `person:${person.id}`, kind: 'person' as const, title: person.name, url: `${SITE_URL}/people/${person.id}/`, text: person.filings.map(filing => `${filing.year} ${filing.officeName} ${filing.partyName} ${filing.county ? withPlaceAliases(`${filing.county} County`) : ''} ${withPlaceAliases(filing.city)}`).join(' ') })),
  ...offices.map(office => ({ id: `office:${office.id}`, kind: 'office' as const, title: office.name, url: `${SITE_URL}/offices/${office.id}/`, text: office.sections.join(' ') })),
  ...parties.map(party => ({ id: `party:${party.id}`, kind: 'party' as const, title: party.name, url: `${SITE_URL}/parties/${party.id}/`, text: party.shortName })),
  ...places.map(place => ({ id: `place:${place.id}`, kind: 'place' as const, title: place.type === 'County' ? place.name : `${place.name}, ${place.county}`, url: `${SITE_URL}/places/${place.id}/`, text: `${withPlaceAliases(place.name)} ${place.type} ${place.county ? withPlaceAliases(`${place.county} County`) : ''}` })),
  ...snapshot.contests.map(contest => ({ id: `contest:${slugs.slug(contest.id)}`, kind: 'contest' as const, title: `2026 results: ${contestLabel(contest)}`, url: contestUrl(contest), text: `${slugs.slug(contest.id)} ${contest.name} ${contest.category} ${contest.options.map(option => `${option.name} ${option.party}`).join(' ')} election results` }))
] as Doc[]).map(doc => ({ ...doc, normTitle: normalize(doc.title), normText: normalize(doc.text) }));

function search(query: string, kinds: Kind[] | undefined, limit: number) {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  const phrase = terms.join(' ');
  return docs
    .filter(doc => !kinds?.length || kinds.includes(doc.kind))
    .map(doc => {
      let score = 0;
      for (const term of terms) {
        if (doc.normTitle.split(' ').includes(term)) score += 3;
        else if (doc.normTitle.includes(term)) score += 2;
        else if (doc.normText.includes(term)) score += 1;
        else return null;
      }
      // A query that spells a contest slug ("us house district 1") goes straight to that contest.
      if (doc.kind === 'contest' && normalize(doc.id.slice('contest:'.length)) === phrase) score += 20;
      if (doc.normTitle === phrase) score += 10;
      else if (doc.normTitle.includes(phrase)) score += 4;
      return { doc, score };
    })
    .filter((row): row is { doc: typeof docs[number]; score: number } => !!row)
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
    .slice(0, limit)
    .map(({ doc }) => ({ id: doc.id, title: doc.title, url: doc.url, type: doc.kind }));
}

// ---- Record formatting --------------------------------------------------

function filingLine(filing: Filing) {
  const where = [filing.city, filing.county && `${filing.county} County`].filter(Boolean).join(', ');
  return `- ${filing.year}: ${filing.officeName}${filing.partyName ? ` (${filing.partyName})` : ''} — ${statusLabel(filing.status)}${where ? `; ${where}` : ''}${filing.runningMate ? `; running mate ${filing.runningMate}` : ''}. Source: ${filing.source}`;
}

function contestText(contest: Contest, county = '') {
  const seats = seatsOf(contest);
  const row = county ? contest.counties.find(item => item.id === county) : contest;
  const lines = [`# ${contestLabel(contest)}`, `Category: ${contest.category}${seats > 1 ? ` · ${seats} seats` : ''}`, resultsStatus()];
  if (county) lines.push(`Showing votes cast in ${countyNames.get(county) ?? county} only.`);
  if (!row) return [...lines, 'This county has no votes reported for this contest.'].join('\n');
  lines.push(`Leader: ${leader(row, seats)}`, `Total votes: ${count(row.total)}`);
  if (row.reporting) lines.push(`Reporting units: ${row.reporting.reportingUnits} of ${row.reporting.totalUnits}`);
  lines.push('', 'Candidates / responses:', ...row.options.map(option => `- ${option.name}${option.party ? ` (${option.party})` : ''}: ${count(option.votes)} votes, ${percent(option.votes, row.total)}${option.winner ? ' — elected' : ''}`));
  if (!county && contest.counties.length > 1) {
    lines.push('', 'Leader by county:', ...contest.counties.map(item => `- ${countyNames.get(item.id)}: ${leader(item, seats)}${item.options[0] && seats === 1 ? ` (${percent(item.options[0].votes, item.total)})` : ''}, ${count(item.total)} votes`));
  }
  lines.push('', `Official source: ${contest.source}`, `Explore: ${contestUrl(contest)}`);
  return lines.join('\n');
}

function record(id: string): { title: string; url: string; text: string; metadata: Record<string, string> } | null {
  const [kind, ...rest] = id.split(':');
  const key = rest.join(':');
  if (kind === 'person') {
    const person = peopleById.get(key);
    if (!person) return null;
    const contact = person.filings.find(filing => filing.contact)?.contact;
    const contactLines = contact ? Object.entries(contact).filter(([, value]) => value).map(([field, value]) => `- ${field}: ${value}`) : [];
    return { title: person.name, url: `${SITE_URL}/people/${person.id}/`, metadata: { type: 'person', years: person.years.join(', ') }, text: [`# ${person.name}`, `Filing years: ${person.years.join(', ')}`, ...(person.links ?? []).map(link => `${link.label || 'Verified social link'}: ${link.url} (source: ${link.source}; checked ${link.verifiedOn})`), '', 'Candidate filings:', ...person.filings.map(filingLine), ...(contactLines.length ? ['', 'Contact details from the most recent filing:', ...contactLines] : [])].join('\n') };
  }
  if (kind === 'office') {
    const office = officesById.get(key);
    if (!office) return null;
    const profile = officeProfile(office, placesById);
    return { title: office.name, url: `${SITE_URL}/offices/${office.id}/`, metadata: { type: 'office' }, text: [`# ${office.name}`, profile.description, `Jurisdiction: ${profile.scope}`, profile.note, profile.boundaryPeriod ?? '', `Communities served: ${profile.communities.map(c => c.name + (c.partial ? ' (part)' : '')).join(', ') || profile.scope}`, ...profile.sources.map(source=>`Source: ${source.url}`), `Sections: ${office.sections.join(', ')}`, `Years with filings: ${office.years.join(', ')}`, ...(office.links.length ? ['', 'Official office links:', ...office.links.map(link => `- ${link.label || 'Social account'}: ${link.url}${link.source ? ` (source: ${link.source}; verified ${link.verifiedOn})` : ''}`)] : []), ...(office.resources.length ? ['', 'Resources:', ...office.resources.map(item => `- ${item.label}: ${item.url}`)] : []), '', 'Candidate filings:', ...office.filings.map(filing => `${filingLine(filing).replace(/^- /, `- ${filing.name}, `)}`)].join('\n') };
  }
  if (kind === 'party') {
    const party = partiesById.get(key);
    if (!party) return null;
    return { title: party.name, url: `${SITE_URL}/parties/${party.id}/`, metadata: { type: 'party' }, text: [`# ${party.name}`, partyProfile(party).description, `Affiliation: ${partyLabel(party)}`, party.localCaucus && `${party.localCaucus.history} Source: ${party.localCaucus.source}`, `Recognized in Utah: ${party.recognized ? 'yes' : 'no'}${party.historical ? ' (historical)' : ''}`, party.website && `Website: ${party.website}`, ...(party.links ?? []).map(link => `Official link: ${link.url}${link.source ? ` (source: ${link.source}; verified ${link.verifiedOn})` : ''}`), `Candidate filings: ${party.filings.length} across ${party.years.join(', ')}`, '', 'Most recent filings:', ...party.filings.slice().sort((a, b) => b.year - a.year).slice(0, 50).map(filing => `- ${filing.year}: ${filing.name}, ${filing.officeName}`)].filter(Boolean).join('\n') };
  }
  if (kind === 'place') {
    const place = placesById.get(key);
    if (!place) return null;
    return { title: place.name, url: `${SITE_URL}/places/${place.id}/`, metadata: { type: 'place' }, text: [`# ${place.name}`, `${place.type}${place.type === 'City' ? ` in ${place.county} County` : ''}`, place.description, ...(place.links ?? []).map(link => `${link.label || 'External link'}: ${link.url}${link.source ? ` (source: ${link.source}; checked ${link.verifiedOn})` : ''}`), place.children.length ? `Places within: ${place.children.map(child => child.name).join(', ')}` : '', `Offices: ${place.offices.map(office => office.name).join(', ')}`, '', 'Candidate filings:', ...place.filings.slice(0, 200).map(filing => `${filingLine(filing).replace(/^- /, `- ${filing.name}, `)}`)].filter(Boolean).join('\n') };
  }
  if (kind === 'contest') {
    const contest = findContest(key);
    if (!contest) return null;
    return { title: contestLabel(contest), url: contestUrl(contest), metadata: { type: 'contest', official: String(snapshot.official), asOf: snapshot.asOf }, text: contestText(contest) };
  }
  return null;
}

// ---- Server -------------------------------------------------------------

const text = (value: string) => ({ type: 'text' as const, text: value });
const failure = (message: string) => ({ isError: true, content: [text(message)] });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const countyIds = () => snapshot.counties.map(row => `${row.id} (${row.name})`).join(', ');
const resolveCounty = (value?: string) => {
  if (!value) return '';
  const wanted = normalize(value).replace(/ county( ut)?$/, '');
  return snapshot.counties.find(row => row.id === value || normalize(row.name).replace(/ county$/, '') === wanted)?.id ?? null;
};

export function createServer() {
  const server = new McpServer({ name: 'elections-utah', title: 'Elections Utah', version: '1.0.0', websiteUrl: SITE_URL }, {
    instructions: `Elections Utah publishes Utah candidate records (selected cycles, 1989–2026) and 2026 general-election results. Use search to find people, offices, parties, places, or contests, then fetch for the full record. Cite the returned URLs. ${resultsStatus()} Always tell users when results are unofficial.`
  });

  server.registerTool('search', {
    title: 'Search Elections Utah',
    description: 'Search Utah candidates, offices, parties, places (counties and cities), and 2026 election contests. Returns ids to pass to fetch.',
    inputSchema: { query: z.string().min(1).describe('Names, offices, districts, places, or parties, e.g. "Salt Lake County sheriff" or "Ben McAdams".'), types: z.array(z.enum(['person', 'office', 'party', 'place', 'contest'])).optional().describe('Limit results to these record types.'), limit: z.number().int().min(1).max(50).optional().describe('Maximum results (default 10).') },
    annotations: { title: 'Search Elections Utah', ...readOnly }
  }, async ({ query, types, limit }) => {
    const found = search(query, types, limit ?? 10);
    return { content: [text(JSON.stringify({ results: found }))], structuredContent: { results: found } };
  });

  server.registerTool('fetch', {
    title: 'Fetch a record',
    description: 'Get the full record for an id returned by search: a person\'s filings, an office, a party, a place, or a contest\'s results.',
    inputSchema: { id: z.string().min(1).describe('An id from search, such as "person:ben-mcadams" or "contest:us-house-district-1".') },
    annotations: { title: 'Fetch a record', ...readOnly }
  }, async ({ id }) => {
    const found = record(id);
    if (!found) return failure(`No record found for "${id}". Use search to find a valid id.`);
    const document = { id, ...found };
    return { content: [text(JSON.stringify(document))], structuredContent: document };
  });

  server.registerTool('list_contests', {
    title: 'List 2026 contests',
    description: `List 2026 general-election contests, optionally filtered by category, county, or text. Categories: ${categories.join(', ')}.`,
    inputSchema: { category: z.enum(categories).optional(), county: z.string().optional().describe('County name (e.g. "Utah") or id (e.g. "utah-county-ut"). Matches contests with votes in that county.'), query: z.string().optional().describe('Text to match in the contest or candidate names.'), limit: z.number().int().min(1).max(200).optional().describe('Maximum contests (default 50).') },
    annotations: { title: 'List 2026 contests', ...readOnly }
  }, async ({ category, county, query, limit }) => {
    const countyId = resolveCounty(county);
    if (countyId === null) return failure(`Unknown county "${county}". Counties: ${countyIds()}`);
    const terms = normalize(query ?? '').split(' ').filter(Boolean);
    const matches = snapshot.contests.filter(contest => (!category || contest.category === category) && (!countyId || contest.counties.some(row => row.id === countyId)) && (!terms.length || terms.every(term => normalize(`${contestLabel(contest)} ${contest.options.map(option => option.name).join(' ')}`).includes(term))));
    const rows = matches.slice(0, limit ?? 50).map(contest => ({ id: slugs.slug(contest.id), title: contestLabel(contest), category: contest.category, leader: leader(contest, seatsOf(contest)), totalVotes: contest.total, url: contestUrl(contest) }));
    const summary = { status: resultsStatus(), matched: matches.length, returned: rows.length, contests: rows };
    return { content: [text(JSON.stringify(summary))], structuredContent: summary };
  });

  server.registerTool('get_contest_results', {
    title: 'Get 2026 contest results',
    description: 'Vote totals for one 2026 contest, statewide or for a single county. Get contest ids from list_contests or search.',
    inputSchema: { contest_id: z.string().min(1).describe('Contest slug from list_contests or search, e.g. "us-house-district-1" (a "contest:" prefix is fine).'), county: z.string().optional().describe('County name or id to show only that county\'s votes.') },
    annotations: { title: 'Get 2026 contest results', ...readOnly }
  }, async ({ contest_id, county }) => {
    const contest = findContest(contest_id);
    if (!contest) return failure(`No 2026 contest with id "${contest_id}". Use list_contests or search to find one.`);
    const countyId = resolveCounty(county);
    if (countyId === null) return failure(`Unknown county "${county}". Counties: ${countyIds()}`);
    return { content: [text(contestText(contest, countyId))] };
  });

  server.registerTool('get_district_shift', {
    title: 'Get political shift for a district',
    description: 'How the Democratic–Republican margin in a 2026 State House, State Senate, or State School Board race changed from the last comparable election (2024 or 2022).',
    inputSchema: { contest_id: z.string().min(1).describe('A 2026 legislative or State School Board contest slug, e.g. "state-house-district-29".'), county: z.string().optional().describe('Compare only votes cast in this county.') },
    annotations: { title: 'Get political shift for a district', ...readOnly }
  }, async ({ contest_id, county }) => {
    const contest = findContest(contest_id);
    if (!contest) return failure(`No 2026 contest with id "${contest_id}".`);
    const countyId = resolveCounty(county);
    if (countyId === null) return failure(`Unknown county "${county}". Counties: ${countyIds()}`);
    const comparison = raceComparison(contest, history, countyId);
    const share = (value?: number) => value === undefined ? 'n/a' : `${value.toFixed(1)}%`;
    const lines = [`# Political shift: ${contestLabel(contest)}${countyId ? ` (${countyNames.get(countyId)} only)` : ''}`, resultsStatus()];
    if (comparison.shift === null) lines.push(`No shift available: ${comparison.reason}`);
    else lines.push(`Shift since ${comparison.year}: ${shiftLabel(comparison.shift)}`, `2026: Democratic ${share(comparison.current?.democraticShare)}, Republican ${share(comparison.current?.republicanShare)}`, `${comparison.year}: Democratic ${share(comparison.previous?.democraticShare)}, Republican ${share(comparison.previous?.republicanShare)}`, comparison.reason);
    lines.push('', 'Shift = (2026 D share − 2026 R share) − (prior D share − prior R share). It measures change in the party margin, not individual voters switching parties.', comparison.previousSource ? `Prior-year source: ${comparison.previousSource}` : '', `Explore: ${SITE_URL}/labs/#political-shift`);
    return { content: [text(lines.filter(Boolean).join('\n'))] };
  });

  server.registerResource('about', 'electionsutah://about', { title: 'About Elections Utah data', mimeType: 'text/markdown' }, async uri => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: `# Elections Utah\n\nOpen civic data about Utah elections: ${people.length} people, ${offices.length} offices, ${parties.length} parties, and ${places.length} places from candidate records (selected cycles, 1989–2026, filings last updated ${currentDatasetUpdated}), plus ${snapshot.contests.length} 2026 general-election contests.\n\n${resultsStatus()}\n\nWebsite: ${SITE_URL}\nResults data: ${SITE_URL}/data/2026-results.json` }]
  }));

  return server;
}

/** Handle one MCP request over Streamable HTTP. Stateless: each request gets a fresh server. */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID', 'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method === 'GET' && !request.headers.get('accept')?.includes('text/event-stream')) {
    return new Response(`Elections Utah MCP server. Add ${new URL(request.url).origin}/mcp as a connector in Claude or ChatGPT.\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors } });
  }
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  } finally {
    // JSON responses are complete once returned, so the per-request server can close.
    void server.close();
  }
}
