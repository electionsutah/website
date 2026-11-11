const smallWords = new Set(['and', 'of', 'the', 'at', 'for', 'in', 'on', 'to', 'or', 'by', 'an', 'a']);
const acronyms = new Set(['REP', 'DEM', 'IAP', 'LIB', 'CON', 'UNA', 'FWD', 'SSD', 'EMS', 'LLC', 'USA', 'UT', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX']);

/** Display formatting only. Never use this value to regenerate source IDs or routes. */
export function formatOfficeName(value: string): string {
  let word = 0;
  let previous = '';
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()
    .replace(/(?:\p{L}\.){2,}|\p{L}+/gu, part => {
      const first = word++ === 0;
      const prior = previous;
      previous = part.toLowerCase();
      const upper = part.toUpperCase();
      if (part.length === 1 && /^(?:seat|district|position|ward|precinct|member|class|grade)$/.test(prior)) return upper;
      if (upper === 'US' || upper === 'U.S.') return 'U.S.';
      if (acronyms.has(upper) || /^(?:\p{L}\.){2,}$/u.test(part)) return upper;
      const lower = part.toLowerCase();
      if (!first && smallWords.has(lower)) return lower;
      // Keep established internal capitals in place names such as McAdams.
      if (part !== upper && part !== lower) return part;
      return (lower[0].toUpperCase() + lower.slice(1)).replace(/^Mc(\p{Ll})/u, (_, letter: string) => `Mc${letter.toUpperCase()}`);
    });
}
