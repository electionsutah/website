import type { Contest } from './results';
import approved from '../data/race-slugs.json';

/** Readable, URL-safe ids for 2026 contests, e.g. "us-house-district-1". Never longer than this. */
export const MAX_SLUG_LENGTH = 36;

const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const countyPart = (id: string) => id.replace(/-county-ut$/, '');
const dropWords = new Set(['of', 'the', 'and', 'seat', 'utah', 'county', 'local', 'election', 'non', 'binding', 'ballot', 'partisan']);
// Always applied, so the same office reads the same way in every county.
const normalizers: [RegExp, string][] = [
  [/^u-s-/, 'us-'],
  [/\bconstitutional-amendment\b/g, 'amendment'],
  [/\bspecial-bond\b/g, 'bond'],
  [/\bcommissioner\b/g, 'commission'],
  [/\b(school-board|council|commission)-district-(\d)/g, '$1-$2'],
  [/\bschool-district\b/g, 'school-board'],
  [/\bwater-district-board\b/g, 'water'],
  [/\bcity-([a-z]+)-bond\b/g, '$1-bond'],
  [/-city-(question|proposition)\b/g, '-$1'],
  [/\bproposition\b/g, 'prop'],
  [/\b2-(yr|year)(-term)?\b/g, '2-year']
];
// Applied in order, only while a slug is still too long.
const shorteners: [RegExp, string][] = [
  [/\bstate-school-board-district\b/g, 'state-school-board'],
  [/\bincorporation\b/g, 'incorp'],
  [/\bdistrict-attorney\b/g, 'da'],
  [/\bat-large\b/g, 'large'],
  [/\bschool-board\b/g, 'schools'],
  [/\bcommission\b/g, 'comm'],
  [/\b2-year\b/g, '2yr'],
  [/\bquestion\b/g, 'q']
];
// Generic words to drop first when a slug still doesn't fit.
const fillerWords = ['city', 'board', 'district', 'term', 'municipal'];

const words = (value: string) => slugify(value).split('-').filter(word => word && !dropWords.has(word));
// Person names keep hyphenated surnames whole ("vo-duc") and skip initials.
// Words after a middle initial are all surname ("Michele M. Christiansen Forster").
const isInitial = (part: string) => /^[A-Za-z]\.?$/.test(part);
function judgeName(name: string) {
  const raw = name.trim().split(/\s+/);
  const initial = raw.map(isInitial).lastIndexOf(true);
  const parts = raw.filter(part => !isInitial(part)).map(slugify).filter(Boolean);
  const surname = initial > 0 ? raw.slice(initial + 1).map(slugify).filter(Boolean) : parts.slice(-1);
  return { first: parts.length > surname.length ? parts[0] : '', last: surname.join('-') };
}

