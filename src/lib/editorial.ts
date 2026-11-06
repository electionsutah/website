import saved from '../data/editor-overrides.json';
import type { Contact, Filing, Person } from './entities';
import type { ContactAddress } from './contact-addresses';

export type Resource = { label: string; description: string; url: string };
export type PersonProfile = {
  sourceUrl: string; lastVerified: string; biography: string; priorities: string[];
  contact: Partial<Contact>; resources: Resource[];
};
export type Field = { path: string; label: string; type?: string; options?: string[] };
export type Changes = Record<string, string | string[] | Resource[] | ContactAddress[]>;
export type EditorialData = { version: number; people: Record<string, Changes>; filings: Record<string, Changes> };
export const editorialData = saved as EditorialData;
const contactFields: Field[] = [
  ...['website', 'facebook', 'instagram', 'twitter', 'bluesky'].map(key => ({ path: `contact.${key}`, label: key === 'twitter' ? 'X / Twitter' : key, type: 'url' })),
  ...['phone', 'email'].map(key => ({ path: `contact.${key}`, label: key })),
  { path: 'contact.address', label: 'Addresses', type: 'addresses' }
];
export const editorFields: Record<'people' | 'filings', Field[]> = {
  people: [
    { path: 'biography', label: 'Biography', type: 'text' },
    { path: 'priorities', label: 'Priorities (one per line)', type: 'lines' },
    { path: 'resources', label: 'Resources (JSON array of label, description, url)', type: 'resources' },
    { path: 'sourceUrl', label: 'Profile source URL', type: 'url' },
    { path: 'lastVerified', label: 'Profile verification date', type: 'date' }, ...contactFields
  ],
  filings: [
    { path: 'status', label: 'Normalized status', options: ['filed', 'primary_election', 'general_election', 'elected', 'defeated', 'withdrew', 'disqualified'] },
    { path: 'sourceStatus', label: 'Displayed source status' },
    { path: 'electionType', label: 'Election type', options: ['primary', 'general', 'special'] },
    { path: 'city', label: 'City' }, { path: 'county', label: 'County' }, { path: 'state', label: 'State' },
    { path: 'source', label: 'Filing source URL', type: 'url' },
    { path: 'lastUpdated', label: 'Filing update date', type: 'date' }, ...contactFields
  ]
};

export function validateChanges(kind: 'people' | 'filings', changes: Changes): void {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Overrides must be an object');
  for (const [path, value] of Object.entries(changes)) {
    const field = editorFields[kind].find(field => field.path === path);
    if (!field) throw new Error(`Unsupported ${kind} field: ${path}`);
    if (field.type === 'addresses') {
      if (typeof value !== 'string' && (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || typeof (item as ContactAddress).label !== 'string' || typeof (item as ContactAddress).value !== 'string' || !(item as ContactAddress).value.trim()))) throw new Error('Addresses need a label and a nonempty address value');
    } else if (field.type === 'lines') {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error(`${path} must be a list of strings`);
    } else if (field.type === 'resources') {
      if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || !['label', 'description', 'url'].every(key => typeof (item as Resource)[key as keyof Resource] === 'string') || !safeUrl((item as Resource).url))) throw new Error('Resources need a label, description, and http(s) URL');
    } else {
      if (typeof value !== 'string') throw new Error(`${path} must be text`);
      if (value && field.type === 'url' && !safeUrl(value)) throw new Error(`${path} needs an http(s) URL`);
      if (value && field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`${path} needs a valid YYYY-MM-DD date`);
      if (value && field.options && !field.options.includes(value)) throw new Error(`Unsupported ${path}: ${value}`);
    }
  }
}

function safeUrl(value: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

/** Only explicit fields replace the source; an empty value intentionally clears a field. */
export function applyChanges<T extends object>(source: T, changes: Changes = {}): T {
  const result = structuredClone(source) as Record<string, unknown>;
  for (const [path, value] of Object.entries(changes)) {
    const [parent, child] = path.split('.');
    if (child) result[parent] = { ...(result[parent] as object ?? {}), [child]: structuredClone(value) };
    else result[parent] = structuredClone(value);
  }
  return result as T;
}

export function applyFilingChanges(filing: Filing, changes: Changes = {}): Filing {
  validateChanges('filings', changes);
  const result = applyChanges(filing, changes);
  // Geography is derived from the corrected location before the entity maps are assembled.
  if ('city' in changes || 'county' in changes) {
    const slug = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    result.placeIds = result.county ? [slug(result.county), ...(result.city ? [`${slug(result.county)}/${slug(result.city)}`] : [])] : [];
  }
  return result;
}

export function importedProfile(person: Person, profiles: Record<string, PersonProfile>): PersonProfile {
  const contact = person.filings.find(filing => filing.personId === person.id && filing.contact && Object.values(filing.contact).some(Boolean))?.contact ?? {};
  return profiles[person.id] ?? { biography: '', priorities: [], resources: [], sourceUrl: '', lastVerified: '', contact };
}

export function profileFor(person: Person, profiles: Record<string, PersonProfile>): PersonProfile | undefined {
  const changes = editorialData.people[person.id];
  if (!changes && !profiles[person.id]) return undefined;
  if (changes) validateChanges('people', changes);
  return applyChanges(importedProfile(person, profiles), changes);
}
