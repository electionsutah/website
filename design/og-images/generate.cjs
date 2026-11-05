// Renders the per-section Open Graph cards (1200×630) into public/og/.
// Needs Playwright with Chrome: NODE_PATH=<dir with playwright> node design/og-images/generate.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'public/og');
const font = (file) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'public/fonts', file)).toString('base64');
const logo = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, 'public/images/logo-editorial-nav.svg')).toString('base64');

const cards = {
  default: ['Open civic data', 'Utah elections, candidates, and results in one place.'],
  labs: ['2026 results', 'Utah’s 2026 general election, county by county.'],
  people: ['People', 'Every candidate who has filed to run in Utah.'],
  offices: ['Offices', 'Who has run for each Utah office.'],
  parties: ['Parties', 'Utah’s political parties and their candidates.'],
  places: ['Places', 'Elections in every Utah county and city.'],
  elections: ['Elections', 'Candidate filings for each Utah election year.'],
  docs: ['Docs', 'The open data, its schema, and a glossary.']
};

const html = (kicker, headline) => `<!doctype html><html><head><style>
@font-face{font-family:'Source Serif 4';font-weight:200 900;src:url(${font('source-serif-4-normal-latin.woff2')}) format('woff2')}
@font-face{font-family:'Noto Sans';font-weight:100 900;src:url(${font('noto-sans-normal-latin.woff2')}) format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#111110;color:#fff;display:grid;grid-template-columns:400px 1fr;align-items:center;gap:72px;padding:0 90px 14px;border-bottom:14px solid #ff4c3c;font-family:'Noto Sans',sans-serif}
img{width:100%;height:auto}
p{color:#ff4c3c;font-weight:700;font-size:26px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:22px}
h1{font:700 64px/1.04 'Source Serif 4',serif;letter-spacing:-.03em;text-wrap:balance}
small{display:block;margin-top:34px;color:#92908b;font-size:22px;letter-spacing:.04em}
</style></head><body><img src="${logo}" alt=""><div><p>${kicker}</p><h1>${headline}</h1><small>electionsutah.org</small></div></body></html>`;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const [name, [kicker, headline]] of Object.entries(cards)) {
    await page.setContent(html(kicker, headline));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  }
  await browser.close();
  console.log(Object.keys(cards).map((name) => `public/og/${name}.png`).join('\n'));
})();
