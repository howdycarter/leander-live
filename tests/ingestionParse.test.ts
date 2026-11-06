import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTRACT_PROMPT,
  TARGETS,
  coerceEvents,
  parseStartsAt,
  runExtract,
  toCategory,
  toCrawledUpsert,
  toCrawledUpserts,
  type FetchLike,
} from "../convex/ingestionParse.ts";

const NOW = Date.parse("2026-11-04T21:00:00Z");

test("coerceEvents accepts a wrapped extract payload, a bare array, or junk", () => {
  assert.deepEqual(
    coerceEvents({
      events: [{ title: "ArtFest", date: "2026-11-08T18:00:00-06:00" }],
    }).map((e) => e.title),
    ["ArtFest"],
  );
  assert.equal(coerceEvents([{ title: "Solo" }])[0]?.title, "Solo");
  assert.deepEqual(coerceEvents(null), []);
  assert.deepEqual(coerceEvents({ events: "nope" }), []);
});

test("toCategory only keeps the six feed chips", () => {
  assert.equal(toCategory("Music"), "Music");
  assert.equal(toCategory("Food & Drink"), "Food & Drink");
  assert.equal(toCategory("sports"), undefined);
  assert.equal(toCategory(1), undefined);
});

test("parseStartsAt accepts ticket startsAt or Firecrawl date, and drops past/unparseable", () => {
  assert.equal(
    parseStartsAt({ startsAt: NOW + 3600_000 }, NOW),
    NOW + 3600_000,
  );
  assert.equal(
    parseStartsAt({ date: "November 8, 2026 10:00 AM GMT-6" }, NOW) != null,
    true,
  );
  assert.equal(parseStartsAt({ date: "not a date" }, NOW), null);
  assert.equal(parseStartsAt({ startsAt: NOW - 48 * 3600_000 }, NOW), null);
  assert.equal(parseStartsAt({ date: "   " }, NOW), null);
});

test("toCrawledUpsert maps {title, description, startsAt, venue, url} and skips empties", () => {
  const row = toCrawledUpsert(
    {
      title: "  Farmers Market  ",
      description: " Saturday produce. ",
      startsAt: "2026-11-08T15:00:00Z",
      venue: " Old Town ",
      url: " https://example.test/market ",
      category: "Food & Drink",
    },
    NOW,
  );
  assert.deepEqual(row, {
    title: "Farmers Market",
    description: "Saturday produce.",
    startsAt: Date.parse("2026-11-08T15:00:00Z"),
    venue: "Old Town",
    category: "Food & Drink",
    url: "https://example.test/market",
  });
  assert.equal(toCrawledUpsert({ title: "  " }, NOW), null);
  const untitled = toCrawledUpsert(
    { title: "Band night", date: "2026-11-08T02:00:00Z" },
    NOW,
  );
  assert.equal(untitled?.description, "Band night");
  assert.equal(untitled?.venue, "Leander, TX");
  assert.equal(untitled?.url, undefined);
});

test("fixture extract of city + chamber-shaped listings upserts only usable rows", () => {
  const fixture = {
    events: [
      {
        title: "City Council watch party",
        description: "Watch the meeting together.",
        date: "November 10, 2026 6:00 PM GMT-6",
        venue: "Pat Bryson Municipal Hall",
        url: "https://www.leandertx.gov/calendar",
        category: "Community",
      },
      {
        title: "Chamber After Hours",
        description: "Networking.",
        startsAt: Date.parse("2026-11-12T23:00:00Z"),
        venue: "Leander Chamber",
        url: "https://leandercc.org/events",
        category: "Community",
      },
      { title: "Last year's picnic", date: "2025-04-01T18:00:00Z" },
      { title: "", date: "2026-11-20T18:00:00Z" },
    ],
  };
  const rows = toCrawledUpserts(coerceEvents(fixture), NOW);
  assert.deepEqual(
    rows.map((r) => r.title),
    ["City Council watch party", "Chamber After Hours"],
  );
});

test("runExtract uses the mock fetch only — never a live Firecrawl or city URL", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push(`${init?.method ?? "GET"} ${input}`);
    assert.equal(new URL(input).hostname, "api.firecrawl.dev");
    assert.match(String(init?.headers?.Authorization), /^Bearer test-key$/);
    if (init?.body) {
      const body = JSON.parse(init.body) as {
        urls: string[];
        prompt: string;
      };
      assert.deepEqual(body.urls, ["https://visitleandertx.com/"]);
      assert.equal(body.prompt, EXTRACT_PROMPT);
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        data: {
          events: [
            {
              title: "Kite Festival",
              date: "2026-11-15T16:00:00Z",
              venue: "Benbrook Ranch Park",
              category: "Family",
            },
          ],
        },
      }),
    };
  };
  const extracted = await runExtract(
    "test-key",
    TARGETS[0],
    fetchImpl,
    { pollMs: 0, attempts: 1 },
  );
  assert.equal(extracted[0]?.title, "Kite Festival");
  assert.deepEqual(calls, ["POST https://api.firecrawl.dev/v2/extract"]);
});

test("runExtract polls an async job and surfaces failed jobs", async () => {
  let polls = 0;
  const fetchImpl: FetchLike = async (input) => {
    if (input.endsWith("/extract")) {
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ id: "job_1" }),
      };
    }
    polls += 1;
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () =>
        polls === 1
          ? { status: "processing" }
          : { status: "completed", data: [{ title: "Done", startsAt: NOW + 1000 }] },
    };
  };
  const extracted = await runExtract("k", TARGETS[1], fetchImpl, {
    pollMs: 0,
    attempts: 3,
  });
  assert.equal(extracted[0]?.title, "Done");

  const failing: FetchLike = async (input) => {
    if (input.endsWith("/extract")) {
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ id: "job_bad" }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ status: "failed", error: "nope" }),
    };
  };
  await assert.rejects(
    () => runExtract("k", TARGETS[1], failing, { pollMs: 0, attempts: 2 }),
    /extract job failed: nope/,
  );
});

test("scheduled targets stay listed and this suite never names a live scrape", () => {
  assert.deepEqual([...TARGETS], [
    "https://visitleandertx.com/",
    "https://www.leandertx.gov",
  ]);
});
