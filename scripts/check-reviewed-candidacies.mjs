import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
const server = await createServer({ configFile:false, plugins:[svelte({compilerOptions:{dev:false}})], logLevel:'silent', server:{middlewareMode:true,hmr:false,ws:false} });
try {
  const { peopleById, filings } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { candidacyHistory, candidacyEvents } = await server.ssrLoadModule('/src/lib/candidacy-history.ts');
  const { resultForFiling, resultsForFiling } = await server.ssrLoadModule('/src/lib/filing-results.ts');
  const { tidySnapshot } = await server.ssrLoadModule('/src/lib/result-names.ts');
  const { reviewedCandidacies } = await server.ssrLoadModule('/src/lib/reviewed-candidacies.ts');
  const reviews = JSON.parse(await readFile('src/data/reviewed-candidacy-groups.json','utf8'));
  const person = peopleById.get('becky-edwards');
  const original = JSON.stringify(filings);
  const histories = candidacyHistory(person.filings);
  const groups = histories.filter(history => history.reviewId);
  assert.equal(groups.length,1);
  const group = groups[0], review = reviews[0];
  assert.equal(person.filings.length,16);
  assert.equal(histories.length,7);
  assert.equal(group.records.length,7);
  assert.equal(group.filing.officeId,'u-s-house-district-2');
  assert.equal(group.filing.partyId,'utah-republican-party');
  assert.equal(group.filing.county,'','County feeds are not residence metadata');
  assert.equal(group.filing.city,'');
  assert.deepEqual(group.filing.placeIds,person.filings.find(row=>row.recordId===review.canonicalRecordId).placeIds);
  assert.deepEqual(new Set(histories.flatMap(history=>history.records)),new Set(person.filings),'Every original record is retained exactly once');
  assert.equal(histories.find(history=>history.filing.year===2016).records.length,2);
  assert.equal(histories.find(history=>history.filing.year===2010).records.length,2);
  assert.equal(reviewedCandidacies(group.records.slice(1)).length,0,'Incomplete groups stay unmerged');
  assert.equal(reviewedCandidacies([...group.records,group.records[0]]).length,0,'Ambiguous duplicate IDs stay unmerged');
  for (const change of [{personId:'other'},{year:2024},{electionType:'general'},{source:'https://example.org/changed'},{officeId:'other'},{partyId:'other'},{county:'changed'},{city:'changed'},{status:'withdrew'}]) {
    assert.equal(reviewedCandidacies(group.records.map((row,i)=>i===1?{...row,...change}:row)).length,0,'Changed source context requires re-review');
  }
  const raw = JSON.parse(await readFile('public/data/results/2023-primary.json','utf8'));
  const snapshot = tidySnapshot(raw);
  const contest = resultForFiling(group.filing,snapshot);
  assert.equal(contest?.id,review.resultContestId);
  assert.equal(contest.county,null,'Use the statewide primary, not a county slice');
  assert.equal(contest.votesPublished,true);
  assert.equal(contest.official,true);
  assert.equal(contest.total,93410);
  assert.equal(contest.options.find(option=>option.name==='Becky Edwards').votes,30560);
  assert(raw.contests.filter(row=>row.source.includes('primary09052023_Demo')).every(row=>row.options.every(option=>option.votes===null)),'Roster placeholders remain unchanged beside official results');
  for (const row of group.records.filter(row=>row.recordId!==review.canonicalRecordId)) {
    const feed = raw.contests.find(contest=>contest.source===row.source);
    assert(feed,'Every feed source exists in the cached primary snapshot');
    assert.equal(feed.electionType,'primary');
    assert.equal(feed.electionDate,'2023-09-05');
    assert.deepEqual(feed.options.map(option=>option.name).sort(),['Becky Edwards','Bruce R Hough','Celeste Maloy']);
  }
  const events = candidacyEvents(group,{contest,snapshot});
  assert.deepEqual(events.map(event=>event.title),['Filed','Primary']);
  assert.equal(events[0].source,group.filing.source);
  assert.equal(events[1].date,'2023-09-05');
  assert.equal(events[1].source,review.resultSource);
  assert.equal(events[1].summary,'30,560 votes · 32.72%');
  assert.equal(resultForFiling(group.filing,{...snapshot,electionDate:'2024-09-05'}),undefined);
  assert.equal(resultForFiling(group.filing,{...snapshot,contests:snapshot.contests.map(c=>({...c,source:'https://example.org/changed'}))}),undefined);
  assert.equal(JSON.stringify(filings),original,'Display merging does not mutate imported or editorial records');
  const primaryEvidence = [];
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async url => ({ok:true,json:async()=>JSON.parse(await readFile(`public${url}`,'utf8'))});
  try {
    for (const [year,votes,total] of [[2008,1413,2710],[2010,2043,3523],[2016,2487,4778],[2022,123617,416703],[2023,30560,93410]]) {
      const history = histories.find(row=>row.filing.year===year);
      const primary = history.records.find(row=>row.electionType==='primary');
      assert(primary,`${year} primary candidacy is present`);
      const matched = await resultsForFiling(primary);
      assert(matched,`${year} primary result loads through the production loader`);
      assert.equal(matched.contest.official,true);
      assert.equal(matched.contest.votesPublished,true);
      assert.equal(matched.contest.options.find(option=>option.name==='Becky Edwards').votes,votes);
      assert.equal(matched.contest.total,total);
      assert.equal(matched.contest.options.reduce((sum,option)=>sum+option.votes,0),total,'Full ballot totals reconcile');
      const event = candidacyEvents(history,undefined,[matched]).find(event=>event.title==='Primary');
      assert(event?.summary?.startsWith(votes.toLocaleString('en-US')+' votes'),`${year} primary counts reach the timeline`);
      assert.equal(event.date,matched.contest.electionDate);
      primaryEvidence.push({year,votes,total,percent:(100*votes/total).toFixed(2),source:matched.contest.source,official:true});
    }
  } finally { globalThis.fetch=fetchBefore; }
  const { render } = await server.ssrLoadModule('svelte/server');
  const { default: Card } = await server.ssrLoadModule('/src/CandidacyCard.svelte');
  const markup = render(Card,{props:{history:group,navigate:()=>{}}}).body;
  assert(markup.includes('7 source records'));
  assert(markup.includes('popover="auto"') && markup.includes('aria-label="Close candidacy sources"'));
  assert(!markup.includes('<details'));
  for (const row of group.records) assert(markup.includes(`href="${row.source}"`),'Every retained source is exposed on the card');
  const report = {personId:person.id,reviewId:review.id,reviewedOn:review.reviewedOn,sourceRecords:person.filings.length,originalSourceRecords:14,beforeCards:12,afterCards:histories.length,primaryEvidence,primary2023:{beforeCards:7,afterCards:1,resultContestId:contest.id,votesPublished:true},preservedRecordIds:person.filings.map(row=>row.recordId),evidence:review,checks:'Passed: exact membership, fail-closed context checks, retained sources/IDs, distinct election years/stages, statewide result selection, all five official primary counts and dates, no inferred residence or outcomes.'};
  await writeFile('reports/becky-edwards-filing-merge.json',JSON.stringify(report,null,2)+'\n');
  const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows = group.records.map(row=>`<tr><td><a href="${esc(row.source)}">${esc(row.rawOfficeName ?? row.officeName)}</a><br><small>${esc(row.recordId)}</small></td><td>${esc(row.county||'State/declaration')}</td><td>${esc(row.partyName)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Becky Edwards filing consolidation</title><style>body{margin:3rem;font:16px/1.6 system-ui;color:#302f2b}main{max-width:1000px}a{color:#005b8f}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #ccc;padding:.7rem}small{overflow-wrap:anywhere}h1,h2{font-family:Georgia,serif}</style></head><body><main><h1>Becky Edwards filing consolidation</h1><p><a href="https://www.electionsutah.org/people/becky-edwards/">Becky Edwards</a> now has seven candidacy cards instead of the original twelve, including her newly recovered 2022 Senate candidacy. Her fourteen original source records remain unchanged; the 2008 and 2022 primary ballots add two records for a total of sixteen. Seven records for the <a href="https://www.electionsutah.org/elections/2023/">2023</a> <a href="https://www.electionsutah.org/offices/u-s-house-district-2/">U.S. House District 2</a> Republican primary are displayed on one card.</p><p>The <a href="${esc(group.filing.source)}">declaration record</a> establishes the canonical candidate/office. Six cached feeds list the same three candidates on September 5, 2023. County names identify reporting sources; they are not candidate residence or additional races. <a href="${esc(review.resultSource)}">Statewide primary source</a>.</p><h2>Seven preserved records → one candidacy</h2><table><thead><tr><th>Original office label and source</th><th>Reporting scope</th><th>Imported party</th></tr></thead><tbody>${rows}</tbody></table><h2>Official primary results</h2><ul>${primaryEvidence.map(row=>`<li><a href="https://www.electionsutah.org/elections/${row.year}/">${row.year}</a>: ${row.votes.toLocaleString('en-US')} votes · ${row.percent}% — <a href="${esc(row.source)}">official source</a>.</li>`).join('')}</ul><p>The 2023 Demo feed is retained as roster evidence with null counts. The official FEC compilation supplies full-district totals of 93,410, including Becky’s 30,560 votes. No general-election participation or outcome flag is inferred. The card’s source popover preserves all seven original records.</p><p>The 2008, 2010 and 2016 primary/general timelines are grouped with both stages preserved. Other election years remain separate. Original IDs, raw labels, and party omissions are retained; this is a display consolidation rather than deletion or a global office alias.</p><h2>Review workflow</h2><p>The <a href="filing-duplicate-review.html">existing duplicate review</a> compares office/party identities before looking for office wording variants. That excludes Becky’s malformed labels, missing party values, and county feed variants. This test uses an explicit reviewed record manifest and fails closed if membership or source context changes. No broader fuzzy merge rule has been enabled.</p><p>${esc(report.checks)}</p><p><a href="becky-edwards-filing-merge.json">Machine-readable review and evidence</a></p></main></body></html>`;
  await writeFile('reports/becky-edwards-filing-merge.html',html);
  console.log('Becky Edwards: 14 original records retained plus 2 recovered primary records; 12 → 7 cards, 7 → 1 in 2023; all five official primary results and timeline counts passed.');
} finally { await server.close(); }
