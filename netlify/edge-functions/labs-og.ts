// Gives each /labs/?race=<slug> link its own preview title and description.
// Link-preview crawlers don't run JavaScript, so the static Labs page alone would
// show the same card for every race. Preview text is built by
// scripts/prerender-routes.mjs into /data/race-previews.json.
// The one part of Netlify's edge Context this uses; avoids a types-only dependency.
type Context = { next: () => Promise<Response> };

type Preview = { title: string; description: string };
let previews: Promise<Record<string, Preview>> | null = null;

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);

function setMeta(html: string, attr: 'name' | 'property', key: string, content: string) {
  const tag = new RegExp(`<meta ${attr}="${key}" content="[^"]*" />`);
  return html.replace(tag, `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`);
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const race = url.searchParams.get('race')?.toLowerCase();
  if (!race) return context.next();
  previews ??= fetch(new URL('/data/race-previews.json', url)).then((res) => (res.ok ? res.json() : {})).catch(() => ({}));
  const [preview, response] = await Promise.all([previews.then((map) => map[race]), context.next()]);
  if (!preview || !response.headers.get('content-type')?.includes('text/html')) return response;

  const pageUrl = `${url.origin}/labs/?race=${encodeURIComponent(race)}`;
  const title = `${preview.title} — Elections Utah`;
  let html = await response.text();
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, 'name', 'description', preview.description);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', preview.description);
  html = setMeta(html, 'property', 'og:url', pageUrl);
  html = setMeta(html, 'property', 'og:image:alt', `Elections Utah — ${preview.title}`);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, headers });
};

export const config = { path: '/labs/' };
