import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'll-scrapers-'));
  t.after(() => rmSync(root, {recursive:true,force:true}));
  cpSync(new URL('../', import.meta.url), join(root,'scripts'), {recursive:true});
  symlinkSync(new URL('../../node_modules', import.meta.url).pathname, join(root,'node_modules'));
  mkdirSync(join(root,'src/data'), {recursive:true});
  for (const name of ['events','jobs','civic','news','businesses','businesses-manual','source-status']) {
    writeFileSync(join(root,`src/data/${name}.json`),'[]');
  }
  writeFileSync(join(root,'offline.mjs'), `globalThis.fetch = async () => { throw new Error('fixture offline'); };`);
  const env = {...process.env};
  for (const key of Object.keys(env)) if (key.startsWith('LEANDER_ENABLE_')) delete env[key];
  return {
    root,
    run: (name) => spawnSync(process.execPath,['--import',join(root,'offline.mjs'),join(root,`scripts/scrape-${name}.mjs`)],{env,encoding:'utf8'}),
    read: (name) => JSON.parse(readFileSync(join(root,`src/data/${name}.json`),'utf8')),
    write: (name, rows) => writeFileSync(join(root,`src/data/${name}.json`),JSON.stringify(rows)),
    network: (code) => writeFileSync(join(root,'offline.mjs'),code),
  };
}

test('events: a Chamber fixture reaches published JSON with verified success provenance', (t) => {
  const f=fixture(t);
  f.network(`globalThis.fetch=async (url)=>{
    if(String(url)==='https://leander.chamberspace.net/calendar') return new Response('<a href="/event/fixture/123">Fixture</a>');
    if(String(url).includes('ICSDownload')) return new Response('BEGIN:VCALENDAR\\r\\nBEGIN:VEVENT\\r\\nDTSTART:20990101T100000Z\\r\\nDTEND:20990101T110000Z\\r\\nSUMMARY:Fixture celebration\\r\\nLOCATION:Fixture Hall\\r\\nEND:VEVENT\\r\\nEND:VCALENDAR');
    if(String(url)==='https://leander.chamberspace.net/event/fixture/123') return new Response('<html></html>');
    throw new Error('unexpected URL '+url);
  };`);
  const run=f.run('events');
  assert.equal(run.status,0,run.stderr);
  assert.equal(f.read('events')[0].id,'chamber-123');
  const row=f.read('source-status').find(r=>r.id==='chamber');
  assert.equal(row.state,'ok');
  assert.ok(Number.isFinite(Date.parse(row.lastSuccessAt)));
  assert.equal(row.recordsKept,1);
});

test('events: an incomplete Chamber scrape cannot claim success or replace last-good data', (t) => {
  const f=fixture(t);
  f.write('events',[{id:'chamber-kept',title:'Last good fixture',source:'chamber',startsAt:Date.now()+86400000}]);
  f.network(`globalThis.fetch=async (url)=>{
    if(String(url)==='https://leander.chamberspace.net/calendar') return new Response('<a href="/event/fixture/123">One</a><a href="/event/fixture/456">Two</a>');
    if(String(url).includes('eid=123')) return new Response('BEGIN:VEVENT\\r\\nDTSTART:20990101T100000Z\\r\\nSUMMARY:Partial fixture\\r\\nEND:VEVENT');
    if(String(url).includes('/event/fixture/123')) return new Response('<html></html>');
    throw new Error('fixture detail failed');
  };`);
  const run=f.run('events');
  assert.equal(run.status,1,run.stderr);
  assert.deepEqual(f.read('events').map(r=>r.id),['chamber-kept']);
  const row=f.read('source-status').find(r=>r.id==='chamber');
  assert.equal(row.state,'failed');
  assert.equal(row.lastSuccessAt,null);
});

