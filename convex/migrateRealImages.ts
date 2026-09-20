import { internalMutation } from "./_generated/server";

/**
 * One-time migration: point the already-seeded anchor events at the real
 * photos in public/images/real/ (sourced from visitleandertx.com, the
 * official visitors site for Leander, TX).
 *
 * Matches rows by title and patches the `image` field. Deliberately leaves
 * "Tricks and Treats Spooktacular" and "Veterans Day Ceremony" untouched —
 * no real photo of those events has been found yet, so their placeholder
 * images stay until one is sourced.
 *
 * Run once after deploy:
 *   npx convex run migrateRealImages:migrateRealImages
 */
export const migrateRealImages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const updates: Record<string, string> = {
      ArtFest: "/images/real/artfest.jpg",
      "Floating Pumpkin Patch": "/images/real/floating-pumpkin-patch.jpg",
      "Old Town Christmas Festival": "/images/real/old-town-christmas.jpg",
      "Devine Lake Kite Festival": "/images/real/kite-festival.jpg",
      "Old Town Street Festival": "/images/real/old-town-street-festival.jpg",
      "Liberty Fest": "/images/real/liberty-fest.jpg",
    };

    const updated: string[] = [];
    const missing: string[] = [];
    for (const [title, image] of Object.entries(updates)) {
      const rows = await ctx.db
        .query("events")
        .filter((q) => q.eq(q.field("title"), title))
        .take(5);
      if (rows.length === 0) {
        missing.push(title);
        continue;
      }
      for (const row of rows) {
        await ctx.db.patch(row._id, { image });
      }
      updated.push(`${title} (${rows.length} row${rows.length === 1 ? "" : "s"})`);
    }
    return { updated, missing };
  },
});
