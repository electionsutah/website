/** Read-only cross-cycle person review. Does not change identity aliases or source records. */
import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const server = await createServer({ configFile:false, logLevel:'silent', server:{middlewareMode:true,hmr:false,ws:false} });
const norm = s => (s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const parts = s => s.toLowerCase().replace(/["“”‘’']/g,'').replace(/[^a-z\s]/g,' ').trim().split(/\s+/).filter(Boolean);
const suffixes = new Set(['jr','sr','ii','iii','iv']);
const nicknames = ['robert bob rob bobby','william bill billy will','richard rick rich dick','james jim jimmy','thomas tom tommy','michael mike','joseph joe','daniel dan danny','david dave','steven stephen steve','christopher chris','elizabeth liz beth','rebecca becky','kenneth ken','ronald ron','donald don','charles chuck charlie','edward ed ted','patricia pat patti','margaret maggie','bradley brad','douglas doug','anthony tony','timothy tim','lawrence larry','benjamin ben','joshua josh','andrew andy','jeffrey jeff','gregory greg','katherine kathryn kathy kathie kate'].map(x=>x.split(' '));
function distance(a,b){let r=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const n=[i];for(let j=1;j<=b.length;j++)n[j]=Math.min(n[j-1]+1,r[j]+1,r[j-1]+(a[i-1]!==b[j-1]));r=n;}return r[b.length];}
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try {
 const { people } = await server.ssrLoadModule('/src/lib/entities.ts');
 const ledger = JSON.parse(await readFile('reports/duplicate-card-review-status.json','utf8'));
 const prior = new Map();
 for(const c of Object.values(ledger.cases??{})){const ids=[...new Set(c.personIds??[])].sort();if(ids.length===2){const key=ids.join('|');prior.set(key,[...(prior.get(key)??[]),{id:c.id,status:c.status,recommendation:c.recommendation}]);}}
 const prepared = people.map(p=>{const words=parts(p.name);const suffix=words.filter(w=>suffixes.has(w)).join(' ');const clean=words.filter(w=>!suffixes.has(w));return {p,first:clean[0],last:clean.at(-1),middle:clean.slice(1,-1),suffix};}).filter(x=>x.first&&x.last);
 const byLast=new Map();for(const x of prepared){const list=byLast.get(x.last)??[];list.push(x);byLast.set(x.last,list);}
 const pairs=new Map();
 function consider(a,b){if(a.p.id===b.p.id)return;const key=[a.p.id,b.p.id].sort().join('|');if(pairs.has(key))return;
 const first=a.first===b.first,last=a.last===b.last;
 const nickname=nicknames.some(g=>g.includes(a.first)&&g.includes(b.first));
 const initial=a.first[0]===b.first[0]&&(a.first.length===1||b.first.length===1);
 const typo=(first&&distance(a.last,b.last)===1)||(last&&Math.min(a.first.length,b.first.length)>=3&&distance(a.first,b.first)===1);
 if(!(last&&(first||nickname||initial)||typo))return;
 const compatible=!a.middle.length||!b.middle.length||(a.middle.length===b.middle.length&&a.middle.every((m,i)=>m===b.middle[i]||((m.length===1||b.middle[i].length===1)&&m[0]===b.middle[i][0])));
 if(!compatible)return;
 let best;for(const x of a.p.filings)for(const y of b.p.filings){const gap=Math.abs(x.year-y.year);if(gap>12)continue;
 const sameOffice=x.officeId===y.officeId;
 const sharedCity=!!x.city&&norm(x.city)===norm(y.city),sharedCounty=!!x.county&&norm(x.county)===norm(y.county);
 const placeConflict=!!x.city&&!!y.city&&!sharedCity;
 const specificOffice=sameOffice&&(/^(U\.S\.|State |Governor|Attorney General)/.test(x.officeName)||sharedCity||sharedCounty||! /^(mayor|council|city council|town council|council member)$/i.test(x.officeName));
 if(!specificOffice&&!sharedCity)continue;
 const score=(sameOffice?5:0)+(sharedCity?3:0)+(sharedCounty?1:0)+(gap===0?3:gap<=4?2:0)+(first?3:nickname?2:0)-(placeConflict?3:0)-(a.suffix!==b.suffix?3:0);
 if(!best||score>best.score)best={score,gap,sameOffice,sharedCity,sharedCounty,placeConflict,rows:[x,y]};}
 if(!best)return;
 const rows=best.rows.map((r,i)=>({personId:[a,b][i].p.id,name:r.personId===[a,b][i].p.id?r.name:r.runningMate,recordId:r.recordId,year:r.year,office:r.officeName,officeId:r.officeId,city:r.city,county:r.county,party:r.partyName,source:r.source}));
 const review=prior.get(key)??[];
 const sameSourceSameYear=rows[0].source===rows[1].source&&rows[0].year===rows[1].year;
 pairs.set(key,{id:createHash('sha256').update(key).digest('hex').slice(0,12),people:[a.p,b.p].map(p=>({id:p.id,name:p.name,years:p.years,filingCount:p.filings.length})),nameMatch:first&&last?'First/last match; middle-name or suffix variant':nickname&&last?'Possible nickname':initial&&last?'First-initial expansion':'Possible spelling variant',priority:best.score>=12&&!best.placeConflict&&!sameSourceSameYear&&a.suffix===b.suffix?'stronger':'investigate',sameSourceSameYear,...best,rows,priorReview:review});
 }
 for(const list of byLast.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)consider(list[i],list[j]);
 const byFirst=new Map();for(const x of prepared){const l=byFirst.get(x.first)??[];l.push(x);byFirst.set(x.first,l);}for(const list of byFirst.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)if(distance(list[i].last,list[j].last)===1)consider(list[i],list[j]);
 const all=[...pairs.values()].sort((a,b)=>b.score-a.score||a.people[0].name.localeCompare(b.people[0].name));
 const report={generatedOn:new Date().toISOString(),scope:'Cross-cycle, distinct resolved person profiles. Names require shared office or city within 12 years. Candidate generation only; no identity merges. Existing aliases already collapse approved identities.',limitations:'Shared offices, party labels, and compatible names do not prove identity. Generic offices and geography can still conceal namesakes. Nickname coverage is bounded; arbitrary name changes and duplicates already collapsed into one ID are outside this audit.',peopleChecked:people.length,counts:{pairs:all.length,stronger:all.filter(x=>x.priority==='stronger').length,previouslyQueued:all.filter(x=>x.priorReview.length).length,newPairs:all.filter(x=>!x.priorReview.length).length},pairs:all};
 await writeFile('reports/person-identity-review-2026-11-14.json',JSON.stringify(report,null,2)+'\n');
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Possible duplicate people — November 14, 2026</title><style>body{margin:3rem;font:16px/1.55 system-ui;color:#262626}main{max-width:1100px}article{border-top:1px solid #bbb;padding:1rem 0}a{color:#005b8f}table{border-collapse:collapse;width:100%}td,th{text-align:left;vertical-align:top;padding:.5rem;border-bottom:1px solid #ddd}code{overflow-wrap:anywhere}</style><body><main><h1>Possible duplicate people</h1><p>${esc(report.scope)}</p><p>${report.peopleChecked} resolved people checked; ${all.length} candidate pairs, ${report.counts.stronger} with stronger internal evidence, ${report.counts.newPairs} absent from the existing card-review ledger. No production data changed.</p><p>${esc(report.limitations)}</p><p>Evidence below comes from imported source records; this pass made no network requests. “Stronger” means higher priority for source review, not confirmed identity. Prior dispositions are retained and must be honored.</p><p><a href="person-identity-review-2026-11-14.json">Full JSON export</a></p>${all.map(c=>`<article id="${c.id}"><h2>${c.people.map(p=>`<a href="https://www.electionsutah.org/people/${esc(p.id)}/">${esc(p.name)}</a>`).join(' / ')}</h2><p><strong>${c.priority==='stronger'?'Stronger internal evidence':'Investigate'}</strong> · ${esc(c.nameMatch)} · ${c.gap} year gap. ${c.placeConflict?'Residence/city conflict. ':''}${c.sameSourceSameYear?'Both names occur in the same source/year: possible separate candidates; hold for source inspection. ':''}${c.people.map(p=>`${esc(p.name)}: ${p.years.join(', ')} (${p.filingCount} records)`).join('; ')}.</p>${c.priorReview.length?`<p>Prior review: ${c.priorReview.map(r=>`${esc(r.id)} — ${esc(r.status)}: ${esc(r.recommendation)}`).join('; ')}</p>`:''}<table><tr><th>Imported name / year</th><th>Office / location</th><th>Source evidence</th></tr>${c.rows.map(r=>`<tr><td>${esc(r.name)} · <a href="https://www.electionsutah.org/elections/${r.year}/">${r.year}</a></td><td><a href="https://www.electionsutah.org/offices/${esc(r.officeId)}/">${esc(r.office)}</a><br>${esc([r.city,r.county].filter(Boolean).join(', '))} · ${esc(r.party)}</td><td><a href="${esc(r.source)}">Imported source</a><br><code>${esc(r.recordId)}</code></td></tr>`).join('')}</table></article>`).join('')}</main></body></html>`;
 await writeFile('reports/person-identity-review-2026-11-14.html',html);console.log(JSON.stringify(report.counts));console.log(all.slice(0,35).map(c=>`${c.priority} | ${c.people.map(p=>p.name).join(' / ')} | ${c.rows.map(r=>r.year+' '+r.office).join(' / ')} | prior ${c.priorReview.length}`).join('\n'));
} finally {await server.close();}
