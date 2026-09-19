import { internalAction } from "./_generated/server";

/**
 * Scheduled ingestion (see convex/crons.ts, weekly on Mondays).
 * Firecrawl crawls Leander city/chamber event pages, each listing becomes an
 * `events` row with source "crawl". Every hackathon participant gets 20k
 * Firecrawl credits — set the key with:
 *
 *   npx convex env set FIRECRAWL_API_KEY <key>
 */
export const crawlLeander = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; inserted: number; reason?: string }> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.log("FIRECRAWL_API_KEY not set — skipping crawl.");
      return { ok: false, inserted: 0, reason: "missing FIRECRAWL_API_KEY" };
    }

    // TODO: call the Firecrawl API (https://api.firecrawl.dev/v2/crawl) against:
    //   - https://www.leandertexas.gov/calendar.aspx (city calendar)
    //   - https://www.leandercc.org/events (chamber of commerce)
    // with an extraction prompt for {title, description, startsAt, venue, url},
    // then for each parsed event:
    //   await ctx.runMutation(internal.events.upsertCrawled, { ... });
    // and optionally kick off AI blurbs:
    //   await ctx.scheduler.runAfter(0, internal.summarize.summarizeEvent, { eventId });

    return { ok: true, inserted: 0, reason: "stub — wire Firecrawl response parsing" };
  },
});
