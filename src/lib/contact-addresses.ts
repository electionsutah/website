export type ContactAddress = { label: string; value: string };

export function isMailingAddress(address: ContactAddress): boolean {
  return /\bmail(?:ing)?\b|\bpostal\b/i.test(address.label) || /\bp\.?\s*o\.?\s*box\b|\bpost office box\b/i.test(address.value);
}

/** Accept original single-address imports as well as labeled address lists. */
export function contactAddresses(address: string | ContactAddress[] | undefined): ContactAddress[] {
  if (Array.isArray(address)) return address.filter(item => item.value.trim());
  return (address ?? '').split('\n').map(line => {
    const match = line.match(/^(Campaign office|Mailing):\s*(.+)$/i);
    return { label: match?.[1] ?? 'Address', value: (match?.[2] ?? line).trim() };
  }).filter(item => item.value);
}

export function addressMapUrl(address: ContactAddress): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.value)}`;
}
