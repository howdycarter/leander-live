import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDraftCopyManager, emailDraftText } from '../../src/site/emailDrafts.ts';

const source = readFileSync(new URL('../../src/site/content.tsx', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../../src/site/useDraftCopy.ts', import.meta.url), 'utf8');
const forms = [
  ['event', 'export function SubmitDialogContent()', '/* ---------------- jobs board'],
  ['job', 'function PostJobDialogContent()', 'export function JobsBoard()'],
  ['business', 'export function BusinessForm(', '/* ---------------- about / crosspromo'],
].map(([name, start, end]) => [name, source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))]);
const draftA = { subject: 'Draft A', body: 'Original details A' };
const draftB = { subject: 'Draft B', body: 'Edited details B' };
const recipient = 'review@example.test';
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

for (const [name, form] of forms) {
  test(`${name}: original form uses guarded copy and invalidates before Edit/new draft`, () => {
    assert.match(form, /const \{ copyStatus, copyDraft, resetCopy \} = useDraftCopy\(/);
    assert.match(form, /onClick=\{copyDraft\}>Copy draft/);
    assert.match(form, /resetCopy\(\);\s+setPreparedDraft\(/);
    assert.match(form, /resetCopy\(\); setPreparedDraft\(null\)/);
    assert.doesNotMatch(form, /navigator\.clipboard|setCopyStatus/);
  });

  test(`${name}: deferred A success cannot claim draft B was copied after Edit/prepare`, async () => {
    const session = createDraftCopyManager().createSession();
    const pending = deferred();
    let clipboardText, status = '', displayedDraft = draftA;
    const task = session.copy(emailDraftText(draftA, recipient), text => {
      clipboardText = text; return pending.promise;
    }, value => { status = value; });
    // The same session remains mounted: Edit -> new form data -> prepare B.
    session.invalidate(); status = ''; displayedDraft = draftB;
    pending.resolve(); await task;
    assert.equal(displayedDraft, draftB);
    assert.equal(clipboardText, emailDraftText(draftA, recipient));
    assert.equal(status, '');
  });

  test(`${name}: stale rejected copy cannot replace B status with A failure`, async () => {
    const session = createDraftCopyManager().createSession();
    const pending = deferred(); let status = '';
    const task = session.copy(emailDraftText(draftA, recipient), () => pending.promise, value => { status = value; });
    session.invalidate(); status = '';
    pending.reject(new Error('Clipboard permission denied')); await task;
    assert.equal(status, '');
  });

  test(`${name}: a second copy is rejected while old A is pending; retry B copies B`, async () => {
    const session = createDraftCopyManager().createSession();
    const pending = deferred(); let clipboardText = '', writes = 0, status = '';
    const copyA = session.copy(emailDraftText(draftA, recipient), async text => {
      writes++; await pending.promise; clipboardText = text;
    }, value => { status = value; });
    session.invalidate(); status = '';
    const writeB = async text => { writes++; clipboardText = text; };
    await session.copy(emailDraftText(draftB, recipient), writeB, value => { status = value; });
    assert.equal(writes, 1);
    assert.match(status, /copy is still finishing/i);
    pending.resolve(); await copyA;
    assert.doesNotMatch(status, /^Copied/);
    await session.copy(emailDraftText(draftB, recipient), writeB, value => { status = value; });
    assert.equal(writes, 2);
    assert.equal(clipboardText, emailDraftText(draftB, recipient));
    assert.match(status, /^Copied — not sent/);
  });

  test(`${name}: unmount invalidation prevents deferred completion from publishing`, async () => {
    const session = createDraftCopyManager().createSession();
    const pending = deferred(); const published = [];
    const task = session.copy('A', () => pending.promise, value => published.push(value));
    session.invalidate();
    pending.resolve(); await task;
    assert.deepEqual(published, ['']);
  });
}

test('business: committed package A → B → A invalidates pending A, even with unchanged fields', async () => {
  const business = forms.find(([name]) => name === 'business')[1];
  assert.match(business, /useDraftCopy\(activeDraft, LEAD_EMAIL, currentDraftKey\)/);
  assert.match(business, /preparedDraft\?\.inputKey === currentDraftKey/);
  const session = createDraftCopyManager().createSession();
  const pending = deferred(); let status = '';
  const task = session.copy('Package A', () => pending.promise, value => { status = value; });
  session.invalidate(); // committed B: cleanup + new snapshot effect
  session.invalidate(); // committed A: a new generation, not the old A request
  pending.resolve(); await task;
  assert.equal(status, '');
});

test('copy hook binds rendered status to draft identity, recipient and input/package context', () => {
  assert.match(hookSource, /result\?\.draft === draft/);
  assert.match(hookSource, /result\?\.recipient === recipient/);
  assert.match(hookSource, /result\?\.contextKey === contextKey/);
  assert.match(hookSource, /return \(\) => session\.invalidate\(\)/);
  assert.match(hookSource, /\[session, draft, recipient, contextKey\]/);
  assert.match(hookSource, /setResult\(\{ draft, recipient, contextKey, message \}\)/);
});

test('shared manager prevents cross-form/remount writes overtaking an unmounted form copy', async () => {
  const manager = createDraftCopyManager();
  const oldForm = manager.createSession(), newForm = manager.createSession();
  const pending = deferred(); let writes = 0, oldStatus = '', newStatus = '';
  const task = oldForm.copy('Old form A', () => { writes++; return pending.promise; }, value => { oldStatus = value; });
  oldForm.invalidate(); // unmount while OS operation remains pending
  await newForm.copy('New form B', async () => { writes++; }, value => { newStatus = value; });
  assert.equal(writes, 1); assert.match(newStatus, /copy is still finishing/i);
  pending.resolve(); await task;
  assert.equal(oldStatus, '');
  await newForm.copy('New form B', async () => { writes++; }, value => { newStatus = value; });
  assert.equal(writes, 2); assert.match(newStatus, /^Copied/);
});

test('current failed copy exposes manual fallback and releases the lock for retry', async () => {
  const session = createDraftCopyManager().createSession(); let status = '';
  await session.copy('Current draft', async () => { throw new Error('No clipboard'); }, value => { status = value; });
  assert.match(status, /Copy unavailable\. Select and copy/);
  await session.copy('Current draft', async () => {}, value => { status = value; });
  assert.match(status, /^Copied/);
});
