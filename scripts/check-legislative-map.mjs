import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const server=await createServer({configFile:false,cacheDir:new URL('../.firecrawl/check-map-vite',import.meta.url).pathname,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const {STATE_VIEW,MAX_ZOOM,districtResults,fitBounds,zoomView,constrainView,pathBounds,pathCentroid,resultState}=await server.ssrLoadModule('/src/lib/legislative-map.ts');
 const data=JSON.parse(await readFile(new URL('../public/data/2026-results.json',import.meta.url)));
 const geometry=JSON.parse(await readFile(new URL('../public/data/utah-legislative-boundaries.json',import.meta.url)));
 const counties=JSON.parse(await readFile(new URL('../src/data/utah-county-paths.json',import.meta.url)));
 function contained(view){assert(view.width>=STATE_VIEW.width/MAX_ZOOM-1e-6);assert(view.width<=STATE_VIEW.width+1e-6);const x=view.x+view.width/2,y=view.y+view.height/2;assert(x>=STATE_VIEW.x-1e-6&&x<=STATE_VIEW.x+STATE_VIEW.width+1e-6);assert(y>=STATE_VIEW.y-1e-6&&y<=STATE_VIEW.y+STATE_VIEW.height+1e-6);}
 const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
 const triangle=pathCentroid('M0,0L6,0L0,6Z');close(triangle[0],2);close(triangle[1],2);
 const reversed=pathCentroid('M0,6L6,0L0,0Z');close(reversed[0],2);close(reversed[1],2);
 const multipart=pathCentroid('M0,0L2,0L2,2L0,2ZM4,0L8,0L8,4L4,4Z');close(multipart[0],5);close(multipart[1],1.8);
 const hole=pathCentroid('M0,0L10,0L10,10L0,10ZM6,2L8,2L8,4L6,4Z');close(hole[0],(500-28)/96);close(hole[1],(500-12)/96);

 for(const [chamber,total,races] of [['house',75,75],['senate',29,15]]){
  const districts=geometry.chambers[chamber].districts;assert.equal(districts.length,total);assert.equal(new Set(districts.map(d=>d.number)).size,total);
  const results=districtResults(data,chamber);assert.equal(results.size,races);for(const [number,contest] of results){assert(districts.some(d=>d.number===number),contest.name);assert.equal(contest.category,chamber==='house'?'State House':'State Senate');}
  for(const district of districts){assert(district.path.startsWith('M')&&district.path.endsWith('Z'));const bounds=pathBounds(district.path);bounds.forEach((value,index)=>assert(Math.abs(value-district.bounds[index])<.002));contained(fitBounds(district.bounds));}
 }
 assert.equal(resultState(undefined),'No 2026 result published');assert.equal(resultState({...data.contests[0],total:0}),'No votes reported');
 assert.equal(resultState({...data.contests[0],options:[{votes:1},{votes:1}]}),'Tied');
 let view={...STATE_VIEW};for(let i=0;i<100;i++){view=zoomView(view,1.5);contained(view);}assert(Math.abs(view.width-STATE_VIEW.width/MAX_ZOOM)<1e-6);
 for(let i=0;i<100;i++){view=zoomView(view,1/1.5);contained(view);}assert.deepEqual(view,STATE_VIEW);
 contained(constrainView({x:-100000,y:100000,width:20,height:20}));
 for(const county of counties){const bounds=pathBounds(county.path);const centroid=pathCentroid(county.path);const fit=fitBounds(bounds,centroid);contained(fit);close(fit.x+fit.width/2,centroid[0]);close(fit.y+fit.height/2,centroid[1]);assert(fit.x<=bounds[0]&&fit.y<=bounds[1]);assert(fit.x+fit.width>=bounds[2]&&fit.y+fit.height>=bounds[3]);}
 console.log('Official geometry: 75 House + 29 Senate districts; results matched: 75 House + 15 Senate. County fits, zoom limits, pan limits, and missing/tied-result states passed.');
} finally {await server.close()}
