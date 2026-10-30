import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
const components = {};
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../../../../', import.meta.url)), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  for (const name of ['button', 'card', 'input', 'textarea', 'checkbox', 'select', 'badge', 'dialog']) {
    Object.assign(components, await server.ssrLoadModule(`/src/components/ui/${name}.tsx`));
  }
});
after(async () => { await server?.close(); });

test('action buttons use the genuine Arc implementation', () => {
  const html = renderToStaticMarkup(h(components.Button, { type: 'submit' }, 'Send draft'));
  assert.match(html, /<button[^>]*type="submit"/);
  assert.match(html, /_button_/);
  assert.match(html, /_labelSlot_/);
  assert.match(html, /bg-primary/);
  const secondary = renderToStaticMarkup(h(components.Button, { variant: 'secondary' }, 'Contact'));
  assert.match(secondary, /bg-secondary/);
  const overridden = renderToStaticMarkup(h(components.Button, { className: 'bg-white text-navy rounded-full px-8' }, 'Browse'));
  const classes = overridden.match(/class="([^"]*)"/)[1].split(' ');
  assert.ok(classes.includes('bg-white') && classes.includes('text-navy'));
  assert.ok(classes.includes('rounded-full') && classes.includes('px-8'));
  assert.ok(!classes.includes('bg-primary') && !classes.includes('rounded-md') && !classes.includes('px-4'));
});

test('asChild links remain links with Arc styling, never nested buttons', () => {
  const html = renderToStaticMarkup(h(components.Button, { asChild: true }, h('a', { href: '/events' }, 'Browse events')));
  assert.match(html, /^<a[^>]*href="\/events"/);
  assert.match(html, /_button_/);
  assert.doesNotMatch(html, /<button/);
});

test('compound cards do not create duplicate empty headings', () => {
  const html = renderToStaticMarkup(h(components.Card, null, h(components.CardHeader, null, h(components.CardTitle, null, 'A local event'))));
  assert.equal((html.match(/<h3/g) ?? []).length, 1);
  assert.match(html, /<article/);
  assert.match(html, /_card_/);
});

test('external field labels keep their control IDs without empty labels', () => {
  const input = renderToStaticMarkup(h(components.Input, { id: 'email', type: 'email', required: true }));
  const textarea = renderToStaticMarkup(h(components.Textarea, { id: 'details', required: true }));
  assert.match(input, /id="email"/);
  assert.match(input, /required=""/);
  assert.doesNotMatch(input, /<label/);
  assert.match(input, /h-9/);
  assert.match(input, /min-h-0/);
  assert.match(textarea, /id="details"/);
  assert.doesNotMatch(textarea, /<label/);
});

test('optional built-in Arc labels remain available', () => {
  const html = renderToStaticMarkup(h(components.Input, { id: 'search', label: 'Search Leander' }));
  assert.match(html, /<label[^>]*for="search"[^>]*>Search Leander<\/label>/);
});

test('checkbox does not override its surrounding label with a generic name', () => {
  const html = renderToStaticMarkup(h('label', null, h(components.Checkbox, { checked: true }), 'Sponsored event'));
  assert.match(html, /role="checkbox"/);
  assert.match(html, /aria-checked="true"/);
  assert.doesNotMatch(html, /aria-label="Checkbox"/);
});

test('compound select values/options map into the real Arc Select', () => {
  const html = renderToStaticMarkup(h(components.Select, { value: 'event', onValueChange() {} },
    h(components.SelectTrigger, { id: 'listing-kind', 'aria-label': 'Listing type' }, h(components.SelectValue, { placeholder: 'Choose a type' })),
    h(components.SelectContent, null,
      h(components.SelectItem, { value: 'event' }, 'Community event'),
      h(components.SelectItem, { value: 'job', disabled: true }, 'Local job'))));
  assert.match(html, /role="combobox"/);
  assert.match(html, /id="listing-kind"/);
  assert.match(html, /for="listing-kind"/);
  assert.match(html, /Community event/);
});

test('controlled closed dialogs render no interactive overlay', () => {
  const html = renderToStaticMarkup(h(components.Dialog, { open: false },
    h(components.DialogContent, null,
      h(components.DialogHeader, null, h(components.DialogTitle, null, 'Submit a listing')),
      h('button', null, 'Send email'))));
  assert.doesNotMatch(html, /role="dialog"/);
  assert.doesNotMatch(html, /Send email/);
});
