import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  businessDraftKey, businessEmailDraft, centralDateTimeInput, emailDraftText, eventEmailDraft,
  hasRequiredDraftFields, jobEmailDraft,
} from '../../src/site/emailDrafts.ts';
import { AD_PACKAGES, SERVICE_LEAD_STEPS, formatPrice } from '../../src/site/monetization.ts';

const eventInput = {
  title: '  Neighborhood market  ', description: '  Local makers & music.  ',
  venue: '  Old Town  ', category: 'Community', url: ' https://example.com/?a=1&b=2 ',
  when: '2026-11-01T01:30',
};
const businessInput = {
  businessName: '  Main Street Bakery  ', contactName: '  Jamie  ',
  email: ' jamie@example.com ', phone: '', vertical: 'Food & drink',
  interests: ['Featured listing'], packageName: 'Featured Listing',
};

test('event drafts preserve entered Central wall time, including ambiguous DST times', () => {
  const draft = eventEmailDraft(eventInput);
  assert.equal(draft.subject, 'Event submission: Neighborhood market');
  assert.match(draft.body, /When: 2026-11-01 01:30 \(Leander \/ America\/Chicago — Central time\)/);
  assert.match(draft.body, /Venue: Old Town/);
  assert.match(draft.body, /Link: https:\/\/example.com\/\?a=1&b=2/);
  assert.match(draft.body, /publication is not guaranteed/);
  assert.match(draft.body, /Please confirm that you own or have permission to share/);
});

test('Central input defaults handle summer, winter, midnight and the DST transition', () => {
  for (const [instant, expected] of [
    ['2026-07-01T23:00:00Z', '2026-07-01T18:00'],
    ['2026-12-01T00:00:00Z', '2026-11-30T18:00'],
    ['2026-11-01T05:00:00Z', '2026-11-01T00:00'],
    ['2026-11-01T06:30:00Z', '2026-11-01T01:30'],
    ['2026-11-01T07:30:00Z', '2026-11-01T01:30'],
  ]) assert.equal(centralDateTimeInput(new Date(instant)), expected);
});

test('event draft serialization and default wall time are independent of browser/server timezone', () => {
  const original = process.env.TZ;
  try {
    const drafts = [];
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone;
      drafts.push(eventEmailDraft(eventInput));
      assert.equal(centralDateTimeInput(new Date('2026-11-01T05:00:00Z')), '2026-11-01T00:00');
    }
    assert.deepEqual(drafts[0], drafts[1]); assert.deepEqual(drafts[1], drafts[2]);
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});

test('optional event fields do not create empty labels or literal nulls', () => {
  const draft = eventEmailDraft({ ...eventInput, category: '', url: ' ' });
  assert.doesNotMatch(draft.body, /Category:|Link:|null|undefined/);
});

test('job draft contains exact employer-provided details, not a posted claim', () => {
  const draft = jobEmailDraft({
    title: ' Cook ', company: ' Bakery ', location: ' Leander, TX ', type: 'Full-time',
    payRange: ' $16–$19/hr ', applyUrl: ' https://example.com/jobs ', description: ' Prepare food. ',
  });
  assert.equal(draft.subject, 'Job posting: Cook at Bakery');
  assert.match(draft.body, /Pay range: \$16–\$19\/hr/);
  assert.match(draft.body, /Apply link: https:\/\/example.com\/jobs/);
  assert.match(draft.body, /Submitted for review; publication is not guaranteed/);
  assert.match(draft.body, /Please confirm that you own or have permission to share/);
});

test('business draft is an inquiry with no payment, reservation or delivery promise', () => {
  const draft = businessEmailDraft(businessInput);
  assert.equal(draft.subject, 'Advertiser inquiry: Main Street Bakery (Featured Listing)');
  assert.match(draft.body, /Package inquiry: Featured Listing/);
  assert.match(draft.body, /Rates and placements are proposals, subject to confirmation/);
  assert.match(draft.body, /No payment, reservation, or publication is made/);
  assert.match(draft.body, /Service leads are not available/);
  assert.doesNotMatch(draft.body, /Phone:|null|undefined/);
});

test('phone-only business inquiries and manual-copy drafts include the actual recipient', () => {
  const draft = businessEmailDraft({ ...businessInput, email: '', phone: ' 512-555-0100 ', packageName: undefined, interests: [] });
  assert.match(draft.body, /Phone: 512-555-0100/);
  assert.doesNotMatch(draft.body, /Email:|Package inquiry:|Interested in:/);
  assert.equal(emailDraftText(draft, 'chris@howdycarter.com'), `To: chris@howdycarter.com\nSubject: ${draft.subject}\n\n${draft.body}`);
});

test('preparing drafts never mutates the original visitor fields', () => {
  const input = Object.freeze({ ...businessInput, interests: Object.freeze([...businessInput.interests]) });
  const before = JSON.stringify(input);
  businessEmailDraft(input);
  assert.equal(JSON.stringify(input), before);
  const event = Object.freeze({ ...eventInput });
  eventEmailDraft(event);
  assert.equal(event.title, '  Neighborhood market  ');
});

