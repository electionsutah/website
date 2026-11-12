// Resolve one existing entity without guessing websites or changing production data.
import { createServer } from 'vite';

const selector = process.argv[2] ?? '';
const match = /^(people|parties|places|offices)\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)$/.exec(selector);
if (!match) {
  console.error('Use --entity KIND/ID, where KIND is people, parties, places, or offices.');
  process.exit(1);
}
const [, kind, id] = match;
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const entities = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resolveEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  const { editorialData } = await server.ssrLoadModule('/src/lib/editorial.ts');
  const entity = entities[kind].find(item => item.id === id);
  if (!entity) throw Error(`Unknown entity: ${selector}`);
  const links = resolveEntityLinks(entity.links ?? []);
  const websites = [...new Set(links.filter(link => link.platform === 'website').map(link => link.url))];
  // Party.website is a resolved field; do not bypass explicit link clears.
  const override = editorialData[kind]?.[id];
  if (!websites.length && entity.website && !override) websites.push(entity.website);
  const latestYear = entity.years.length ? Math.max(...entity.years) : null;
  const seed = {
    id, kind, name: entity.name, entityUrl: `https://www.electionsutah.org/${kind}/${id}/`,
    websites, existingLinks: links, manualOverride: !!override, editorialOverride: override ?? null,
    latestYear, historical: kind === 'people' ? !entity.years.includes(2026) : !!entity.historical,
    offices: kind === 'people' ? [...new Set(entity.filings.filter(f => f.year === latestYear).map(f => f.officeName))] : [],
    sources: [...new Set(entity.filings.filter(f => f.year === latestYear).map(f => f.source))]
  };
  process.stdout.write(JSON.stringify({ selection: `Explicit entity ${selector}; resolved existing evidence only; ownership review required.`, seeds: [seed] }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await server.close();
}
