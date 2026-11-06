import type { Business, LiveEvent } from "../data/types.ts";
import { eventDateLabel, eventTimeLabel, overlapsDateFilter } from "./eventTime.ts";

export const LEANDER_ZIPS = ["78641", "78645", "78646"] as const;
export const FALLBACK_CARD_IMAGE = "/brand/old-town-festival-night.jpg";

export interface WeekendCardEvent {
  id: string;
  title: string;
  venue: string;
  when: string;
  href: string;
  image?: string;
}

export interface WeekendRoundup {
  kind: "weekend-roundup";
  title: string;
  weekStart: string;
  sharePath: "/weekend";
  image: string;
  text: string;
  events: WeekendCardEvent[];
}

export interface NearYouItem {
  id: string;
  name: string;
  category: string;
  address: string;
  zip: string;
  permitIssuedAt: number;
}

export interface NewNearYouDigest {
  kind: "new-near-you";
  title: string;
  sharePath: "/new-near-you";
  text: string;
  items: NearYouItem[];
  zips: readonly string[];
}

export interface DecisionAlertSummary {
  status: string;
  body: string;
  bullets?: string[];
}

function centralYmd(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function fridayOfWeekend(now: number): string {
  const today = centralYmd(now);
  const dow = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const offset = dow === 6 ? -1 : dow === 0 ? -2 : (5 - dow + 7) % 7;
  const friday = new Date(Date.UTC(today.year, today.month - 1, today.day + offset, 12));
  const y = friday.getUTCFullYear();
  const m = String(friday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(friday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function eventLine(event: LiveEvent): string {
  return `${eventDateLabel(event)} · ${eventTimeLabel(event)} · ${event.title} (${event.venue})`;
}

export function weekendRoundup(
  events: readonly LiveEvent[],
  now: number,
  opts: { limit?: number } = {},
): WeekendRoundup {
  const limit = opts.limit ?? 8;
  const picked = (Array.isArray(events) ? events : [])
    .filter((event) => overlapsDateFilter(event, "This Weekend", now))
    .slice()
    .sort((a, b) => {
      const aPin = (a.featuredUntil ?? 0) > now ? 1 : 0;
      const bPin = (b.featuredUntil ?? 0) > now ? 1 : 0;
      return bPin - aPin || a.startsAt - b.startsAt;
    })
    .slice(0, limit);
  const weekStart = fridayOfWeekend(now);
  const image = picked.find((event) => event.image)?.image ?? FALLBACK_CARD_IMAGE;
  const lines = picked.map(eventLine);
  const text = [
    "This weekend in Leander",
    weekStart,
    ...lines,
    picked.length === 0 ? "Nothing posted for this weekend yet." : "https://leanderlive.com/weekend",
  ].join("\n");
  return {
    kind: "weekend-roundup",
    title: "This weekend in Leander",
    weekStart,
    sharePath: "/weekend",
    image,
    text,
    events: picked.map((event) => ({
      id: event.id,
      title: event.title,
      venue: event.venue,
      when: `${eventDateLabel(event)} · ${eventTimeLabel(event)}`,
      href: `/events/${event.id}`,
      image: event.image,
    })),
  };
}

export function newNearYou(
  businesses: readonly Business[],
  now: number,
  opts: { days?: number; zips?: readonly string[]; limit?: number } = {},
): NewNearYouDigest {
  const days = opts.days ?? 14;
  const zips = opts.zips ?? LEANDER_ZIPS;
  const limit = opts.limit ?? 12;
  const zipSet = new Set(zips);
  const cutoff = now - days * 86_400_000;
  const items = (Array.isArray(businesses) ? businesses : [])
    .filter(
      (biz) =>
        zipSet.has(biz.zip) &&
        typeof biz.permitIssuedAt === "number" &&
        biz.permitIssuedAt >= cutoff,
    )
    .slice()
    .sort((a, b) => (b.permitIssuedAt ?? 0) - (a.permitIssuedAt ?? 0))
    .slice(0, limit)
    .map((biz) => ({
      id: biz.id,
      name: biz.name,
      category: biz.category,
      address: biz.address,
      zip: biz.zip,
      permitIssuedAt: biz.permitIssuedAt ?? 0,
    }));
  const text = [
    "New near you — Leander openings",
    items.length === 0
      ? "No new storefront permits in Leander ZIPs in this window."
      : items.map((item) => `${item.name} · ${item.category} · ${item.address} ${item.zip}`).join("\n"),
    "https://leanderlive.com/new-near-you",
  ].join("\n");
  return {
    kind: "new-near-you",
    title: "New on your street",
    sharePath: "/new-near-you",
    text,
    items,
    zips,
  };
}

export function decisionAlertText(
  summaries: readonly DecisionAlertSummary[],
): string | null {
  const published = (Array.isArray(summaries) ? summaries : []).filter(
    (s): s is DecisionAlertSummary & { bullets: string[] } =>
      s.status === "published" && Array.isArray(s.bullets) && s.bullets.length === 5,
  );
  if (published.length === 0) return null;
  return published
    .map((s) => [`${s.body} decided:`, ...s.bullets.map((b) => `• ${b}`)].join("\n"))
    .join("\n\n");
}
