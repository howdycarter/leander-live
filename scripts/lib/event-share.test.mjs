import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDraftCopyManager } from '../../src/site/emailDrafts.ts';
import {
  createEventShareManager, eventShareUrl, LINK_COPY_MESSAGES, NATIVE_SHARE_MESSAGES,
} from '../../src/site/eventShare.ts';

const dataA = { title: 'Event A', text: 'Event details', url: 'https://example.test/events/a' };
const dataB = { title: 'Event B', url: 'https://example.test/events/b' };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('event share URL uses only current origin/path, dropping credentials, preview query and hash', () => {
  assert.equal(eventShareUrl('https://example.test', '/events/town-festival'), 'https://example.test/events/town-festival');
  assert.equal(eventShareUrl('https://user:password@preview.example.test/?_vercel_share=SYNTHETIC_TOKEN#private', '/events/town-festival?_vercel_share=SYNTHETIC_TOKEN#private'), 'https://preview.example.test/events/town-festival');
  assert.equal(eventShareUrl('http://localhost:5173', '/events/a%20b'), 'http://localhost:5173/events/a%20b');
  assert.equal(new URL(eventShareUrl('https://example.test', '//other.example.test/events/a')).origin, 'https://example.test');
  assert.throws(() => eventShareUrl('file:///tmp/example', '/events/a'), /Unsupported/);
});

test('unavailable native sharing is explicit and does not automatically write to clipboard', async () => {
  const session = createEventShareManager().createSession(); const states = [];
  await session.share(dataA, undefined, state => states.push(state));
  assert.deepEqual(states, ['unavailable']);
  assert.match(NATIVE_SHARE_MESSAGES.unavailable, /Copy or select/);
});

test('canceled native share is cancellation, never copied/completed success', async () => {
  const session = createEventShareManager().createSession(); const states = [];
  await session.share(dataA, async () => { throw Object.assign(new Error('Canceled'), { name: 'AbortError' }); }, state => states.push(state));
  assert.deepEqual(states, ['pending', 'canceled']);
  assert.match(NATIVE_SHARE_MESSAGES.canceled, /Sharing canceled/);
});

test('native errors are visible, including synchronous unavailable-platform errors', async () => {
  for (const error of [new Error('Not allowed'), { name: 'NotAllowedError' }, null, 'unsupported']) {
    const session = createEventShareManager().createSession(); const states = [];
    await session.share(dataA, () => { throw error; }, state => states.push(state));
    assert.deepEqual(states, ['pending', 'failed']);
  }
});

test('resolved native share reports only device completion, not delivery', async () => {
  const session = createEventShareManager().createSession(); const states = []; let actual;
  await session.share(dataA, async data => { actual = data; }, state => states.push(state));
  assert.equal(actual, dataA); assert.deepEqual(states, ['pending', 'completed']);
  assert.match(NATIVE_SHARE_MESSAGES.completed, /Delivery is not confirmed/);
});

test('native hanging does not block explicit copy or its truthful success state', async () => {
  const session = createEventShareManager().createSession(); const native = deferred();
  const nativeStates = [], copyStates = []; let clipboard;
  const pending = session.share(dataA, () => native.promise, state => nativeStates.push(state));
  assert.deepEqual(nativeStates, ['pending']);
  assert.match(NATIVE_SHARE_MESSAGES.pending, /If it does not open, copy or select/);
  await session.copy(dataA.url, async text => { clipboard = text; }, state => copyStates.push(state));
  assert.equal(clipboard, dataA.url); assert.deepEqual(copyStates, ['pending', 'copied']);
  assert.deepEqual(nativeStates, ['pending']);
  session.invalidate(); native.resolve(); await pending;
});

test('clipboard unavailable or denied always exposes manual fallback', async () => {
  const session = createEventShareManager().createSession(); const unavailable = [], denied = [];
  await session.copy(dataA.url, undefined, state => unavailable.push(state));
  await session.copy(dataA.url, async () => { throw new Error('Denied'); }, state => denied.push(state));
  assert.deepEqual(unavailable, ['unavailable']); assert.deepEqual(denied, ['pending', 'failed']);
  assert.match(LINK_COPY_MESSAGES.unavailable, /manually/); assert.match(LINK_COPY_MESSAGES.failed, /manually/);
});

