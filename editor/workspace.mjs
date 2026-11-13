import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invalidateCollectionIndex } from './entry-index.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const workspace = join(root, 'editor/.workspace');
export const overridesPath = join(root, 'src/data/editor-overrides.json');
export const json = value => `${JSON.stringify(value, null, 2)}\n`;
export const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
export function filingRecordLabel(filing) {
  if (filing.status === 'filed') return 'Declaration of candidacy';
  if (['withdrew', 'disqualified', 'deceased'].includes(filing.status)) return 'Candidacy status record';
  return ({ general: 'General-election result record', primary: 'Primary-election result record', 'presidential-primary': 'Presidential-primary result record' })[filing.electionType] ?? 'Election source record';
}
// A document navigation remounts Decap's editor; hash-only entry-to-entry
// navigation reuses its mounted draft and can leave the previous form visible.
const editorUrl = (kind, id) => {
  const slug = createHash('sha256').update(id).digest('hex').slice(0, 32);
  return `?entry=${kind}-${slug}#/collections/${kind}/entries/${slug}`;
};
const filingEditorUrl = id => editorUrl('filings', id);
const personEditorUrl = id => editorUrl('people', id);

export async function atomicJson(path, value) {
  const text = json(value);
  if (await readFile(path, 'utf8').catch(() => null) === text) return;
  const temporary = `${path}.tmp`;
  await writeFile(temporary, text);
  await rename(temporary, path);
}

