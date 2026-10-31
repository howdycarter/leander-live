import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
let out, status;
before(async () => {
  const root=new URL('../../',import.meta.url).pathname;
  mkdirSync(join(root,'node_modules/.cache'),{recursive:true});
  out=mkdtempSync(join(root,'node_modules/.cache/ll-notice-'));
  const entry=join(out,'input.mjs');
  writeFileSync(entry,`export * from ${JSON.stringify(join(root,'src/site/sourceStatus.tsx'))};`);
  await build({root,logLevel:'silent',build:{ssr:entry,outDir:join(out,'build'),rollupOptions:{output:{entryFileNames:'notice.mjs'}}}});
  status=await import(pathToFileURL(join(out,'build/notice.mjs')).href);
});
after(()=>{if(out)rmSync(out,{recursive:true,force:true});});

test('events notice names only affected event sources and renders clean text', () => {
  const html=renderToStaticMarkup(h(status.SourceStatusBanner,{kind:'events'}));
  const $=load(html);
  const note=$('[aria-label="Listing freshness"]');
  assert.equal(note.attr('role'),'note');
  assert.equal(note.attr('aria-live'),undefined);
  assert.match(note.text(),/City of Leander calendar/);
  assert.doesNotMatch(note.text(),/Google News|job postings|&#|&amp;|<strong>/);
  assert.match($.text(),/Last successful update unknown/);
  assert.doesNotMatch(html,/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<details\b/);
});

test('jobs and civic notices scope their affected source names', () => {
  const jobs=load(renderToStaticMarkup(h(status.SourceStatusBanner,{kind:'jobs'}))).text();
  assert.match(jobs,/City of Leander job postings/);
  assert.match(jobs,/Williamson County job postings/);
  assert.match(jobs,/Leander ISD job postings/);
  assert.doesNotMatch(jobs,/City of Leander calendar/);
  const civic=load(renderToStaticMarkup(h(status.SourceStatusBanner,{kind:'civic'}))).text();
  assert.match(civic,/Leander ISD board agendas/);
  assert.match(civic,/City of Leander news/);
  assert.doesNotMatch(civic,/Google News|job postings/);
});

test('failed active sources and paused sources both remain visible without fake timestamps', () => {
  const notice=status.sourceNotice('events',[
    {id:'chamber',state:'failed',lastSuccessAt:'2026-10-29T21:00:00Z'},
    {id:'leandertx-city-calendar',state:'paused',lastSuccessAt:null},
    {id:'google-news',state:'failed'},
  ]);
  assert.match(notice.title,/failed/);
  assert.deepEqual(notice.affected.map(r=>r.id),['chamber','leandertx-city-calendar']);
  assert.match(status.statusText(notice.affected[0]),/Oct 29, 2026/);
  assert.match(status.statusText(notice.affected[1]),/unknown/);
  assert.doesNotMatch(status.sourceNotice('events',[]).title,/paused|refreshed/);
});
