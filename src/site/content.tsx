import { useMemo, useState, type ButtonHTMLAttributes, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trackEvent } from "./analytics";
import { businessDraftKey, businessEmailDraft, centralDateTimeInput, emailDraftText, eventEmailDraft, hasRequiredDraftFields, jobEmailDraft, type EmailDraft } from "./emailDrafts";
import { useDraftCopy } from "./useDraftCopy";
import { UpliftSearch } from "./upliftSearch";
import { ListingStatus, SourceStatusBanner } from "./sourceStatus";
import { downloadEventIcs } from "./ics";
import { eventDateLabel, eventTimeLabel, isStillListed } from "./eventTime";
import type { Business, Job, LiveEvent } from "../data/types";
import eventsRaw from "../data/events.json";
import jobsRaw from "../data/jobs.json";
import businessesRaw from "../data/businesses.json";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowUpRight,
  Bell,
  BookOpen,

  Building2,
  CalendarDays,
  ChevronRight,
  CalendarPlus,
  Clock,
  Heart,
  Leaf,
  Mail,
  MapPin,
  Music,
  Plus,
  Search,
  Send,
  Star,
  TreePine,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- static data (build-time JSON, no backend) ---------------- */

/** The city calendar leaves cancelled listings up with a CANCELLED marker —
    they aren't happening, so they don't belong on the board. */
function isCancelled(e: LiveEvent): boolean {
  return (
    /\bcancelled\b/i.test(e.title) ||
    /^\s*this event has been cancelled/i.test(e.description ?? "")
  );
}

export const ALL_EVENTS: LiveEvent[] = (eventsRaw as LiveEvent[])
  .filter((e) => isStillListed(e, Date.now()))
  .filter((e) => !isCancelled(e) && !e.cancelled)
  .sort((a, b) => a.startsAt - b.startsAt);

export const ALL_JOBS: Job[] = (jobsRaw as Job[]).slice();

/** Business directory (Texas sales-tax permit records, NAICS-gated to
    storefront/service businesses — see scripts/scrape-businesses.mjs).
    Featured placements first, then A–Z. */
export const ALL_BUSINESSES: Business[] = (businessesRaw as Business[])
  .slice()
  .sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name),
  );

export type BusinessItem = Business;

export type EventItem = LiveEvent;
export type JobItem = Job;

const LEAD_EMAIL = "chris@howdycarter.com";

function mailtoFor(subject: string, body: string): string {
  return `mailto:${LEAD_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ---------------- constants ---------------- */

const CATEGORIES = ["Music", "Food & Drink", "Family", "Outdoors", "Learn", "Community"] as const;

const BUSINESS_VERTICALS = [
  "Home Services",
  "Real Estate",
  "Restaurant/Food",
  "Health & Wellness",
  "Events/Venues",
  "Other",
] as const;


const DATE_FILTERS = ["All", "Today", "This Weekend", "This Month"] as const;
export type DateFilter = (typeof DATE_FILTERS)[number];

/* Category badge accents sampled from the approved mockups. */
/* Text colors are darkened shades of the mockup hues — each passes WCAG AA
   (>= 4.5:1) against its soft pill background. */
const CATEGORY_STYLE: Record<string, { label: string; color: string; soft: string; Icon: LucideIcon }> = {
  Music: { label: "Music", color: "#bf3737", soft: "#fbe7e7", Icon: Music },
  "Food & Drink": { label: "Food & Drink", color: "#a15a17", soft: "#fceedb", Icon: UtensilsCrossed },
  Family: { label: "Family", color: "#7053c1", soft: "#ece5fa", Icon: Users },
  Outdoors: { label: "Outdoors", color: "#60712f", soft: "#ebf1da", Icon: TreePine },
  Learn: { label: "Learning", color: "#286cb1", soft: "#e2eefb", Icon: BookOpen },
  Community: { label: "Community", color: "#41773f", soft: "#e6f2e3", Icon: Leaf },
};
const DEFAULT_CATEGORY = { label: "Community", color: "#41773f", soft: "#e6f2e3", Icon: Leaf };

/* Photo shown on an event card: the event's own image, else a category fallback. */
const CATEGORY_IMAGE: Record<string, string> = {
  Music: "/images/event-music-park.jpg",
  "Food & Drink": "/images/event-food-truck.jpg",
  Family: "/images/event-kids-craft.jpg",
  Outdoors: "/images/event-sunrise-yoga.jpg",
  Learn: "/images/event-resume-workshop.jpg",
  Community: "/images/event-night-market.jpg",
};

/* ---------------- helpers ---------------- */

/* All event/meeting times are Leander-local: always render in America/Chicago,
   never the viewer's timezone (a traveler in another zone still sees the
   correct local start time). */
const SITE_TZ = "America/Chicago";

export function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: SITE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", {
    timeZone: SITE_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Sat, Oct 24" — compact card date (no year). */
export function formatShortDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: SITE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "5:00 PM" or "5:00–8:00 PM" when the event ends the same Central day. */
export function formatTimeRange(event: { startsAt: number; endsAt?: number }) {
  const start = formatTime(event.startsAt);
  if (!event.endsAt || event.endsAt <= event.startsAt) return start;
  const sameDay =
    centralParts(new Date(event.startsAt)).day === centralParts(new Date(event.endsAt)).day &&
    centralParts(new Date(event.startsAt)).month === centralParts(new Date(event.endsAt)).month;
  if (!sameDay) return start;
  const end = formatTime(event.endsAt);
  // "5:00 PM" + "8:00 PM" reads better as "5:00–8:00 PM".
  const startShort = start.replace(/ ([AP]M)$/, (m) =>
    end.endsWith(m.trim()) ? "" : m,
  );
  return `${startShort}–${end}`;
}

/** "Today" / "Tomorrow" for near-in events, else null. */
export function relativeDayLabel(startsAt: number, now = new Date()): string | null {
  const a = centralParts(new Date(startsAt));
  const b = centralParts(now);
  const dayMs = 86400000;
  const diff =
    Math.round(
      (centralMidnightMs(a.year, a.month, a.day) -
        centralMidnightMs(b.year, b.month, b.day)) /
        dayMs,
    );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return null;
}

/* The scrapers store some descriptions as entity-encoded HTML
   ("&lt;div style=&quot;…&quot;&gt;…") — governmentjobs postings are the
   worst offenders, and rendering them raw printed markup on the cards.
   Decode + strip to plain text at display time; the schema is unchanged. */
let entityDecoder: HTMLTextAreaElement | null = null;
function decodeEntities(raw: string): string {
  if (typeof document === "undefined") return raw;
  entityDecoder ??= document.createElement("textarea");
  entityDecoder.innerHTML = raw;
  return entityDecoder.value;
}

export function plainText(raw: string | undefined | null): string {
  if (!raw) return "";
  return decodeEntities(raw).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Paragraphs for detail views: block tags become paragraph breaks, and
    over-long blocks are re-chunked at sentence boundaries. */
export function textParagraphs(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const withBreaks = decodeEntities(raw)
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const blocks = withBreaks
    .replace(/<[^>]*>/g, " ")
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    if (block.length <= 420) {
      out.push(block);
      continue;
    }
    const sentences = block.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [block];
    let cur = "";
    for (const s of sentences) {
      if (cur && (cur + s).length > 420) {
        out.push(cur.trim());
        cur = s;
      } else {
        cur += s;
      }
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

/** City-calendar boilerplate ("X — see the City of Leander calendar for
    details.") carries no information — cards hide it instead of truncating it. */
export function isBoilerplateText(text: string | undefined | null): boolean {
  if (!text) return true;
  return /see the .* calendar for details/i.test(text) && plainText(text).length < 140;
}

/** "$57,241.6 - $68,681.6 Annually" → "$57k–$69k/yr"; "$27.52 Hourly" → "$27.52/hr". */
export function formatPay(payRange: string): string {
  const annual = /annual/i.test(payRange);
  const nums = (payRange.match(/[\d,]+(?:\.\d+)?/g) ?? [])
    .map((x) => parseFloat(x.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return payRange.trim();
  const fmt = (n: number) =>
    annual && n >= 1000
      ? `$${Math.round(n / 1000)}k`
      : `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const range =
    nums.length > 1 ? `${fmt(nums[0])}–${fmt(nums[1])}` : fmt(nums[0]);
  return annual ? `${range}/yr` : `${range}/hr`;
}

