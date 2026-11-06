// Shared report decoration: use the application's platform resolver and local icons.
// Run after generating reports, or pass individual HTML report paths.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'reports');
const files = process.argv.slice(2).length ? process.argv.slice(2).map(file => resolve(file))
  : (await readdir(directory)).filter(file => file.endsWith('.html')).map(file => join(directory, file));
const globe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0070ad" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>';
const component = await readFile(join(root, 'src/EntityLinks.svelte'), 'utf8');
const wikipedia = component.match(/<svg class="wikipedia-icon"[\s\S]*?<\/svg>/)[0].replace('class="wikipedia-icon"', 'xmlns="http://www.w3.org/2000/svg" fill="#202020"');
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { resolveEntityLinks } = await server.ssrLoadModule(join(root, 'src/lib/entity-links.ts'));
  for (const file of files) {
    const data = JSON.parse(await readFile(file.replace(/\.html$/, '.json'), 'utf8'));
    const urls = new Set();
    function collect(value) {
      if (!value || typeof value !== 'object') return;
      if (typeof value.url === 'string') urls.add(value.url);
      for (const child of Object.values(value)) collect(child);
    }
    collect(data);
    const icons = {};
    const platforms = {};
    for (const link of resolveEntityLinks([...urls].map(url => ({ url })))) {
      const platform = link.platform;
      if (!icons[platform]) {
        const svg = platform === 'website' ? globe : platform === 'wikipedia' ? wikipedia
          : await readFile(join(root, `public/icons/external/${platform}.svg`), 'utf8');
        icons[platform] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      }
      platforms[link.url] = platform;
    }
    const style = `<style id="report-link-icon-styles">article li>a.report-collection-link{display:inline-flex;align-items:center;gap:8px;max-width:100%;vertical-align:middle}article li>a.report-collection-link>img{display:block;flex:none;width:20px;height:20px;object-fit:contain;padding:2px;border-radius:3px;background:#fff}</style>`;
    const script = `<script id="report-link-icons">(()=>{const icons=${JSON.stringify(icons)},platforms=${JSON.stringify(platforms)};function decorate(){for(const link of document.querySelectorAll('article li>a[href]')){if(link.classList.contains('report-collection-link'))continue;const platform=platforms[link.href];if(!platform)continue;const icon=document.createElement('img');icon.src=icons[platform];icon.alt='';icon.setAttribute('aria-hidden','true');link.prepend(icon);link.classList.add('report-collection-link');}}decorate();new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});})();</script>`;
    let html = await readFile(file, 'utf8');
    html = html.replace(/<style id="report-link-icon-styles">[\s\S]*?<\/style>/g, '')
      .replace(/<script id="report-link-icons">[\s\S]*?<\/script>/g, '');
    html = html.replace('</head>', `${style}</head>`).replace('</body>', `${script}</body>`);
    await writeFile(file, html);
    console.log(`${basename(file)}: ${Object.keys(platforms).length} link destinations, ${Object.keys(icons).length} platform icons`);
  }
} finally { await server.close(); }
