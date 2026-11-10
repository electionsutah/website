import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {createServer} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
const server=await createServer({configFile:false,plugins:[svelte({compilerOptions:{dev:false}})],logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const {render}=await server.ssrLoadModule('svelte/server');
 const {default:Header}=await server.ssrLoadModule('/src/FilingOfficeHeader.svelte');
 const {filings}=await server.ssrLoadModule('/src/lib/entities.ts');
 const filing=filings.find(f=>f.year===2026&&f.officeId==='u-s-house-district-3'&&f.partyId==='utah-republican-party');
 const draw=row=>render(Header,{props:{filing:row,navigate:()=>{}}}).body;
 const body=draw(filing);
 assert(body.includes('src="/maps/us-house/3.svg"'));
 assert(body.includes('2026–2032 boundaries'));
 const heading=body.indexOf('</h3>'), party=body.indexOf('class="filing-party ');
 assert(heading>=0&&party>heading,'Party sits beneath the office title');
 assert(!body.includes('class="filing-jurisdiction'));
 assert(!body.includes('popover="auto"'),'No jurisdiction block or popover on filing cards');
 const historical=draw({...filing,year:1996});
 assert(historical.includes('Current reference map'));
 const unknown=draw({...filing,officeId:'no-reviewed-boundary',officeName:'Unverified office'});
 assert(!unknown.includes('class="filing-minimap'));
 assert(!unknown.includes('class="filing-jurisdiction'));
 const statewide=filings.find(f=>f.officeId==='u-s-senate');
 assert(draw(statewide).includes('src="/maps/utah.svg"'));
 await access('public/maps/us-house/3.svg');
 console.log('Filing header: minimap, party order, no jurisdiction block, historical dates and unknown/statewide boundaries passed.');
} finally {await server.close();}
