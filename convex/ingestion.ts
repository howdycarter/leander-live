import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Category } from "./schema";

/**
 * Scheduled ingestion (see convex/crons.ts, weekly on Mondays).
 *
 * Firecrawl's /v2/extract pulls structured events from Leander's real
 * event pages; each parsed listing becomes an `events` row with source
 * "crawl" (deduped on title + date). Every hackathon participant gets
 * 20k Firecrawl credits — sign up at https://www.firecrawl.dev, then:
 *
 *   npx convex env set FIRECRAWL_API_KEY <key>
 */

const TARGETS = [
  "https://visitleandertx.com/",
  "https://www.leandertx.gov",
];

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          date: {
            type: "string",
            description:
              "Date and time of the event, e.g. 'October 3, 2026 10:00 AM'",
          },
          venue: { type: "string" },
          url: { type: "string" },
          category: {
            type: "string",
            description:
              "One of: Music, Food & Drink, Family, Outdoors, Learn, Community",
          },
        },
        required: ["title"],
      },
    },
  },
  required: ["events"],
};

const VALID_CATEGORIES = [
  "Music",
  "Food & Drink",
  "Family",
  "Outdoors",
  "Learn",
  "Community",
] as const;

function toCategory(value: unknown): Category | undefined {
  return typeof value === "string" &&
    (VALID_CATEGORIES as readonly string[]).includes(value)
    ? (value as Category)
    : undefined;
}

interface ExtractedEvent {
  title?: string;
  description?: string;
  date?: string;
  venue?: string;
  url?: string;
  category?: string;
}

async function runExtract(
  apiKey: string,
  url: string,
): Promise<ExtractedEvent[]> {
  const startRes = await fetch("https://api.firecrawl.dev/v2/extract", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      urls: [url],
      prompt:
        "List upcoming public events in Leander, Texas. For each event give: title, a 1-2 sentence description, the date and time, the venue name, the page URL, and a category (Music, Food & Drink, Family, Outdoors, Learn, or Community). Only include events happening in the future — ignore navigation, ads, sponsors, and past events.",
      schema: EXTRACT_SCHEMA,
    }),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`extract start failed (${startRes.status}): ${text}`);
  }
  const started = (await startRes.json()) as { id?: string; data?: unknown };
  // v2 answers async with { success: true, id }; poll until terminal.
  if (started.data) return coerceEvents(started.data);
  const jobId = started.id;
  if (!jobId) throw new Error("extract returned no job id and no data");

  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(
      `https://api.firecrawl.dev/v2/extract/${jobId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!pollRes.ok) continue;
    const job = (await pollRes.json()) as {
      status?: string;
      data?: unknown;
      error?: string;
    };
    if (job.status === "completed") return coerceEvents(job.data);
    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(`extract job ${job.status}: ${job.error ?? jobId}`);
    }
  }
  throw new Error(`extract job ${jobId} did not complete in time`);
}

function coerceEvents(data: unknown): ExtractedEvent[] {
  if (Array.isArray(data)) return data as ExtractedEvent[];
  if (data && typeof data === "object" && Array.isArray((data as { events?: unknown }).events)) {
    return (data as { events: ExtractedEvent[] }).events;
  }
  return [];
}

export const crawlLeander = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ ok: boolean; inserted: number; reason?: string }> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.log("FIRECRAWL_API_KEY not set — skipping crawl.");
      return { ok: false, inserted: 0, reason: "missing FIRECRAWL_API_KEY" };
    }

    let inserted = 0;
    const errors: string[] = [];
    for (const url of TARGETS) {
      let extracted: ExtractedEvent[];
      try {
        extracted = await runExtract(apiKey, url);
      } catch (err) {
        errors.push(`${url}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      for (const e of extracted) {
        const title = (e.title ?? "").trim();
        if (!title) continue;
        const startsAt = e.date ? new Date(e.date).getTime() : NaN;
        if (Number.isNaN(startsAt) || startsAt < Date.now() - 24 * 60 * 60 * 1000) {
          continue; // unparseable or past — skip rather than invent
        }
        const { eventId } = await ctx.runMutation(
          internal.events.upsertCrawled,
          {
            title,
            description: (e.description ?? "").trim() || title,
            startsAt,
            venue: (e.venue ?? "").trim() || "Leander, TX",
            category: toCategory(e.category),
            url: (e.url ?? "").trim() || undefined,
          },
        );
        if (eventId) {
          inserted++;
          // Kick off the AI "why go" blurb for the fresh listing.
          await ctx.scheduler.runAfter(0, internal.summarize.summarizeEvent, {
            eventId,
          });
        }
      }
    }

    const reason = errors.length > 0 ? errors.join(" | ") : undefined;
    console.log(`crawlLeander: inserted ${inserted}${reason ? `; errors: ${reason}` : ""}`);
    return { ok: true, inserted, reason };
  },
});