export async function prepare(server, directory = workspace, saved = null) {
  const { importedFilings, people, places, offices, parties, placesById, officeResources, importedPartyProperties, importedPlaceDescriptions, importedEntityStructure } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { importedProfile, importedEntityLinks, importedPersonLinks, migratePersonLinks, validateChanges, editorFields } = await server.ssrLoadModule('/src/lib/editorial.ts');
  const { validateStructure } = await server.ssrLoadModule('/src/lib/editor-structure.ts');
  const { candidacyHistory } = await server.ssrLoadModule('/src/lib/candidacy-history.ts');
  const relatedRecords = new Map();
  const filingPeople = new Map();
  for (const person of people) for (const filing of person.filings) {
    const links = filingPeople.get(filing.recordId) ?? [];
    links.push({ id: person.id, name: person.name, role: filing.personId === person.id ? 'Candidate' : 'Running mate', editorUrl: personEditorUrl(person.id) });
    filingPeople.set(filing.recordId, links);
  }
  for (const person of people) for (const history of candidacyHistory(person.filings)) {
    const records = history.records.map(filing => ({ recordId: filing.recordId, label: filingRecordLabel(filing), status: filing.sourceStatus, source: filing.source, editorUrl: filingEditorUrl(filing.recordId) }));
    for (const filing of history.records) relatedRecords.set(filing.recordId, records);
  }
  const references = Object.fromEntries(['people', 'offices', 'parties', 'places'].map(kind => [kind, ({people, offices, parties, places})[kind].map(row => ({ id: row.id, label: row.name }))]));
  references.elections = [...new Set(importedFilings.map(row => row.year))].sort((a,b) => b-a).map(year => ({ id: String(year), label: String(year) }));
  references.counties = places.filter(row => row.type === 'County').map(row => ({ id: row.id, label: row.name }));
  const validateReferences = (kind, changes) => {
    if ('name' in changes && !changes.name.trim()) throw new Error('Entity names cannot be empty');
    for (const field of editorFields[kind]) if (field.relation && field.path in changes) {
      const values = Array.isArray(changes[field.path]) ? changes[field.path] : [changes[field.path]];
      for (const id of values) if (id && !references[field.relation].some(row => row.id === String(id))) throw new Error(`Unknown ${field.relation} reference: ${id}`);
      if (['personId', 'officeId', 'partyId', 'parentId', 'year'].includes(field.path) && !changes[field.path]) throw new Error(`${field.label} cannot be empty`);
    }
  };
  const validateEditorChanges = (kind, changes) => { validateChanges(kind, changes); validateReferences(kind, changes); };
  const { importedOfficeProfile, importedPartyProfile } = await server.ssrLoadModule('/src/lib/entity-profiles.ts');
  const { importedEntityImage, entityImageFor } = await server.ssrLoadModule('/src/lib/entity-images.ts');
  const { placeImageFor } = await server.ssrLoadModule('/src/lib/place-images.ts');
  const { placeEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  const placeProfiles = await readJson(join(root, 'src/data/place-enrichment.json'));
  const placeLinks = await readJson(join(root, 'src/data/place-link-enrichment.json'));
  const officeProfiles = await readJson(join(root, 'src/data/office-enrichment.json'));
  const partyProfiles = await readJson(join(root, 'src/data/party-enrichment.json'));
  const personLinks = await readJson(join(root, 'src/data/person-link-enrichment.json'));
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
    validateEditorChanges(kind, changes);
    const record = { id, title, record: { source, context, overrides: changes } };
    const relative = `content/${kind}/${filename}`;
    if (catalog.has(relative)) throw new Error(`Duplicate editor identity: ${id}`);
    catalog.set(relative, { kind, id, filename, title, source, context });
    known[kind].add(id);
    await atomicJson(join(directory, relative), record);
  }
  const snapshot = entity => Object.fromEntries(Object.entries(entity).map(([key, value]) => [key, ['filings', 'offices', 'children'].includes(key) && Array.isArray(value) ? value.map(item => item.recordId ?? item.id) : value]));
  for (const person of people) {
    const baseline = { ...person, filings: importedEntityStructure.filings.filter(row => row.personId === person.id || row.runningMateId === person.id).map(row => ({ ...originals.get(row.id), personId: row.personId, runningMateId: row.runningMateId })) };
    baseline.filings.sort((a, b) => b.year - a.year || a.officeName.localeCompare(b.officeName));
    const sourceLinks = importedPersonLinks(baseline, profiles, personLinks[person.id]?.links ?? []);
    if (saved.people[person.id]) saved.people[person.id] = migratePersonLinks(saved.people[person.id], sourceLinks);
    await add('people', person.id, person.name, { name: importedEntityStructure.people.find(row => row.id === person.id)?.name, ...importedProfile(baseline, profiles), photo: importedEntityImage('people', person.id) ?? {}, links: sourceLinks }, {
      entity: snapshot(person),
      personPath: `/people/${person.id}/`,
      connectedFilings: person.filings.map(filing => ({ recordId: filing.recordId, label: `${filing.year} · ${filing.officeName} · ${filingRecordLabel(filing)}`, editorUrl: filingEditorUrl(filing.recordId) })),
      filings: person.filings.map(filing => `${filing.year} · ${filing.officeName} · ${filing.recordId}`)
    });
  }
  for (const filing of importedFilings) await add('filings', filing.recordId,
    `${filing.year} · ${filing.name} · ${filing.officeName} · ${filingRecordLabel(filing)}${filing.county ? ` · ${filing.county}` : ''}`, { ...filing, ...importedEntityStructure.filings.find(row => row.id === filing.recordId), placeId: filing.placeIds.at(-1) ?? '' }, {
      entity: snapshot(filing), source: filing.source, identity: filing.recordId,
      recordType: filingRecordLabel(filing), relatedRecords: relatedRecords.get(filing.recordId) ?? [],
      connectedPeople: filingPeople.get(filing.recordId) ?? []
    });
  for (const place of places) await add('places', place.id, `${place.name} · ${place.type} · ${place.county}`, { ...importedEntityStructure.places.find(row => row.id === place.id), ...importedEntityLinks(placeEntityLinks(placeProfiles[place.id], placeLinks[place.id]?.links ?? [])), photo: importedEntityImage('places', place.id) ?? entityImageFor('places', place.parentId) ?? {}, emblem: importedEntityImage('places', place.id, 'emblem') ?? {}, contact: placeLinks[place.id]?.contact ?? placeProfiles[place.id]?.contact ?? {}, profile: placeProfiles[place.id] ?? {}, description: importedPlaceDescriptions[place.id] }, {
    entity: snapshot(place), placePath: `/places/${place.id}/`, identity: place.id, type: place.type, county: place.county
  });
  for (const [kind, entities, profiles] of [['offices', offices, officeProfiles], ['parties', parties, partyProfiles]]) {
    for (const entity of entities) await add(kind, entity.id, entity.name, { ...importedEntityStructure[kind].find(row => row.id === entity.id), ...(kind === 'offices' ? { placeIds: entity.placeIds, photo: (() => { const locations = entity.placeIds.map(id => placesById.get(id)).filter(place => place && (entity.sections.includes('Municipal office') ? place.type !== 'County' : entity.sections.includes('County office') && place.type === 'County')); return locations.length === 1 ? placeImageFor({ id: locations[0].id, parentId: '' }) ?? {} : {}; })() } : {}), contact: profiles[entity.id]?.contact ?? {}, ...importedEntityLinks(profiles[entity.id]?.links ?? (entity.website ? [{ url: entity.website }] : [])), ...(kind === 'offices' ? { resources: officeResources(importedEntityStructure.offices.find(row => row.id === entity.id)?.name ?? entity.name), profile: importedOfficeProfile(entity, placesById) } : { profile: importedPartyProfile(entity), ...importedPartyProperties[entity.id] }) }, { entity: snapshot(entity), entityPath: `/${kind}/${entity.id}/`, identity: entity.id });
  }
  for (const kind of Object.keys(known)) {
    for (const name of await readdir(join(directory, 'content', kind))) {
      if (name.endsWith('.json') && !catalog.has(`content/${kind}/${name}`)) await unlink(join(directory, 'content', kind, name));
    }
  }
  const orphans = Object.entries(known).flatMap(([kind, ids]) => Object.keys(saved[kind]).filter(id => !ids.has(id)).map(id => `${kind}/${id}`));
  // Old source identities must be reviewed, never silently reassigned or discarded.
  if (orphans.length) console.warn('Overrides without a current source record (preserved):', orphans);
  return { catalog, editorFields, validateChanges: validateEditorChanges, validateReferences, validateStructure: saved => validateStructure(importedEntityStructure, saved), references, counts: { people: people.length, filings: importedFilings.length, places: places.length, offices: offices.length, parties: parties.length }, orphans, directory: resolve(directory) };
}

