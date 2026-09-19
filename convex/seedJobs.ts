import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-off Firecrawl jobs import.
 *
 * The Firecrawl agent writes scraped listings to /tmp/leander-jobs/jobs.json,
 * one object per line (JSONL) or a JSON array, shaped like:
 *
 *   {
 *     "title": "Line Cook",
 *     "company": "Mash + Mallow",
 *     "location": "Leander, TX",
 *     "type": "full-time",            // full-time | part-time | contract | temporary
 *     "payRange": "$16-$19/hr",       // optional
 *     "description": "…",             // optional
 *     "applyUrl": "https://…",       // required
 *     "featured": false,              // optional, paid placement
 *     "expiresAt": 1790000000000      // optional unix ms
 *   }
 *
 * Run recipe (internal functions can't be called from the CLI directly):
 *   1. If /tmp/leander-jobs/jobs.json is missing, do nothing — the importer
 *      is tolerant: an empty/absent payload imports zero rows.
 *   2. Temporarily change `internalMutation` below to `mutation` and deploy.
 *   3. Run:
 *        python3 - <<'EOF'
 *        import json, os, subprocess
 *        p = "/tmp/leander-jobs/jobs.json"
 *        jobs = []
 *        if os.path.exists(p):
 *            raw = open(p).read().strip()
 *            jobs = json.loads(raw) if raw.startswith("[") else [json.loads(l) for l in raw.splitlines() if l.strip()]
 *        subprocess.run(["npx", "convex", "run", "seedJobs:importJobs",
 *                        "--args", json.dumps({"jobs": jobs})], cwd="/home/hatch/workspace/leander-live")
 *        EOF
 *   4. Flip back to `internalMutation` and redeploy.
 *
 * Rows with a missing title/company/applyUrl are skipped; (title, company)
 * duplicates against already-approved jobs are skipped.
 */
export const importJobs = internalMutation({
  args: {
    jobs: v.array(
      v.object({
        title: v.string(),
        company: v.string(),
        location: v.optional(v.string()),
        type: v.optional(v.string()),
        payRange: v.optional(v.string()),
        description: v.optional(v.string()),
        applyUrl: v.string(),
        featured: v.optional(v.boolean()),
        expiresAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ imported: number; skipped: number }> => {
    const validTypes = ["full-time", "part-time", "contract", "temporary"] as const;
    const approved = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(500);
    const seen = new Set(
      approved.map(
        (j) => `${j.title.trim().toLowerCase()}|${j.company.trim().toLowerCase()}`,
      ),
    );
    let imported = 0;
    let skipped = 0;
    for (const raw of args.jobs) {
      const title = raw.title.trim().slice(0, 120);
      const company = raw.company.trim().slice(0, 120);
      const applyUrl = raw.applyUrl.trim();
      const key = `${title.toLowerCase()}|${company.toLowerCase()}`;
      if (!title || !company || !/^https?:\/\//i.test(applyUrl) || seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      const type = (validTypes as readonly string[]).includes(raw.type ?? "")
        ? (raw.type as (typeof validTypes)[number])
        : "full-time";
      await ctx.db.insert("jobs", {
        title,
        company,
        location: raw.location?.trim().slice(0, 160) || "Leander, TX",
        type,
        payRange: raw.payRange?.trim().slice(0, 80) || undefined,
        description: raw.description?.trim().slice(0, 4000) || "(no description provided)",
        applyUrl,
        source: "crawl",
        featured: raw.featured ?? false,
        status: "approved",
        submittedAt: Date.now(),
        expiresAt: raw.expiresAt,
      });
      imported += 1;
    }
    return { imported, skipped };
  },
});
