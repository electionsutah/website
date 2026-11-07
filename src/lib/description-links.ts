import { elections, people, offices, parties, places } from './entities';

type Part = { text: string; href?: string };
const destinations = new Map<string, Set<string>>();
function add(name: string, href: string) {
  const key = name.toLowerCase();
  if (!key) return;
  const targets = destinations.get(key) ?? new Set<string>();
  targets.add(href);
  destinations.set(key, targets);
}
for (const [kind, records] of Object.entries({ people, offices, parties, places })) {
  for (const record of records) add(record.name, `/${kind}/${record.id}/`);
}
for (const election of elections) add(String(election.year), `/elections/${election.year}/`);
type Trie = { children: Map<string, Trie>; name?: string };
const root: Trie = { children: new Map() };
for (const name of destinations.keys()) {
  let node = root;
  for (const char of name) {
    if (!node.children.has(char)) node.children.set(char, { children: new Map() });
    node = node.children.get(char)!;
  }
  node.name = name;
}
const word = (char: string) => /[\p{L}\p{N}_]/u.test(char);

/** Preserve the original prose and link only names with a single destination. */
export function descriptionLinks(text: string, self = ''): Part[] {
  const parts: Part[] = [];
  let offset = 0;
  const lower = text.toLowerCase();
  for (let start = 0; start < text.length; start++) {
    if (start && word(text[start - 1])) continue;
    let node = root;
    let found: { name: string; end: number } | undefined;
    for (let end = start; end < lower.length; end++) {
      const next = node.children.get(lower[end]);
      if (!next) break;
      node = next;
      if (node.name && (end + 1 === text.length || !word(text[end + 1]))) found = { name: node.name, end: end + 1 };
    }
    if (!found) continue;
    const targets = destinations.get(found.name)!;
    const href = targets.size === 1 ? [...targets][0] : undefined;
    if (href && href !== self) {
      if (start > offset) parts.push({ text: text.slice(offset, start) });
      parts.push({ text: text.slice(start, found.end), href });
      offset = found.end;
    }
    start = found.end - 1;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}
