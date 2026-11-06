import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const workspace = join(root, 'editor/.workspace');
export const overridesPath = join(root, 'src/data/editor-overrides.json');
export const json = value => `${JSON.stringify(value, null, 2)}\n`;
export const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

export async function atomicJson(path, value) {
  const text = json(value);
  if (await readFile(path, 'utf8').catch(() => null) === text) return;
  const temporary = `${path}.tmp`;
  await writeFile(temporary, text);
  await rename(temporary, path);
}

export async function prepare(server, directory = workspace, saved = null) {
  const { importedFilings, people, places, offices, parties } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { importedProfile, importedPlaceSocial, validateChanges, editorFields } = await server.ssrLoadModule('/src/lib/editorial.ts');
  const { placeEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  const placeProfiles = await readJson(join(root, 'src/data/place-enrichment.json'));
  const placeLinks = await readJson(join(root, 'src/data/place-link-enrichment.json'));
  const officeProfiles = await readJson(join(root, 'src/data/office-enrichment.json'));
  const partyProfiles = await readJson(join(root, 'src/data/party-enrichment.json'));
  const profiles = await readJson(join(root, 'src/data/person-enrichment.json'));
  saved ??= await readJson(overridesPath);
  if (saved.version !== 1 || !saved.people || !saved.filings) throw new Error('Unsupported editorial data format');
  const originals = new Map(importedFilings.map(filing => [filing.recordId, filing]));
  const catalog = new Map();
  saved.places ??= {};
  saved.offices ??= {};
  saved.parties ??= {};
  const known = { people: new Set(), filings: new Set(), places: new Set(), offices: new Set(), parties: new Set() };
  for (const kind of Object.keys(known)) await mkdir(join(directory, 'content', kind), { recursive: true });
  async function add(kind, id, title, source, context) {
    const filename = `${createHash('sha256').update(id).digest('hex').slice(0, 32)}.json`;
    const changes = saved[kind][id] ?? {};
    validateChanges(kind, changes);
    const record = { id, title, record: { source, context, overrides: changes } };
    const relative = `content/${kind}/${filename}`;
    if (catalog.has(relative)) throw new Error(`Duplicate editor identity: ${id}`);
    catalog.set(relative, { kind, id, filename, title, source, context });
    known[kind].add(id);
    await atomicJson(join(directory, relative), record);
  }
  for (const person of people) {
    const baseline = { ...person, filings: person.filings.map(filing => ({ ...originals.get(filing.recordId), personId: filing.personId })) };
    await add('people', person.id, person.name, importedProfile(baseline, profiles), {
      personPath: `/people/${person.id}/`,
      filings: person.filings.map(filing => `${filing.year} · ${filing.officeName} · ${filing.recordId}`)
    });
  }
  for (const filing of importedFilings) await add('filings', filing.recordId,
    `${filing.year} · ${filing.name} · ${filing.officeName}${filing.county ? ` · ${filing.county}` : ''}`, filing, {
      source: filing.source, identity: filing.recordId
    });
  for (const place of places) await add('places', place.id, `${place.name} · ${place.type} · ${place.county}`, { ...importedPlaceSocial(placeEntityLinks(placeProfiles[place.id], placeLinks[place.id]?.links ?? [])), contact: placeLinks[place.id]?.contact ?? placeProfiles[place.id]?.contact ?? {} }, {
    placePath: `/places/${place.id}/`, identity: place.id, type: place.type, county: place.county
  });
  for (const [kind, entities, profiles] of [['offices', offices, officeProfiles], ['parties', parties, partyProfiles]]) {
    for (const entity of entities) await add(kind, entity.id, entity.name, { contact: profiles[entity.id]?.contact ?? {} }, { entityPath: `/${kind}/${entity.id}/`, identity: entity.id });
  }
  for (const kind of Object.keys(known)) {
    for (const name of await readdir(join(directory, 'content', kind))) {
      if (name.endsWith('.json') && !catalog.has(`content/${kind}/${name}`)) await unlink(join(directory, 'content', kind, name));
    }
  }
  const orphans = Object.entries(known).flatMap(([kind, ids]) => Object.keys(saved[kind]).filter(id => !ids.has(id)).map(id => `${kind}/${id}`));
  // Old source identities must be reviewed, never silently reassigned or discarded.
  if (orphans.length) console.warn('Overrides without a current source record (preserved):', orphans);
  return { catalog, editorFields, validateChanges, counts: { people: people.length, filings: importedFilings.length, places: places.length, offices: offices.length, parties: parties.length }, orphans, directory: resolve(directory) };
}

/** Read only the permitted override paths; snapshots and identities are never writable input. */
export function validateRecord(record, entry, validateChanges) {
  if (record.id !== entry.id || record.title !== entry.title) throw new Error('Record identity is locked');
  validateChanges(entry.kind, record.record?.overrides);
  return record.record.overrides;
}

export async function syncRecord(relative, state, destination = overridesPath) {
  const entry = state.catalog.get(relative);
  if (!entry) throw new Error(`Unknown editor record: ${relative}`);
  const record = await readJson(join(state.directory, relative));
  const changes = validateRecord(record, entry, state.validateChanges);
  const saved = await readJson(destination);
  saved[entry.kind] ??= {};
  if (Object.keys(changes).length) saved[entry.kind][entry.id] = changes;
  else delete saved[entry.kind][entry.id];
  await atomicJson(destination, saved);
  return entry.title;
}
