import { cleanOfficeName, identityKey, offices, parties } from './entities';

/** Resolve actual directory entries, leaving unknown or aggregate labels unlinked. */
export function resultOfficeHref(name: string): string | undefined {
  const key = identityKey(cleanOfficeName(name.trim()));
  const matches = offices.filter(office => identityKey(cleanOfficeName(office.name.trim())) === key);
  return matches.length === 1 ? `/offices/${matches[0].id}/` : undefined;
}

export function resultPartyHref(name: string): string | undefined {
  const key = identityKey(name);
  if (!key) return undefined;
  const matches = parties.filter(party => identityKey(party.name) === key || identityKey(party.shortName) === key);
  return matches.length === 1 ? `/parties/${matches[0].id}/` : undefined;
}