test('civic: a CivicClerk fixture reaches published JSON with verified success provenance', (t) => {
  const f=fixture(t);
  f.network(`globalThis.fetch=async (url)=>{
    if(String(url).startsWith('https://leandertx.api.civicclerk.com/v1/Events?')) return Response.json({value:[{id:123,eventName:'Fixture board meeting',eventCategoryName:'City Council',startDateTime:'2099-01-01T17:00:00Z'}]});
    throw new Error('unexpected URL '+url);
  };`);
  const run=f.run('civic');
  assert.equal(run.status,0,run.stderr);
  assert.equal(f.read('civic')[0].id,'civic-123');
  const row=f.read('source-status').find(r=>r.id==='civicclerk-meetings');
  assert.equal(row.state,'ok');
  assert.ok(Number.isFinite(Date.parse(row.lastSuccessAt)));
});

test('businesses: Socrata fixtures dedupe into published listings and count published rows', (t) => {
  const f=fixture(t);
  f.network(`globalThis.fetch=async (url)=>{
    if(String(url).startsWith('https://data.texas.gov/resource/jrea-zgmq.json?')) return Response.json(Array.from({length:500},(_,i)=>({taxpayer_number:'1',outlet_number:'1',outlet_name:'FIXTURE CAFE',outlet_address:'123 MAIN ST',outlet_naics_code:'722511',outlet_zip_code:'78641'})));
    throw new Error('unexpected URL '+url);
  };`);
  const run=f.run('businesses');
  assert.equal(run.status,0,run.stderr);
  assert.equal(f.read('businesses').length,1);
  assert.equal(f.read('businesses')[0].id,'biz-1-1');
  const row=f.read('source-status').find(r=>r.id==='tx-sales-tax-businesses');
  assert.equal(row.state,'ok');
  assert.equal(row.recordsKept,1);
  assert.ok(Number.isFinite(Date.parse(row.lastSuccessAt)));
});

const successfulFeeds = `globalThis.fetch=async (url)=>{
  url=String(url);
  if(url==='https://leander.chamberspace.net/calendar') return new Response('<a href="/event/fixture/123">Fixture</a>');
  if(url.includes('ICSDownload')) return new Response('BEGIN:VEVENT\\r\\nDTSTART:20990101T100000Z\\r\\nSUMMARY:Fixture celebration\\r\\nEND:VEVENT');
  if(url.includes('/event/fixture/123')) return new Response('<html></html>');
  if(url.startsWith('https://leandertx.api.civicclerk.com/v1/Events?')) return Response.json({value:[{id:123,eventName:'Fixture board meeting',eventCategoryName:'City Council',startDateTime:'2099-01-01T17:00:00Z'}]});
  if(url.startsWith('https://data.texas.gov/resource/jrea-zgmq.json?')) return Response.json(Array.from({length:500},()=>({taxpayer_number:'1',outlet_number:'1',outlet_name:'FIXTURE CAFE',outlet_address:'123 MAIN ST',outlet_naics_code:'722511'})));
  throw new Error('unexpected URL '+url);
};`;

for (const [name,source] of [['events','chamber'],['civic','civicclerk-meetings'],['businesses','tx-sales-tax-businesses']]) {
  test(`${name}: failed output write cannot advance the last confirmed success`, (t) => {
    const f=fixture(t);
    const previous=[{id:'old-good',title:'Confirmed fixture',source:'chamber',startsAt:Date.now()+86400000}];
    f.write(name,previous);
    f.write('source-status',[{id:source,state:'ok',lastSuccessAt:'2026-10-01T12:00:00Z',recordsKept:1,historical:false}]);
    f.network(`${successfulFeeds}
      import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
      const write=fs.writeFileSync;
      fs.writeFileSync=(path,...args)=>{if(String(path).endsWith('/src/data/${name}.json'))throw new Error('fixture output write failed');return write(path,...args)};
      syncBuiltinESMExports();`);
    const run=f.run(name);
    assert.equal(run.status,1,run.stderr);
    assert.deepEqual(f.read(name),previous);
    const row=f.read('source-status').find(r=>r.id===source);
    assert.equal(row.state,'failed');
    assert.equal(row.lastSuccessAt,'2026-10-01T12:00:00Z');
    assert.equal(row.recordsKept,1);
  });
}