/** Two-letter employer mark initials ("City of Leander" → "CL"). */
export function companyInitials(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const skip = new Set(["of", "the", "and", "&"]);
  const picked = words.filter((w) => !skip.has(w.toLowerCase()));
  const list = (picked.length > 0 ? picked : words).slice(0, 2);
  return list.map((w) => w[0]!.toUpperCase()).join("");
}

const MARK_PALETTE = [
  { bg: "#e2eefb", fg: "#205d99" },
  { bg: "#fceedb", fg: "#96600f" },
  { bg: "#e6f2e3", fg: "#3c6b39" },
  { bg: "#ece5fa", fg: "#5d43a8" },
  { bg: "#fbe7e7", fg: "#a52f2f" },
];

export function CompanyMark({ name, className }: { name: string; className?: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const palette = MARK_PALETTE[hash % MARK_PALETTE.length];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[13px] font-extrabold tracking-wide",
        className,
      )}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      {companyInitials(name)}
    </span>
  );
}

function startOfDay(d: Date) {
  const p = centralParts(d);
  return new Date(centralMidnightMs(p.year, p.month, p.day));
}
function endOfDay(d: Date) {
  const p = centralParts(d);
  return new Date(centralMidnightMs(p.year, p.month, p.day) + 86400000 - 1);
}

/** Calendar parts of an instant in America/Chicago. */
function centralParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"), // "Sun".."Sat"
  };
}

const WEEKDAY_NUM: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Offset of America/Chicago at an instant, in ms: (wall clock read as UTC) - instant.
 * DST-aware; probing at 00:30 local keeps clear of the 2 AM transitions.
 */
function chicagoOffsetMs(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let hour = get("hour");
  if (hour === 24) hour = 0; // midnight edge in some implementations
  const asUTC = Date.UTC(
    get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"),
  );
  return asUTC - d.getTime();
}

/** Epoch ms of Central midnight starting the given Central calendar day. */
function centralMidnightMs(year: number, month: number, day: number): number {
  const probe = new Date(Date.UTC(year, month - 1, day, 0, 30, 0));
  return Date.UTC(year, month - 1, day) - chicagoOffsetMs(probe);
}

