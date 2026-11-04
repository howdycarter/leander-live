/**
 * Firecrawl extract parsing for Leander Live (CHR-1473).
 *
 * Pure helpers: no Convex runtime, no live HTTP unless a caller supplies
 * fetchImpl. Tests always inject a mock fetch so this module never scrapes
 * visitleandertx.com, leandertx.gov, or any other live site.
 */

export const VALID_CATEGORIES = [
  "Music",
  "Food & Drink",
  "Family",
  "Outdoors",
  "Learn",
  "Community",
] as const;

export type ParsedCategory = (typeof VALID_CATEGORIES)[number];

/** Pages the scheduled action may extract from when FIRECRAWL_API_KEY is set. */
export const TARGETS = [
  "https://visitleandertx.com/",
  "https://www.leandertx.gov",
] as const;

export const EXTRACT_SCHEMA = {
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
          startsAt: {
            description: "Unix ms or an ISO / city-calendar datetime string",
          },
          venue: { type: "string" },
          url: { type: "string" },
          category: {
            type: "string",
            description:
              "One of: Music, Food & Drink, Family, Outdoors, Learn, or Community",
          },
        },
        required: ["title"],
      },
    },
  },
  required: ["events"],
} as const;

export const EXTRACT_PROMPT =
  "List upcoming public events in Leander, Texas. For each event give: title, a 1-2 sentence description, the date and time, the venue name, the page URL, and a category (Music, Food & Drink, Family, Outdoors, Learn, or Community). Only include events happening in the future — ignore navigation, ads, sponsors, and past events.";

export interface ExtractedEvent {
  title?: string;
  description?: string;
  date?: string;
  startsAt?: string | number;
  venue?: string;
  url?: string;
  category?: string;
}

export interface CrawledUpsert {
  title: string;
  description: string;
  startsAt: number;
  venue: string;
  category?: ParsedCategory;
  url?: string;
}

export function toCategory(value: unknown): ParsedCategory | undefined {
  return typeof value === "string" &&
    (VALID_CATEGORIES as readonly string[]).includes(value)
    ? (value as ParsedCategory)
    : undefined;
}

export function coerceEvents(data: unknown): ExtractedEvent[] {
  if (Array.isArray(data)) return data as ExtractedEvent[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { events?: unknown }).events)
  ) {
    return (data as { events: ExtractedEvent[] }).events;
  }
  return [];
}

export function parseStartsAt(
  event: ExtractedEvent,
  now = Date.now(),
): number | null {
  const raw = event.startsAt ?? event.date;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < now - 24 * 60 * 60 * 1000 ? null : raw;
  }
  if (typeof raw !== "string" || !raw.trim()) return null;
  const startsAt = new Date(raw.trim()).getTime();
  if (Number.isNaN(startsAt) || startsAt < now - 24 * 60 * 60 * 1000) {
    return null;
  }
  return startsAt;
}

/** Map one extracted listing to the upsert payload, or null if unusable. */
export function toCrawledUpsert(
  event: ExtractedEvent,
  now = Date.now(),
): CrawledUpsert | null {
  const title = (event.title ?? "").trim();
  if (!title) return null;
  const startsAt = parseStartsAt(event, now);
  if (startsAt == null) return null;
  const url = (event.url ?? "").trim();
  return {
    title,
    description: (event.description ?? "").trim() || title,
    startsAt,
    venue: (event.venue ?? "").trim() || "Leander, TX",
    category: toCategory(event.category),
    url: url || undefined,
  };
}

export function toCrawledUpserts(
  events: readonly ExtractedEvent[],
  now = Date.now(),
): CrawledUpsert[] {
  const out: CrawledUpsert[] = [];
  for (const event of events) {
    const row = toCrawledUpsert(event, now);
    if (row) out.push(row);
  }
  return out;
}

export interface ExtractJob {
  id?: string;
  data?: unknown;
  status?: string;
  error?: string;
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

/**
 * Start (and if needed poll) a Firecrawl v2 extract job.
 * Callers must pass fetchImpl in tests. The scheduled action uses global fetch
 * only when FIRECRAWL_API_KEY is present; this PR never invokes that path.
 */
export async function runExtract(
  apiKey: string,
  url: string,
  fetchImpl: FetchLike,
  opts: { pollMs?: number; attempts?: number } = {},
): Promise<ExtractedEvent[]> {
  const startRes = await fetchImpl("https://api.firecrawl.dev/v2/extract", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      urls: [url],
      prompt: EXTRACT_PROMPT,
      schema: EXTRACT_SCHEMA,
    }),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`extract start failed (${startRes.status}): ${text}`);
  }
  const started = (await startRes.json()) as ExtractJob;
  if (started.data) return coerceEvents(started.data);
  const jobId = started.id;
  if (!jobId) throw new Error("extract returned no job id and no data");

  const attempts = opts.attempts ?? 12;
  const pollMs = opts.pollMs ?? 5000;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (pollMs > 0) await new Promise((r) => setTimeout(r, pollMs));
    const pollRes = await fetchImpl(
      `https://api.firecrawl.dev/v2/extract/${jobId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!pollRes.ok) continue;
    const job = (await pollRes.json()) as ExtractJob;
    if (job.status === "completed") return coerceEvents(job.data);
    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(`extract job ${job.status}: ${job.error ?? jobId}`);
    }
  }
  throw new Error(`extract job ${jobId} did not complete in time`);
}
