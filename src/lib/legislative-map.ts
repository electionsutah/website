import type { Contest, Snapshot } from './results';

export type Chamber = 'house' | 'senate';
export type Bounds = [number, number, number, number];
export interface DistrictShape { number: number; path: string; bounds: Bounds }
export interface LegislativeGeometry { chambers: Record<Chamber, { source: string; service: string; fetchedAt: string; districts: DistrictShape[] }> }
export interface MapView { x: number; y: number; width: number; height: number }
export const STATE_VIEW: MapView = { x: -10, y: -6, width: 264, height: 334 };
export const MAX_ZOOM = 24;
export const chamberLabel = (chamber: Chamber) => chamber === 'house' ? 'Utah House' : 'Utah Senate';
export const districtNumber = (name: string) => Number(/\bDistrict\s+(\d+)\b/i.exec(name)?.[1]);
export function districtResults(data: Snapshot, chamber: Chamber) {
  const category = chamber === 'house' ? 'State House' : 'State Senate';
  return new Map(data.contests.filter(row => !row.county && row.category === category).map(row => [districtNumber(row.name), row]));
}
export function pathBounds(path: string): Bounds {
  const points = [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(match => [Number(match[1]), Number(match[2])]);
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}
export type Point = [number, number];

/** Area-weighted polygon centroid, subtracting holes and combining multipart areas.
 * The bundled paths use M/L/Z. Ring nesting determines holes, so winding order
 * does not affect the result. Degenerate geometry falls back to its bounds.
 */
export function pathCentroid(path: string): Point {
  const rings = (path.match(/M[^M]+/gi) || []).map(ring => [...ring.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(match => [Number(match[1]), Number(match[2])] as Point)).filter(ring => ring.length >= 3);
  function inside(point: Point, ring: Point[]) {
    let contained = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) contained = !contained;
    }
    return contained;
  }
  let area = 0, x = 0, y = 0;
  rings.forEach((ring, index) => {
    let twiceArea = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const cross = p[0] * q[1] - q[0] * p[1];
      twiceArea += cross; cx += (p[0] + q[0]) * cross; cy += (p[1] + q[1]) * cross;
    }
    if (Math.abs(twiceArea) < 1e-9) return;
    const depth = rings.filter((other, otherIndex) => otherIndex !== index && inside(ring[0], other)).length;
    const weight = Math.abs(twiceArea) / 2 * (depth % 2 ? -1 : 1);
    area += weight; x += cx / (3 * twiceArea) * weight; y += cy / (3 * twiceArea) * weight;
  });
  if (area > 1e-9) return [x / area, y / area];
  const bounds = pathBounds(path);
  return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}

export function constrainView(view: MapView): MapView {
  const width = Math.max(STATE_VIEW.width / MAX_ZOOM, Math.min(STATE_VIEW.width, view.width));
  if (width === STATE_VIEW.width) return { ...STATE_VIEW };
  const height = width * STATE_VIEW.height / STATE_VIEW.width;
  // Constrain the center rather than the viewport edges. Border counties need
  // whitespace outside Utah to remain centered instead of being pushed inward.
  const cx = Math.max(STATE_VIEW.x, Math.min(STATE_VIEW.x + STATE_VIEW.width, view.x + view.width / 2));
  const cy = Math.max(STATE_VIEW.y, Math.min(STATE_VIEW.y + STATE_VIEW.height, view.y + view.height / 2));
  return { width, height, x: cx - width / 2, y: cy - height / 2 };
}
export function zoomView(view: MapView, factor: number): MapView {
  const width = view.width / factor;
  const height = width * STATE_VIEW.height / STATE_VIEW.width;
  return constrainView({ x: view.x + (view.width - width) / 2, y: view.y + (view.height - height) / 2, width, height });
}
export function fitBounds(bounds: Bounds, center: Point = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]): MapView {
  // Fit the furthest edge on either side of the chosen centroid, rather than
  // re-centering the bounding box. All of an asymmetric county stays visible.
  const spanX = 2 * Math.max(center[0] - bounds[0], bounds[2] - center[0]);
  const spanY = 2 * Math.max(center[1] - bounds[1], bounds[3] - center[1]);
  const width = Math.max(spanX, spanY * STATE_VIEW.width / STATE_VIEW.height) * 1.18;
  const height = width * STATE_VIEW.height / STATE_VIEW.width;
  return constrainView({ x: center[0] - width / 2, y: center[1] - height / 2, width, height });
}
export function resultState(contest?: Contest) {
  if (!contest) return 'No 2026 result published';
  if (!contest.total || !contest.options.length) return 'No votes reported';
  if (contest.options.length > 1 && contest.options[0].votes === contest.options[1].votes) return 'Tied';
  return `${contest.options[0].name} ${contest.options[0].winner ? 'elected' : 'leads'}`;
}
