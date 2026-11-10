import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
const read = async name => JSON.parse(await readFile(`src/data/${name}.json`, 'utf8'));
try {
  const { people, parties, places, offices, elections } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resolveEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  const reviews = { people: await read('person-link-enrichment'), parties: await read('party-enrichment'), places: await read('place-link-enrichment'), offices: await read('office-enrichment') };
  const records = [];
  const personProfiles = await read('person-enrichment');
  for (const [kind, entities] of Object.entries({ people, parties, places, offices })) for (const entity of entities) {
    const raw = entity.links ?? [], links = resolveEntityLinks(raw).map(link => ({ ...link, ...Object.fromEntries(['source','verifiedOn'].filter(k => raw.find(r => resolveEntityLinks([r])[0]?.url === link.url)?.[k]).map(k => [k,raw.find(r => resolveEntityLinks([r])[0]?.url === link.url)[k]])) }));
    const websites = links.filter(l => l.platform === 'website'), socials = links.filter(l => !['website','wikipedia','wikidata'].includes(l.platform));
    const importedContacts = (kind === 'people' ? entity.filings : [])?.flatMap(f => Object.entries(f.contact ?? {}).filter(([k,v]) => v && ['website','facebook','instagram','twitter','bluesky','youtube','linkedin','threads','tiktok','mastodon','truthsocial','rumble','substack'].includes(k)).map(([field,url]) => ({field,url,year:f.year,source:f.source}))) ?? [];
    const absentContactLinks = [...new Map(importedContacts.filter(c => !links.some(l => l.url === resolveEntityLinks([{url:c.url}])[0]?.url)).map(c => [c.url,c])).values()];
    const referenceUrls = [...new Set([...(entity.filings ?? []).map(f=>f.source), ...(entity.resources ?? []).map(r=>r.url), ...(kind === 'people' ? (personProfiles[entity.id]?.resources ?? []).map(r=>r.url) : []), ...(reviews[kind][entity.id]?.sources ?? [])].filter(Boolean))];
    records.push({ referenceUrls, kind,id:entity.id,name:entity.name,entityUrl:`https://www.electionsutah.org/${kind}/${entity.id}/`,current2026:entity.years.includes(2026),reviewed:!!reviews[kind][entity.id],reviewStatus:reviews[kind][entity.id]?.status ?? '',links,websiteCount:websites.length,socialCount:socials.length,absentContactLinks });
  }
  for (const e of elections) records.push({kind:'elections',id:String(e.year),name:e.title,entityUrl:`https://www.electionsutah.org/elections/${e.year}/`,current2026:e.year===2026,reviewed:false,links:[{url:e.source,platform:'website',label:e.sourceLabel,role:'cycle-source'}].filter(l=>l.url),referenceUrls:[...new Set(e.filings.map(f=>f.source).filter(Boolean))],websiteCount:e.source?1:0,socialCount:0});
  const summary = Object.fromEntries(['elections','parties','people','places','offices'].map(kind => {
    const r=records.filter(r=>r.kind===kind), links=r.flatMap(r=>r.links);
    return [kind,{total:r.length,reviewed:r.filter(r=>r.reviewed).length,withLinks:r.filter(r=>r.links.length).length,withWebsite:r.filter(r=>r.websiteCount).length,withSocial:r.filter(r=>r.socialCount).length,links:links.length,distinctReferenceUrls:new Set(r.flatMap(r=>r.referenceUrls)).size,withSource:links.filter(l=>l.source).length,withVerifiedDate:links.filter(l=>l.verifiedOn).length,platforms:Object.fromEntries([...new Set(links.map(l=>l.platform))].sort().map(p=>[p,links.filter(l=>l.platform===p).length])),current2026:{total:r.filter(r=>r.current2026).length,noLinks:r.filter(r=>r.current2026&&!r.links.length).length,noWebsite:r.filter(r=>r.current2026&&!r.websiteCount).length,noSocial:r.filter(r=>r.current2026&&!r.socialCount).length},absentContactLinks:r.reduce((s,r)=>s+(r.absentContactLinks?.length??0),0)}];
  }));
  const result={generatedAt:new Date().toISOString(),scope:'Resolved runtime entity links after imports, review dispositions and editorial overrides. Elections have cycle source and distinct filing sources, not social/profile link lists. No live URL checks performed.',summary,records};
  await mkdir('reports',{recursive:true});
  await writeFile('reports/external-link-inventory.json',JSON.stringify(result,null,2)+'\n');
  const csv = rows => rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
  await writeFile('reports/external-links.csv',csv([['kind','id','name','entityUrl','platform','url','source','verifiedOn'],...records.flatMap(r=>r.links.map(l=>[r.kind,r.id,r.name,r.entityUrl,l.platform,l.url,l.source,l.verifiedOn]))]));
  await writeFile('reports/external-link-gaps.csv',csv([['kind','id','name','entityUrl','current2026','reviewed','noLinks','noWebsite','noSocial','absentContactLinks'],...records.map(r=>[r.kind,r.id,r.name,r.entityUrl,r.current2026,r.reviewed,!r.links.length,!r.websiteCount,!r.socialCount,r.absentContactLinks?.length??0])]));
  await writeFile('reports/external-link-references.csv',csv([['kind','id','entityUrl','referenceUrl'],...records.flatMap(r=>r.referenceUrls.map(url=>[r.kind,r.id,r.entityUrl,url]))]));
  console.log(JSON.stringify(summary,null,2));
  console.log('Party dispositions',JSON.stringify(records.filter(r=>r.kind==='parties').map(({id,reviewStatus,links})=>({id,reviewStatus,links:links.length}))));
} finally { await server.close(); }
