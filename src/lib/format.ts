/** Counts with thousands separators ("1,488"), matching the place population figures. */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** Source dates are calendar dates, independent of the visitor's time zone. */
export function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric'
  });
}
