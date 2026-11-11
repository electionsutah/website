export interface Option { id: string; name: string; votes: number; party: string; winner: boolean | null; votesPublished?: boolean }
export interface Reporting { reportingUnits: number; totalUnits: number; asOf: string }
export interface CountyResult { id: string; total: number; options: Option[]; reporting: Reporting | null }
export interface Contest { electionDate?: string; official?: boolean; asOf?: string; year?: number; electionType?: string; judgeName?: string; kind?: string; city?: string; party?: string; votesPublished?: boolean; optionTotalsReconcile?: boolean; totalBasis?: string; notes?: string[]; id: string; name: string; category: string; county: string | null; seats?: number; countyTotalsReconcile?: boolean; total: number; reporting: Reporting | null; options: Option[]; source: string; counties: CountyResult[] }
export interface Snapshot { source: string; election: string; electionDate: string; asOf: string; official: boolean; fetchedAt: string; counties: {id: string; name: string; asOf: string | null}[]; contests: Contest[] }
export const count = (value: number) => value.toLocaleString('en-US');
export const percent = (votes: number, total: number) => total ? `${(votes / total * 100).toFixed(2)}%` : '—';
/** Winners elected in a contest ("Vote for N"); 1 unless the source says otherwise. */
export const seatsOf = (contest: { seats?: number }) => Math.max(1, contest.seats ?? 1);
/** Mark published leaders without treating a vote lead as a certified outcome. */
export function resultStanding(contest: Contest, option: Option): 'Winner' | 'Leading' | undefined {
  if (option.winner === true) return 'Winner';
  if (!contest.total || contest.votesPublished === false || option.votesPublished === false ||
    contest.optionTotalsReconcile === false || contest.totalBasis === 'listed named-candidate votes' ||
    contest.totalBasis === 'first-round votes' || contest.options.some(row => row.winner === true)) return;
  const published = contest.options.filter(row => row.votesPublished !== false);
  const ahead = published.filter(row => row.votes > option.votes).length;
  const tied = published.filter(row => row.votes === option.votes).length;
  if (option.votes > 0 && ahead + tied <= seatsOf(contest)) return 'Leading';
}
/** Gap between the last winning position and the first losing one, as a share of votes cast. */
export const margin = (row: { options: Option[]; total: number }, seats = 1) => row.options.length > seats && row.total ? (row.options[seats - 1].votes - row.options[seats].votes) / row.total * 100 : Infinity;
/**
 * Result palette for maps, bars, and legends. Democratic and Republican match
 * --color-democratic and --color-republican in app.css; none and other match
 * --color-rule and --color-muted. Change them together.
 */
export const RESULT_COLORS = {
  Democratic: '#2675aa', Republican: '#bc443d', Forward: '#79629d', Libertarian: '#886e13',
  yes: '#32796c', no: '#a75936', other: '#5f5e59', none: '#e3e2dd'
} as const;
export function color(option?: Option) {
  if (!option) return RESULT_COLORS.none;
  if (option.party === 'Republican' || option.party === 'Democratic' || option.party === 'Forward' || option.party === 'Libertarian') return RESULT_COLORS[option.party];
  const name = option.name.toLowerCase();
  if (name === 'yes' || name === 'no') return RESULT_COLORS[name];
  return RESULT_COLORS.other;
}
/** True when a single named leader should be shown (one seat, votes reported, no tie). */
export const hasSingleLeader = (row: { options: Option[]; total: number }, seats = 1) => seats === 1 && !!row.total && !!row.options.length && leader(row) !== 'Tied';
export function leader(row: { options: Option[]; total: number }, seats = 1) {
  if (!row.total || !row.options.length) return 'No votes reported';
  if (seats > 1) {
    if (row.options.length <= seats) return `All ${row.options.length} candidates for ${seats} seats`;
    if (row.options[seats - 1].votes === row.options[seats].votes) return `Tied for seat ${seats} of ${seats}`;
    return `Top ${seats} ${row.options.slice(0, seats).every(option => option.winner) ? 'elected' : 'lead'} · ${seats} seats`;
  }
  if (row.options.length > 1 && row.options[0].votes === row.options[1].votes) return 'Tied';
  return `${row.options[0].name} ${row.options[0].winner ? 'elected' : 'leads'}`;
}
export const updated = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(date));
