import data from '../data/municipal-results.json';
import { filings } from './entities';
const key = (year: number, name: string, office: string, placeId: string) => JSON.stringify([year, name, office, placeId]);
const candidateIds = new Map(filings.flatMap(f => f.placeIds.map(placeId => [key(f.year, f.name, f.officeName, placeId), f.personId] as const)));
export const municipalResults = data.map(contest => ({ ...contest, options: contest.options.map(option => ({
  ...option, personId: contest.kind === 'candidate' ? candidateIds.get(key(contest.year, option.name, contest.office, contest.placeId)) ?? null : null
})) }));
