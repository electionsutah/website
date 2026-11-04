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
let entities;
try {
  entities = await server.ssrLoadModule('/src/lib/entities.ts');
} finally {
  await server.close();
}
const { people, offices, parties, places, elections, filings, currentDatasetUpdated } = entities;

/** @type {{ path: string; title: string }[]} */
const routes = [
  { path: '/', title: 'Elections Utah — Open civic data' },
  { path: '/labs/', title: '2026 Utah election results — Elections Utah Labs' },
  { path: '/elections/', title: 'Election years' },
  ...elections.map((election) => ({ path: `/elections/${election.year}/`, title: election.title })),
  { path: '/people/', title: 'People' },
  ...people.map((person) => ({ path: `/people/${person.id}/`, title: person.name })),
  { path: '/offices/', title: 'Offices' },
  ...offices.map((office) => ({ path: `/offices/${office.id}/`, title: office.name })),
  { path: '/parties/', title: 'Parties' },
  ...parties.map((party) => ({ path: `/parties/${party.id}/`, title: party.name })),
  { path: '/places/', title: 'Places' },
  ...places.map((place) => ({ path: `/places/${place.id}/`, title: place.name })),
  { path: '/docs/', title: 'Documentation' },
  { path: '/docs/data-schema/', title: 'Data schema' },
  { path: '/docs/glossary/', title: 'Glossary' }
];

const escapeHtml = (value) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const fullTitle = (title) => (title.includes('Elections Utah') ? title : `${title} — Elections Utah`);

const shell = await readFile(join(dist, 'index.html'), 'utf8');
if (!/<title>[^<]*<\/title>/.test(shell)) throw new Error('dist/index.html has no <title> to replace');

function page(title, head = '') {
  return shell.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(fullTitle(title))}</title>${head}`);
}

const seen = new Set();
for (const route of routes) {
  if (seen.has(route.path)) throw new Error(`Duplicate route ${route.path}`);
  seen.add(route.path);
  const file = join(dist, route.path, 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page(route.title, `\n    <link rel="canonical" href="${escapeHtml(siteUrl + route.path)}" />`));
}

// Netlify serves dist/404.html with HTTP 404 for any path without a file; the app renders its not-found view.
await writeFile(join(dist, '404.html'), page('Page not found', '\n    <meta name="robots" content="noindex" />'));

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

console.log(`Prerendered ${routes.length} routes, 404.html, sitemap.xml, llms.txt, and data/filings.json`);
