import overrides from '../data/editor-overrides.json';
import { entityImageFor, type EntityImage } from './entity-images';
export type PlaceImage = EntityImage;

/** An explicit clear suppresses the county fallback as well as the place photo. */
export function placeImageFor(place: { id: string; parentId: string } | undefined): PlaceImage | undefined {
  if (!place) return undefined;
  const changes = (overrides.places as Record<string, Record<string, unknown>>)?.[place.id];
  if (changes?.['photo.src'] === '') return undefined;
  return entityImageFor('places', place.id) ?? entityImageFor('places', place.parentId);
}
export function hasOwnPlaceImage(id: string): boolean {
  return !!entityImageFor('places', id);
}
