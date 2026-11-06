import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicJson, root, overridesPath, readJson } from './workspace.mjs';

export const schemaPath = join(root, 'src/data/editor-schema.json');
export const collectionLabels = { people: 'People', filings: 'Filings', places: 'Places', offices: 'Offices', parties: 'Parties' };
const revision = text => createHash('sha256').update(text).digest('hex');
const relationships = {
  people: ['People → filing records (one to many)', 'Filing → office, party, and places'],
  filings: ['Filing → person and optional running mate', 'Filing → office, party, places, and election year'],
  places: ['City → parent county', 'Place → children, offices, and filings'],
  offices: ['Office → filings and places'],
  parties: ['Party → filings']
};
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

export async function inspectSchema(server, state, path = schemaPath) {
  const raw = await readFile(path, 'utf8');
  const settings = JSON.parse(raw);
  const { baseEditorFields } = await server.ssrLoadModule('/src/lib/editorial.ts');
  const { configureFields } = await server.ssrLoadModule('/src/lib/editor-schema.ts');
  const fields = configureFields(baseEditorFields, settings);
  return {
    revision: revision(raw), settings,
    collections: Object.entries(fields).map(([kind, fields]) => ({
      kind, label: settings.collections[kind]?.label ?? collectionLabels[kind], defaultLabel: collectionLabels[kind],
      count: state.counts[kind], fields: fields.map(field => ({ ...field, type: field.options ? 'select' : field.type ?? 'string' })),
      defaults: baseEditorFields[kind], relationships: relationships[kind],
      storage: `src/data/editor-overrides.json → ${kind}`, identity: 'Stable record ID (read only)',
      editableScope: 'Fields exposed in the editor; computed entity properties and imported fields remain defined in code.'
    }))
  };
}

export async function saveSchema(server, state, input, path = schemaPath, savedPath = overridesPath) {
  const raw = await readFile(path, 'utf8');
  if (input.revision !== revision(raw)) throw new Error('Schema changed in another session. Reload before saving.');
  const { baseEditorFields, validateChanges } = await server.ssrLoadModule('/src/lib/editorial.ts');
  const { configureFields } = await server.ssrLoadModule('/src/lib/editor-schema.ts');
  const fields = configureFields(baseEditorFields, input.settings);
  const saved = await readJson(savedPath);
  // Reject option removals that would make existing data impossible to edit or build.
  for (const [kind, values] of Object.entries(fields)) {
    for (const changes of Object.values(saved[kind] ?? {})) validateChanges(kind, changes, fields);
    for (const entry of state.catalog.values()) {
      if (entry.kind !== kind) continue;
      for (const field of values) {
        const value = get(entry.source, field.path);
        if (field.options && value && !field.options.includes(value)) throw new Error(`${kind}.${field.path}: option “${value}” is in use by imported records and cannot be removed`);
      }
    }
  }
  await atomicJson(path, input.settings);
  state.editorFields = fields;
  state.validateChanges = (kind, changes) => validateChanges(kind, changes, fields);
  return inspectSchema(server, state, path);
}
