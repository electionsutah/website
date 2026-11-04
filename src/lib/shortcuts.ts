/** Apple platforms label the search shortcut ⌘K; everywhere else uses Ctrl+K. */
export function isApplePlatform() {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Cmd+K or Ctrl+K, accepted on every platform so external keyboards behave predictably. */
export function isSearchShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
}
