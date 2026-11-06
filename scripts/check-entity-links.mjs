import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { resolveEntityLinks, placeEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  const links = resolveEntityLinks([
    { url: 'beaver.utah.gov', label: 'Official website' },
    { url: 'https://en.wikipedia.org/wiki/Beaver_County%2C_Utah' },
    { url: 'https://www.wikidata.org/wiki/Q109284' },
    { url: 'https://www.instagram.com/example/' },
    { url: 'https://twitter.com/example' },
    { url: 'https://bsky.app/profile/example.bsky.social' },
    { url: 'https://www.linkedin.com/company/example/' },
    { url: 'https://www.youtube.com/@example' },
    { url: 'https://www.facebook.com/example/' },
    { url: 'https://social.example/@example', platform: 'mastodon' },
    { url: 'https://www.tiktok.com/@example' },
    { url: 'https://truthsocial.com/@example' },
    { url: 'https://rumble.com/c/example' },
    { url: 'https://www.threads.net/@example' },
    { url: 'https://substack.com/@example' }
  ]);
  assert.deepEqual(links.map(({ platform }) => platform), ['website', 'wikipedia', 'wikidata', 'instagram', 'x', 'bluesky', 'linkedin', 'youtube', 'facebook', 'mastodon', 'tiktok', 'truthsocial', 'rumble', 'threads', 'substack']);
  assert.equal(links[0].url, 'https://beaver.utah.gov/');
  assert.equal(links[1].detail, 'Beaver County, Utah');
  assert.equal(links[2].detail, 'Q109284');
  assert.equal(links[3].detail, '@example');
  assert.equal(links[5].detail, '@example.bsky.social');
  assert.equal(links[10].detail, '@example');
  assert.equal(links[11].detail, '@example');
  assert.equal(links[12].detail, 'c/example');
  assert.equal(links[13].detail, '@example');
  assert.equal(links[14].detail, '@example');
  assert.equal(resolveEntityLinks([{ url: 'https://www.threads.com/@example' }])[0].platform, 'threads');
  for (const host of ['tiktok.com', 'truthsocial.com', 'rumble.com', 'threads.com', 'threads.net', 'substack.com']) assert.equal(resolveEntityLinks([{ url: `https://${host}.unrelated.example/account` }])[0].platform, 'website');
  assert.equal(links[9].detail, '@example · social.example');
  assert.equal(resolveEntityLinks([{ url: 'https://instagram.com.unrelated.example/account' }])[0].platform, 'website', 'Do not brand unrelated hosts as social platforms');
  assert.equal(resolveEntityLinks([{ url: 'javascript:alert(1)' }, { url: 'data:text/html,test' }, { url: 'mailto:person@example.org' }, { url: 'https://user:password@example.org/' }, { url: '' }]).length, 0, 'Omit non-web URLs, credentials and empty values');
  assert.equal(resolveEntityLinks([{ url: 'example.org' }, { url: 'https://example.org/' }]).length, 1, 'Collapse the same destination');
  assert.equal(resolveEntityLinks([{ url: 'https://instagram.com/one' }, { url: 'https://instagram.com/two' }]).length, 2, 'Preserve distinct accounts on the same platform');
  assert.equal(resolveEntityLinks(placeEntityLinks())[0], undefined);
  assert.equal(resolveEntityLinks(placeEntityLinks({ officialWebsite: '', wikipediaUrl: '', wikidataUrl: '' })).length, 0);
  for (const platform of links.map(({ platform }) => platform).filter((p) => !['website', 'wikipedia'].includes(p))) {
    const asset = new URL(`../public/icons/external/${platform}.svg`, import.meta.url);
    await access(asset);
    assert(!/<script|<foreignObject|https?:\/\/[^\s"']+\.(?:js|png|jpg)/i.test(await readFile(asset, 'utf8')), `${platform} should be a self-contained icon`);
  }
  console.log('Entity links: URL handling, account labels, platform matching and local SVG assets passed.');
} finally {
  await server.close();
}