test('business A → B → edit → A never revives a stale prepared draft', () => {
  const savedA = { ...businessEmailDraft(businessInput), inputKey: businessDraftKey(businessInput) };
  const selectedB = { ...businessInput, packageName: 'Featured Job' };
  assert.notEqual(savedA.inputKey, businessDraftKey(selectedB));
  const editedB = { ...selectedB, contactName: 'New contact', email: 'new@example.com' };
  const returnedA = { ...editedB, packageName: businessInput.packageName };
  assert.notEqual(savedA.inputKey, businessDraftKey(returnedA));
  const preparedAgain = { ...businessEmailDraft(returnedA), inputKey: businessDraftKey(returnedA) };
  assert.equal(preparedAgain.inputKey, businessDraftKey(returnedA));
  assert.match(preparedAgain.body, /Contact: New contact/);
  assert.match(preparedAgain.body, /Email: new@example.com/);
  assert.match(preparedAgain.body, /Package inquiry: Featured Listing/);
});

test('every business field participates in snapshot matching, without mutating input', () => {
  const originalKey = businessDraftKey(businessInput);
  const changes = {
    businessName: 'Another business', contactName: 'Another contact', email: 'other@example.com',
    phone: '512-555-0101', vertical: 'Other', interests: ['Sponsored event'], packageName: undefined,
  };
  for (const [field, value] of Object.entries(changes)) {
    assert.notEqual(businessDraftKey({ ...businessInput, [field]: value }), originalKey, field);
  }
  assert.equal(businessDraftKey({ ...businessInput, interests: [...businessInput.interests] }), originalKey);
  assert.equal(businessInput.businessName, '  Main Street Bakery  ');
});

test('required-field guard rejects blank or whitespace-only input without persistent DOM validity', () => {
  assert.equal(hasRequiredDraftFields(['A title', 'A description']), true);
  assert.equal(hasRequiredDraftFields(['A title', '']), false);
  assert.equal(hasRequiredDraftFields(['A title', ' \t\n ']), false);
  assert.equal(hasRequiredDraftFields([' A title ', 'Corrected text']), true);
});

test('three approved charter rates remain explicit; service leads are unavailable; payment URLs stay empty', () => {
  assert.deepEqual(AD_PACKAGES.filter(p => !p.unavailable).map(p => [p.id, p.price, p.cadence]), [
    ['featured-listing', 29, '/month'], ['sponsored-event', 19, '/event'], ['featured-job', 59, '/30 days'],
  ]);
  for (const pkg of AD_PACKAGES) {
    assert.equal(pkg.stripeUrl, '');
    assert.equal(pkg.exclusivity, undefined);
    assert.equal(formatPrice(pkg), pkg.unavailable ? 'Unavailable' : `$${pkg.price}${pkg.cadence}`);
  }
  assert.equal(AD_PACKAGES.find(p => p.id === 'service-leads').unavailable, true);
  const copy = JSON.stringify([AD_PACKAGES, SERVICE_LEAD_STEPS]);
  assert.doesNotMatch(copy, /AI-qualified|weekly reminders|performance snapshot|repost discount|we qualify every|start getting leads|no lead, no charge|\$299/i);
});

const content = readFileSync(new URL('../../src/site/content.tsx', import.meta.url), 'utf8');
const section = (start, end) => content.slice(content.indexOf(start), content.indexOf(end, content.indexOf(start)));
const forms = [
  section('export function SubmitDialogContent()', '/* ---------------- jobs board'),
  section('function PostJobDialogContent()', 'export function JobsBoard()'),
  section('export function BusinessForm(', '/* ---------------- about / crosspromo'),
];

test('all three original forms retain drafts and offer not-sent/manual fallback states', () => {
  for (const form of forms) {
    assert.match(form, /Email draft prepared — not sent/);
    assert.match(form, /href=\{mailtoFor\(preparedDraft.subject, preparedDraft.body\)\}/);
    assert.match(form, /readOnly rows=\{5\} value=\{emailDraftText/);
    assert.match(form, /onClick=\{copyDraft\}/);
    assert.match(form, /resetCopy\(\); setPreparedDraft\(null\)/);
    assert.match(form, /Edit details/);
    assert.doesNotMatch(form, /window\.location|setSent|setCustomValidity|set(?:BusinessName|ContactName|Email|Phone|Vertical|Interests|Title|Description)\((?:""|\[\])\)/);
  }
  assert.match(forms[0], /Date &amp; time \(Central\)/);
  assert.match(forms[2], /preparedDraft\.packageName === packageName/);
  assert.match(forms[2], /preparedDraft\.inputKey === currentDraftKey/);
  assert.match(forms[2], /inputKey: currentDraftKey/);
  assert.match(forms[2], /type="email"/);
  assert.doesNotMatch(forms[2], /Buy leads/);
});

test('advertising actions remain inquiry-only without unsupported checkout, exclusivity or automated fulfillment claims', () => {
  const pages = readFileSync(new URL('../../src/site/pages.tsx', import.meta.url), 'utf8');
  const concept = readFileSync(new URL('../../src/site/conceptA.tsx', import.meta.url), 'utf8');
  assert.match(pages, /Inquiry only\. No payment or reservation/);
  assert.match(pages, /\$\{pkg.cadence\}/);
  assert.doesNotMatch(pages, /· proposed/);
  assert.match(pages, /grid gap-6 md:grid-cols-2/);
  assert.match(pages, /Service leads are not available/);
  assert.doesNotMatch(pages + concept, /stripe_checkout_started|window\.open\(pkg|Checkout opens soon|reserve your spot|AI-qualified|we route the qualified lead|own your trade exclusively|refreshed twice a day/i);
});
