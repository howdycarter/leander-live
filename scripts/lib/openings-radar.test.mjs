import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  STATUS_OPENING,
  STATUS_PERMIT_FILED,
  PERMIT_KIND,
  CHAMBER_RIBBON_KIND,
  CHAMBER_MEMBER_KIND,
  PRESS_OPENING_KIND,
  buildOpeningsFeed,
  loadOpenings,
  namesMatch,
  ribbonSubject,
  statusDisplay,
  statusLabel,
  OPENINGS_EMPTY_TITLE,
  OPENINGS_EMPTY_BODY,
} from "./openings-radar.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SODAM_PERMIT = Date.parse("2026-10-23T00:00:00-05:00");
const SODAM_SALES = Date.parse("2026-10-23T00:00:00-05:00") + 9 * 86400000;
const NOW = Date.parse("2026-11-04T15:00:00-05:00");

const sodamBusiness = {
  id: "biz-32106877544-1",
  name: "Sodam Korean Restaurant",
  category: "Restaurants & Food",
  naics: "722511",
  address: "109 Parryi Cove",
  zip: "78641",
  permitIssuedAt: SODAM_PERMIT,
  firstSalesAt: SODAM_SALES,
  source: "tx-sales-tax",
  sourceUrl: "https://data.texas.gov/dataset/Texas-Sales-and-Use-Tax-Permit-Holders",
};

const eyemartBusiness = {
  id: "biz-eyemart-1",
  name: "Eyemart Express",
  category: "Health & Beauty",
  address: "8481 W State Highway 29 Ste 130",
  zip: "78641",
  permitIssuedAt: Date.parse("2026-09-03T00:00:00-05:00"),
  firstSalesAt: Date.parse("2026-10-05T00:00:00-05:00"),
  source: "tx-sales-tax",
  sourceUrl: "https://data.texas.gov/dataset/Texas-Sales-and-Use-Tax-Permit-Holders",
};

const eyemartRibbon = {
  id: "chamber-168971",
  title: "Ribbon Cutting; Eyemart Express",
  source: "chamber",
  startsAt: Date.parse("2026-11-12T00:00:00-06:00"),
  url: "https://leander.chamberspace.net/event/ribbon-cutting-eyemart-express/168971",
};

test("permit-only is labeled permit filed, never opening", () => {
  const label = statusLabel([{ kind: PERMIT_KIND, label: "Texas sales-tax permit", date: SODAM_PERMIT }]);
  assert.equal(label, STATUS_PERMIT_FILED);
  assert.notEqual(label, STATUS_OPENING);
  assert.doesNotMatch(label, /opening/i);
  assert.equal(statusDisplay(label), "Permit filed");
});

test("proof case: Sodam permit plus first-sales date stays permit filed", () => {
  const feed = buildOpeningsFeed({
    businesses: [sodamBusiness],
    events: [],
    now: NOW,
  });
  assert.equal(feed.length, 1);
  assert.equal(feed[0].name, "Sodam Korean Restaurant");
  assert.equal(feed[0].permitIssuedAt, SODAM_PERMIT);
  assert.equal(feed[0].firstSalesAt, SODAM_SALES);
  const label = statusLabel(feed[0].sources);
  assert.equal(label, STATUS_PERMIT_FILED);
  assert.doesNotMatch(label, /opening/i);
  assert.equal(feed[0].sources.every((s) => s.kind === PERMIT_KIND), true);
});

test("permit plus a Chamber ribbon cutting can say opening", () => {
  const feed = buildOpeningsFeed({
    businesses: [sodamBusiness, eyemartBusiness],
    events: [eyemartRibbon],
    now: NOW,
  });
  const sodam = feed.find((r) => r.name === "Sodam Korean Restaurant");
  const eyemart = feed.find((r) => r.name === "Eyemart Express");
  assert.equal(statusLabel(sodam.sources), STATUS_PERMIT_FILED);
  assert.equal(statusLabel(eyemart.sources), STATUS_OPENING);
  assert.equal(statusDisplay(statusLabel(eyemart.sources)), "Opening");
  assert.ok(eyemart.sources.some((s) => s.kind === CHAMBER_RIBBON_KIND));
});

