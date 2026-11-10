import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
const s=await createServer({root:process.cwd(),configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const {people,filings}=await s.ssrLoadModule('/src/lib/entities.ts');
 const {resultForFiling}=await s.ssrLoadModule('/src/lib/filing-results.ts');
 const {tidySnapshot}=await s.ssrLoadModule('/src/lib/result-names.ts');
 const {candidacyHistory}=await s.ssrLoadModule('/src/lib/candidacy-history.ts');
 const index=JSON.parse(await readFile('src/data/result-index.json'));
 const snapshots=new Map(await Promise.all(index.filter(d=>d.electionType.includes('primary')).map(async d=>[`${d.year}:${d.electionType}`,tidySnapshot(JSON.parse(await readFile('public'+d.url)))])));
 const rows=filings.filter(f=>f.electionType.includes('primary')).map(f=>{
 const snapshot=snapshots.get(`${f.year}:${f.electionType}`);const c=snapshot&&resultForFiling(f,snapshot);
 const ballotExpected=f.status==='primary_election'||f.status==='elected'||f.status==='defeated'&&/primary/i.test(f.sourceStatus);
 return {personId:f.personId,name:f.name,year:f.year,office:f.officeName,officeId:f.officeId,partyId:f.partyId,county:f.county,city:f.city,recordId:f.recordId,source:f.source,status:!ballotExpected?'not_primary_ballot':!snapshot?'no_dataset':!c?'unmatched':c.votesPublished===false?'unpublished':'published',contestId:c?.id};
 });
 const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>b-a).map(year=>({year,...Object.fromEntries(['published','unpublished','unmatched','no_dataset','not_primary_ballot'].map(k=>[k,rows.filter(r=>r.year===year&&r.status===k).length]))}));
 const split=people.flatMap(p=>{const hs=candidacyHistory(p.filings);const by=new Map();for(const h of hs){const k=[h.filing.year,h.filing.partyId].join(':');by.set(k,[...(by.get(k)??[]),h])}return [...by.values()].filter(g=>g.length>1).map(g=>({personId:p.id,name:p.name,year:g[0].filing.year,cards:g.length,offices:g.map(h=>h.filing.officeName),sources:g.map(h=>h.filing.source)}))});
 const report={generatedOn:new Date().toISOString().slice(0,10),scope:'All imported primary-stage records. Declaration-only, withdrawn and other non-ballot statuses are counted separately; they are not assumed to have primary vote totals. Missing imported data does not establish that published results are unavailable.',years,rows,split};
 await writeFile('reports/primary-coverage-audit.json',JSON.stringify(report,null,2)+'\n');
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const link=(kind,id,name)=>`<a href="https://www.electionsutah.org/${kind}/${esc(id)}/">${esc(name)}</a>`;
 const summary=years.map(y=>`<tr><td>${link('elections',y.year,y.year)}</td><td>${y.published}</td><td>${y.unpublished}</td><td>${y.unmatched}</td><td>${y.no_dataset}</td><td>${y.not_primary_ballot}</td></tr>`).join('');
 const exceptions=rows.filter(r=>['unpublished','unmatched','no_dataset'].includes(r.status));
 const detail=exceptions.map(r=>`<tr><td>${link('people',r.personId,r.name)}</td><td>${link('elections',r.year,r.year)}</td><td>${link('offices',r.officeId,r.office)}</td><td>${esc(r.status)}</td><td><a href="${esc(r.source)}">Record source</a></td></tr>`).join('');
 await writeFile('reports/primary-coverage-audit.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Primary result coverage</title><style>body{margin:3rem;font:15px/1.6 system-ui;color:#302f2b}table{border-collapse:collapse;width:100%;margin-bottom:2rem}th,td{border-bottom:1px solid #ccc;text-align:left;vertical-align:top;padding:.5rem}a{color:#005b8f}td{overflow-wrap:anywhere}h1,h2{font-family:Georgia,serif}</style></head><body><h1>Primary result coverage</h1><p>${esc(report.scope)}</p><p>Published means a unique result match with published votes. Unpublished means the matched import has no totals. Unmatched means a dataset exists but the record has no unique result match. No dataset means that election/stage has not been imported. These are import statuses, not findings that an election had no results.</p><table><thead><tr><th>Year</th><th>Published match</th><th>Unpublished import</th><th>Unmatched ballot</th><th>No dataset</th><th>Not a primary ballot record</th></tr></thead><tbody>${summary}</tbody></table><p><a href="primary-coverage-audit.json">Full machine-readable audit</a> · <a href="filing-duplicate-review.html">Identity/filing exception queue</a> · <a href="candidacy-batch-review.html">Applied source batches</a></p><h2>Records needing further source work</h2><p>Full exception rows remain visible so empty caches cannot be mistaken for unavailable election returns.</p><table><thead><tr><th>Person</th><th>Year</th><th>Office</th><th>Import status</th><th>Evidence</th></tr></thead><tbody>${detail}</tbody></table></body></html>`);
 console.log(JSON.stringify({years,primaryBallotRecords:rows.filter(r=>r.status!=='not_primary_ballot').length,remaining:exceptions.length}));
}finally{await s.close()}
