import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_CARD_IMAGE,
  LEANDER_ZIPS,
  decisionAlertText,
  newNearYou,
  weekendRoundup,
} from "./shareables.mjs";

const FRI = Date.parse("2026-11-06T18:00:00Z"); // Friday evening CT-ish
const SAT = Date.parse("2026-11-07T18:00:00Z");
const MON = Date.parse("2026-11-09T18:00:00Z");
const NOW_THU = Date.parse("2026-11-05T22:00:00Z"); // Thursday PM UTC, still Thursday CT

const events = [
  {
    id: "e-sat",
    title: "Night Market",
    description: "Makers.",
    startsAt: SAT,
    venue: "Old Town",
    category: "Community",
    source: "anchor",
    image: "/images/real/old-town-street-festival.jpg",
  },
  {
    id: "e-fri",
    title: "Football Friday",
    description: "Lights.",
    startsAt: FRI,
    venue: "Leander High",
    category: "Community",
    source: "anchor",
  },
  {
    id: "e-mon",
    title: "Monday workshop",
    description: "Skip me.",
    startsAt: MON,
    venue: "Library",
    category: "Learn",
    source: "anchor",
  },
];

test("weekend roundup from Thursday PM keeps Fri–Sun, text-first, one fallback image", () => {
  const card = weekendRoundup(events, NOW_THU);
  assert.equal(card.kind, "weekend-roundup");
  assert.equal(card.weekStart, "2026-11-06");
  assert.deepEqual(card.events.map((e) => e.id), ["e-fri", "e-sat"]);
  assert.equal(card.image, "/images/real/old-town-street-festival.jpg");
  assert.match(card.text, /This weekend in Leander/);
  assert.match(card.text, /Football Friday/);
  assert.doesNotMatch(card.text, /Monday workshop/);
  assert.equal(card.sharePath, "/weekend");
});

test("weekend roundup with no photos still ships a text card and brand image", () => {
  const card = weekendRoundup(
    events.map((e) => ({ ...e, image: undefined })),
    NOW_THU,
  );
  assert.equal(card.image, FALLBACK_CARD_IMAGE);
  assert.match(card.text, /Night Market/);
});

test("new-near-you keeps Leander ZIPs and recent permits only", () => {
  const digest = newNearYou(
    [
      {
        id: "a",
        name: "New Cafe",
        category: "Food",
        naics: "722",
        address: "1 Main",
        zip: "78641",
        permitIssuedAt: NOW_THU - 2 * 86400000,
        featured: false,
        source: "texas-permits",
      },
      {
        id: "b",
        name: "Old Shop",
        category: "Retail",
        naics: "448",
        address: "2 Main",
        zip: "78641",
        permitIssuedAt: NOW_THU - 40 * 86400000,
        featured: false,
        source: "texas-permits",
      },
      {
        id: "c",
        name: "Austin spill",
        category: "Food",
        naics: "722",
        address: "Elsewhere",
        zip: "78750",
        permitIssuedAt: NOW_THU - 1 * 86400000,
        featured: false,
        source: "texas-permits",
      },
    ],
    NOW_THU,
  );
  assert.deepEqual([...digest.zips], [...LEANDER_ZIPS]);
  assert.deepEqual(digest.items.map((i) => i.id), ["a"]);
  assert.match(digest.text, /New Cafe/);
  assert.doesNotMatch(digest.text, /Austin spill|Old Shop/);
});

test("decision alerts only include published five-bullet summaries", () => {
  assert.equal(
    decisionAlertText([{ status: "draft", body: "City Council", bullets: [] }]),
    null,
  );
  const text = decisionAlertText([
    {
      status: "published",
      body: "City Council",
      bullets: ["One", "Two", "Three", "Four", "Five"],
    },
  ]);
  assert.match(text, /City Council decided/);
  assert.match(text, /• Five/);
});
