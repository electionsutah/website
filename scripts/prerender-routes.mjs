// After `vite build`, write an HTML entry for every known route so Netlify serves
// them with HTTP 200, a 404.html for everything else, and a sitemap.xml.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const siteUrl = 'https://www.electionsutah.org';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true } });
let entities, resultsLib, namesLib, slugsLib, peopleLib, profilesLib;
try {
  entities = await server.ssrLoadModule('/src/lib/entities.ts');
  profilesLib = await server.ssrLoadModule('/src/lib/entity-profiles.ts');
  [resultsLib, namesLib, slugsLib, peopleLib] = await Promise.all(['/src/lib/results.ts', '/src/lib/result-names.ts', '/src/lib/contest-slugs.ts', '/src/lib/result-people.ts'].map((id) => server.ssrLoadModule(id)));
} finally {
  await server.close();
}
const { people, offices, parties, places, elections, filings, currentDatasetUpdated } = entities;

// Data-driven descriptions for link previews and search results. LinkedIn wants
// at least 100 characters; search engines truncate around 160.
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
const span = (years) => { const sorted = [...years].sort((a, b) => a - b); return sorted.length ? (sorted[0] === sorted.at(-1) ? `in ${sorted[0]}` : `from ${sorted[0]} to ${sorted.at(-1)}`) : ''; };
const latest = (list) => [...list].sort((a, b) => b.year - a.year)[0];
const hasParty = (name) => name && !/^(unaffiliated|nonpartisan|unknown)?$/i.test(name);
const sources = 'with offices, parties, filing status, and links to official sources';
function personDescription(person) {
  const filing = latest(person.filings);
  if (!filing) return `${person.name} in Utah election records on Elections Utah, with offices, parties, and links to official sources.`;
  const ran = `${person.name} filed for ${filing.officeName} in ${filing.year}${hasParty(filing.partyName) ? ` with the ${filing.partyName.replace(/^the /i, '')}` : ''}.`;
  return person.filings.length > 1
    ? `${ran} See all ${plural(person.filings.length, 'Utah candidate filing')} ${span(person.years)}, with status and official sources.`
    : `${ran} See the filing, its status, and the official source on Elections Utah.`;
}
const filed = (filings, years) => (filings.length ? `${plural(filings.length, 'candidate filing')} ${span(years)}` : 'no candidate filings on record yet');

/** @type {{ path: string; title: string; description: string; image: string; type?: string }[]} */
const routes = [
  { path: '/', title: 'Elections Utah — Open civic data', description: 'Open civic data for Utah elections: candidate filings since 2017, offices, parties, counties and cities, and 2026 results by county.', image: 'default' },
  { path: '/labs/', title: '2026 Utah election results — Elections Utah Labs', description: 'Unofficial 2026 Utah general election results for every contest, with county-by-county maps and shifts from past elections.', image: 'labs' },
  { path: '/elections/', title: 'Election years', description: 'Candidate filings for each Utah election year since 2017, with offices, parties, filing status, and links to official sources.', image: 'elections' },
  ...elections.map((election) => ({ path: `/elections/${election.year}/`, title: election.title, description: `Candidates in Utah’s ${election.title}: ${plural(election.filings.length, 'candidate filing')}, ${sources}.`, image: 'elections' })),
  { path: '/people/', title: 'People', description: `${plural(people.length, 'candidate')} who have filed to run for office in Utah, with the offices they sought, their parties, and official sources.`, image: 'people' },
  ...people.map((person) => ({ path: `/people/${person.id}/`, title: person.name, description: personDescription(person), image: 'people', type: 'profile' })),
  { path: '/offices/', title: 'Offices', description: `${plural(offices.length, 'Utah office')}, from U.S. House to local school boards, and every candidate who has filed to run for each one.`, image: 'offices' },
  ...offices.map((office) => ({ path: `/offices/${office.id}/`, title: office.name, description: `${office.name}: ${profilesLib.officeProfile(office, entities.placesById).description} Candidate filings and communities served.`, image: 'offices' })),
  { path: '/parties/', title: 'Parties', description: 'Utah’s recognized and historical political parties, with their candidates, the offices they sought, and links to official sources.', image: 'parties' },
  ...parties.map((party) => ({ path: `/parties/${party.id}/`, title: party.name, description: `${profilesLib.partyProfile(party).description} Browse candidates and official sources.`, image: 'parties' })),
  { path: '/places/', title: 'Places', description: 'Elections in every Utah county and city, with the local offices on the ballot, the candidates who filed, and links to official sources.', image: 'places' },
  ...places.map((place) => ({ path: `/places/${place.id}/`, title: place.name, description: `Elections in ${place.type === 'City' ? `${place.name}, ${place.county} County` : `${place.name}, Utah`}: ${plural(place.offices.length, 'office')} and ${filed(place.filings, place.years)}, with candidates and official sources.`, image: 'places' })),
  { path: '/docs/', title: 'Documentation', description: 'How to use Elections Utah’s open election data: downloads, the data schema, a glossary, and an MCP connector for AI assistants.', image: 'docs' },
  { path: '/docs/data-schema/', title: 'Data schema', description: 'Every field in the Elections Utah datasets, from candidate filings to 2026 results, with formats, examples, and source notes.', image: 'docs' },
  { path: '/docs/glossary/', title: 'Glossary', description: 'Plain-language definitions of Utah election terms, from declarations of candidacy and filing status to retention elections and canvass.', image: 'docs' }
];

