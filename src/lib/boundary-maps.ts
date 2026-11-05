import maps from '../data/boundary-maps.json';
import type { Office, Place } from './entities';

/**
 * A generated boundary map in public/maps/ (see scripts/generate-boundary-maps.py).
 * bounds are Web Mercator world coordinates [west, north, east, south] for terrain tiles.
 */
export type BoundaryMap = { src: string; title: string; note: string; bounds: Bounds; width: number; height: number; locator: boolean };
type Bounds = [number, number, number, number];
type Entry = { title: string; bounds: Bounds; size: [number, number]; locator?: boolean };

const { state, ...index } = maps as unknown as { state: { bounds: Bounds; size: [number, number] } } & Record<string, Record<string, Entry>>;
/** Statewide outline for the locator inset (public/maps/utah.svg). */
export const utahOutline = { src: '/maps/utah.svg', bounds: state.bounds, width: state.size[0], height: state.size[1] };
const notes: Record<string, string> = {
  'state-house': 'District boundaries in effect 2022–2032.',
  'state-senate': 'District boundaries in effect 2022–2032.',
  'school-board': 'District boundaries in effect 2022–2032.',
  'us-house': 'District boundaries adopted for 2026–2032.',
  county: 'County boundary.',
  city: 'Municipal boundary.'
};
// Archive spellings that differ from the official municipality names.
const cityAliases: Record<string, string> = { milcreek: 'millcreek', apline: 'alpine', 'mt-pleasant': 'mount-pleasant', magna: 'magna-city' };

function find(layer: string, key: string): BoundaryMap | null {
  const entry = index[layer]?.[key];
  return entry ? { src: `/maps/${layer}/${key}.svg`, title: entry.title, note: notes[layer], bounds: entry.bounds, width: entry.size[0], height: entry.size[1], locator: !!entry.locator } : null;
}

export function placeMap(place: Place): BoundaryMap | null {
  const key = place.id.split('/').pop()!;
  return place.type === 'County' ? find('county', key) : find('city', cityAliases[key] ?? key);
}

const districtOffices: [RegExp, string][] = [
  [/^state-house-district-(\d+)/, 'state-house'],
  [/^state-senate-district-(\d+)/, 'state-senate'],
  [/^state-school-board-district-(\d+)/, 'school-board'],
  [/^u-s-house-district-(\d+)/, 'us-house']
];

export function officeMap(office: Office, placesById: Map<string, Place>): BoundaryMap | null {
  for (const [pattern, layer] of districtOffices) {
    const match = office.id.match(pattern);
    if (match) return find(layer, match[1]);
  }
  // Citywide seats (mayor, at-large council) cover the whole municipality; council districts do not.
  const cities = office.placeIds.map((id) => placesById.get(id)).filter((place) => place?.type === 'City');
  if (cities.length === 1 && !/district|seat|east|west/i.test(office.name)) return placeMap(cities[0]!);
  return null;
}
