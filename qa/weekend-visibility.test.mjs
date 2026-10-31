// CHR-2014 / PR #21 review: ongoing timed events stay visible through their end
// in the ALL_EVENTS pipeline and all three weekend views. No network.
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'vite';
let server,content,eventTime;
before(async()=>{
 server=await createServer({server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',resolve:{alias:{'react-router-dom':new URL('../node_modules/react-router-dom/dist/index.mjs',import.meta.url).pathname}},ssr:{resolve:{conditions:['module-sync','import']}}});
 [content,eventTime]=await Promise.all(['/src/site/content.tsx','/src/site/eventTime.ts'].map(p=>server.ssrLoadModule(p)));
});
after(async()=>{await server?.close()});
const H=3600_000, ct=(m,d,h)=>Date.UTC(2026,m-1,d,h+6); // CST, Nov 2026
const SAT=ct(11,7,12);
const ev=(id,x)=>({title:'Fall fair '+id,description:'',venue:'Leander',category:'Community',...x,id});
const thuSun=ev('thu-sun',{startsAt:ct(11,5,10),endsAt:ct(11,8,18)});
// The three weekend views on the pipeline output, using the predicates in source.
const views=(list,now)=>({
 events:list.filter(e=>eventTime.overlapsDateFilter(e,'This Weekend',now)),
 spotlight:list.filter(e=>eventTime.overlapsDateFilter(e,'This Weekend',now)),
 upcoming:list.slice(0,50).filter(e=>eventTime.overlapsDateFilter(e,'This Weekend',now)),
});
test('views and ALL_EVENTS are wired to the pipeline and overlap helper',async()=>{
 const c=await fs.readFile(new URL('../src/site/content.tsx',import.meta.url),'utf8');
 assert.match(c,/export const ALL_EVENTS: LiveEvent\[\] = selectListedEvents\(eventsRaw as LiveEvent\[\], Date\.now\(\)\);/);
 const a=await fs.readFile(new URL('../src/site/conceptA.tsx',import.meta.url),'utf8');
 assert.equal((a.match(/ALL_EVENTS\.filter\(\(e\) => overlapsDateFilter\(e, "This Weekend", now\.getTime\(\)\)\)/g)||[]).length,1);
 assert.equal((a.match(/events\.filter\(\(e: EventItem\) => overlapsDateFilter\(e, "This Weekend", now\.getTime\(\)\)\)/g)||[]).length,1);
 const p=await fs.readFile(new URL('../src/site/pages.tsx',import.meta.url),'utf8');
 assert.match(p,/ALL_EVENTS\.filter\(/); assert.match(p,/overlapsDateFilter\(e, dateFilter, now\.getTime\(\)\)/);
});
test('Thursday-to-Sunday timed event is visible Saturday in all three weekend views',()=>{
 const listed=content.selectListedEvents([thuSun],SAT);
 assert.deepEqual(listed.map(e=>e.id),['thu-sun']);
 for(const [name,v] of Object.entries(views(listed,SAT)))assert.deepEqual(v.map(e=>e.id),['thu-sun'],name);
});
test('event past its end is hidden (end exclusive)',()=>{
 assert.equal(content.selectListedEvents([thuSun],thuSun.endsAt).length,0);
 assert.equal(content.selectListedEvents([thuSun],thuSun.endsAt-1).length,1);
 const short=ev('short',{startsAt:ct(11,7,9),endsAt:ct(11,7,10)});
 assert.equal(content.selectListedEvents([short],SAT).length,0);
});
test('absent or invalid end falls back to the 24h-after-start rule',()=>{
 const s=ct(11,6,12);
 for(const endsAt of [undefined,null,NaN,'2026-11-08',s,s-H]){
  const e=ev('x',{startsAt:s,endsAt});
  assert.equal(content.selectListedEvents([e],s+24*H).length,1,String(endsAt));
  assert.equal(content.selectListedEvents([e],s+24*H+1).length,0,String(endsAt));
 }
});
test('cancelled events are dropped exactly as before, even while ongoing',()=>{
 const list=[ev('a',{startsAt:thuSun.startsAt,endsAt:thuSun.endsAt,title:'CANCELLED Fall fair'}),ev('b',{startsAt:thuSun.startsAt,endsAt:thuSun.endsAt,description:'This event has been cancelled.'}),ev('c',{...thuSun,cancelled:true}),ev('d',{...thuSun})];
 assert.deepEqual(content.selectListedEvents(list,SAT).map(e=>e.id),['d']);
});
test('all-day exclusive end semantics are unchanged',()=>{
 const ad=ev('ad',{allDay:true,startDate:'2026-11-05',endDateExclusive:'2026-11-08',startsAt:ct(11,5,0),endsAt:ct(11,8,0)});
 assert.equal(content.selectListedEvents([ad],ct(11,7,23)).length,1);
 assert.equal(content.selectListedEvents([ad],ct(11,8,1)).length,0);
});
