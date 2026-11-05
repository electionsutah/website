import type { Bounds, Point } from './legislative-map';

/**
 * The bundled district and county paths use a linear projection of longitude and latitude
 * (see scripts/import-legislative-boundaries.py), so they convert back exactly for MapLibre.
 */
const SCALE_X = 62 * Math.cos(39.5 * Math.PI / 180);
export const toLngLat = ([x, y]: Point): Point => [x / SCALE_X - 114.1, 42.1 - y / 62];
/** Projected [minX, minY, maxX, maxY] to MapLibre [[west, south], [east, north]]. */
export const lngLatBounds = ([minX, minY, maxX, maxY]: Bounds): [Point, Point] => [toLngLat([minX, maxY]), toLngLat([maxX, minY])];
export const UTAH_BOUNDS: [Point, Point] = [[-114.06, 36.99], [-109.04, 42.0]];

type Ring = Point[];
type Polygon = Ring[];

function rings(path: string): Ring[] {
  return (path.match(/M[^M]+/gi) || []).map((ring) => [...ring.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((match) => toLngLat([Number(match[1]), Number(match[2])]))).filter((ring) => ring.length >= 3).map((ring) => {
    const [first, last] = [ring[0], ring[ring.length - 1]];
    return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  });
}
function inside(point: Point, ring: Ring) {
  let contained = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) contained = !contained;
  }
  return contained;
}

/** Group a path's rings into polygons: a ring nested an odd number of times is a hole in its nearest outer ring. */
export function polygons(path: string): Polygon[] {
  const all = rings(path);
  const depth = all.map((ring, index) => all.filter((other, otherIndex) => otherIndex !== index && inside(ring[0], other)).length);
  const outers = all.filter((_, index) => depth[index] % 2 === 0);
  const result: Polygon[] = outers.map((ring) => [ring]);
  all.forEach((ring, index) => {
    if (depth[index] % 2 === 0) return;
    // The containing outer ring with the greatest depth is the hole's parent.
    let parent = -1;
    outers.forEach((outer, outerIndex) => { if (inside(ring[0], outer) && (parent < 0 || depth[all.indexOf(outer)] > depth[all.indexOf(outers[parent])])) parent = outerIndex; });
    if (parent >= 0) result[parent].push(ring);
  });
  return result;
}

export const multiPolygon = (path: string) => ({ type: 'MultiPolygon' as const, coordinates: polygons(path) });

/** Everything except the district: a world-sized polygon with the district cut out, plus any holes inside the district. */
export function maskAround(path: string) {
  const parts = polygons(path);
  const world: Ring = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  return { type: 'MultiPolygon' as const, coordinates: [[world, ...parts.map((part) => part[0])], ...parts.flatMap((part) => part.slice(1).map((hole) => [hole]))] };
}