const shortDescriptions = routes.filter((route) => route.description.length < 100);
if (shortDescriptions.length) console.warn(`${shortDescriptions.length} descriptions are under 100 characters, e.g. ${shortDescriptions[0].path}: "${shortDescriptions[0].description}"`);

const escapeHtml = (value) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const fullTitle = (title) => (title.includes('Elections Utah') ? title : `${title} — Elections Utah`);

const shell = await readFile(join(dist, 'index.html'), 'utf8');
if (!/<title>[^<]*<\/title>/.test(shell)) throw new Error('dist/index.html has no <title> to replace');

// The shell's generic description is replaced by each page's own.
const descriptionTag = /\n?\s*<meta name="description"[^>]*>/;
if (!descriptionTag.test(shell)) throw new Error('dist/index.html has no meta description to replace');

/** Title, description, canonical URL, and Open Graph / Twitter tags for one page. */
function metaTags({ title, description, url, image, type = 'website' }) {
  const tags = [
    ['name', 'description', description],
    ['property', 'og:site_name', 'Elections Utah'],
    ['property', 'og:type', type],
    ['property', 'og:title', fullTitle(title)],
    ['property', 'og:description', description],
    ...(url ? [['property', 'og:url', url]] : []),
    ['property', 'og:image', `${siteUrl}/og/${image}.png`],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', fullTitle(title)],
    ['name', 'twitter:card', 'summary_large_image']
  ];
  return [...(url ? [`<link rel="canonical" href="${escapeHtml(url)}" />`] : []), ...tags.map(([key, name, content]) => `<meta ${key}="${name}" content="${escapeHtml(content)}" />`)].map((tag) => `\n    ${tag}`).join('');
}

