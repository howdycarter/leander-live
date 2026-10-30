import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {load} from 'cheerio';
import postcss from 'postcss';
let server,router,state,pages,content,concept;
before(async()=>{
 server=await createServer({server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',resolve:{alias:{'react-router-dom':new URL('../node_modules/react-router-dom/dist/index.mjs',import.meta.url).pathname}},ssr:{resolve:{conditions:['module-sync','import']}}});
 [router,state,pages,content,concept]=await Promise.all(['/node_modules/react-router-dom/dist/index.mjs','/src/site/state.tsx','/src/site/pages.tsx','/src/site/content.tsx','/src/site/conceptA.tsx'].map(p=>server.ssrLoadModule(p)));
});
after(async()=>{await server?.close()});
function render(Component,url='/'){return renderToStaticMarkup(h(router.MemoryRouter,{initialEntries:[url]},h(state.SavedEventsProvider,null,h(state.SiteActionsProvider,null,h(Component)))));}
test('all original photography/logo assets, routes, data and feed protections remain byte-identical',async()=>{
 const {sha256}=JSON.parse(await fs.readFile(new URL('../scripts/lib/fixtures/uiarc-preserved-files.json',import.meta.url),'utf8'));
 for(const [name,expected] of Object.entries(sha256))assert.equal(createHash('sha256').update(await fs.readFile(new URL('../'+name,import.meta.url))).digest('hex'),expected,name);
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
