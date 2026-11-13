import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {sortByElectionYearAndSurname,surnameSortKey}=await server.ssrLoadModule('/src/lib/people-sort.ts');
 const rows=[{name:'Aaron Zane',year:2026},{name:'Zoe Adams',year:2026},{name:'Amy Adams',year:2026},{name:'Abe Baker',year:2024}];
 const original=JSON.stringify(rows);
 assert.deepEqual(sortByElectionYearAndSurname(rows,r=>r.year,r=>r.name).map(r=>r.name),['Amy Adams','Zoe Adams','Aaron Zane','Abe Baker']);
 assert.equal(JSON.stringify(rows),original,'Input order and records remain intact');
 assert(surnameSortKey('John Smith Jr.').startsWith('Smith,'));
 assert(surnameSortKey('J. Antonio De La Cruz').startsWith('De La Cruz,'));
 assert(surnameSortKey('John “Frugal” Dougall').startsWith('Dougall,'));
 assert(surnameSortKey('Ann Vo-Duc').startsWith('Vo-Duc,'));
 const {people}=await server.ssrLoadModule('/src/lib/entities.ts');
 const sorted=sortByElectionYearAndSurname(people,p=>p.years[0]??0,p=>p.name);
 assert.equal(new Set(sorted.map(p=>p.id)).size,people.length);
 for(let i=1;i<sorted.length;i++)assert((sorted[i-1].years[0]??0)>=(sorted[i].years[0]??0));
 console.log(`People sorting: ${sorted.length} people retained; newest year, surname, full-name ties, suffixes, compound surnames and non-mutation passed.`);
}finally{await server.close()}
