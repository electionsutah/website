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
const { people, offices, parties, places, elections } = entities;

/** @type {{ path: string; title: string }[]} */
const routes = [
  { path: '/', title: 'Elections Utah — Open civic data' },
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

console.log(`Prerendered ${routes.length} routes, 404.html, and sitemap.xml`);
