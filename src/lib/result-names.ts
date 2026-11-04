import { resultPerson } from './result-people';
import type { Contest, Option, Snapshot } from './results';

// County feeds publish many names in all caps ("COUNTY CLERK", "REP JANE DOE").
// Recase those for display; strings that already use mixed case are left alone.
const smallWords = new Set(['and', 'of', 'the', 'at', 'for', 'in', 'on', 'to', 'or', 'by', 'an']);
const keepUpper = new Set(['SSD', 'EMS', 'II', 'III', 'IV', 'USA', 'LLC']);
// Two-letter first names that are initials ("AJ Mower"), not words.
const initials = new Set(['AJ', 'BJ', 'CJ', 'DJ', 'JD', 'JJ', 'JR', 'KC', 'RJ', 'TJ']);
const partyNames: Record<string, string> = {
  REPUBLICAN: 'Republican', 'Republican Party': 'Republican',
  DEMOCRATIC: 'Democratic', 'Democratic Party': 'Democratic',
  LIBERTARIAN: 'Libertarian', CONSTITUTION: 'Constitution',
  UNAFFILIATED: 'Unaffiliated', NONPARTISAN: 'Nonpartisan', 'Forward Party': 'Forward'
};
// Ballot-label party codes some counties prefix to candidate names.
const partyPrefixes: Record<string, string> = { REP: 'Republican', DEM: 'Democratic', CON: 'Constitution', IAP: 'Independent American', LIB: 'Libertarian', UNA: '', FWD: 'Forward' };

const isAllCaps = (value: string) => value === value.toUpperCase() && /\p{Lu}{2}/u.test(value);

function recaseWord(word: string, first: boolean) {
  if (keepUpper.has(word) || (first && initials.has(word))) return word;
  const lower = word.toLowerCase();
  if (!first && smallWords.has(lower)) return lower;
  if (lower === 'write-in' || lower === 'write-ins') return lower.replace(/^w/, 'W');
  return lower
    .replace(/(^|[-/("“])(\p{L})/gu, (_, start, letter) => start + letter.toUpperCase())
    .replace(/^(o['’])(\p{L})/u, (_, start, letter) => start.toUpperCase() + letter.toUpperCase())
    .replace(/^(Mc)(\p{L})/u, (_, start, letter) => start + letter.toUpperCase());
}

export function recase(value: string) {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!isAllCaps(text)) return text;
  return text.split(' ').map((word, index) => recaseWord(word, index === 0)).join(' ');
}

function tidyOption(option: Option, contest: Contest): Option {
  let name = option.name.trim().replace(/\s+/g, ' ');
  const prefix = /^([A-Z]{3})\s+(.+)$/.exec(name);
  if (prefix && prefix[1] in partyPrefixes) name = prefix[2];
  const party = partyNames[option.party] ?? (option.party || (prefix ? partyPrefixes[prefix[1]] ?? '' : ''));
  // Prefer the directory's spelling of a person when the ballot name matches one record.
  const person = isAllCaps(name) ? resultPerson(name, contest) : undefined;
  return { ...option, name: person?.name ?? recase(name), party };
}

/** Normalize the display casing of contest, candidate, and party names in a snapshot. */
// Some feeds wrap the office in "County ... County" ("County Attorney County"); read it as "Utah County Attorney".
function contestName(name: string, county: string | undefined) {
  const wrapped = /^County\s+(.+?)\s+County$/i.exec(name);
  return wrapped && county ? `${county} County ${wrapped[1]}` : name;
}

export function tidySnapshot(snapshot: Snapshot): Snapshot {
  const countyNames = new Map(snapshot.counties.map(row => [row.id, row.name.replace(/\s+County$/i, '')]));
  return {
    ...snapshot,
    contests: snapshot.contests.map(contest => {
      const tidy = (option: Option) => tidyOption(option, contest);
      return { ...contest, name: contestName(recase(contest.name), contest.county ? countyNames.get(contest.county) : undefined), options: contest.options.map(tidy), counties: contest.counties.map(row => ({ ...row, options: row.options.map(tidy) })) };
    })
  };
}
