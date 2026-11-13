const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base', ignorePunctuation: true });

/** Sort source display names by surname without changing the displayed name. */
export function surnameSortKey(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && /^(?:jr|sr|ii|iii|iv|v)\.?$/i.test(parts.at(-1)!)) parts.pop();
  let start = Math.max(0, parts.length - 1);
  // Keep common multiword surname particles with the family name.
  while (start > 1 && /^(?:de|del|della|la|le|van|von|der|den|di|da|dos|du|st\.?)$/i.test(parts[start - 1])) start--;
  return `${parts.slice(start).join(' ')}, ${name}`;
}

/** Non-mutating default: latest relevant election year, surname, then full name. */
export function sortByElectionYearAndSurname<T>(rows: T[], year: (row: T) => number, name: (row: T) => string): T[] {
  return [...rows].sort((a, b) => year(b) - year(a) || collator.compare(surnameSortKey(name(a)), surnameSortKey(name(b))));
}
