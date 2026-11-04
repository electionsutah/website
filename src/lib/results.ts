export interface Option { id: string; name: string; votes: number; party: string; winner: boolean | null }
export interface Reporting { reportingUnits: number; totalUnits: number; asOf: string }
export interface CountyResult { id: string; total: number; options: Option[]; reporting: Reporting | null }
export interface Contest { id: string; name: string; category: string; county: string | null; countyTotalsReconcile?: boolean; total: number; reporting: Reporting | null; options: Option[]; source: string; counties: CountyResult[] }
export interface Snapshot { source: string; election: string; electionDate: string; asOf: string; official: boolean; fetchedAt: string; counties: {id: string; name: string; asOf: string | null}[]; contests: Contest[] }
export const count = (value: number) => value.toLocaleString('en-US');
export const percent = (votes: number, total: number) => total ? `${(votes / total * 100).toFixed(2)}%` : '—';
export const margin = (row: { options: Option[]; total: number }) => row.options.length > 1 && row.total ? (row.options[0].votes - row.options[1].votes) / row.total * 100 : Infinity;
export function color(option?: Option) {
  if (!option) return '#e8e5df';
  if (option.party === 'Republican') return '#bc443d';
  if (option.party === 'Democratic') return '#2675aa';
  if (option.party === 'Forward') return '#79629d';
  if (option.party === 'Libertarian') return '#997321';
  if (option.name.toLowerCase() === 'yes') return '#32796c';
  if (option.name.toLowerCase() === 'no') return '#a75936';
  return '#626870';
}
export function leader(row: { options: Option[]; total: number }) {
  if (!row.total || !row.options.length) return 'No votes reported';
  if (row.options.length > 1 && row.options[0].votes === row.options[1].votes) return 'Tied';
  return `${row.options[0].name} ${row.options[0].winner ? 'elected' : 'leads'}`;
}
export const updated = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(date));