/** Judicial retention questions, including county justice-court ballots that only name the judge. */
function retention(contest: Contest): { first: string; last: string; court: string } | null {
  const name = contest.name.trim();
  const named = /^Shall\s+(.+?)\s+be retained\b/i.exec(name) ?? /^(.+?)\s+Judicial Retention$/i.exec(name);
  if (named) return { ...judgeName(named[1]), court: '' };
  const yesNo = contest.options.length === 2 && contest.options.every(option => /^(yes|no)$/i.test(option.name));
  if (!yesNo || !contest.county) return null;
  // "Roy/Weber Justice Court - Nelson": the judge follows the court.
  const courtFirst = /^(.+?)\s+Justice Court\s+-\s+(.+)$/i.exec(name);
  if (courtFirst) return { first: '', last: judgeName(courtFirst[2]).last, court: words(courtFirst[1]).slice(0, 2).join('-') };
  // "Davis County Justice Court John Carl Ynchausti": the court precedes the judge.
  const judgeAfter = /Justice Court\s+(.+)$/i.exec(name);
  if (judgeAfter) return { ...judgeName(judgeAfter[1]), court: '' };
  // "Lisa A. Garner (Draper)" or "Jojo C. Liu": a bare judge name.
  const bare = /^([A-Za-z.'’ -]+?)(?:\s+\(([^)]+)\))?$/.exec(name);
  if (bare && bare[1].trim().split(/\s+/).length > 1 && !/\b(prop|proposition|bond|amendment|incorporation|question|tax|levy)\b/i.test(name)) {
    return { ...judgeName(bare[1]), court: bare[2] ? slugify(bare[2]) : '' };
  }
  return null;
}

function fit(slug: string) {
  for (const [pattern, replacement] of shorteners) {
    if (slug.length <= MAX_SLUG_LENGTH) break;
    slug = slug.replace(pattern, replacement);
  }
  const parts = slug.split('-');
  for (const filler of fillerWords) {
    while (parts.join('-').length > MAX_SLUG_LENGTH && parts.lastIndexOf(filler) > 0) parts.splice(parts.lastIndexOf(filler), 1);
  }
  // Last resort: drop words just before the trailing number or letter, keeping the place prefix.
  while (parts.join('-').length > MAX_SLUG_LENGTH && parts.length > 2) parts.splice(parts.length - 2, 1);
  return parts.join('-').slice(0, MAX_SLUG_LENGTH).replace(/-$/, '');
}

/** Preferred slugs for a contest, best first. Later ones disambiguate duplicates. */
function candidates(contest: Contest): string[] {
  const county = contest.county ? countyPart(contest.county) : '';
  const judge = retention(contest);
  if (judge) {
    // Prefer "retain-first-last"; add the court or county to tell duplicates apart.
    const options = [['retain', judge.first, judge.last, judge.court], ['retain', judge.first, judge.last, county], ...(judge.court ? [['retain', judge.last, judge.court]] : []), ['retain', judge.last, county], ['retain', judge.last]]
      .map(parts => parts.filter(Boolean).join('-'));
    const fitting = options.filter(option => option.length <= MAX_SLUG_LENGTH);
    return fitting.length ? fitting : options.map(fit);
  }
  let slug = words(contest.name.replace(/\(multi-county\)/i, '')).join('-');
  for (const [pattern, replacement] of normalizers) slug = slug.replace(pattern, replacement);
  // Don't repeat the county name ("box-elder-box-elder-sheriff").
  if (county) slug = `-${slug}-`.replace(`-${county}-`, '-').replace(/^-|-$/g, '');
  return [fit([county, slug].filter(Boolean).join('-'))];
}

/**
 * Map each contest id to a unique slug of at most MAX_SLUG_LENGTH characters, in ballot order.
 * Slugs in `fixed` win, so shared links survive snapshot refreshes; new contests get a generated slug.
 */
export function contestSlugs(contests: Contest[], fixed: Record<string, string> = {}): Map<string, string> {
  const slugs = new Map<string, string>();
  const used = new Set<string>();
  for (const contest of contests) if (fixed[contest.id]) { slugs.set(contest.id, fixed[contest.id]); used.add(fixed[contest.id]); }
  for (const contest of contests) {
    if (slugs.has(contest.id)) continue;
    const options = candidates(contest);
    let slug = options.find(option => !used.has(option)) ?? options[0];
    for (let n = 2; used.has(slug); n++) slug = `${options[0].slice(0, MAX_SLUG_LENGTH - String(n).length - 1).replace(/-$/, '')}-${n}`;
    used.add(slug);
    slugs.set(contest.id, slug);
  }
  return slugs;
}

/** Slugs for a results snapshot, using the approved table in src/data/race-slugs.json. */
export function raceSlugs(contests: Contest[]) {
  const toSlug = contestSlugs(contests, approved as Record<string, string>);
  const toId = new Map([...toSlug].map(([id, slug]) => [slug, id]));
  return {
    slug: (id: string) => toSlug.get(id) ?? id,
    // Accepts a slug or a legacy contest id, so older shared links keep working.
    id: (value: string) => toId.get(value.toLowerCase()) ?? (toSlug.has(value) ? value : undefined)
  };
}
