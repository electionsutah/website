import saved from '../data/editor-overrides.json';
import schemaSettings from '../data/editor-schema.json';
import { configureFields } from './editor-schema';
import type { Contact, Filing, Person } from './entities';
import type { ContactAddress } from './contact-addresses';
import { resolveEntityLinks, type EntityLink } from './entity-links';
import { structuralPaths } from './editor-structure';

export type Resource = { label: string; description: string; url: string };
export type PersonProfile = {
  sourceUrl: string; lastVerified: string; biography: string; priorities: string[];
  contact: Partial<Contact>; resources: Resource[];
};
export type Field = { path: string; label: string; type?: string; options?: string[]; relation?: EntityKind | 'counties' | 'elections' };
export type Changes = Record<string, string | number | boolean | null | string[] | Resource[] | ContactAddress[] | EntityLink[]>;
export type EditorialData = { version: number; people: Record<string, Changes>; filings: Record<string, Changes>; places?: Record<string, Changes>; offices?: Record<string, Changes>; parties?: Record<string, Changes> };
export type EntityKind = 'people' | 'filings' | 'places' | 'offices' | 'parties';
export const editorialData = saved as EditorialData;
const contactFields: Field[] = [
  ...['website', 'facebook', 'instagram', 'twitter', 'bluesky', 'youtube', 'linkedin', 'threads', 'tiktok', 'mastodon', 'truthsocial', 'rumble', 'substack'].map(key => ({ path: `contact.${key}`, label: `Campaign ${key === 'twitter' ? 'X / Twitter' : key}`, type: 'url' })),
  ...['phone', 'email'].map(key => ({ path: `contact.${key}`, label: key })),
  { path: 'contact.address', label: 'Addresses', type: 'addresses' }
];
export const placeSocialPlatforms = ['facebook', 'instagram', 'x', 'bluesky', 'youtube', 'linkedin', 'threads', 'tiktok', 'mastodon', 'truthsocial', 'rumble', 'substack'] as const;
export const entityLinkPlatforms = ['website', 'wikipedia', 'wikidata', ...placeSocialPlatforms] as const;
const linkFields: Field[] = [
  ...entityLinkPlatforms.map(platform => ({ path: platform, label: `Directory ${platform === 'x' ? 'X / Twitter' : platform}`, type: 'url' })),
  { path: 'links', label: 'Directory link records', type: 'links' }
];
const entityContactFields: Field[] = [
  { path: 'contact.email', label: 'Email', type: 'email' },
  { path: 'contact.phone', label: 'Phone' },
  { path: 'contact.address', label: 'Addresses', type: 'addresses' }
];
const profileFields: Field[] = [
  { path: 'profile.description', label: 'Description', type: 'text' },
  { path: 'profile.sources', label: 'Description sources', type: 'links' }
];
const imageFields = (slot: string, label: string): Field[] => [
  { path: `${slot}.src`, label, type: 'image' },
  ...[['title', 'Image title'], ['artist', 'Creator / credit'], ['license', 'License'], ['licenseUrl', 'License URL'], ['sourceUrl', 'Image source URL']].map(([key, name]) => ({ path: `${slot}.${key}`, label: `${label}: ${name}`, type: key.endsWith('Url') ? 'url' : undefined }))
];
export const baseEditorFields: Record<EntityKind, Field[]> = {
  offices: [{ path: 'name', label: 'Office name' }, ...imageFields('photo', 'Office photo'), { path: 'placeIds', label: 'Associated place IDs (one per line)', type: 'lines', relation: 'places' }, ...profileFields, ...entityContactFields, ...linkFields, { path: 'resources', label: 'Office resources', type: 'resources' }],
  parties: [{ path: 'name', label: 'Party name' }, ...profileFields, { path: 'shortName', label: 'Short name' }, { path: 'color', label: 'Party color', type: 'color' }, { path: 'logo', label: 'Party logo', type: 'image' }, { path: 'recognized', label: 'Recognized party', type: 'boolean' }, { path: 'historical', label: 'Historical party', type: 'boolean' }, ...entityContactFields, ...linkFields],
  places: [
    { path: 'name', label: 'Place name' }, ...imageFields('photo', 'Place photo'), ...imageFields('emblem', 'Seal, logo, or flag'),
    { path: 'emblem.kind', label: 'Emblem type', options: ['seal', 'logo', 'flag', 'emblem'] },
    { path: 'parentId', label: 'Parent county', relation: 'counties' },
    { path: 'description', label: 'Directory description', type: 'text' },
    { path: 'profile.summary', label: 'Profile summary', type: 'text' },
    ...['wikipediaTitle', 'wikidataId', 'populationAsOf', 'populationSource', 'inceptionDate'].map(key => ({ path: `profile.${key}`, label: key })),
    { path: 'profile.populationSourceUrl', label: 'Population source URL', type: 'url' },
    { path: 'profile.population', label: 'Population', type: 'number' },
    { path: 'profile.inceptionPrecision', label: 'Inception precision', type: 'number' },
    ...entityContactFields, ...linkFields
  ],
  people: [
    { path: 'name', label: 'Person name' }, ...imageFields('photo', 'Portrait'),
    { path: 'biography', label: 'Biography', type: 'text' },
    { path: 'priorities', label: 'Priorities (one per line)', type: 'lines' },
    { path: 'resources', label: 'Resources', type: 'resources' },
    { path: 'sourceUrl', label: 'Profile source URL', type: 'url' },
    { path: 'lastVerified', label: 'Profile verification date', type: 'date' }, ...entityContactFields,
    { path: 'links', label: 'Websites and social accounts', type: 'links' }
  ],
  filings: [
    { path: 'year', label: 'Election year', type: 'number', relation: 'elections' },
    { path: 'personId', label: 'Candidate', relation: 'people' },
    { path: 'runningMateId', label: 'Running mate', relation: 'people' },
    { path: 'officeId', label: 'Office', relation: 'offices' },
    { path: 'partyId', label: 'Party', relation: 'parties' },
    { path: 'placeId', label: 'Place', relation: 'places' },
    { path: 'status', label: 'Normalized status', options: ['filed', 'primary_election', 'general_election', 'elected', 'defeated', 'withdrew', 'disqualified'] },
    { path: 'sourceStatus', label: 'Displayed source status' },
    { path: 'electionType', label: 'Election type', options: ['primary', 'presidential-primary', 'general', 'special'] },
    { path: 'city', label: 'City' }, { path: 'county', label: 'County' }, { path: 'state', label: 'State' },
    { path: 'source', label: 'Filing source URL', type: 'url' },
    { path: 'lastUpdated', label: 'Filing update date', type: 'date' }, ...contactFields
  ]
};
export const editorFields = configureFields(baseEditorFields, schemaSettings);

