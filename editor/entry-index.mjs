import { createHash } from 'node:crypto';

// Collection lists only display/search the title. Fetch full data with getEntry
// when a record is opened, rather than shipping every entity snapshot up front.
const indexes = new WeakMap();
export function collectionIndex(state, params) {
  const kind = params?.folder?.match(/^content\/(people|filings|places|offices|parties)$/)?.[1];
  if (!kind || params.extension !== 'json') throw new Error('Unknown editor collection');
  let cached = indexes.get(state);
  if (!cached) { cached = new Map(); indexes.set(state, cached); }
  if (!cached.has(kind)) {
    const entries = [...state.catalog].filter(([, entry]) => entry.kind === kind).map(([path, entry]) => {
      const data = JSON.stringify({ id: entry.id, title: entry.title });
      return { data, file: { path, id: createHash('sha256').update(data).digest('hex') } };
    });
    cached.set(kind, JSON.stringify(entries));
  }
  return cached.get(kind);
}
export function invalidateCollectionIndex(state, kind) {
  indexes.get(state)?.delete(kind);
}
