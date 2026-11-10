export type TimelineDateParts = { value: string; label: string; month?: string; day?: string; year: string };

/** Preserve source precision and avoid local-timezone shifts or date rollover. */
export function timelineDate(value?: string | null): TimelineDateParts | undefined {
  if (!value) return;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return;
  const [, year, month, day] = match;
  if (+year < 1 || (month && (+month < 1 || +month > 12))) return;
  const date = new Date(`${year}-${month || '01'}-${day || '01'}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== +year || (month && date.getUTCMonth() + 1 !== +month) || (day && date.getUTCDate() !== +day)) return;
  return { value, year, month: month ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(date) : undefined,
    day: day ? String(+day) : undefined,
    label: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', ...(month ? { month: 'long' } : {}), ...(day ? { day: 'numeric' } : {}) }).format(date) };
}
