/** Counts with thousands separators ("1,488"), matching the place population figures. */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}
