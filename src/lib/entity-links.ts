export type LinkPlatform = 'website' | 'wikipedia' | 'wikidata' | 'facebook' | 'instagram' | 'x' | 'linkedin' | 'youtube' | 'mastodon' | 'bluesky' | 'tiktok' | 'truthsocial' | 'rumble' | 'threads' | 'substack';

export type EntityLink = {
  url: string;
  label?: string;
  platform?: LinkPlatform;
  detail?: string;
  /** Primary page that publishes this link. */
  source?: string;
  verifiedOn?: string;
};

const labels: Record<LinkPlatform, string> = {
  website: 'Website', wikipedia: 'Wikipedia', wikidata: 'Wikidata', facebook: 'Facebook',
  instagram: 'Instagram', x: 'X', linkedin: 'LinkedIn', youtube: 'YouTube', mastodon: 'Mastodon', bluesky: 'Bluesky', tiktok: 'TikTok', truthsocial: 'Truth Social', rumble: 'Rumble', threads: 'Threads', substack: 'Substack'
};

function inferPlatform(host: string): LinkPlatform {
  const domain = (name: string) => host === name || host.endsWith(`.${name}`);
  if (domain('wikipedia.org')) return 'wikipedia';
  if (domain('wikidata.org')) return 'wikidata';
  if (domain('facebook.com') || host === 'fb.com') return 'facebook';
  if (domain('instagram.com')) return 'instagram';
  if (domain('x.com') || domain('twitter.com')) return 'x';
  if (domain('linkedin.com')) return 'linkedin';
  if (domain('youtube.com') || host === 'youtu.be') return 'youtube';
  if (domain('threads.net') || domain('threads.com')) return 'threads';
  if (domain('substack.com')) return 'substack';
  if (domain('tiktok.com')) return 'tiktok';
  if (domain('truthsocial.com')) return 'truthsocial';
  if (domain('rumble.com')) return 'rumble';
  if (host === 'bsky.app') return 'bluesky';
  return 'website';
}

/** One URL model for cards, profiles and future social-account enrichment. */
export function resolveEntityLinks(links: EntityLink[]) {
  const seen = new Set<string>();
  return links.flatMap((link) => {
    if (!link.url?.trim()) return [];
    try {
      const value = link.url.trim();
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || seen.has(url.href)) return [];
      seen.add(url.href);
      const host = url.hostname.replace(/^www\./, '');
      const platform = link.platform ?? inferPlatform(host);
      const path = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      let detail = host;
      if (platform === 'wikipedia') detail = path.slice(1).join('/').replace(/_/g, ' ') || host;
      else if (platform === 'wikidata') detail = path.at(-1) ?? host;
      else if (platform === 'bluesky') detail = path.at(-1) ? `@${path.at(-1)}` : host;
      else if (platform === 'mastodon') detail = path.at(-1) ? `${path.at(-1)} · ${host}` : host;
      else if (['instagram', 'x', 'tiktok', 'truthsocial', 'threads', 'substack'].includes(platform)) detail = path[0] ? `@${path[0].replace(/^@/, '')}` : host;
      else if (['facebook', 'linkedin', 'youtube', 'rumble'].includes(platform)) detail = path.join('/') || host;
      return [{ url: url.href, platform, label: link.label || labels[platform], detail: link.detail || detail }];
    } catch {
      return [];
    }
  });
}

export function placeEntityLinks(
  profile?: { officialWebsite: string; wikipediaUrl: string; wikidataUrl: string },
  verified: EntityLink[] = []
): EntityLink[] {
  const hasVerifiedWebsite = verified.some(link => link.label === 'Official website');
  return [
    ...verified,
    ...(profile ? [
      ...(!hasVerifiedWebsite ? [{ url: profile.officialWebsite, label: 'Official website' }] : []),
      { url: profile.wikipediaUrl },
      { url: profile.wikidataUrl }
    ] : [])
  ];
}
