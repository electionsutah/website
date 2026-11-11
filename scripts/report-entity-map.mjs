import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

// Read the same resolved module as the site; do not infer identities from raw imports.
const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const data = await server.ssrLoadModule('/src/lib/entities.ts');
  const kinds = ['people', 'filings', 'offices', 'parties', 'places', 'elections'];
  const nodes = [], edges = [], issues = [], lookup = new Map();
  const key = (kind, id) => `${kind}:${id}`;
  const issue = (severity, node, rule, message, target = '') => issues.push({ severity, node, rule, message, target });
  for (const kind of kinds) for (const row of data[kind]) {
    const id = String(kind === 'filings' ? row.recordId : kind === 'elections' ? row.year : row.id);
    const k = key(kind, id);
    if (lookup.has(k)) issue('error', k, 'duplicate-id', `Duplicate stable ID: ${id}`);
    const n = { key: k, kind, id, name: row.name ?? row.title, year: row.year, source: row.source ?? '', url: kind === 'filings' ? `https://www.electionsutah.org/people/${row.personId}/` : `https://www.electionsutah.org/${kind}/${id}/` };
    if (kind === 'filings') n.name = `${row.name} · ${row.year} · ${row.officeName}`;
    lookup.set(k, nodes.length); nodes.push(n);
  }
  function link(from, kind, id, relation, required = true) {
    if (!id && !required) return;
    const to = key(kind, String(id ?? ''));
    edges.push([from, to, relation]);
    if (!lookup.has(to)) issue('error', from, 'missing-reference', `${relation} points to missing ${to}`, to);
  }
  for (const f of data.filings) {
    const k = key('filings', f.recordId);
    link(k, 'people', f.personId, 'candidate'); link(k, 'people', f.runningMateId, 'running mate', false);
    link(k, 'offices', f.officeId, 'office'); link(k, 'parties', f.partyId, 'affiliation');
    link(k, 'elections', f.year, 'election');
    for (const id of f.placeIds) link(k, 'places', id, 'candidate location');
    if (f.runningMateId === f.personId) issue('error', k, 'self-running-mate', 'Candidate is their own running mate');
    if (!!f.runningMate !== !!f.runningMateId) issue('error', k, 'running-mate-pair', 'Running mate name and ID disagree about whether a mate exists');
    if (!f.source) issue('review', k, 'missing-source', 'No source URL recorded');
    if (f.partyId === 'not-reported') issue('review', k, 'unreported-affiliation', 'Source does not report affiliation; do not infer a party');
    for (const [kind, ids] of [['people', [f.personId, f.runningMateId].filter(Boolean)], ['offices', [f.officeId]], ['parties', [f.partyId]], ['places', f.placeIds], ['elections', [f.year]]]) {
      for (const id of ids) {
        const entity = data[kind].find(r => String(kind === 'elections' ? r.year : r.id) === String(id));
        if (entity && !entity.filings.includes(f)) issue('error', k, 'missing-backlink', `${kind}:${id} does not include this filing`);
      }
    }
  }
  for (const p of data.places) {
    const k = key('places', p.id);
    link(k, 'places', p.parentId, 'parent county', p.type === 'City');
    if (p.type === 'City' && data.placesById.get(p.parentId)?.type !== 'County') issue('error', k, 'invalid-parent', 'City parent must be an existing county');
    if (!p.filings.length) issue('review', k, 'no-filings', 'No imported filings; this can be an intentional coverage gap');
    for (const child of p.children) if (child.parentId !== p.id) issue('error', k, 'child-parent-mismatch', `Child ${child.id} points to another parent`);
  }
  for (const o of data.offices) for (const id of o.placeIds) link(key('offices', o.id), 'places', id, 'candidate locations');
  // Validate both directions of computed filing lists, including unexpected entries.
  for (const kind of ['people', 'offices', 'parties', 'places', 'elections']) for (const r of data[kind]) {
    const k = key(kind, kind === 'elections' ? r.year : r.id);
    for (const f of r.filings) {
      const matches = kind === 'people' ? [f.personId, f.runningMateId].includes(r.id) : kind === 'offices' ? f.officeId === r.id : kind === 'parties' ? f.partyId === r.id : kind === 'places' ? f.placeIds.includes(r.id) : f.year === r.year;
      if (!matches || !lookup.has(key('filings', f.recordId))) issue('error', k, 'unexpected-backlink', `Computed filing list includes unrelated or missing ${f.recordId}`);
    }
  }
  const report = { generatedAt: new Date().toISOString(), scope: 'Resolved runtime entities after editorial overrides. Internal reference audit, not a live website or external URL availability check. Candidate locations are not office jurisdiction. Results, contests and enrichment files are not separate nodes in this core entity map.', counts: Object.fromEntries(kinds.map(k => [k, data[k].length])), nodes, edges, issues };
  await writeFile('reports/entity-map.json', JSON.stringify(report));
  const template = await readFile('scripts/templates/entity-map.html', 'utf8');
  await writeFile('reports/entity-map.html', template.replace('/*__DATA__*/', `const DATA=${JSON.stringify(report).replaceAll('<', '\\u003c')};`));
  console.log(JSON.stringify({ counts: report.counts, relationships: edges.length, issues: Object.fromEntries(['error','review'].map(s => [s, issues.filter(i => i.severity === s).length])) }, null, 2));
} finally { await server.close(); }