test('successful copy writes the exact URL, not title, full location or a sent claim', async () => {
  const session = createEventShareManager().createSession(); let clipboard; const states = [];
  await session.copy(dataA.url, async text => { clipboard = text; }, state => states.push(state));
  assert.equal(clipboard, dataA.url); assert.deepEqual(states, ['pending', 'copied']);
  assert.match(LINK_COPY_MESSAGES.copied, /nothing was sent here/);
});

for (const outcome of ['resolve', 'reject']) {
  test(`dismissal/route invalidation suppresses stale native ${outcome} and analytics-facing completion`, async () => {
    const session = createEventShareManager().createSession(); const native = deferred(); const states = [];
    const pending = session.share(dataA, () => native.promise, state => states.push(state));
    session.invalidate(); // close or keyed ShareButton unmount
    native[outcome](new Error('Old result')); await pending;
    assert.deepEqual(states, ['pending']);
  });

  test(`dismissal/route invalidation suppresses stale clipboard ${outcome}`, async () => {
    const session = createEventShareManager().createSession(); const copy = deferred(); const states = [];
    const pending = session.copy(dataA.url, () => copy.promise, state => states.push(state));
    session.invalidate();
    copy[outcome](new Error('Old result')); await pending;
    assert.deepEqual(states, ['pending']);
  });
}

test('reopening does not create overlapping native calls, including across route/remount', async () => {
  const manager = createEventShareManager(); const oldSession = manager.createSession(), newSession = manager.createSession();
  const native = deferred(); let calls = 0; const oldStates = [], newStates = [];
  const pending = oldSession.share(dataA, () => { calls++; return native.promise; }, state => oldStates.push(state));
  oldSession.invalidate();
  await newSession.share(dataB, async () => { calls++; }, state => newStates.push(state));
  assert.equal(calls, 1); assert.deepEqual(newStates, ['busy']);
  native.resolve(); await pending;
  assert.deepEqual(oldStates, ['pending']);
  await newSession.share(dataB, async () => { calls++; }, state => newStates.push(state));
  assert.equal(calls, 2); assert.deepEqual(newStates, ['busy', 'pending', 'completed']);
});

test('overlapping clipboard writes cannot overwrite a newer reported copied URL', async () => {
  const manager = createEventShareManager(); const oldSession = manager.createSession(), newSession = manager.createSession();
  const copy = deferred(); let writes = 0, clipboard; const oldStates = [], newStates = [];
  const pending = oldSession.copy(dataA.url, async text => { writes++; await copy.promise; clipboard = text; }, state => oldStates.push(state));
  oldSession.invalidate();
  const write = async text => { writes++; clipboard = text; };
  await newSession.copy(dataB.url, write, state => newStates.push(state));
  assert.equal(writes, 1); assert.deepEqual(newStates, ['busy']);
  copy.resolve(); await pending;
  assert.deepEqual(oldStates, ['pending']);
  await newSession.copy(dataB.url, write, state => newStates.push(state));
  assert.equal(writes, 2); assert.equal(clipboard, dataB.url);
  assert.deepEqual(newStates, ['busy', 'pending', 'copied']);
});

test('same-session repeated requests are rejected while each platform action is pending', async () => {
  const session = createEventShareManager().createSession(); const native = deferred(), copy = deferred();
  const nativeStates = [], copyStates = []; let nativeCalls = 0, copyCalls = 0;
  const pendingNative = session.share(dataA, () => { nativeCalls++; return native.promise; }, state => nativeStates.push(state));
  const pendingCopy = session.copy(dataA.url, () => { copyCalls++; return copy.promise; }, state => copyStates.push(state));
  await session.share(dataA, async () => { nativeCalls++; }, state => nativeStates.push(state));
  await session.copy(dataA.url, async () => { copyCalls++; }, state => copyStates.push(state));
  assert.equal(nativeCalls, 1); assert.equal(copyCalls, 1);
  assert.deepEqual(nativeStates, ['pending', 'busy']); assert.deepEqual(copyStates, ['pending', 'busy']);
  native.resolve(); copy.resolve(); await Promise.all([pendingNative, pendingCopy]);
  assert.equal(nativeStates.at(-1), 'completed'); assert.equal(copyStates.at(-1), 'copied');
});