export function inRange(startsAt: number, filter: DateFilter, now: Date): boolean {
  const day = startOfDay(now);
  switch (filter) {
    case "All":
      return true;
    case "Today":
      return startsAt >= day.getTime() && startsAt <= endOfDay(now).getTime();
    case "This Weekend": {
      // The weekend runs Friday through Sunday: on Fri/Sat/Sun it's this
      // week's Friday; Mon–Thu it's the coming Friday. (Previously Sat–Sun
      // only, which hid Friday events and, on Sundays, jumped a week ahead.)
      const p = centralParts(now);
      const dow = WEEKDAY_NUM[p.weekday] ?? 0;
      const offset = dow === 6 ? -1 : dow === 0 ? -2 : (5 - dow + 7) % 7;
      const friMs = centralMidnightMs(p.year, p.month, p.day) + offset * 86400000;
      const sunEnd = friMs + 3 * 86400000 - 1;
      return startsAt >= friMs && startsAt <= sunEnd;
    }
    case "This Month": {
      const p = centralParts(now);
      const lastDay = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
      const end = centralMidnightMs(p.year, p.month, lastDay) + 86400000 - 1;
      return startsAt >= startOfDay(now).getTime() && startsAt <= end;
    }
  }
}

function toggleInList(prev: string[], item: string) {
  return prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item];
}

const PRIVACY_NOTE =
  "We use your info only to follow up on your inquiry — never sold, never shared.";

/* ---------------- event feed ---------------- */

/** Category identity as a small dot + label chip. Used on photo banners
    (detail page) where a white chip reads cleanly; list cards use the
    colored edge + label row inside EventCard instead of a floating pill. */
export function CategoryBadge({ event, className }: { event: EventItem; className?: string }) {
  const style = CATEGORY_STYLE[event.category ?? ""] ?? DEFAULT_CATEGORY;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-navy shadow-sm",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: style.color }}
      />
      {style.label}
    </span>
  );
}

export function SaveButton({
  saved,
  onToggleSaved,
  className,
}: {
  saved: boolean;
  onToggleSaved: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggleSaved}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this event"}
      className={cn(
        "rounded-full [&_svg]:size-5",
        saved ? "text-primary" : "text-foreground/30 hover:text-primary",
        className,
      )}
    >
      <Heart className={cn("h-5 w-5", saved && "fill-current")} />
    </Button>
  );
}

/** Mini date block overlaid on the card photo: "OCT / 24". */
function ThumbDateChip({ startsAt }: { startsAt: number }) {
  const d = new Date(startsAt);
  const month = d
    .toLocaleDateString("en-US", { timeZone: SITE_TZ, month: "short" })
    .toUpperCase();
  const day = d.toLocaleDateString("en-US", { timeZone: SITE_TZ, day: "numeric" });
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-1.5 left-1.5 flex flex-col items-center rounded-md bg-navy/90 px-1.5 py-0.5 leading-none text-white backdrop-blur-sm"
    >
      <span className="text-[9px] font-bold tracking-[0.14em] text-gold">{month}</span>
      <span className="text-[15px] font-extrabold">{day}</span>
    </span>
  );
}

/**
 * Compact event card — one layout at every width (v2).
 *
 * Fixes from Chris's Oct 24 screenshots: the category pill no longer sits
 * beside the title (it starved the title into one-word lines and overlapped
 * it); category is now a colored left edge + a small label row ABOVE the
 * title, the title gets the full text column at a 2-line clamp, and the
 * card is ~110px tall so 3–4 fit a phone viewport.
 */
export function EventCard({
  event,
  saved,
  onToggleSaved,
  className,
}: {
  event: EventItem;
  saved: boolean;
  onToggleSaved: () => void;
  className?: string;
}) {
  const img = event.image ?? CATEGORY_IMAGE[event.category ?? ""] ?? CATEGORY_IMAGE.Community;
  const style = CATEGORY_STYLE[event.category ?? ""] ?? DEFAULT_CATEGORY;
  const detailUrl = `/events/${event.id}`;
  const relative = relativeDayLabel(event.startsAt);
  const featured = isEventFeatured(event);
  const rawBlurb = event.blurb ?? event.description;
  const blurb = rawBlurb && !isBoilerplateText(rawBlurb) ? plainText(rawBlurb) : null;
  return (
    <Card
      className={cn(
        "uplift-event-card group relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(22,50,79,0.07)] transition-shadow hover:shadow-md",
        className,
      )}
    >
      <CardContent className="flex gap-3 p-3 pl-4">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: style.color }}
      />
      <Link
        to={detailUrl}
        className="relative block h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl sm:h-[104px] sm:w-[104px]"
        aria-label={`${event.title} — view details`}
      >
        <img
          src={img}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <ThumbDateChip startsAt={event.startsAt} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: style.color }}
          >
            {style.label}
          </span>
          {relative && (
            <span className="rounded bg-gold/20 px-1.5 py-px text-[11px] font-bold text-[#8a5a12]">
              {relative}
            </span>
          )}
          {featured && (
            <span className="inline-flex items-center gap-1 rounded bg-gold px-1.5 py-px text-[11px] font-bold text-navy">
              <Star className="h-3 w-3 fill-current" aria-hidden="true" /> Sponsored
            </span>
          )}
          <SaveButton
            saved={saved}
            onToggleSaved={onToggleSaved}
            className="-mr-1.5 -mt-1.5 ml-auto h-8 w-8 [&_svg]:size-[18px]"
          />
        </div>
        <h3 className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug text-navy">
          <Link to={detailUrl} className="transition-colors hover:text-primary">
            {event.title.trim()}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-foreground/80">
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          {eventDateLabel(event)} · {eventTimeLabel(event)}
        </p>
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{event.venue}</span>
        </p>
        {blurb && (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{blurb}</p>
        )}
        <ListingStatus item={event} compact />
      </div>
      </CardContent>
    </Card>
  );
}

