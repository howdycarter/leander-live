import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  TARGETS,
  runExtract,
  toCrawledUpsert,
} from "./ingestionParse";

/**
 * Scheduled ingestion (see convex/crons.ts, weekly on Mondays).
 *
 * Firecrawl's /v2/extract pulls structured events from listed public
 * pages; each parsed listing becomes an `events` row with source
 * "crawl" (deduped on title + date). Parsing lives in ingestionParse.ts
 * so it can be tested with fixtures and a mock fetch — this action still
 * no-ops when FIRECRAWL_API_KEY is unset, and this PR never runs a live
 * crawl.
 *
 *   npx convex env set FIRECRAWL_API_KEY <key>
 */

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
    const now = Date.now();
    for (const url of TARGETS) {
      try {
        const extracted = await runExtract(apiKey, url, (input, init) =>
          fetch(input, init),
        );
        for (const e of extracted) {
          const row = toCrawledUpsert(e, now);
          if (!row) continue;
          const { eventId } = await ctx.runMutation(
            internal.events.upsertCrawled,
            row,
          );
          if (eventId) {
            inserted++;
            await ctx.scheduler.runAfter(0, internal.summarize.summarizeEvent, {
              eventId,
            });
          }
        }
      } catch (err) {
        errors.push(`${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    const reason = errors.length > 0 ? errors.join(" | ") : undefined;
    console.log(
      `crawlLeander: inserted ${inserted}${reason ? `; errors: ${reason}` : ""}`,
    );
    return { ok: true, inserted, reason };
  },
});
