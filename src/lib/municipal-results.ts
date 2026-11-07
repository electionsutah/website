import data from '../data/municipal-results.json';
import { filings } from './entities';
export const municipalResults = data.map(contest => ({ ...contest, options: contest.options.map(option => {
  const filing = filings.find(f => f.year === contest.year && f.name === option.name && f.officeName === contest.office && f.placeIds.includes(contest.placeId));
  return { ...option, personId: filing?.personId ?? null };
}) }));