/* Filter pill built on the genuine UIARC Button primitive: the default (active) /
   outline (inactive) variants carry the color story, with pill overrides
   for the mockup look (rounded-full, auto height, cream-theme borders). */
export function FilterPill({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      className={cn(
        "h-auto cursor-pointer rounded-full border border-transparent px-4 py-2 text-sm font-semibold hover:bg-primary/85",
        !active &&
          "border-border bg-card text-foreground/75 shadow-none hover:border-primary/50 hover:bg-card hover:text-primary",
        className,
      )}
      {...props}
    />
  );
}

export function FeedFilters({
  query,
  setQuery,
  dateFilter,
  setDateFilter,
  category,
  setCategory,
}: {
  query: string;
  setQuery: (v: string) => void;
  dateFilter: DateFilter;
  setDateFilter: (v: DateFilter) => void;
  category: string;
  setCategory: (v: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3">
      <UpliftSearch
        value={query}
        onValueChange={setQuery}
        placeholder="Search events, places, or categories…"
        label="Search events"
      />

      {/* Desktop filter row */}
      <div className="hidden items-center gap-2 md:flex" role="group" aria-label="Filter events">
        {DATE_FILTERS.map((f) => (
          <FilterPill key={f} active={dateFilter === f} onClick={() => setDateFilter(f)}>
            {f}
          </FilterPill>
        ))}
        <Separator orientation="vertical" className="mx-2 h-6" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger
            aria-label="Filter by category"
            className="h-10 w-auto gap-2 rounded-full bg-card px-4 text-sm font-semibold text-foreground/80 shadow-sm"
          >
            <SelectValue>{category === "All" ? "All Categories" : category}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {["All", ...CATEGORIES].map((c) => (
              <SelectItem key={c} value={c}>
                {c === "All" ? "All Categories" : c === "Learn" ? "Learning" : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: one scrolling strip for dates + categories (the header
          already carries Submit — no duplicate full-width button). */}
      <div
        className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:hidden"
        role="group"
        aria-label="Filter events"
      >
        {DATE_FILTERS.map((f) => (
          <FilterPill
            key={f}
            active={dateFilter === f}
            onClick={() => setDateFilter(f)}
            className="shrink-0"
          >
            {f}
          </FilterPill>
        ))}
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
        {["All", ...CATEGORIES].map((c) => (
          <FilterPill
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            className="shrink-0"
          >
            {c === "Learn" ? "Learning" : c}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}

/* ---------------- submit event dialog (mailto — no backend) ---------------- */

export function SubmitDialogContent() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState<string>("");
  const [url, setUrl] = useState("");
  const [when, setWhen] = useState(() => centralDateTimeInput(new Date(Date.now() + 7 * 86400000)));
  const [preparedDraft, setPreparedDraft] = useState<EmailDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const { copyStatus, copyDraft, resetCopy } = useDraftCopy(preparedDraft, LEAD_EMAIL);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hasRequiredDraftFields([title, description, venue, when])) {
      setDraftError("Add an event name, description, date and venue; spaces alone are not enough.");
      return;
    }
    setDraftError("");
    resetCopy();
    setPreparedDraft(eventEmailDraft({ title, description, venue, category, url, when }));
    trackEvent("event_email_draft_prepared", { category: category || "uncategorized" });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Submit an event</DialogTitle>
        <DialogDescription>
          Community submissions are reviewed before they appear on the board.
        </DialogDescription>
      </DialogHeader>
      {preparedDraft ? (
        <div className="flex flex-col items-start gap-4 py-2">
          <Alert>
            <Mail className="h-4 w-4 text-secondary" />
            <AlertDescription>
              Email draft prepared — not sent. Open your email app and send it,
              or copy the draft below. Publication is subject to review.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={mailtoFor(preparedDraft.subject, preparedDraft.body)}>Open email app</a>
            </Button>
            <Button variant="outline" onClick={copyDraft}>Copy draft</Button>
            <Button variant="outline" onClick={() => { resetCopy(); setPreparedDraft(null); }}>
              Edit details
            </Button>
          </div>
          {copyStatus && <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>}
          <div className="grid w-full gap-2">
            <Label htmlFor="ev-draft">Email draft — select to copy manually</Label>
            <Textarea id="ev-draft" readOnly rows={5} value={emailDraftText(preparedDraft, LEAD_EMAIL)} />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ev-title">Event name</Label>
            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Friday Night Market" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required placeholder="What should people expect?" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ev-when">Date &amp; time (Central)</Label>
              <Input id="ev-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-venue">Venue</Label>
              <Input id="ev-venue" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={160} required placeholder="Robin Bledsoe Park" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Category">
                  <SelectValue placeholder="Pick a category…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c === "Learn" ? "Learning" : c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-url">Link (optional)</Label>
              <Input id="ev-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          {draftError && <p role="alert" className="text-xs text-destructive">{draftError}</p>}
          <Button type="submit">
            <Mail className="h-4 w-4" /> Prepare email draft
          </Button>
          <p className="text-xs text-muted-foreground">
            Nothing is sent here. Send the draft from your email app for review,
            and confirm that you own or have permission to share the information.
          </p>
        </form>
      )}
    </DialogContent>
  );
}

/* ---------------- jobs board (static JSON) ---------------- */

const JOB_TYPES = ["full-time", "part-time", "contract", "temporary"] as const;

const JOB_TYPE_LABEL: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  temporary: "Temporary",
};

/* Job-type accent dots — v2 drops the pastel pill badges for a colored
   dot + label, which keeps rows compact and scannable. */
const JOB_TYPE_STYLE: Record<string, { color: string }> = {
  "full-time": { color: "#286cb1" },
  "part-time": { color: "#7053c1" },
  contract: { color: "#a15a17" },
  temporary: { color: "#60712f" },
};

function JobTypeTag({ type, className }: { type: string; className?: string }) {
  const style = JOB_TYPE_STYLE[type] ?? JOB_TYPE_STYLE["full-time"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold", className)}>
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: style.color }}
      />
      {JOB_TYPE_LABEL[type] ?? type}
    </span>
  );
}

function FeaturedJobBadge() {
  return (
    <Badge className="gap-1 rounded-md bg-accent px-2 py-0.5 font-bold text-accent-foreground">
      <Star className="h-3 w-3 fill-current" aria-hidden="true" />
      Featured
    </Badge>
  );
}

/** True while an event's paid featured placement is active. */
export function isEventFeatured(event: { featuredUntil?: number }): boolean {
  return (event.featuredUntil ?? 0) > Date.now();
}

export function FeaturedEventBadge() {
  return (
    <Badge className="gap-1 rounded-full bg-accent px-2.5 py-0.5 text-accent-foreground">
      <Star className="h-3 w-3" aria-hidden="true" />
      Sponsored
    </Badge>
  );
}

/**
 * Dense job row (v2) — replaces the giant near-empty cards: employer
 * initial-mark, title, company · location, then a metadata line with
 * formatted pay, job type, and close date. ~76px tall, so a phone shows
 * 5+ openings at once instead of one.
 *
 * Posted date: jobs.json carries postedAt from both sources (government
 * jobs JSON-LD + AppliTrack) plus firstSeenAt — when the board's scraper
 * first saw the posting. The meta line shows the source's posted date,
 * and the close date when one is set.
 */
export function JobRow({
  job,
  onSelect,
}: {
  job: JobItem;
  onSelect?: () => void;
}) {
  const inner = (
    <>
      <CompanyMark name={job.company} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <span className="line-clamp-2 text-[15px] font-bold leading-snug text-navy">
            {job.title.trim()}
          </span>
          {job.featured && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" aria-label="Featured job" />
          )}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
          {job.company} · {job.location}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-foreground/75">
          {job.payRange && (
            <span className="font-extrabold text-navy">{plainText(job.payRange)}</span>
          )}
          <JobTypeTag type={job.type} />
          {job.postedAt && (
            <span className="text-muted-foreground">
              Posted {formatShortDate(job.postedAt)}
            </span>
          )}
          {job.closesAt && (
            <span className="text-muted-foreground">
              Closes {formatShortDate(job.closesAt)}
            </span>
          )}
        </span>
        <ListingStatus item={job} compact />
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" aria-hidden="true" />
    </>
  );
  const rowClass =
    "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/70 sm:px-4 @min-[42rem]:rounded-2xl @min-[42rem]:border @min-[42rem]:border-border @min-[42rem]:bg-card @min-[42rem]:shadow-[0_1px_2px_rgba(22,50,79,0.07)]";
  if (!onSelect) {
    return <div className={rowClass}>{inner}</div>;
  }
  return (
    <Button asChild variant="ghost" className={cn(rowClass, "h-auto justify-start whitespace-normal rounded-none font-normal hover:text-foreground")}>
      <button type="button" onClick={onSelect} aria-label={`${job.title.trim()} at ${job.company} — view details`}>
        {inner}
      </button>
    </Button>
  );
}

function JobDetailContent({ job }: { job: JobItem }) {
  const paragraphs = textParagraphs(job.description);
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-[22px] font-extrabold leading-tight tracking-tight text-navy">
          {job.title.trim()}
        </DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-1 pt-0.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {job.company}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {job.location}
            </span>
          </div>
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted px-4 py-3 text-sm">
        {job.payRange && (
          <span className="text-base font-extrabold text-navy">{plainText(job.payRange)}</span>
        )}
        <JobTypeTag type={job.type} className="text-foreground/80" />
        {job.postedAt && (
          <span className="text-muted-foreground">Posted {formatDate(job.postedAt)}</span>
        )}
        {job.closesAt && (
          <span className="text-muted-foreground">Closes {formatDate(job.closesAt)}</span>
        )}
        {job.featured && <FeaturedJobBadge />}
      </div>
      <ListingStatus item={job} />
      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
        {paragraphs.slice(0, 20).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <Button asChild className="w-full rounded-full" size="lg">
        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
          Apply now <ArrowUpRight className="h-4 w-4" />
        </a>
      </Button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        You&rsquo;ll apply on the employer&rsquo;s site.
      </p>
    </DialogContent>
  );
}

function PostJobDialogContent() {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("Leander, TX");
  const [type, setType] = useState<string>("full-time");
  const [payRange, setPayRange] = useState("");
  const [description, setDescription] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [preparedDraft, setPreparedDraft] = useState<EmailDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const { copyStatus, copyDraft, resetCopy } = useDraftCopy(preparedDraft, LEAD_EMAIL);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hasRequiredDraftFields([title, company, location, applyUrl, description])) {
      setDraftError("Complete the required job details; spaces alone are not enough.");
      return;
    }
    setDraftError("");
    resetCopy();
    setPreparedDraft(jobEmailDraft({ title, company, location, type: JOB_TYPE_LABEL[type] ?? type, payRange, applyUrl, description }));
    trackEvent("job_email_draft_prepared", { type });
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Post a job</DialogTitle>
        <DialogDescription>
          Job posts are reviewed before they appear on the board.
        </DialogDescription>
      </DialogHeader>
      {preparedDraft ? (
        <div className="flex flex-col items-start gap-4 py-2">
          <Alert>
            <Mail className="h-4 w-4 text-secondary" />
            <AlertDescription>
              Email draft prepared — not sent. Open your email app and send it,
              or copy the draft below. Publication is subject to review.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={mailtoFor(preparedDraft.subject, preparedDraft.body)}>Open email app</a>
            </Button>
            <Button variant="outline" onClick={copyDraft}>Copy draft</Button>
            <Button variant="outline" onClick={() => { resetCopy(); setPreparedDraft(null); }}>
              Edit details
            </Button>
          </div>
          {copyStatus && <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>}
          <div className="grid w-full gap-2">
            <Label htmlFor="job-draft">Email draft — select to copy manually</Label>
            <Textarea id="job-draft" readOnly rows={5} value={emailDraftText(preparedDraft, LEAD_EMAIL)} />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="job-title">Job title</Label>
              <Input
                id="job-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
                placeholder="Line Cook"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-company">Company</Label>
              <Input
                id="job-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={120}
                required
                placeholder="Main Street Diner"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="job-location">Location</Label>
              <Input
                id="job-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={160}
                required
                placeholder="Leander, TX"
              />
            </div>
            <div className="grid gap-2">
              <Label>Job type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger aria-label="Job type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {JOB_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="job-pay">Pay range (optional)</Label>
              <Input
                id="job-pay"
                value={payRange}
                onChange={(e) => setPayRange(e.target.value)}
                maxLength={80}
                placeholder="$16–$19/hr"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-apply">Apply link</Label>
              <Input
                id="job-apply"
                type="url"
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                required
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="job-desc">Description</Label>
            <Textarea
              id="job-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              placeholder="What does the role involve? Any requirements?"
            />
          </div>
          {draftError && <p role="alert" className="text-xs text-destructive">{draftError}</p>}
          <Button type="submit">
            <Mail className="h-4 w-4" /> Prepare email draft
          </Button>
          <p className="text-xs text-muted-foreground">
            Nothing is sent here. Send the draft from your email app for review,
            and confirm that you own or have permission to share the information.
          </p>
        </form>
      )}
    </DialogContent>
  );
}

