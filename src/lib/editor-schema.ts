export type SchemaField = { path: string; label: string; type?: string; options?: string[] };
export type SchemaSettings = {
  version: number;
  collections: Record<string, { label?: string; fields?: { path: string; label: string; options?: string[] }[] }>;
};

/** Schema settings can change presentation and select values, never storage paths or types. */
export function configureFields<T extends Record<string, SchemaField[]>>(base: T, settings: SchemaSettings): T {
  if (!settings || settings.version !== 1 || !settings.collections || typeof settings.collections !== 'object' || Array.isArray(settings.collections)) throw new Error('Invalid schema settings');
  if (Object.keys(settings).some(key => !['version', 'collections'].includes(key))) throw new Error('Unknown schema setting');
  const result = structuredClone(base);
  for (const [kind, collection] of Object.entries(settings.collections)) {
    if (!Object.hasOwn(base, kind)) throw new Error(`Unknown collection: ${kind}`);
    if (!collection || typeof collection !== 'object' || Object.keys(collection).some(key => !['label', 'fields'].includes(key))) throw new Error(`Invalid settings for ${kind}`);
    if (collection.label !== undefined && (typeof collection.label !== 'string' || !collection.label.trim() || collection.label.length > 100)) throw new Error('Collection labels need 1–100 characters');
    if (collection.fields === undefined) continue;
    if (!Array.isArray(collection.fields) || new Set(collection.fields.map(field => field.path)).size !== collection.fields.length) throw new Error(`${kind} must retain every field exactly once`);
    const fields = collection.fields.map(field => {
      const original = base[kind].find(item => item.path === field.path);
      if (!original || Object.keys(field).some(key => !['path', 'label', 'options'].includes(key))) throw new Error(`Field paths and types cannot be changed: ${field.path}`);
      if (typeof field.label !== 'string' || !field.label.trim() || field.label.length > 160) throw new Error('Field labels need 1–160 characters');
      if (field.options !== undefined && (!original.options || !Array.isArray(field.options) || !field.options.length || field.options.some(value => typeof value !== 'string' || !value.trim() || value.length > 100) || new Set(field.options).size !== field.options.length)) throw new Error(`Invalid select options for ${field.path}`);
      return { ...original, label: field.label.trim(), ...(field.options ? { options: [...field.options] } : {}) };
    });
    // New code-defined fields remain available when saved presentation settings predate them.
    const configured = new Set(fields.map(field => field.path));
    result[kind as keyof T] = [...fields, ...base[kind].filter(field => !configured.has(field.path))] as T[keyof T];
  }
  return result;
}