function page(title, head = '') {
  return shell.replace(descriptionTag, '').replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(fullTitle(title))}</title>${head}`);
}

const seen = new Set();
for (const route of routes) {
  if (seen.has(route.path)) throw new Error(`Duplicate route ${route.path}`);
  seen.add(route.path);
  const file = join(dist, route.path, 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page(route.title, metaTags({ ...route, url: siteUrl + encodeURI(route.path) })));
}

// Netlify serves dist/404.html with HTTP 404 for any path without a file; the app renders its not-found view.
await writeFile(join(dist, '404.html'), page('Page not found', `\n    <meta name="robots" content="noindex" />${metaTags({ title: 'Page not found', description: 'This page could not be found on Elections Utah. Search Utah candidates, offices, parties, places, and 2026 election results.', image: 'default' })}`));

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map((route) => `  <url><loc>${escapeHtml(siteUrl + encodeURI(route.path))}</loc></url>`),
  '</urlset>',
  ''
].join('\n');
await writeFile(join(dist, 'sitemap.xml'), sitemap);

// Machine-readable copies of the directory for AI tools and scripts that can't use MCP.
const filingsExport = {
  source: siteUrl,
  updated: currentDatasetUpdated,
  license: 'Public candidate-filing records compiled from official Utah sources; see each record\'s source URL.',
  filings: filings.map(({ contact, ...filing }) => ({ ...filing, url: `${siteUrl}/people/${filing.personId}/`, contact: contact ?? null }))
};
await mkdir(join(dist, 'data'), { recursive: true });
await writeFile(join(dist, 'data', 'filings.json'), JSON.stringify(filingsExport));

// Per-race link previews for /labs/?race=<slug>, read by netlify/edge-functions/labs-og.ts.
const snapshot = namesLib.tidySnapshot(JSON.parse(await readFile(join(root, 'public/data/2026-results.json'), 'utf8')));
const slugs = slugsLib.raceSlugs(snapshot.contests);
const countyNames = new Map(snapshot.counties.map((row) => [row.id, row.name]));
const status = `${snapshot.official ? 'Official' : 'Unofficial'} 2026 Utah results with county maps.`;
const racePreviews = Object.fromEntries(snapshot.contests.map((contest) => {
  const title = peopleLib.contestTitle(contest);
  const county = contest.county ? countyNames.get(contest.county) ?? '' : '';
  const label = county && !title.startsWith(county.replace(/ County$/, '')) ? `${title}, ${county}` : title;
  const seats = resultsLib.seatsOf(contest);
  const top = contest.options[0];
  const votes = resultsLib.count(contest.total);
  const share = top && contest.total ? `${resultsLib.percent(top.votes, contest.total)} of ${votes} votes` : '';
  const measure = contest.options.length > 0 && contest.options.every((option) => /^(yes|no|for|against)\b/i.test(option.name));
  const judge = measure && /(Judge|Justice)\b/.test(title);
  let result;
  if (!contest.total) result = `${label}: no votes reported yet.`;
  else if (judge) result = `Retain ${label}? “${top.name}” leads with ${share}.`;
  else if (measure) result = `${label}: “${top.name}” leads with ${share}.`;
  else if (seats > 1) result = `${label}: ${resultsLib.leader(contest, seats).replace('Top', 'the top').replace(' · ', ' for ')}, with ${votes} votes counted.`.replace(': the', ': The');
  else result = `${top.name} leads with ${share} in ${label}.`;
  return [slugs.slug(contest.id), { title: `${label}: 2026 results`, description: `${result} ${status}` }];
}));
await writeFile(join(dist, 'data', 'race-previews.json'), JSON.stringify(racePreviews));

const llms = `# Elections Utah

> Open civic data about Utah elections: candidate filings from 2017 to 2026 for ${people.length.toLocaleString('en-US')} people, ${offices.length.toLocaleString('en-US')} offices, ${parties.length} parties, and ${places.length} counties and cities, plus 2026 general-election results by county.

Every page links its official source. 2026 results are unofficial until the state canvass is certified; check the \`official\` and \`asOf\` fields before citing them. Candidate filings were last updated ${currentDatasetUpdated}.

## Connect an AI assistant (MCP)

- [MCP server](${siteUrl}/mcp): read-only Streamable HTTP endpoint, no sign-in. Add it as a custom connector in Claude or ChatGPT. Tools: \`search\`, \`fetch\`, \`list_contests\`, \`get_contest_results\`, \`get_district_shift\`.

## Data files

- [Candidate filings](${siteUrl}/data/filings.json): every filing with office, party, place, status, source, and public contact details.
- [2026 general-election results](${siteUrl}/data/2026-results.json): contests, candidates, votes, and county breakdowns from the Utah election results API.
- [2024 certified results](${siteUrl}/data/2024-results.json) and [2022 legislative baselines](${siteUrl}/data/2022-shift-baseline.json): used for political-shift comparisons.
- [Legislative district boundaries](${siteUrl}/data/utah-legislative-boundaries.json)

## Pages

- [2026 results lab](${siteUrl}/labs/): results, county maps, and political shifts.
- [People](${siteUrl}/people/), [Offices](${siteUrl}/offices/), [Parties](${siteUrl}/parties/), [Places](${siteUrl}/places/), [Election years](${siteUrl}/elections/)
- [Data schema](${siteUrl}/docs/data-schema/) and [Glossary](${siteUrl}/docs/glossary/)
- [Sitemap](${siteUrl}/sitemap.xml)
`;
await writeFile(join(dist, 'llms.txt'), llms);

console.log(`Prerendered ${routes.length} routes, 404.html, sitemap.xml, llms.txt, data/filings.json, and data/race-previews.json`);