export function JobsBoard() {
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [postOpen, setPostOpen] = useState(false);
  const [selected, setSelected] = useState<JobItem | null>(null);

  const filtered = useMemo(
    () => ALL_JOBS.filter((j) => typeFilter === "All" || j.type === typeFilter),
    [typeFilter],
  );

  return (
    <div className="@container">
      <SourceStatusBanner kind="jobs" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground/70">
          {filtered.length === 1 ? "1 collected listing" : `${filtered.length} collected listings`}
          {typeFilter !== "All" ? " · filtered" : " in Leander"}
        </p>
        <Button
          onClick={() => setPostOpen(true)}
          size="sm"
          className="shrink-0 rounded-full font-bold"
        >
          <Plus className="h-4 w-4" /> Post a job
        </Button>
      </div>

      <div
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Filter by job type"
      >
        {["All", ...JOB_TYPES].map((t) => (
          <FilterPill
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            className="shrink-0"
          >
            {t === "All" ? "All types" : JOB_TYPE_LABEL[t]}
          </FilterPill>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">No jobs here yet</h3>
            <p className="text-sm text-muted-foreground">
              {typeFilter !== "All"
                ? "Try a different job type — or post the opening yourself."
                : "Be the first to post a local opening."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(22,50,79,0.07)] @min-[42rem]:grid @min-[42rem]:grid-cols-2 @min-[42rem]:gap-3 @min-[42rem]:divide-y-0 @min-[42rem]:overflow-visible @min-[42rem]:rounded-none @min-[42rem]:border-0 @min-[42rem]:bg-transparent @min-[42rem]:shadow-none @min-[64rem]:grid-cols-3">
          {filtered.map((job) => (
            <JobRow key={job.id} job={job} onSelect={() => setSelected(job)} />
          ))}
        </div>
      )}

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <PostJobDialogContent />
      </Dialog>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && <JobDetailContent job={selected} />}
      </Dialog>
    </div>
  );
}