test('businesses: transform failure cannot publish success provenance over last-good output', (t) => {
  const f=fixture(t);
  const previous=[{id:'old-good',name:'Confirmed fixture'}];
  f.write('businesses',previous);
  f.write('source-status',[{id:'tx-sales-tax-businesses',state:'ok',lastSuccessAt:'2026-10-01T12:00:00Z',recordsKept:1,historical:false}]);
  f.network(`globalThis.fetch=async()=>Response.json(Array(500).fill(null));`);
  const run=f.run('businesses');
  assert.equal(run.status,1,run.stderr);
  assert.deepEqual(f.read('businesses'),previous);
  const row=f.read('source-status').find(r=>r.id==='tx-sales-tax-businesses');
  assert.equal(row.state,'failed');
  assert.equal(row.lastSuccessAt,'2026-10-01T12:00:00Z');
  assert.equal(row.recordsKept,1);
});

test('civic: failure writing the second output cannot confirm success for the partial publication', (t) => {
  const f=fixture(t);
  f.write('source-status',[{id:'civicclerk-meetings',state:'ok',lastSuccessAt:'2026-10-01T12:00:00Z',recordsKept:1}]);
  f.network(`${successfulFeeds}
    import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
    const write=fs.writeFileSync;
    fs.writeFileSync=(path,...args)=>{if(String(path).endsWith('/src/data/news.json'))throw new Error('fixture second output failed');return write(path,...args)};
    syncBuiltinESMExports();`);
  const run=f.run('civic');
  assert.equal(run.status,1,run.stderr);
  assert.equal(f.read('civic')[0].id,'civic-123','the first file may already have been written');
  const row=f.read('source-status').find(r=>r.id==='civicclerk-meetings');
  assert.equal(row.state,'failed');
  assert.equal(row.lastSuccessAt,'2026-10-01T12:00:00Z');
});

for (const [name, source] of [['events','chamber'],['civic','civicclerk-meetings'],['businesses','tx-sales-tax-businesses']]) {
  test(`${name}: offline source preserves last-good records, records failure and exits nonzero`, (t) => {
    const f = fixture(t);
    const file = name === 'events' ? 'events' : name === 'civic' ? 'civic' : 'businesses';
    const row = {id:name === 'civic'?'civic-1':'old-1',title:'Future fixture',source:'chamber',startsAt:Date.now()+86400000};
    f.write(file,[row]);
    const run = f.run(name);
    assert.equal(run.status,1,run.stderr);
    assert.ok(f.read(file).some(r=>r.id===row.id));
    const status = f.read('source-status').find(r=>r.id===source);
    assert.equal(status.state,'failed');
    assert.equal(status.lastSuccessAt,null);
  });
}

test('civic: paused and failed fallback meetings still expire after the existing six-hour grace', (t) => {
  const f=fixture(t);
  f.write('civic',[
    {id:'civic-old',startsAt:Date.now()-7*3600000},
    {id:'lisd-board-old',startsAt:Date.now()-7*3600000},
    {id:'lisd-board-future',startsAt:Date.now()+86400000},
  ]);
  f.run('civic');
  assert.deepEqual(f.read('civic').map(r=>r.id),['lisd-board-future']);
});

test('jobs: paused ISD postings follow the same 150-day age limit as fresh pulls', (t) => {
  const f=fixture(t);
  f.write('jobs',[
    {id:'applitrack-old',company:'Leander ISD',postedAt:Date.now()-151*86400000},
    {id:'applitrack-current',company:'Leander ISD',postedAt:Date.now()-2*86400000},
    {id:'govjobs-open',company:'City of Leander',postedAt:Date.now()-200*86400000},
  ]);
  assert.equal(f.run('jobs').status,0);
  assert.deepEqual(f.read('jobs').map(r=>r.id),['applitrack-current','govjobs-open']);
});

for (const name of ['events','jobs','civic','businesses','signals']) {
  test(`${name}: a fatal write error exits nonzero`, (t) => {
    const f=fixture(t);
    const path = name==='signals' ? join(f.root,'signals') : join(f.root,'src/data',name==='events'?'events.json':name==='jobs'?'jobs.json':'source-status.json');
    rmSync(path,{force:true});
    if(name==='signals') writeFileSync(path,'blocked');
    else mkdirSync(path);
    assert.equal(f.run(name).status,1);
  });
}
