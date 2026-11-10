/** Read-only review queue. No candidate data or editorial overrides are changed. */
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ configFile:false, logLevel:'silent', server:{ middlewareMode:true, hmr:false, ws:false } });
try {
  const { filings, peopleById, identityKey, placesById, slug } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { candidacyHistory } = await server.ssrLoadModule('/src/lib/candidacy-history.ts');
  const displayGroups = candidacyHistory(filings);
  const displayGroupFor = new Map(displayGroups.flatMap(group => group.records.map(row => [row, group])));
  const normalize = value => slug(value ?? '').replaceAll('-','');
  const groups = (rows,key) => { const out=new Map();for(const row of rows){const k=key(row);const list=out.get(k)??[];list.push(row);out.set(k,list);}return [...out.values()]; };
  const national = row => /^(U\.S\.|State (House|Senate|School Board)|Governor|Attorney General|State Auditor|State Treasurer)/.test(row.officeName);
  const geo = (a,b) => ['county','city'].every(field => !a[field] || !b[field] || normalize(a[field])===normalize(b[field]));
  const realStages = (a,b) => a.status!=='filed' && b.status!=='filed' && a.electionType!==b.electionType;
  const digits = row => (row.officeName.match(/\d+/g)??[]).join(',');
  function officeCore(row) {
    let name=row.officeName.toLowerCase();
    for (const place of [row.city,row.county && `${row.county} County`].filter(Boolean).sort((a,b)=>b.length-a.length)) {
      const prefix=place.toLowerCase();if(name.startsWith(prefix+' '))name=name.slice(prefix.length).trim();
    }
    return normalize(name.replace(/\b(city|town|member|members|of the)\b/g,'').replace(/\bat[- ]large\b/g,'atlarge'));
  }
  const flat = row => ({ recordId:row.recordId, personId:row.personId, name:row.name, year:row.year, office:row.officeName, officeId:row.officeId, party:row.partyName, electionType:row.electionType, status:row.status, sourceStatus:row.sourceStatus, county:row.county, city:row.city, source:row.source, placeIds:row.placeIds });
  const queue=[],seen=new Set();let separateStages=0;
  function add(tier,reason,a,b,extra={}) {
    if (displayGroupFor.get(a) === displayGroupFor.get(b)) return;
    const key=[filings.indexOf(a),filings.indexOf(b)].sort((a,b)=>a-b).join(':');if(seen.has(key))return;seen.add(key);
    queue.push({tier,reason,rows:[flat(a),flat(b)],...extra});
  }
  for (const list of groups(filings,row=>JSON.stringify([row.personId,row.year,row.officeId,row.partyId]))) {
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];if(realStages(a,b)){separateStages++;continue;}
      if ((a.status==='filed' || b.status==='filed') && new Set(list.filter(row=>row.status!=='filed').map(row=>row.electionType)).size>1) {add(2,'An initial Filed record matches both a real primary and a real general appearance. Choose how to attach its filing evidence without collapsing the two election stages.',a,b);continue;}
      if(!geo(a,b)){add(3,'Same identity and office, but published location fields conflict; verify residence versus jurisdiction.',a,b);continue;}
      const exactGeo=['county','city'].every(field=>normalize(a[field])===normalize(b[field]));
      const exactStage=a.electionType===b.electionType;
      add(exactGeo&&exactStage?0:1,exactGeo&&exactStage?'Same person, year, office, party, stage and location; compare source/status before consolidation.':'Same person, year, office and party; one source omits location or labels only an initial filing.',a,b);
    }
  }
  // Same known person, same year and party, compatible stage; office wording varies.
  for (const list of groups(filings,row=>JSON.stringify([row.personId,row.year,row.partyId]))) {
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];if(a.officeId===b.officeId || realStages(a,b) || !geo(a,b) || digits(a)!==digits(b))continue;
      if(officeCore(a)===officeCore(b))add(2,'Same known person and cycle; office differs only in local prefixes or office wording.',a,b);
    }
  }
  function nameParts(name){return name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,'').trim().split(/\s+/).filter(word=>!['jr','sr','ii','iii','iv'].includes(word));}
  function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length];}
  // Different profiles require a shared office/year/party and non-conflicting geography.
  for (const list of groups(filings,row=>JSON.stringify([row.year,row.officeId,row.partyId]))) {
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];if(a.personId===b.personId || realStages(a,b) || !geo(a,b))continue;
      // Generic local offices need actual shared geography; blank is not supporting evidence.
      if(!national(a) && !['county','city'].some(field=>a[field] && b[field] && normalize(a[field])===normalize(b[field])))continue;
      const na=nameParts(a.name),nb=nameParts(b.name);if(na.length<2 || nb.length<2)continue;
      const first=na[0]===nb[0],last=na.at(-1)===nb.at(-1);
      const ma=na.slice(1,-1),mb=nb.slice(1,-1);
      const compatibleMiddle=!ma.length || !mb.length || (ma.length===mb.length && ma.every((part,k)=>part===mb[k] || (part.length===1 || mb[k].length===1) && part[0]===mb[k][0]));
      if(first&&last&&compatibleMiddle && /President|Governor/.test(a.officeName) && Math.max(ma.length,mb.length)>2){add(4,'A combined ticket label appears to have become a person name; review candidate/running-mate parsing before any identity merge.',a,b);continue;}
      if(first&&last&&compatibleMiddle){add(5,'Different profiles; same first/last name and compatible missing or expanded middle initials in the same contest context.',a,b);continue;}
      const edit=distance(normalize(a.name),normalize(b.name));
      if(edit<=2 && (first||last) && Math.min(normalize(a.name).length,normalize(b.name).length)>=8)add(6,'Different profiles; one or two character edits, with a shared first or last name and contest context. Could be different candidates.',a,b,{editDistance:edit});
    }
  }
  queue.sort((a,b)=>a.tier-b.tier || a.rows[0].name.localeCompare(b.rows[0].name) || b.rows[0].year-a.rows[0].year);
  queue.forEach((item,i)=>item.id=`FD-${String(i+1).padStart(4,'0')}`);
  const tiers=['Exact filing identity','Exact identity, incomplete metadata','Stage ambiguity / office wording','Conflicting geography','Ticket parsing anomalies','Middle-name / initial variants','Spelling variants'];
  const counts=tiers.map((label,tier)=>({tier,label,pairs:queue.filter(row=>row.tier===tier).length,people:new Set(queue.filter(row=>row.tier===tier).flatMap(row=>row.rows.map(f=>f.personId))).size}));
  const report={scope:'Unresolved source-record pairs after editorial identity aliases and current candidacy timeline grouping. Pairs already displayed together are excluded. This is a review queue, not proven duplicates; distinct primary/general appearances are excluded.',counts,alreadyGroupedCandidacies:displayGroups.filter(group=>group.records.length>1).length,separateStagePairsExcluded:separateStages,review:queue};
  await writeFile('reports/filing-duplicate-review.json',JSON.stringify(report,null,2)+'\n');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entity=(kind,id,label)=>`<a href="https://www.electionsutah.org/${kind}/${esc(id)}/">${esc(label)}</a>`;
  function record(row){return `<div class="record"><strong>${entity('people',row.personId,row.name)}</strong> · ${entity('elections',row.year,row.year)}<p>${entity('offices',row.officeId,row.office)} · ${esc(row.party)}</p><p>${esc(row.electionType)} · ${esc(row.sourceStatus)}<br>${esc([row.county,row.city].filter(Boolean).join(' / ')||'Location not published')}</p><p>${row.source?`<a href="${esc(row.source)}" target="_blank" rel="noreferrer">Source record ↗</a>`:'No source URL on this record'}</p><code>${esc(row.recordId)}</code></div>`;}
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Filing duplicate review — Elections Utah</title><style>body{margin:3rem;color:#302f2b;background:#faf9f5;font:16px/1.5 system-ui,sans-serif}h1,h2{font-family:Georgia,serif}a{color:#006eac}input,select{font:inherit;padding:.5rem;max-width:100%}.tools{display:flex;flex-wrap:wrap;gap:1rem;margin:2rem 0}.pair{border:1px solid #ccc8bf;padding:1.5rem;margin:1rem 0;background:white}.pair h2{margin:0 0 .5rem;font-size:1.3rem}.records{display:grid;grid-template-columns:1fr 1fr;gap:2rem}.record p{margin:.5rem 0}code{font-size:11px;overflow-wrap:anywhere}table{border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #ccc8bf;padding:.5rem 1rem .5rem 0}.summary{max-width:75ch}@media(max-width:700px){.records{grid-template-columns:1fr}}</style></head><body><h1>Filing duplicate review</h1><p class="summary">${esc(report.scope)} Underlying source records are preserved; pairs already grouped on one timeline are excluded. Review exact identities first, then incomplete metadata, office wording, conflicting geography, ticket parsing, middle-name variants, and spelling variants. A conflicting stage or seat number must not be resolved through fuzzy matching alone.</p><table><thead><tr><th>Review tier</th><th>Pairs</th><th>Profiles</th></tr></thead><tbody>${counts.map(row=>`<tr><td>${esc(row.label)}</td><td>${row.pairs}</td><td>${row.people}</td></tr>`).join('')}</tbody></table><p>${separateStages} distinct-stage pairs excluded. <a href="filing-duplicate-review.json">Full review data</a>.</p><div class="tools"><label>Search <input id="search" type="search" placeholder="Name, office, year, or county"></label><label>Tier <select id="tier"><option value="">All tiers</option>${tiers.map((label,tier)=>`<option value="${tier}">${esc(label)}</option>`).join('')}</select></label><span id="count" role="status"></span></div>${queue.map(item=>`<article class="pair" data-tier="${item.tier}"><h2>${item.id} · ${esc(tiers[item.tier])}</h2><p>${esc(item.reason)}</p><div class="records">${item.rows.map(record).join('')}</div></article>`).join('')}<script>const rows=[...document.querySelectorAll('.pair')];function filter(){let visible=0;for(const row of rows){row.hidden=!!((tier.value&&row.dataset.tier!==tier.value)||(search.value&&!row.innerText.toLowerCase().includes(search.value.toLowerCase())));if(!row.hidden)visible++;}document.getElementById('count').textContent=visible+' pairs';}const search=document.getElementById('search'),tier=document.getElementById('tier');search.addEventListener('input',filter);tier.addEventListener('change',filter);filter();</script></body></html>`;
  await writeFile('reports/filing-duplicate-review.html',html);
  console.log(JSON.stringify({counts,separateStages,abrian:queue.filter(item=>item.rows.some(row=>row.personId==='abrian-b-velarde')),examples:tiers.map((label,tier)=>({label,examples:queue.filter(row=>row.tier===tier).slice(0,5).map(row=>({id:row.id,rows:row.rows.map(f=>({personId:f.personId,name:f.name,year:f.year,office:f.office,stage:f.electionType,status:f.status,county:f.county,city:f.city}))}))}))},null,2));
} finally {await server.close();}