/* ---------------- business directory (static JSON) ---------------- */

/** "Opening soon" = the permit's first-sales date is still ahead.
    "New" = permit issued within the last 90 days. Both derive from the
    permit record itself — no editorializing. */
function businessFreshness(b: BusinessItem, now: number): "opening" | "new" | null {
  if (b.firstSalesAt && b.firstSalesAt > now) return "opening";
  if (b.permitIssuedAt && now - b.permitIssuedAt < 90 * 24 * 3600 * 1000) return "new";
  return null;
}

export function BusinessRow({
  business,
  onSelect,
}: {
  business: BusinessItem;
  onSelect?: () => void;
}) {
  const fresh = businessFreshness(business, Date.now());
  const inner = (
    <>
      <CompanyMark name={business.name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <span className="line-clamp-2 text-[15px] font-bold leading-snug text-navy">
            {business.name}
          </span>
          {business.featured && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" aria-label="Featured business" />
          )}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
          {business.category} · {business.address}
        </span>
        {(fresh || business.featured) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
            {fresh === "opening" && (
              <span className="font-bold text-[#bc4519]">Opening soon</span>
            )}
            {fresh === "new" && <span className="font-bold text-[#60712f]">New in town</span>}
            {business.featured && <FeaturedJobBadge />}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" aria-hidden="true" />
    </>
  );
  const rowClass =
    "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/70 sm:px-4 @min-[42rem]:rounded-2xl @min-[42rem]:border @min-[42rem]:border-border @min-[42rem]:bg-card @min-[42rem]:shadow-[0_1px_2px_rgba(22,50,79,0.07)]";
  if (!onSelect) {
    return <div className={rowClass}>{inner}</div>;
  }
  return (
    <Button asChild variant="ghost" className={cn(rowClass, "h-auto justify-start whitespace-normal rounded-none font-normal hover:text-foreground")}>
      <button type="button" onClick={onSelect} aria-label={`${business.name} — view details`}>
        {inner}
      </button>
    </Button>
  );
}

function BusinessDetailContent({ business }: { business: BusinessItem }) {
  const fresh = businessFreshness(business, Date.now());
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${business.name} ${business.address} Leander TX ${business.zip}`,
  )}`;
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-[22px] font-extrabold leading-tight tracking-tight text-navy">
          {business.name}
        </DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-1 pt-0.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {business.category}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {business.address}, Leander, TX {business.zip}
            </span>
          </div>
        </DialogDescription>
      </DialogHeader>
      {(fresh || business.permitIssuedAt) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted px-4 py-3 text-sm">
          {fresh === "opening" && business.firstSalesAt && (
            <span className="font-bold text-[#bc4519]">
              Opening soon — first sales {formatDate(business.firstSalesAt)}
            </span>
          )}
          {fresh === "new" && <span className="font-bold text-[#60712f]">New in town</span>}
          {business.permitIssuedAt && (
            <span className="text-muted-foreground">
              Permit issued {formatDate(business.permitIssuedAt)}
            </span>
          )}
          {business.featured && <FeaturedJobBadge />}
        </div>
      )}
      <p className="text-sm leading-relaxed text-foreground/90">
        {business.name} is listed in the Texas sales-tax permit records for
        Leander{business.firstSalesAt ? `, with first sales recorded ${formatDate(business.firstSalesAt)}` : ""}.
        A permit shows a business is registered to open — hours and opening
        status can change, so check before you go.
      </p>
      <Button asChild className="w-full rounded-full" size="lg">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          Directions <ArrowUpRight className="h-4 w-4" />
        </a>
      </Button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        Directory data: Texas Comptroller sales-tax permit records. Confirm current details with the business.
      </p>
    </DialogContent>
  );
}