export function validateChanges(kind: EntityKind, changes: Changes, fields = editorFields): void {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Overrides must be an object');
  for (const [path, value] of Object.entries(changes)) {
    const field = fields[kind].find(field => field.path === path);
    if (!field) throw new Error(`Unsupported ${kind} field: ${path}`);
    if (field.type === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`${path} must be true or false`);
    } else if (field.type === 'number') {
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error(`${path} must be a nonnegative number or null`);
    } else if (field.type === 'links') {
      if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || !safeUrl((item as EntityLink).url) || ((item as EntityLink).platform !== undefined && !(entityLinkPlatforms as readonly string[]).includes((item as EntityLink).platform!)) || ['label', 'detail', 'source', 'verifiedOn'].some(key => key in item && typeof (item as Record<string, unknown>)[key] !== 'string'))) throw new Error('Links need an http(s) URL and optional platform, label, detail, source, and verifiedOn text');
    } else if (field.type === 'addresses') {
      if (typeof value !== 'string' && (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || typeof (item as ContactAddress).label !== 'string' || typeof (item as ContactAddress).value !== 'string' || !(item as ContactAddress).value.trim()))) throw new Error('Addresses need a label and a nonempty address value');
    } else if (field.type === 'lines') {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error(`${path} must be a list of strings`);
    } else if (field.type === 'resources') {
      if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || !['label', 'description', 'url'].every(key => typeof (item as Resource)[key as keyof Resource] === 'string') || !safeUrl((item as Resource).url))) throw new Error('Resources need a label, description, and http(s) URL');
    } else {
      if (typeof value !== 'string') throw new Error(`${path} must be text`);
      if (field.type === 'color' && value && !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${path} must be a six-digit hex color`);
      if (['asset', 'image'].includes(field.type ?? '') && value && !safeUrl(value) && !/^\/(?!\/)[^\s]*$/.test(value)) throw new Error(`${path} needs an http(s) URL or local asset path`);
      if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`${path} needs an email address`);
      if (value && field.type === 'url' && !safeUrl(value)) throw new Error(`${path} needs an http(s) URL`);
      if (value && field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`${path} needs a valid YYYY-MM-DD date`);
      if (value && field.options && !field.options.includes(value)) throw new Error(`Unsupported ${path}: ${value}`);
    }
  }
}

/** Fold current profile/contact imports into the person's one canonical link list. */
export function importedPersonLinks(person: Person, profiles: Record<string, PersonProfile>, links: EntityLink[] = []): EntityLink[] {
  const contact = importedProfile(person, profiles).contact;
  const combined = [...links, ...contactFields.filter(field => field.type === 'url').flatMap(field => {
    const key = field.path.slice('contact.'.length);
    const url = contact[key as keyof Contact];
    return typeof url === 'string' && url ? [{ url, platform: (key === 'twitter' ? 'x' : key) as EntityLink['platform'] }] : [];
  })];
  const seen = new Set<string>();
  return combined.filter(link => {
    const key = resolveEntityLinks([link])[0]?.url ?? link.url;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

/** Compatibility migration: preserve old manual platform edits, including explicit clears. */
export function migratePersonLinks(changes: Changes = {}, source: EntityLink[] = []): Changes {
  const legacy = Object.entries(changes).filter(([path]) => path !== 'links' && (
    (entityLinkPlatforms as readonly string[]).includes(path) || contactFields.some(field => field.type === 'url' && field.path === path)));
  if (!legacy.length) return changes;
  let links = (changes.links as EntityLink[] | undefined) ?? source;
  // Old directory overrides win over old contact overrides when both specify a platform.
  legacy.sort(([a], [b]) => Number(!a.startsWith('contact.')) - Number(!b.startsWith('contact.')));
  for (const [path, value] of legacy) {
    const key = path.replace(/^contact\./, '');
    const platform = key === 'twitter' ? 'x' : key;
    links = links.filter(link => resolveEntityLinks([link])[0]?.platform !== platform);
    if (value) links = [...links, { url: value as string, platform: platform as EntityLink['platform'] }];
  }
  const removed = new Set(legacy.map(([path]) => path));
  return { ...Object.fromEntries(Object.entries(changes).filter(([path]) => !removed.has(path))), links };
}

export function importedPlaceSocial(links: EntityLink[]): Record<string, string> {
  const resolved = resolveEntityLinks(links);
  return Object.fromEntries(placeSocialPlatforms.map(platform => [platform, resolved.find(link => link.platform === platform)?.url ?? '']));
}

export function importedEntityLinks(links: EntityLink[]): Record<string, string | EntityLink[]> {
  const resolved = resolveEntityLinks(links);
  return { links, ...Object.fromEntries(entityLinkPlatforms.map(platform => [platform, resolved.find(link => link.platform === platform)?.url ?? ''])) };
}

export function applyEntityLinks(kind: EntityKind, links: EntityLink[], changes: Changes = {}): EntityLink[] {
  validateChanges(kind, changes);
  const source = changes.links as EntityLink[] | undefined ?? links;
  const edits = Object.entries(changes).filter(([key]) => (entityLinkPlatforms as readonly string[]).includes(key));
  const overridden = new Set(edits.map(([key]) => key));
  return [
    ...source.filter(link => !overridden.has(resolveEntityLinks([link])[0]?.platform ?? '')),
    ...edits.flatMap(([platform, value]) => value ? [{ platform: platform as EntityLink['platform'], url: value as string }] : [])
  ];
}

export function applyPlaceSocial(links: EntityLink[], changes: Changes = {}): EntityLink[] {
  return applyEntityLinks('places', links, changes);
}

export function entityContact(kind: 'offices' | 'parties' | 'places', source: Partial<Contact> = {}, changes: Changes = {}): Partial<Contact> {
  validateChanges(kind, changes);
  const contactChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => key.startsWith('contact.')));
  return applyChanges({ contact: source }, contactChanges).contact;
}

export function editorProfileFor<T extends object>(kind: 'offices' | 'parties' | 'places', id: string, source: T, changes = editorialData[kind]?.[id] ?? {}): T {
  validateChanges(kind, changes);
  const profileChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => key.startsWith('profile.')));
  const result = applyChanges({ profile: source }, profileChanges).profile;
  if (kind === 'places') {
    for (const [key, target] of [['website', 'officialWebsite'], ['wikipedia', 'wikipediaUrl'], ['wikidata', 'wikidataUrl']]) {
      if (changes[key] !== undefined) Object.assign(result, { [target]: changes[key] });
    }
  }
  return result;
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
  const result = applyChanges(filing, Object.fromEntries(Object.entries(changes).filter(([key]) => !structuralPaths.includes(key))));
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
  const profileChanges = Object.fromEntries(Object.entries(changes ?? {}).filter(([path]) => !contactFields.some(field => field.type === 'url' && field.path === path) && !(entityLinkPlatforms as readonly string[]).includes(path)));
  validateChanges('people', profileChanges);
  return applyChanges(importedProfile(person, profiles), profileChanges);
}
