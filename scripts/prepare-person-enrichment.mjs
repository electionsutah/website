import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
const limit = Number(process.argv[2] ?? 100);
if (!Number.isInteger(limit) || limit < 1) throw Error('Supply a positive integer limit');
const previousPath=process.argv[3];
const output=process.argv[4]??'.firecrawl/enrichment/people-seeds.json';
const previous=previousPath?JSON.parse(await readFile(previousPath,'utf8')):null;
const excluded=new Set((previous?.seeds??previous?.people??[]).map(p=>p.id));
const server = await createServer({ configFile:false, logLevel:'silent', server:{middlewareMode:true,hmr:false,ws:false} });
try {
  const { people } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resolveEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  const { editorialData } = await server.ssrLoadModule('/src/lib/editorial.ts');
  const seeds = people.filter(p=>!excluded.has(p.id)&&(previousPath||p.years.includes(2026))).filter(p=>{
    const links=resolveEntityLinks(p.links??[]);
    return links.some(l=>l.platform==='website'&&!/utleg\.gov/.test(new URL(l.url).hostname)) && !links.some(l=>!['website','wikipedia','wikidata'].includes(l.platform));
  }).sort((a,b)=>Number(b.years.includes(2026))-Number(a.years.includes(2026))||Math.max(...b.years)-Math.max(...a.years)||a.id.localeCompare(b.id)).slice(0,limit).map(p=>({
    id:p.id,name:p.name,kind:'people',entityUrl:`https://www.electionsutah.org/people/${p.id}/`,
    websites:resolveEntityLinks(p.links??[]).filter(l=>l.platform==='website'&&!/utleg\.gov/.test(new URL(l.url).hostname)).map(l=>l.url),
    latestYear:Math.max(...p.years),historical:!p.years.includes(2026),existingLinks:p.links??[],manualOverride:!!editorialData.people[p.id],
    offices:[...new Set(p.filings.filter(f=>f.year===Math.max(...p.years)).map(f=>f.officeName))],
    sources:[...new Set(p.filings.filter(f=>f.year===Math.max(...p.years)).map(f=>f.source))]
  }));
  await mkdir('.firecrawl/enrichment',{recursive:true});
  await writeFile(output,JSON.stringify({selection:previousPath?'Next distinct people with a non-legislative website and no recorded social accounts; exclude previous cohort, prioritize 2026 then latest filing year, then entity ID. Historical candidates require additional review. Not a random sample.':'2026 filing, non-legislative website, no recorded social accounts; latest filing year then entity ID. Not a random population sample.',requested:limit,seeds},null,2)+'\n');
  console.log(JSON.stringify({prepared:seeds.length,current2026:seeds.filter(p=>!p.historical).length,historical:seeds.filter(p=>p.historical).length,output,excluded:excluded.size}));
} finally {await server.close();}
