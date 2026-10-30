import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {load} from 'cheerio';
import postcss from 'postcss';
let server,router,state,pages,content,concept,sourceStatus,chrome;
before(async()=>{
 server=await createServer({server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',resolve:{alias:{'react-router-dom':new URL('../node_modules/react-router-dom/dist/index.mjs',import.meta.url).pathname}},ssr:{resolve:{conditions:['module-sync','import']}}});
 [router,state,pages,content,concept,sourceStatus,chrome]=await Promise.all(['/node_modules/react-router-dom/dist/index.mjs','/src/site/state.tsx','/src/site/pages.tsx','/src/site/content.tsx','/src/site/conceptA.tsx','/src/site/sourceStatus.tsx','/src/site/chrome.tsx'].map(p=>server.ssrLoadModule(p)));
});
after(async()=>{await server?.close()});
function render(Component,url='/'){return renderToStaticMarkup(h(router.MemoryRouter,{initialEntries:[url]},h(state.SavedEventsProvider,null,h(state.SiteActionsProvider,null,h(Component)))));}
test('all original photography/logo assets, routes, data and feed protections remain byte-identical',async()=>{
 const {sha256,presentationExceptions}=JSON.parse(await fs.readFile(new URL('../scripts/lib/fixtures/uiarc-preserved-files.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(presentationExceptions).sort(),['src/site/chrome.tsx','src/site/pages.tsx']);
 for(const [name,expected] of Object.entries(sha256).filter(([name])=>!presentationExceptions[name]))assert.equal(createHash('sha256').update(await fs.readFile(new URL('../'+name,import.meta.url))).digest('hex'),expected,name);
});
test('home preserves original hero identity, headline, tagline and imagery',()=>{
 const $=load(render(pages.HomePage));
 assert.equal($('h1').text(),"What's happening in Leander this week?");
 assert.equal($('[aria-label="Welcome to Leander Live"] > img').attr('src'),'/brand/hero-old-town-sunset.jpg');
 assert.equal($('[aria-label="Welcome to Leander Live"] > img').attr('alt'),'Sunset over a street festival in Old Town Leander');
 assert.match($('[aria-label="Welcome to Leander Live"]').text(),/People • Places • Opportunities — your front porch for everything happening in town/);
 const headings=$('h2').map((_,e)=>$(e).text()).get();
 assert.ok(headings.indexOf('This weekend in Leander')<headings.indexOf('Upcoming in Leander'));
 assert.ok(headings.indexOf('Upcoming in Leander')<headings.findIndex(t=>/jobs/i.test(t)));
});
test('homepage uses real UIARC search and keeps the original search purpose',()=>{
 const $=load(render(concept.HomeHero));const input=$('input[type=search]');
 assert.equal(input.attr('placeholder'),'Search events, places, or categories…');
 assert.match(input.attr('class'),/_input_/);assert.equal($('label[for="'+input.attr('id')+'"]').text(),'Search Leander events');
 assert.equal($('button[type=submit]').text(),'Search');
});
test('homepage jobs preview uses a genuine Arc Card without changing its links or row spacing',()=>{
 const $=load(render(concept.JobsPreview));const card=$('article.arc-jobs-preview');
 assert.equal(card.length,1);assert.match(card.attr('class'),/_card_/);
 for(const token of ['overflow-hidden','rounded-2xl','border-border','bg-card','shadow-[0_1px_2px_rgba(22,50,79,0.07)]'])assert.ok(card.attr('class').split(' ').includes(token),token);
 const rows=card.children('div').children('.divide-y.divide-border.p-0').children('a');
 const expected=[...content.ALL_JOBS.filter(j=>j.featured),...content.ALL_JOBS.filter(j=>!j.featured)].slice(0,3);
 assert.equal(rows.length,expected.length);
 rows.each((i,e)=>{
  const row=$(e),job=expected[i];assert.equal(row.attr('href'),'/jobs');
  assert.equal(row.attr('aria-label'),`${job.title.trim()} at ${job.company} — view on the jobs board`);
  assert.equal(row.attr('class'),'flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/70 sm:px-4');
  assert.ok(row.text().includes(job.title.trim()));assert.ok(row.text().includes(job.company));
  if(job.payRange)assert.ok(row.text().includes(content.plainText(job.payRange)));
 });
 assert.equal(card.find('button,h3,[role=button]').length,0);
});
test('grouped jobs Card retains a stationary surface instead of lifting all links together',async()=>{
 const css=await fs.readFile(new URL('../src/components/ui/compat.css',import.meta.url),'utf8');
 let stationary=false;postcss.parse(css).walkRules('.arc-jobs-preview',rule=>{
  rule.walkDecls('transform',d=>{stationary=d.value==='none'&&d.important;});
 });assert.ok(stationary);
});
test('event cards retain photography, category edge, detail links and save control on UIARC surfaces',()=>{
 const event=content.ALL_EVENTS.find(e=>e.image);assert.ok(event);
 const $=load(render(()=>h(content.EventCard,{event,saved:false,onToggleSaved(){}})));
 assert.match($('article').attr('class'),/_card_/);assert.match($('article').attr('class'),/uplift-event-card/);
 assert.equal($('img').attr('src'),event.image);assert.equal($('h3 a').attr('href'),'/events/'+event.id);
 assert.equal($('button').attr('aria-label'),'Save this event');
 assert.equal($('article > div > div > span[aria-hidden=true]').length,1);
});
test('all-day multi-day labels stay on the reviewed shared helpers',()=>{
 const event={...content.ALL_EVENTS[0],allDay:true,startDate:'2026-11-23',endDateExclusive:'2026-11-28',startsAt:Date.parse('2026-11-23T06:00:00Z'),endsAt:Date.parse('2026-11-28T06:00:00Z')};
 const html=render(()=>h(content.EventCard,{event,saved:false,onToggleSaved(){}}));
 assert.match(html,/Mon, Nov 23 – Fri, Nov 27/);assert.match(html,/All day/);assert.doesNotMatch(html,/12:00 AM/);
});
test('events keep original hero and query/zero-result behavior',()=>{
 const $=load(render(pages.EventsPage,'/events?q=zzzzNoSuchEvent'));
 assert.equal($('h1').text(),'Upcoming Events');assert.equal($('h2').text(),'Find your thing');
 assert.match($.text(),/No events match those filters/);assert.equal($('input[type=search]').attr('value'),'zzzzNoSuchEvent');
 assert.equal($('img').first().attr('src'),'/brand/hero-old-town-sunset.jpg');
});
test('saved events keep original empty state and browser-local model',()=>{
 const html=render(pages.EventsPage,'/events?saved=1');assert.match(html,/Saved Events/);assert.match(html,/No saved events yet/);
});
test('original brand tokens and Archivo remain in product theme',async()=>{
 const css=await fs.readFile(new URL('../src/index.css',import.meta.url),'utf8');
 for(const s of ['--color-background: #f6f4f0','--color-primary: #bc4519','--color-navy: #16324f','--color-gold: #d98a1f','--font-sans: "Archivo"','--font-body: "Archivo"'])assert.ok(css.includes(s),s);
});

test('compiled cascade preserves the original Tailwind heading scale against Arc token collisions',async()=>{
 const assets=await fs.readdir(new URL('../dist/assets/',import.meta.url));
 const css=(await Promise.all(assets.filter(p=>p.endsWith('.css')).map(p=>fs.readFile(new URL('../dist/assets/'+p,import.meta.url),'utf8')))).join('\n');
 const tree=postcss.parse(css);const actual=new Map();const ranks={theme:0,base:1,components:2,utilities:3};
 tree.walkRules(rule=>{
  if(!rule.selector.split(',').some(s=>s.trim()===':root'))return;
  let rank=4,conditional=false;
  for(let p=rule.parent;p;p=p.parent){if(p.type==='atrule'&&p.name==='layer')rank=ranks[p.params]??-1;if(p.type==='atrule'&&['media','supports','container'].includes(p.name))conditional=true;}
  if(conditional)return;
  rule.walkDecls(d=>{if(!d.prop.startsWith('--text-'))return;const prev=actual.get(d.prop);if(!prev||rank>=prev.rank)actual.set(d.prop,{value:d.value,rank});});
 });
 for(const [name,rem] of Object.entries({xs:.75,sm:.875,base:1,lg:1.125,xl:1.25,'2xl':1.5,'3xl':1.875,'4xl':2.25,'5xl':3,'6xl':3.75})){
  const token=actual.get('--text-'+name);assert.ok(token,name+' missing');assert.equal(parseFloat(token.value),rem,name+' computed cascade value');assert.match(token.value,/rem$/);assert.equal(token.rank,4,name+' must be configured at the product boundary');
 }
});

test('production distribution includes the complete authentic Arc MIT notice',async()=>{
 const license=await fs.readFile(new URL('../src/components/arc/LICENSE',import.meta.url),'utf8');
 const notice=await fs.readFile(new URL('../dist/third-party-notices.txt',import.meta.url),'utf8');
 assert.ok(notice.includes(license));assert.match(notice,/Copyright \(c\) 2026 Elia Kuratli/);
 const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(html,/rel="license" href="\/third-party-notices.txt"/);
});


test('chrome retains the original logo, mobile navigation and desktop destinations',()=>{
 const $=load(render(chrome.SiteLayout));
 assert.equal($('header img').attr('src'),'/brand/logo-leander-live.png');
 assert.equal($('footer img').attr('src'),'/brand/logo-leander-live.png');
 assert.deepEqual($('nav[aria-label=Mobile] a').map((_,e)=>$(e).attr('href')).get(),['/','/events','/jobs','/events?saved=1','/about']);
 assert.deepEqual($('header nav a').map((_,e)=>$(e).attr('href')).get(),['/events','/jobs','/businesses','/city-hall','/community','/about']);
 assert.match($('header').attr('class'),/sticky top-0/);
 assert.match($('footer').attr('class'),/bg-navy/);
 assert.match($('footer button').attr('class'),/arc-button-compat/);
});

test('truthful source states do not infer paused or fresh from absent/null metadata',()=>{
 for(const [company,id] of [['City of Leander','governmentjobs-city-of-leander'],['Williamson County','governmentjobs-williamson-county'],['Leander ISD','lisd-applitrack-jobs']])assert.equal(sourceStatus.sourceStatusFor({company}).id,id);
 assert.equal(sourceStatus.sourceStatusFor({source:'applitrack'}).id,'lisd-applitrack-jobs');
 assert.equal(sourceStatus.sourceStatusFor({source:'city-calendar'}).id,'leandertx-city-calendar');
 assert.equal(sourceStatus.sourceStatusFor({id:'lisd-board-example'}).id,'lisd-board-agendas');
 assert.equal(sourceStatus.sourceStatusFor({source:'leandertx-city-news'}).id,'leandertx-city-news');
 for(const source of ['chamber','civicclerk','texas-permits','anchor'])assert.equal(sourceStatus.sourceStatusFor({source}),undefined);
 assert.doesNotMatch(sourceStatus.statusText(),/paused|refreshed/);
 assert.match(sourceStatus.statusText(sourceStatus.sourceStatusFor({company:'Leander ISD'})),/Source paused · Historical listing · Last successful update unknown/);
 assert.match(sourceStatus.statusText({state:'failed',lastSuccessAt:null}),/Latest refresh failed/);
 assert.equal(sourceStatus.statusText({state:'ok',lastSuccessAt:null}),'Last successful refresh unknown');
 assert.equal(sourceStatus.statusText({state:'ok',lastSuccessAt:'invalid'}),'Last successful refresh unknown');
 assert.equal(sourceStatus.statusText({state:'ok',lastSuccessAt:'2026-10-30T01:00:00Z'}),'Source refreshed Oct 29, 2026');
});

test('historical jobs retain original source pay, without guessing a salary period',()=>{
 const job=content.ALL_JOBS.find(j=>j.title.includes('Chief of Police'));assert.ok(job);
 const $=load(render(()=>h(content.JobRow,{job,onSelect(){}})));
 assert.ok($.text().includes(content.plainText(job.payRange)));
 assert.doesNotMatch($.text(),/150062\/hr|150,062\/hr/);
 assert.match($.text(),/Source paused · Historical listing/);
 assert.match($('button').attr('class'),/arc-button-compat/);
 const home=render(concept.JobsPreview);assert.ok(home.includes(content.plainText(job.payRange)));
 const board=render(content.JobsBoard);assert.match(board,/Some source updates are paused/);assert.match(board,/collected listings/);
});

test('events expose reviewed status without changing original hero and card identity',()=>{
 const event=content.ALL_EVENTS.find(e=>e.source==='city-calendar');assert.ok(event);
 const html=render(()=>h(content.EventCard,{event,saved:false,onToggleSaved(){}}));
 assert.match(html,/Source paused · Historical listing/);
 assert.match(render(pages.EventsPage,'/events'),/Some source updates are paused/);
});


test('reminder cards use the same all-day date/time helpers as event cards',async()=>{
 const source=await fs.readFile(new URL('../src/site/content.tsx',import.meta.url),'utf8');
 const reminders=source.slice(source.indexOf('export function RemindersContent'),source.indexOf('/* ---------------- lead forms'));
 assert.match(reminders,/eventDateLabel\(event, \{ withYear: true \}\)\} · \{eventTimeLabel\(event\)/);
 assert.doesNotMatch(reminders,/formatTime\(event.startsAt\)/);
});


test('initial and built HTML descriptions do not claim real-time updates',async()=>{
 for(const path of ['../index.html','../dist/index.html']){
  const $=load(await fs.readFile(new URL(path,import.meta.url),'utf8'));
  assert.equal($('meta[name=description]').attr('content'),'A community events board for Leander, Texas. Browse local events or submit your own.');
 }
});

test('city news publisher labels match each destination, including local editorial',()=>{
 const $=load(render(pages.CityHallPage,'/city-hall'));
 const union=$('a[href="https://www.leanderunion.com/"]');
 assert.equal(union.length,1);assert.match(union.text(),/Read on leanderunion.com/);assert.doesNotMatch(union.text(),/Read on leandertx.gov|Source paused/);
 for(const el of $('a[href*="CivicAlerts.aspx"]').toArray())assert.match($(el).text(),/Read on leandertx.gov/);
});
