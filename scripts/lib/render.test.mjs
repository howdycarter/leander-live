// Render test for event cards (CHR-2011). Builds tests/render/event-card-entry.tsx
// with Vite in SSR mode into a temporary folder under node_modules/.cache, then renders cards to HTML.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('event cards render all-day and timed events correctly', async () => {
  mkdirSync(join(ROOT, 'node_modules/.cache'), { recursive: true });
  // Inside the repo so the bundle can resolve react from node_modules.
  const out = mkdtempSync(join(ROOT, 'node_modules/.cache/ll-render-'));
  try {
    await build({
      root: ROOT, logLevel: 'silent', configFile: join(ROOT, 'vite.config.ts'),
      build: { ssr: join(ROOT, 'tests/render/event-card-entry.tsx'), outDir: out, emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'entry.mjs' } } },
    });
    const { renderCard } = await import(pathToFileURL(join(out, 'entry.mjs')).href);
    const base = { title: 'Thanksgiving break', description: '', venue: 'Leander ISD', category: 'Community', source: 'lisd-district' };

    const allDay = renderCard({
      ...base, id: 'lisd-a', allDay: true, startDate: '2026-11-23', endDateExclusive: '2026-11-28',
      startsAt: Date.UTC(2026, 10, 23, 6), endsAt: Date.UTC(2026, 10, 28, 6),
    });
    assert.match(allDay, /Mon, Nov 23 – Fri, Nov 27 · All day/);
    assert.doesNotMatch(allDay, /12:00/);

    const oneDay = renderCard({
      ...base, id: 'lisd-b', title: 'Election Day', allDay: true, startDate: '2026-11-03', endDateExclusive: '2026-11-04',
      startsAt: Date.UTC(2026, 10, 3, 6), endsAt: Date.UTC(2026, 10, 4, 6),
    });
    assert.match(oneDay, /Tue, Nov 3 · All day/);

    const timed = renderCard({
      ...base, id: 'city-1', title: 'Board meeting', source: 'city-calendar',
      startsAt: Date.UTC(2026, 10, 20, 0, 15), endsAt: Date.UTC(2026, 10, 20, 2, 15),
    });
    assert.match(timed, /Thu, Nov 19 · 6:15–8:15 PM/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