test("chamber membership is not a confirming second source", () => {
  const label = statusLabel([
    { kind: PERMIT_KIND, label: "Texas sales-tax permit" },
    { kind: CHAMBER_MEMBER_KIND, label: "New Chamber member" },
  ]);
  assert.equal(label, STATUS_PERMIT_FILED);
});

test("press coverage of an opening is a confirming second source", () => {
  const feed = buildOpeningsFeed({
    businesses: [sodamBusiness],
    signals: [{
      kind: "press",
      title: "Sodam Korean Restaurant grand opening set for Leander",
      url: "https://example.com/sodam",
      source: "google-news",
      firstSeenAt: NOW,
    }],
    now: NOW,
  });
  assert.equal(statusLabel(feed[0].sources), STATUS_OPENING);
  assert.ok(feed[0].sources.some((s) => s.kind === PRESS_OPENING_KIND));
});

test("newest permit is listed first", () => {
  const older = { ...eyemartBusiness, id: "biz-old", name: "Older Cafe", permitIssuedAt: NOW - 40 * 86400000 };
  const newer = { ...sodamBusiness, id: "biz-new", name: "Newer Cafe", permitIssuedAt: NOW - 2 * 86400000 };
  const feed = buildOpeningsFeed({ businesses: [older, newer], now: NOW });
  assert.deepEqual(feed.map((r) => r.name), ["Newer Cafe", "Older Cafe"]);
});

test("unknown or missing status never becomes opening", () => {
  assert.equal(statusDisplay("weird"), "Permit filed");
  assert.equal(statusDisplay(null), "Permit filed");
  assert.equal(statusLabel(undefined), STATUS_PERMIT_FILED);
  assert.equal(statusLabel([{ kind: "chamber-member", label: "Joined the Chamber" }]), STATUS_PERMIT_FILED);
});

test("a missing or non-array businesses feed publishes nothing", () => {
  assert.deepEqual(buildOpeningsFeed({ businesses: null, now: NOW }), []);
  assert.deepEqual(buildOpeningsFeed({ businesses: { error: true }, now: NOW }), []);
});

test("empty or failed feed loads as an empty list instead of throwing", () => {
  assert.deepEqual(loadOpenings(null), []);
  assert.deepEqual(loadOpenings(undefined), []);
  assert.deepEqual(loadOpenings({ items: [] }), []);
  assert.deepEqual(loadOpenings("not-json-array"), []);
  assert.deepEqual(loadOpenings([{ name: "Missing id" }]), []);
  assert.ok(OPENINGS_EMPTY_TITLE);
  assert.match(OPENINGS_EMPTY_BODY, /did not return any new Leander storefronts/i);
});

test("ribbon subject is taken from the Chamber title, then matched to the permit name", () => {
  assert.equal(ribbonSubject(eyemartRibbon), "Eyemart Express");
  assert.ok(namesMatch("Eyemart Express", ribbonSubject(eyemartRibbon)));
});

test("published openings.json keeps Sodam as permit filed", () => {
  const raw = JSON.parse(readFileSync(join(ROOT, "src/data/openings.json"), "utf8"));
  const feed = loadOpenings(raw);
  const sodam = feed.find((r) => /sodam korean restaurant/i.test(r.name));
  assert.ok(sodam, "Sodam Korean Restaurant should be in the published radar");
  assert.equal(statusLabel(sodam.sources), STATUS_PERMIT_FILED);
  assert.doesNotMatch(statusDisplay(statusLabel(sodam.sources)), /opening/i);
  const eyemart = feed.find((r) => /eyemart express/i.test(r.name));
  assert.ok(eyemart, "Eyemart Express should be in the published radar");
  assert.equal(statusLabel(eyemart.sources), STATUS_OPENING);
  assert.ok(feed.length === 0 || feed[0].permitIssuedAt >= feed[feed.length - 1].permitIssuedAt);
});
