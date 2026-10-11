export const EVENT_TIME_ZONE = "America/Chicago";
export type DateFilter = "All" | "Today" | "This Weekend" | "This Month";

export function formatDate(ms: number) {
  return new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(ms);
}
export function formatTime(ms: number) {
  return new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(ms);
}
function parts(ms: number) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms);
  const get = (type: string) => Number(p.find(x => x.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
function dayNumber(ms: number) {
  const p = parts(ms);
  return Date.UTC(p.year, p.month - 1, p.day) / 86400000;
}
export function inRange(startsAt: number, filter: DateFilter, now: Date): boolean {
  if (!Number.isFinite(startsAt)) return false;
  if (filter === "All") return true;
  const today = dayNumber(now.getTime());
  const eventDay = dayNumber(startsAt);
  if (filter === "Today") return eventDay === today;
  if (filter === "This Month") {
    const a = parts(startsAt), b = parts(now.getTime());
    return eventDay >= today && a.year === b.year && a.month === b.month;
  }
  // Work with civil calendar days, not 24-hour additions across DST changes.
  const weekday = new Date(today * 86400000).getUTCDay();
  const saturday = today + (weekday === 0 ? -1 : (6 - weekday + 7) % 7);
  return eventDay >= saturday && eventDay <= saturday + 1;
}

export function toLocalInputValue(d: Date) {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: EVENT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return p.replace(" ", "T");
}

/** Reject nonexistent or ambiguous wall-clock times instead of guessing. */
export function parseLeanderTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter a valid Leander date and time.");
  const matches = [-5, -6].map(offset => Date.parse(`${value}${offset === -5 ? "-05:00" : "-06:00"}`))
    .filter(ms => Number.isFinite(ms) && toLocalInputValue(new Date(ms)) === value);
  if (matches.length !== 1) throw new Error("This local time is ambiguous or unavailable during a clock change. Choose another time.");
  return matches[0];
}
