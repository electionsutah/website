import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const report=JSON.parse(await readFile(new URL('../reports/historical-newspaper-elections.json',import.meta.url),'utf8'));
const server=await createServer({configFile:false,logLevel:'error',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {municipalResults}=await server.ssrLoadModule('/src/lib/municipal-results.ts');
 const {filings}=await server.ssrLoadModule('/src/lib/entities.ts');
 const officeIds=new Map(filings.flatMap(f=>f.placeIds.map(p=>[JSON.stringify([f.year,p,f.officeName]),f.officeId])));
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const link=(path,label)=>`<a href="https://www.electionsutah.org${path}">${esc(label)}</a>`;
 let html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Historical newspaper election import</title><style>body{margin:3rem;font:16px/1.6 system-ui;color:#31302d;max-width:1200px}table{border-collapse:collapse;width:100%;margin-block:1.5rem}td,th{text-align:left;padding:.5rem;border-bottom:1px solid #c8c6c0}a{color:#006eb7}section{margin-block:3rem}h2{border-top:1px solid #c8c6c0;padding-top:1rem}.bar{display:block;height:.5rem;background:#006eb7;max-width:100%}</style><body><h1>Historical newspaper election import</h1><p>Imported November 6, 2026. Contemporary Deseret News returns are unofficial. Names, party labels and write-in status follow the published entries. Outcomes are unverified. Unknown or illegible tallies are shown as —, not zero. Subtotals include only known votes for listed options; unnamed write-ins are not invented as people.</p>';
 html+='<h2>Coverage by source year</h2><table><tr><th>Year and source</th><th>Jurisdictions</th><th>Candidate appearances</th><th>Candidate contests</th><th>Measures</th></tr>';
 const summary=[];
 for(const {year,url} of report.sources){const cs=report.contests.filter(c=>c.year===year);const candidates=cs.filter(c=>c.kind==='candidate').reduce((n,c)=>n+c.options.length,0);const row={year,jurisdictions:new Set(cs.map(c=>c.municipality)).size,candidateAppearances:candidates,candidateContests:cs.filter(c=>c.kind==='candidate').length,measures:cs.filter(c=>c.kind==='measure').length};summary.push(row);html+=`<tr><th>${link(`/elections/${year}/`,year)} · <a href="${esc(url)}">Newspaper source</a></th><td>${row.jurisdictions}</td><td>${candidates}<span class="bar" style="width:${candidates/2000*100}%"></span></td><td>${row.candidateContests}</td><td>${row.measures}</td></tr>`;}
 html+='</table><p>School-district measures are shown on their county pages with the district named in the contest. Historical Hiawatha, Sunnyside and Ophir records are retained. Salt Lake County is excluded from the 1991 article; other missing places or races are source gaps, not evidence that elections did not occur.</p><h2>Source limitations and unresolved entries</h2><ul>';
 for(const issue of [...report.issues,...report.narrativeEntries])html+=`<li>${issue.year} · ${esc(issue.place)}: ${esc((issue.details??[issue.reason]).join(' '))}</li>`;
 html+='</ul>';
 for(const {year}of report.sources){html+=`<section><h2>${year} imported contests</h2>`;for(const c of municipalResults.filter(c=>c.year===year&&!c.official)){html+=`<h3>${link(`/places/${c.placeId}/`,c.municipality)} · ${officeIds.has(JSON.stringify([c.year,c.placeId,c.office]))?link(`/offices/${officeIds.get(JSON.stringify([c.year,c.placeId,c.office]))}/`,c.office):esc(c.office)}</h3><p>${c.kind==='candidate'?'Candidate contest':'Ballot question'} · <a href="${esc(c.source)}">Unofficial newspaper source</a></p><table><tr><th>${c.kind==='candidate'?'Candidate':'Response'}</th><th>Votes</th><th>Write-in</th></tr>`;for(const o of c.options)html+=`<tr><td>${o.personId?link(`/people/${o.personId}/`,o.name):esc(o.name)}</td><td>${o.votes??'—'}</td><td>${o.writeIn?'Yes':'Not labeled'}</td></tr>`;html+='</table>';for(const n of c.notes.slice(1))html+=`<p>${esc(n)}</p>`;}html+='</section>';}
 html+='</body></html>\n';
 await writeFile(new URL('../reports/historical-newspaper-elections.html',import.meta.url),html);
 await writeFile(new URL('../reports/historical-newspaper-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
 console.log(summary);
}finally{await server.close()}
