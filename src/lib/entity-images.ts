import photos from '../data/person-photos.json';
import placePhotos from '../data/place-images.json';
import emblems from '../data/place-emblems.json';
import overrides from '../data/editor-overrides.json';

export type EntityImage = { src: string; title: string; artist: string; license: string; licenseUrl: string; sourceUrl: string; via?: string; kind?: string };
export type ImageKind = 'people' | 'offices' | 'places';
export const imageMetadataKeys = ['title', 'artist', 'license', 'licenseUrl', 'sourceUrl'] as const;
const data = { people: photos, places: placePhotos } as Record<string, Record<string, EntityImage>>;
export function importedEntityImage(kind: ImageKind, id: string, slot = 'photo'): EntityImage | undefined {
  return slot === 'emblem' ? (emblems as Record<string, EntityImage>)[id] : data[kind]?.[id];
}

/** Replacing an image does not carry the old image's attribution onto the new file. */
export function entityImageFor(kind: ImageKind, id: string, slot = 'photo', imported = importedEntityImage(kind, id, slot)): EntityImage | undefined {
  const changes = (overrides as unknown as Record<string, Record<string, Record<string, unknown>>>)[kind]?.[id] ?? {};
  const replacement = changes[`${slot}.src`];
  const src = replacement === undefined ? imported?.src : replacement as string;
  if (!src) return undefined;
  const image: EntityImage = replacement !== undefined && replacement !== imported?.src
    ? { src, title: '', artist: '', license: '', licenseUrl: '', sourceUrl: '' }
    : { title: '', artist: '', license: '', licenseUrl: '', sourceUrl: '', ...imported, src };
  for (const key of [...imageMetadataKeys, 'kind'] as const) {
    if (changes[`${slot}.${key}`] !== undefined) image[key] = changes[`${slot}.${key}`] as string;
  }
  return image;
}
export const personImageFor = (id: string) => entityImageFor('people', id);
export const placeEmblemFor = (id: string) => entityImageFor('places', id, 'emblem');
