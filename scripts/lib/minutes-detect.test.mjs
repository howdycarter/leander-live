import test from "node:test";
import assert from "node:assert/strict";
import {
  boardbookMinutesUrl,
  civicClerkFileStreamUrl,
  minutesUrlFromCivicClerkEvent,
} from "./civic-minutes.mjs";
import {
  detectMinutesSignals,
  isDecisionBody,
  snapshotCivic,
} from "./minutes-detect.mjs";
import {
  draftFromMinutesSignal,
  publishSummary,
  publishedOnly,
  reviewSummary,
  upsertDraft,
} from "./decision-summary.mjs";

const NOW = Date.parse("2026-11-04T15:00:00Z");
const COUNCIL = {
  id: "civic-865",
  body: "City Council",
  title: "City Council Meeting",
  startsAt: NOW - 36 * 3600_000,
  sourceUrl: "https://leandertx.portal.civicclerk.com/event/865",
};
const PARKS = {
  id: "civic-1",
  body: "Parks & Recreation Advisory Board",
  title: "Parks",
  startsAt: NOW,
};

test("CivicClerk minutes URLs come from already-fetched minutesFile ids, with no HTTP", () => {
  assert.equal(
    civicClerkFileStreamUrl("https://leandertx.api.civicclerk.com/v1", 44),
    "https://leandertx.api.civicclerk.com/v1/Meetings/GetMeetingFileStream(fileId=44)",
  );
  assert.equal(
    minutesUrlFromCivicClerkEvent("https://leandertx.api.civicclerk.com/v1", {
      minutesFile: { agendaId: 99 },
    }),
    "https://leandertx.api.civicclerk.com/v1/Meetings/GetMeetingFileStream(fileId=99)",
  );
  assert.equal(
    minutesUrlFromCivicClerkEvent("https://leandertx.api.civicclerk.com/v1", {}),
    undefined,
  );
  assert.match(
    boardbookMinutesUrl(
      'Agenda https://meetings.boardbook.org/Public/Agenda/1234?meeting=9 Minutes https://meetings.boardbook.org/Public/Minutes/1234?meeting=9',
    ),
    /Public\/Minutes\/1234/,
  );
});

test("only council / P&Z / ISD board bodies are decision bodies", () => {
  assert.equal(isDecisionBody("City Council"), true);
  assert.equal(isDecisionBody("Planning & Zoning Commission"), true);
  assert.equal(isDecisionBody("Leander ISD Board of Trustees"), true);
  assert.equal(isDecisionBody("Parks & Recreation Advisory Board"), false);
});

test("first snapshot is a baseline: no signals even if minutesUrl is already present", () => {
  const result = detectMinutesSignals(
    [],
    [{ ...COUNCIL, minutesUrl: "https://example.test/minutes.pdf" }],
    NOW,
  );
  assert.equal(result.baseline, true);
  assert.deepEqual(result.signals, []);
  assert.equal(result.snapshots[0].minutesUrl, "https://example.test/minutes.pdf");
});

test("minutesUrl appearing on a watched body queues a summary-draft that is not a publish", () => {
  const prev = snapshotCivic([COUNCIL, PARKS]);
  const next = [
    {
      ...COUNCIL,
      minutesUrl: "https://example.test/council-minutes.pdf",
      agendaUrl: "https://example.test/council-agenda.pdf",
    },
    PARKS,
  ];
  const { signals, baseline } = detectMinutesSignals(prev, next, NOW);
  assert.equal(baseline, false);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "summary-draft");
  assert.equal(signals[0].autoPublish, false);
  assert.equal(signals[0].meetingId, "civic-865");
  assert.equal(signals[0].minutesUrl, "https://example.test/council-minutes.pdf");
  assert.doesNotMatch(JSON.stringify(signals), /published/);
});

test("unwatched bodies and unchanged minutes do not queue drafts", () => {
  const withMinutes = {
    ...COUNCIL,
    minutesUrl: "https://example.test/council-minutes.pdf",
  };
  const { signals: none } = detectMinutesSignals(
    snapshotCivic([withMinutes]),
    [withMinutes],
    NOW,
  );
  assert.deepEqual(none, []);
  const parksGotMinutes = detectMinutesSignals(
    snapshotCivic([PARKS]),
    [{ ...PARKS, minutesUrl: "https://example.test/parks.pdf" }],
    NOW,
  );
  assert.deepEqual(parksGotMinutes.signals, []);
});

test("agenda URL changes emit agenda-updated, not a publishable summary", () => {
  const prev = snapshotCivic([
    { ...COUNCIL, agendaUrl: "https://example.test/a1.pdf" },
  ]);
  const { signals } = detectMinutesSignals(
    prev,
    [{ ...COUNCIL, agendaUrl: "https://example.test/a2.pdf" }],
    NOW,
  );
  assert.equal(signals[0].kind, "agenda-updated");
  assert.equal(signals[0].autoPublish, false);
});

test("drafts stay unpublished until a reviewer writes five bullets and publishes explicitly", () => {
  const { signals } = detectMinutesSignals(
    snapshotCivic([COUNCIL]),
    [{ ...COUNCIL, minutesUrl: "https://example.test/m.pdf" }],
    NOW,
  );
  const draft = draftFromMinutesSignal(signals[0], NOW);
  assert.equal(draft.status, "draft");
  assert.deepEqual(draft.bullets, []);
  assert.throws(() => publishSummary(draft, { reviewer: "chris" }), /reviewed/);
  assert.throws(() => reviewSummary(draft, ["one"]), /five/);
  const reviewed = reviewSummary(
    draft,
    [
      "Approved the consent agenda.",
      "Adopted the noise ordinance amendment.",
      "Awarded the Brushy Street overlay contract.",
      "Set the next meeting for November 20.",
      "Took no action on the hotel occupancy item.",
    ],
    NOW + 1,
  );
  assert.equal(reviewed.status, "reviewed");
  assert.throws(() => publishSummary(reviewed, {}), /reviewer/);
  const published = publishSummary(reviewed, { reviewer: "chris@howdycarter.com" }, NOW + 2);
  assert.equal(published.status, "published");
  assert.equal(published.bullets.length, 5);
  assert.deepEqual(publishedOnly([draft, reviewed, published]).map((s) => s.id), [
    published.id,
  ]);
});

test("upsertDraft never demotes a reviewed or published row", () => {
  const draft = {
    id: "decision-civic-865",
    status: "draft",
    bullets: [],
  };
  const reviewed = { ...draft, status: "reviewed", bullets: ["a", "b", "c", "d", "e"] };
  const store = upsertDraft([], reviewed);
  const again = upsertDraft(store, draft);
  assert.equal(again[0].status, "reviewed");
});