for (const first of ['email', 'event']) {
  test(`${first} copy cannot overlap or later overwrite a newer copy in the other flow`, async () => {
    const lock = { pending: false };
    const email = createDraftCopyManager(lock).createSession();
    const event = createEventShareManager(lock).createSession();
    const [oldSession, newSession] = first === 'email' ? [email, event] : [event, email];
    const deferredCopy = deferred(); let clipboard = '', writes = 0;
    const oldStates = [], newStates = [];
    const pending = oldSession.copy('old content', async text => { writes++; await deferredCopy.promise; clipboard = text; }, state => oldStates.push(state));
    oldSession.invalidate();
    const write = async text => { writes++; clipboard = text; };
    await newSession.copy('new content', write, state => newStates.push(state));
    assert.equal(writes, 1); assert.equal(clipboard, '');
    assert.ok(newStates.some(state => state === 'busy' || /still finishing/.test(state)));
    deferredCopy.resolve(); await pending;
    assert.ok(!oldStates.some(state => /copied/i.test(state)));
    await newSession.copy('new content', write, state => newStates.push(state));
    assert.equal(writes, 2); assert.equal(clipboard, 'new content');
    assert.ok(/copied/i.test(newStates.at(-1)));
  });
}

test('event and email UI flows bind to the same application clipboard lock', () => {
  const event = readFileSync(new URL('../../src/site/eventDetail.tsx', import.meta.url), 'utf8');
  const email = readFileSync(new URL('../../src/site/useDraftCopy.ts', import.meta.url), 'utf8');
  for (const source of [event, email]) assert.match(source, /import \{ clipboardWriteLock \} from "\.\/clipboardWrites"/);
  assert.match(event, /createEventShareManager\(clipboardWriteLock\)/);
  assert.match(email, /createDraftCopyManager\(clipboardWriteLock\)/);
});

test('original Share button opens fallback first; genuine UIARC dialog/input/buttons remain accessible during native pending', () => {
  const source = readFileSync(new URL('../../src/site/eventDetail.tsx', import.meta.url), 'utf8');
  const share = source.slice(source.indexOf('function ShareButton('), source.indexOf('function RelatedEvents('));
  const open = share.slice(share.indexOf('function openShare()'), share.indexOf('function changeOpen('));
  assert.match(open, /setOpen\(true\)/); assert.doesNotMatch(open, /await|session\.share|clipboard\.writeText/);
  assert.match(open, /eventShareUrl\(window\.location\.origin, window\.location\.pathname\)/);
  assert.match(share, /<Button variant="outline" className="rounded-full" onClick=\{openShare\}>/);
  assert.match(share, /<Dialog open=\{open\} onOpenChange=\{changeOpen\}>/);
  assert.match(share, /<Input id=\{fieldId\} readOnly value=\{url\}/);
  assert.match(share, /<Label htmlFor=\{fieldId\}>Event link — select to copy manually/);
  assert.equal((share.match(/role="status" aria-live="polite" aria-atomic="true"/g) ?? []).length, 2);
  assert.match(share, /disabled=\{copyStatus === "pending"\}/); // native pending never disables copy
  assert.match(share, /if \(!next\) session\.invalidate\(\)/);
  assert.match(share, /useLayoutEffect\(\(\) => \(\) => session\.invalidate\(\), \[session\]\)/);
  assert.match(source, /<ShareButton key=\{event.id\} event=\{event\} \/>/);
  assert.doesNotMatch(share, /window\.location\.href|event_shared|setTimeout/);
  for (const component of ['button', 'dialog', 'input', 'label']) assert.ok(source.includes(`@/components/ui/${component}`));
});
