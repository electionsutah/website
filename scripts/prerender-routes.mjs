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
let entities, resultsLib, namesLib, slugsLib, peopleLib;
try {
  entities = await server.ssrLoadModule('/src/lib/entities.ts');
  [resultsLib, namesLib, slugsLib, peopleLib] = await Promise.all(['/src/lib/results.ts', '/src/lib/result-names.ts', '/src/lib/contest-slugs.ts', '/src/lib/result-people.ts'].map((id) => server.ssrLoadModule(id)));
} finally {
  await server.close();
}
const { people, offices, parties, places, elections, filings, currentDatasetUpdated } = entities;

// Brief, data-driven descriptions for link previews and search results.
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
const span = (years) => { const sorted = [...years].sort((a, b) => a - b); return sorted.length ? (sorted[0] === sorted.at(-1) ? `${sorted[0]}` : `${sorted[0]}–${sorted.at(-1)}`) : ''; };
const latest = (list) => [...list].sort((a, b) => b.year - a.year)[0];
const partyLabel = (name) => (name && !/^(unaffiliated|nonpartisan|unknown)?$/i.test(name) ? `, ${name}` : '');
function personDescription(person) {
  const filing = latest(person.filings);
  if (!filing) return `${person.name} in Utah election records.`;
  const more = person.filings.length > 1 ? ` ${plural(person.filings.length, 'filing')}, ${span(person.years)}.` : '';
  return `Candidate for ${filing.officeName} in ${filing.year}${partyLabel(filing.partyName)}.${more}`;
}
const filingsSummary = (filings, years) => (filings.length ? `${plural(filings.length, 'candidate filing')}, ${span(years)}.` : 'No candidate filings on record.');

/** @type {{ path: string; title: string; description: string; image: string; type?: string }[]} */
const routes = [
  { path: '/', title: 'Elections Utah — Open civic data', description: 'Open civic data for Utah elections: candidates, offices, parties, places, and 2026 results.', image: 'default' },
  { path: '/labs/', title: '2026 Utah election results — Elections Utah Labs', description: 'Unofficial 2026 Utah general election results for every contest, with county maps.', image: 'labs' },
  { path: '/elections/', title: 'Election years', description: 'Candidate filings for each Utah election year.', image: 'elections' },
  ...elections.map((election) => ({ path: `/elections/${election.year}/`, title: election.title, description: `${election.title}: ${filingsSummary(election.filings, [election.year]).replace(/, \d{4}\.$/, '.')}`, image: 'elections' })),
  { path: '/people/', title: 'People', description: `${plural(people.length, 'candidate')} who have filed to run in Utah.`, image: 'people' },
  ...people.map((person) => ({ path: `/people/${person.id}/`, title: person.name, description: personDescription(person), image: 'people', type: 'profile' })),
  { path: '/offices/', title: 'Offices', description: `${plural(offices.length, 'Utah office')} and who has run for each.`, image: 'offices' },
  ...offices.map((office) => ({ path: `/offices/${office.id}/`, title: office.name, description: `${office.name}: ${filingsSummary(office.filings, office.years)}`, image: 'offices' })),
  { path: '/parties/', title: 'Parties', description: 'Utah political parties and their candidates.', image: 'parties' },
  ...parties.map((party) => ({ path: `/parties/${party.id}/`, title: party.name, description: `${party.name}${party.recognized ? ', a recognized Utah party' : ''}: ${filingsSummary(party.filings, party.years)}`, image: 'parties' })),
  { path: '/places/', title: 'Places', description: 'Elections in every Utah county and city.', image: 'places' },
  ...places.map((place) => ({ path: `/places/${place.id}/`, title: place.name, description: `${place.type === 'City' ? `${place.name}, ${place.county} County` : place.name}: ${plural(place.offices.length, 'office')}, ${filingsSummary(place.filings, place.years).replace(/^./, (c) => c.toLowerCase())}`, image: 'places' })),
  { path: '/docs/', title: 'Documentation', description: 'How to use Elections Utah’s open data.', image: 'docs' },
  { path: '/docs/data-schema/', title: 'Data schema', description: 'Fields and formats in the Elections Utah datasets.', image: 'docs' },
  { path: '/docs/glossary/', title: 'Glossary', description: 'Utah election terms, defined.', image: 'docs' }
];

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
    ['property', 'og:image:alt', `Elections Utah — ${fullTitle(title)}`],
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
await writeFile(join(dist, '404.html'), page('Page not found', `\n    <meta name="robots" content="noindex" />${metaTags({ title: 'Page not found', description: 'This page could not be found on Elections Utah.', image: 'default' })}`));

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
const status = snapshot.official ? 'Official 2026 results.' : 'Unofficial 2026 results.';
const racePreviews = Object.fromEntries(snapshot.contests.map((contest) => {
  const title = peopleLib.contestTitle(contest);
  const county = contest.county ? countyNames.get(contest.county) ?? '' : '';
  const label = county && !title.startsWith(county.replace(/ County$/, '')) ? `${title}, ${county}` : title;
  const seats = resultsLib.seatsOf(contest);
  const top = contest.options[0];
  const votes = resultsLib.count(contest.total);
  const result = !contest.total ? resultsLib.leader(contest, seats) : seats === 1 && top ? `${resultsLib.leader(contest, seats)} with ${resultsLib.percent(top.votes, contest.total)} of ${votes} votes` : `${resultsLib.leader(contest, seats).replace(" · ", " for ")}, ${votes} votes`;
  return [slugs.slug(contest.id), { title: `${label}: 2026 results`, description: `${result}. ${status}` }];
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
