import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Weekly crawl of Leander event pages (Mondays, 8am CT).
crons.weekly(
  "crawl leander events",
  { dayOfWeek: "monday", hourUTC: 13, minuteUTC: 0 },
  internal.ingestion.crawlLeander,
  {},
);

export default crons;