/** Read only the permitted override paths; snapshots and identities are never writable input. */
export function validateRecord(record, entry, validateChanges) {
  if (record.id !== entry.id || typeof record.title !== 'string' || !record.title.trim()) throw new Error('Record identity is locked');
  validateChanges(entry.kind, record.record?.overrides);
  return record.record.overrides;
}

export async function syncRecord(relative, state, destination = overridesPath) {
  const entry = state.catalog.get(relative);
  if (!entry) throw new Error(`Unknown editor record: ${relative}`);
  const record = await readJson(join(state.directory, relative));
  const changes = { ...validateRecord(record, entry, state.validateChanges) };
  if (entry.kind === 'filings' && Object.keys(changes).some(path => path !== 'lastUpdated')) {
    const today = new Date();
    changes.lastUpdated = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  const saved = await readJson(destination);
  saved[entry.kind] ??= {};
  if (Object.keys(changes).length) saved[entry.kind][entry.id] = changes;
  else delete saved[entry.kind][entry.id];
  state.validateStructure?.(saved);
  await atomicJson(destination, saved);
  record.record.overrides = changes;
  await atomicJson(join(state.directory, relative), record);
  const displayName = entry.kind === 'filings' ? entry.title : changes.name ?? entry.source.name;
  if (typeof displayName === 'string') {
    entry.title = displayName;
    for (const reference of [state.references?.[entry.kind], ...(entry.kind === 'places' ? [state.references?.counties] : [])]) {
      const row = reference?.find(row => row.id === entry.id);
      if (row) row.label = displayName;
    }
  }
  invalidateCollectionIndex(state, entry.kind);
  return entry.title;
}
