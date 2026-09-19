import { internalMutation, mutation } from "./_generated/server";

/**
 * Idempotent seed of Leander's anchor annual events.
 * Researched 2026-09-19 (see research_notes/leander-texas-history-20260919-0632).
 * Dates verified against weekday; descriptions grounded in the research notes.
 *
 * Run once after deploy:
 *   npx convex run seed:seedAnchorEvents
 */
export const seedAnchorEvents = mutation({
  // TEMPORARY: public for one-time prod seeding 2026-09-19; revert to internalMutation after.
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("events").take(1);
    if (existing.length > 0) {
      return { seeded: 0, reason: "events table already has rows — skipping" };
    }

    const anchorEvents = [
      {
        title: "ArtFest",
        description:
          "The city's Public Arts and Culture Commission takes over the Lakewood Park Sculpture Trail: live entertainment, food, art contests, and artist booths along the trail.",
        startsAt: Date.UTC(2026, 9, 3, 15, 0), // Sat Oct 3, 2026, 10am CT
        venue: "Lakewood Park Sculpture Trail",
        url: "https://visitleandertx.com/",
        category: "Community" as const,
        image: "/images/event-night-market.jpg",
      },
      {
        title: "Floating Pumpkin Patch",
        description:
          "A uniquely Leander fall tradition: pick your pumpkin straight out of the pool, then decorate it. Hosted by Parks & Recreation.",
        startsAt: Date.UTC(2026, 9, 17, 15, 0), // Sat Oct 17, 2026, 10am CT
        venue: "Robin Bledsoe Park Pool",
        url: "https://visitleandertx.com/",
        category: "Family" as const,
        image: "/images/event-kids-craft.jpg",
      },
      {
        title: "Tricks and Treats Spooktacular",
        description:
          "Trick-or-treating, costumes, and family fun hosted by Leander Parks & Recreation and the Leander Police Department.",
        startsAt: Date.UTC(2026, 9, 24, 22, 0), // Sat Oct 24, 2026, 5pm CT
        venue: "Devine Lake Park",
        url: "https://visitleandertx.com/",
        category: "Family" as const,
        image: "/images/event-movie-night.jpg",
      },
      {
        title: "Veterans Day Ceremony",
        description:
          "The city's annual ceremony honoring veterans at Veterans Park.",
        startsAt: Date.UTC(2026, 10, 11, 17, 0), // Wed Nov 11, 2026, 11am CT
        venue: "Veterans Park",
        url: "https://www.leandertx.gov/",
        category: "Community" as const,
        image: "/images/event-farmers-market.jpg",
      },
      {
        title: "Old Town Christmas Festival",
        description:
          "First Saturday of December in Historic Old Town: parade, 40-foot tree lighting, Rudolph Run 5K, pictures with Santa, holiday hayrides, yule fire, and choral performances.",
        startsAt: Date.UTC(2026, 11, 5, 16, 0), // Sat Dec 5, 2026, 10am CT
        venue: "Historic Old Town Leander",
        url: "https://visitleandertx.com/",
        category: "Community" as const,
        image: "/images/event-night-market.jpg",
      },
      {
        title: "Devine Lake Kite Festival",
        description:
          "Early-spring family day at the lake: competitive kite events, workshops, kite-making, games, and food trucks.",
        startsAt: Date.UTC(2027, 4, 1, 15, 0), // Sat May 1, 2027, 10am CT
        venue: "Devine Lake Park",
        url: "https://visitleandertx.com/",
        category: "Outdoors" as const,
        image: "/images/event-sunrise-yoga.jpg",
      },
      {
        title: "Old Town Street Festival",
        description:
          "Leander's signature community celebration, first Saturday of June: 5K run, artisan and local vendors, Texas bands and live music, wine & beer tent, and family activities.",
        startsAt: Date.UTC(2027, 5, 5, 14, 0), // Sat Jun 5, 2027, 9am CT
        venue: "Historic Old Town Leander",
        url: "https://visitleandertx.com/",
        category: "Community" as const,
        image: "/images/event-music-park.jpg",
      },
      {
        title: "Liberty Fest",
        description:
          "The city's free Fourth of July celebration: live music, food trucks, children's attractions, a drone show, and fireworks over the lake. One of Leander's largest annual events.",
        startsAt: Date.UTC(2027, 6, 3, 23, 0), // Sat Jul 3, 2027, 6pm CT
        venue: "Devine Lake Park",
        url: "https://visitleandertx.com/",
        category: "Community" as const,
        image: "/images/event-food-truck.jpg",
      },
    ];

    for (const e of anchorEvents) {
      await ctx.db.insert("events", {
        ...e,
        source: "crawl",
        status: "approved",
      });
    }
    return { seeded: anchorEvents.length };
  },
});
