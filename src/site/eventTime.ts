/**
 * Date and time labels for events (CHR-2011).
 *
 * All labels are in Leander time (America/Chicago), whatever the viewer's
 * own time zone is.
 *
 * All-day events use their explicit calendar dates (`startDate` and
 * `endDateExclusive`, as YYYY-MM-DD) and never show a clock time. The end date
 * is exclusive, as in iCalendar: an event with endDateExclusive "2026-11-03"
 * runs through Nov 2.
 *
 * This file has no React or browser dependencies, so it can be unit tested
 * with node --test.
 */

const SITE_TZ = "America/Chicago";
const DAY_MS = 86_400_000;

export interface EventTiming {
  startsAt: number;
  endsAt?: number;
  allDay?: boolean;
  startDate?: string | null;
  endDateExclusive?: string | null;
}

interface YMD {
  year: number;
  month: number;
  day: number;
}

function parseYmd(value: string | null | undefined): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const ymd = { year: +m[1], month: +m[2], day: +m[3] };
  const check = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  if (check.getUTCMonth() !== ymd.month - 1 || check.getUTCDate() !== ymd.day) return null;
  return ymd;
}

/** The Central calendar date of an instant. */
function centralYmd(ms: number): YMD {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TZ, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function addDays(d: YMD, n: number): YMD {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day) + n * DAY_MS);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

function sameYmd(a: YMD, b: YMD): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Format a calendar date. Uses UTC noon, so no time zone can shift the day. */
function formatYmd(d: YMD, withYear: boolean): string {
  return new Date(Date.UTC(d.year, d.month - 1, d.day, 12)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/**
 * The first and last calendar day of an all-day event, or null for timed events.
 * Uses the explicit date fields. If they're missing, it falls back to the Central
 * dates of startsAt and endsAt, still treating the end as exclusive.
 */
export function allDaySpan(event: EventTiming): { first: YMD; last: YMD } | null {
  if (!event.allDay) return null;
  const first = parseYmd(event.startDate) ?? centralYmd(event.startsAt);
  const endExclusive =
    parseYmd(event.endDateExclusive) ??
    (event.endsAt && event.endsAt > event.startsAt ? centralYmd(event.endsAt) : addDays(first, 1));
  let last = addDays(endExclusive, -1);
  const lastMs = Date.UTC(last.year, last.month - 1, last.day);
  if (lastMs < Date.UTC(first.year, first.month - 1, first.day)) last = first;
  return { first, last };
}

/**
 * The date part of an event label.
 * "Mon, Nov 2" for one day, or "Mon, Nov 23 – Fri, Nov 27" for a multi-day all-day event.
 */
export function eventDateLabel(event: EventTiming, opts: { withYear?: boolean } = {}): string {
  const withYear = opts.withYear ?? false;
  const span = allDaySpan(event);
  if (!span) return formatYmd(centralYmd(event.startsAt), withYear);
  if (sameYmd(span.first, span.last)) return formatYmd(span.first, withYear);
  return `${formatYmd(span.first, withYear)} – ${formatYmd(span.last, withYear)}`;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    timeZone: SITE_TZ, hour: "numeric", minute: "2-digit",
  });
}

/**
 * The time part of an event label.
 * "All day" for all-day events, otherwise "5:00 PM" or "5:00–8:00 PM" in Central time.
 */
export function eventTimeLabel(event: EventTiming): string {
  if (event.allDay) return "All day";
  const start = formatClock(event.startsAt);
  if (!event.endsAt || event.endsAt <= event.startsAt) return start;
  if (!sameYmd(centralYmd(event.startsAt), centralYmd(event.endsAt))) return start;
  const end = formatClock(event.endsAt);
  const startShort = start.replace(/ ([AP]M)$/, (m) => (end.endsWith(m.trim()) ? "" : m));
  return `${startShort}–${end}`;
}

/**
 * True while an event is still worth listing.
 * All-day events stay listed through their last day.
 * Timed events follow the site's existing rule: listed until 24 hours after the start.
 */
export function isStillListed(event: EventTiming, now: number): boolean {
  const span = allDaySpan(event);
  if (span) {
    const today = centralYmd(now);
    const lastMs = Date.UTC(span.last.year, span.last.month - 1, span.last.day);
    return lastMs >= Date.UTC(today.year, today.month - 1, today.day);
  }
  return event.startsAt >= now - DAY_MS;
}

/** iCalendar DATE value (YYYYMMDD) for the all-day .ics download. */
export function icsAllDayDates(event: EventTiming): { start: string; endExclusive: string } | null {
  const span = allDaySpan(event);
  if (!span) return null;
  const fmt = (d: YMD) => `${d.year}${String(d.month).padStart(2, "0")}${String(d.day).padStart(2, "0")}`;
  return { start: fmt(span.first), endExclusive: fmt(addDays(span.last, 1)) };
}

/** schema.org dates for an all-day event: the first and last day (inclusive), YYYY-MM-DD. */
export function allDayIsoDates(event: EventTiming): { start: string; end: string } | null {
  const span = allDaySpan(event);
  if (!span) return null;
  const fmt = (d: YMD) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  return { start: fmt(span.first), end: fmt(span.last) };
}
