import { peopleById, partiesById, type Filing } from './entities';
import { candidacyHistory } from './candidacy-history';

export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const c = hex.replace('#', '').match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function avatarPalette(color: string, treatment: 'tint' | 'solid' | 'accent' = 'tint') {
  const reference = /^#[0-9a-f]{6}$/i.test(color) ? color : '#5f5e59';
  const tint = '#' + reference.slice(1).match(/../g)!.map(value => Math.round(parseInt(value, 16) * .18 + 255 * .82).toString(16).padStart(2, '0')).join('');
  const background = treatment === 'solid' ? reference : treatment === 'accent' ? '#f5f5f3' : tint;
  const foreground = contrastRatio(background, '#26333b') >= 4.5 ? '#26333b' : contrastRatio(background, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
  return { reference, background, foreground, contrast: contrastRatio(background, foreground) };
}
const stage = (row: Filing) => row.status === 'filed' ? 0 : row.electionType === 'general' ? 2 : 1;
const explicitDate = (row: Filing) => row.statusDate ?? row.electionDate ?? row.filingDate ?? '';
/** Prefer later ballot stages within a year, then explicit dates; unresolved affiliation ties stay neutral. */
export function latestAvatarAffiliation(records: Filing[]) {
  if (!records.length) return 'not-reported';
  const latestYear = Math.max(...records.map(row => row.year));
  const rows = candidacyHistory(records.filter(row => row.year === latestYear)).map(history => history.filing);
  rows.sort((a, b) => stage(b) - stage(a) || explicitDate(b).localeCompare(explicitDate(a)));
  const first = rows[0];
  const tied = rows.filter(row => stage(row) === stage(first) && explicitDate(row) === explicitDate(first));
  const affiliations = new Set(tied.map(row => row.partyId));
  return affiliations.size === 1 ? first.partyId : 'not-reported';
}
const cache = new Map<string, ReturnType<typeof avatarPalette> & { partyId: string; label: string }>();
export function personAvatarColors(personId?: string) {
  if (personId && cache.has(personId)) return cache.get(personId)!;
  const person = personId ? peopleById.get(personId) : undefined;
  const partyId = latestAvatarAffiliation(person?.filings.filter(row => row.personId === person.id) ?? []);
  const party = partiesById.get(partyId);
  const colors = { ...avatarPalette(party?.color ?? '#5f5e59', 'solid'), partyId, label: party?.name ?? 'Not reported' };
  if (personId) cache.set(personId, colors);
  return colors;
}