export function BusinessesBoard() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [selected, setSelected] = useState<BusinessItem | null>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of ALL_BUSINESSES) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_BUSINESSES.filter((b) => {
      if (category !== "All" && b.category !== category) return false;
      if (q && !`${b.name} ${b.category} ${b.address}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, category]);

  return (
    <div className="@container">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground/70">
          {filtered.length === 1 ? "1 business" : `${filtered.length} businesses`}
          {category !== "All" || query.trim() ? " · filtered" : " in Leander"}
        </p>
      </div>

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants, salons, repair…"
          className="rounded-full bg-white pl-10"
          aria-label="Search businesses"
        />
      </div>

      <div
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Filter by category"
      >
        {["All", ...categories].map((c) => (
          <FilterPill
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            className="shrink-0"
          >
            {c === "All" ? "All categories" : c}
          </FilterPill>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">No businesses match that</h3>
            <p className="text-sm text-muted-foreground">
              Try a different search or category — the directory covers every
              storefront and service business with an active Leander sales-tax permit.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(22,50,79,0.07)] @min-[42rem]:grid @min-[42rem]:grid-cols-2 @min-[42rem]:gap-3 @min-[42rem]:divide-y-0 @min-[42rem]:overflow-visible @min-[42rem]:rounded-none @min-[42rem]:border-0 @min-[42rem]:bg-transparent @min-[42rem]:shadow-none @min-[64rem]:grid-cols-3">
          {filtered.map((business) => (
            <BusinessRow
              key={business.id}
              business={business}
              onSelect={() => setSelected(business)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && <BusinessDetailContent business={selected} />}
      </Dialog>
    </div>
  );
}

/* ---------------- reminders → add-to-calendar (.ics downloads, no backend) ---------------- */

export function RemindersContent() {
  const upcoming = useMemo(() => ALL_EVENTS.slice(0, 15), []);

  function addToCalendar(event: EventItem) {
    downloadEventIcs(event);
    trackEvent("ics_downloaded", { event_id: event.id });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Never miss what&apos;s happening
        </CardTitle>
        <CardDescription>
          No sign-up needed — download any event straight to your calendar
          (Apple, Google, Outlook — the .ics file works everywhere).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming events right now — check back soon.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {upcoming.map((event) => (
              <li key={event.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{event.title}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {eventDateLabel(event, { withYear: true })} · {eventTimeLabel(event)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => addToCalendar(event)}
                >
                  <CalendarPlus className="h-4 w-4" /> Add to calendar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- lead forms (mailto — no backend) ---------------- */

export function BusinessForm({ packageName }: { packageName?: string }) {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vertical, setVertical] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [preparedDraft, setPreparedDraft] = useState<(EmailDraft & { packageName?: string; inputKey: string }) | null>(null);
  const [draftError, setDraftError] = useState("");
  const [contactError, setContactError] = useState(false);
  const currentDraftKey = businessDraftKey({ businessName, contactName, email, phone, vertical, interests, packageName });
  const activeDraft = preparedDraft?.packageName === packageName && preparedDraft?.inputKey === currentDraftKey ? preparedDraft : null;
  const { copyStatus, copyDraft, resetCopy } = useDraftCopy(activeDraft, LEAD_EMAIL, currentDraftKey);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Keep every field intact: a prepared draft is not a submitted inquiry.
    if (!email.trim() && !phone.trim()) {
      setContactError(true);
      return;
    }
    setContactError(false);
    if (!hasRequiredDraftFields([businessName, contactName, vertical])) {
      setDraftError("Add your business name, contact name and vertical; spaces alone are not enough.");
      return;
    }
    setDraftError("");
    resetCopy();
    setPreparedDraft({ ...businessEmailDraft({ businessName, contactName, email, phone, vertical, interests, packageName }), packageName, inputKey: currentDraftKey });
    trackEvent("business_email_draft_prepared", { vertical, interest_count: interests.length });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-secondary" /> Tell us about your business
        </CardTitle>
        <CardDescription>Prepare an inquiry about proposed placements. Nothing is sent or purchased here.</CardDescription>
      </CardHeader>
      <CardContent>
      {preparedDraft && preparedDraft.packageName === packageName && preparedDraft.inputKey === currentDraftKey ? (
        <div className="flex flex-col items-start gap-4 py-2">
          <Alert>
            <Mail className="h-4 w-4 text-secondary" />
            <AlertDescription>
              Email draft prepared — not sent. Open your email app and send it,
              or copy the draft below. No payment or reservation has been made.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={mailtoFor(preparedDraft.subject, preparedDraft.body)}>Open email app</a>
            </Button>
            <Button variant="outline" onClick={copyDraft}>Copy draft</Button>
            <Button variant="outline" onClick={() => { resetCopy(); setPreparedDraft(null); }}>
              Edit details
            </Button>
          </div>
          {copyStatus && <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>}
          <div className="grid w-full gap-2">
            <Label htmlFor="bz-draft">Email draft — select to copy manually</Label>
            <Textarea id="bz-draft" readOnly rows={5} value={emailDraftText(preparedDraft, LEAD_EMAIL)} />
          </div>
        </div>
      ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bz-name">Business name</Label>
                <Input id="bz-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={160} required placeholder="Main Street Bakery" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bz-contact">Contact name</Label>
                <Input id="bz-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={120} required placeholder="Your name" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bz-email">Email</Label>
                <Input id="bz-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setContactError(false); }} placeholder="you@business.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bz-phone">Phone</Label>
                <Input id="bz-phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setContactError(false); }} placeholder="(512) 555-0123" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">At least one of email or phone is required.</p>
            {contactError && (
              <p role="alert" className="-mt-2 text-xs font-semibold text-destructive">
                Add an email or phone number so we can reach you.
              </p>
            )}
            <div className="grid gap-2">
              <Label>Business vertical</Label>
              <Select value={vertical} onValueChange={setVertical} required>
                <SelectTrigger aria-label="Business vertical">
                  <SelectValue placeholder="Choose a vertical…" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_VERTICALS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>I&apos;m interested in</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {["Featured listing", "Featured job", "Sponsored event"].map((i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox checked={interests.includes(i)} onCheckedChange={() => setInterests((prev) => toggleInList(prev, i))} />
                    {i}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{PRIVACY_NOTE}</p>
            {draftError && <p role="alert" className="text-xs text-destructive">{draftError}</p>}
            <Button type="submit">
              <Mail className="h-4 w-4" /> Prepare email draft
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- about / crosspromo ---------------- */

export function About() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">About Leander</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-[15px] leading-relaxed">
        <p>
          <strong>Lee-AN-der</strong>, Texas was founded in <strong>1882</strong> when the
          Austin and Northwestern Railroad built through — named for railroad official
          Leander &quot;Catfish&quot; Brown. The town grew from the older settlement of Bagdad
          (1854), bypassed by the rail line, and incorporated in 1978.
        </p>
        <p>
          Locals call themselves <strong>&quot;Leanderthals&quot;</strong> — a nod to the Leanderthal
          Lady, a 10,000–13,000-year-old skeleton discovered here in 1982 and one of North
          America&apos;s oldest intact burials.
        </p>
        <p>
          From <strong>59,202</strong> people in 2020 to an estimated <strong>~91,132</strong>{" "}
          in 2025 — the fastest-growing city in America in 2018–2019, now planning for
          250,000 — Leander keeps its Old Town soul while the new town booms around it.
        </p>
        <p>
          Anchor traditions: Old Town Street Festival (first Saturday of June), Liberty Fest
          (July 3 at Devine Lake Park), the Floating Pumpkin Patch, ArtFest, the Devine Lake
          Kite Festival, and the Old Town Christmas Festival.
        </p>
        <Separator />
        <p className="text-sm text-muted-foreground">
          <em>
            Leander Live was designed and built by{" "}
            <a href="https://howdycarter.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
              Howdy Carter
            </a>{" "}
            — one neighbor helping the whole town find its next favorite night out.
          </em>
        </p>
      </CardContent>
    </Card>
  );
}

export function CrossPromoCard() {
  return (
    <Card className="border-dashed border-accent bg-accent/10">
      <CardHeader>
        <CardTitle className="text-lg">Want a website that turns visitors into customers?</CardTitle>
        <CardDescription>
          Leander Live was designed and built by Howdy Carter — product fixes for local
          businesses, shipped fast.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <a href="https://howdycarter.com" target="_blank" rel="noopener noreferrer">
            See how <Send className="h-3.5 w-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
