import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Bell,

  Building2,
  CalendarSearch,
  Heart,
  MapPin,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_EVENTS, ALL_JOBS, CompanyMark, EventCard, formatPay, inRange, type EventItem, type JobItem } from "./content";
import { useSavedEvents } from "./state";
import { UpliftSearch } from "./upliftSearch";

/* ================================================================
   Concept A — "Bright & Bold" design system.
   Navy #16324f, amber #d98a1f, rust #b5431f on warm cream.
   ================================================================ */

export const NAVY = "#16324f";
const SUNSET = "/brand/hero-old-town-sunset.jpg";

/* ---------------- slim interior-page hero ---------------- */

export function PageHero({
  eyebrow = "Leander, Texas",
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ backgroundColor: NAVY }}
      role="region"
      aria-label={typeof title === "string" ? title : "Page header"}
    >
      <div className="absolute inset-0 opacity-25" aria-hidden="true">
        <img src={SUNSET} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ backgroundColor: NAVY, opacity: 0.6 }} />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-5 md:py-10">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-gold">{eyebrow}</p>
        <h1 className="font-display mt-1.5 text-[28px] font-black leading-[1.08] tracking-tight text-white md:text-[44px]">{title}</h1>
        {subtitle && <div className="mt-2 max-w-2xl text-[15px] text-white/80">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

/* ---------------- homepage hero ---------------- */

export function HomeHero() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <section aria-label="Welcome to Leander Live" className="relative overflow-hidden">
      <img
        src={SUNSET}
        alt="Sunset over a street festival in Old Town Leander"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#16324f]/90 via-[#16324f]/60 to-[#16324f]/30"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 pb-12 pt-9 text-white md:pb-20 md:pt-16">
        <Badge className="bg-gold px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-navy hover:bg-gold">
          <MapPin className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Leander, Texas
        </Badge>
        <h1 className="font-display max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          What&apos;s happening in Leander this week?
        </h1>
        <p className="max-w-xl text-lg text-white/85">
          People <span className="text-gold">•</span> Places{" "}
          <span className="text-gold">•</span> Opportunities — your front porch for
          everything happening in town.
        </p>
        <form
          className="w-full max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(q.trim() ? `/events?q=${encodeURIComponent(q.trim())}` : "/events");
          }}
          role="search"
        >
          <div className="uplift-hero-search">
            <UpliftSearch
              value={q}
              onValueChange={setQ}
              placeholder="Search events, places, or categories…"
              label="Search Leander events"
            />
            <Button
              type="submit"
              className="h-11 shrink-0 rounded-full bg-gold px-6 font-bold text-navy hover:bg-gold/85"
            >
              Search
            </Button>
          </div>
        </form>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
          <span>
            <strong className="font-display text-lg text-white">
              {ALL_EVENTS.length}
            </strong>{" "}
            upcoming events
          </span>
          <span>
            <strong className="font-display text-lg text-white">
              {ALL_JOBS.length}
            </strong>{" "}
            local jobs
          </span>
          <Link to="/events" className="font-semibold text-gold hover:underline">
            Browse everything <ArrowRight className="inline h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Events / Businesses / Jobs trio ---------------- */

const TRIO = [
  {
    icon: "/brand/icon-events.jpg",
    title: "Events",
    blurb: "Festivals, live music, family fun and more.",
    to: "/events",
    chip: "Experience what's happening",
  },
  {
    icon: "/brand/icon-businesses.png",
    title: "Businesses",
    blurb: "Shop local. Dine local. Support Leander.",
    to: "/community",
    chip: "Meet your neighbors",
  },
  {
    icon: "/brand/icon-jobs.png",
    title: "Jobs",
    blurb: "Local opportunities. A stronger community.",
    to: "/jobs",
    chip: "Build your future here",
  },
];

export function IconTrio({ overlap = false }: { overlap?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-5xl gap-5 px-4 sm:grid-cols-3",
        overlap && "-mt-20"
      )}
    >
      {TRIO.map((t) => (
        <Link key={t.title} to={t.to} className="group">
          <Card className="h-full border-border bg-white/95 shadow-lg backdrop-blur transition-transform duration-200 group-hover:-translate-y-1">
            <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
              <img
                src={t.icon}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover shadow sm:h-16 sm:w-16"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#d98a1f]">
                  {t.chip}
                </p>
                <h3 className="font-display text-xl font-bold text-navy">{t.title}</h3>
                <p className="hidden text-sm text-stone-600 sm:block">{t.blurb}</p>
              </div>
              <ArrowRight
                className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/* ---------------- this-weekend spotlight strip ---------------- */

export function WeekendSpotlight() {
  const { saved, toggleSaved } = useSavedEvents();
  const now = useMemo(() => new Date(), []);
  const weekend = useMemo(
    () => ALL_EVENTS.filter((e) => inRange(e.startsAt, "This Weekend", now)),
    [now],
  );

  return (
    <section aria-label="This weekend in Leander" className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Don&apos;t miss it
          </p>
          <h2 className="font-display mt-1 text-3xl font-bold text-navy">
            This weekend in Leander
          </h2>
        </div>
        <Button asChild variant="link" className="h-auto px-0 font-semibold text-primary">
          <Link to="/events">
            All events <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {weekend.length === 0 ? (
        <Card className="border-dashed border-border bg-muted">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CalendarSearch className="h-10 w-10 text-primary" aria-hidden="true" />
            <p className="font-semibold text-foreground">
              Nothing posted for this weekend yet — be the first.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/events">Browse all events</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2"
          role="list"
          aria-label="Weekend events"
        >
          {weekend.map((event) => (
            <div key={event.id} role="listitem" className="w-[86%] max-w-sm shrink-0 snap-start sm:w-[26rem] sm:max-w-none">
              <EventCard
                event={event}
                saved={saved.has(event.id)}
                onToggleSaved={() => toggleSaved(event.id)}
                className="h-full"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- jobs preview ---------------- */

export function JobsPreview() {
  const preview = useMemo(() => {
    const featured = ALL_JOBS.filter((j) => j.featured);
    const rest = ALL_JOBS.filter((j) => !j.featured);
    return [...featured, ...rest].slice(0, 3);
  }, []);

  return (
    <section aria-label="Featured jobs" className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Work local
          </p>
          <h2 className="font-display mt-1 text-3xl font-bold text-navy">
            Jobs in Leander
          </h2>
          <p className="mt-1.5 text-[15px] text-stone-600">
            Local work, right here in town — posted by Leander employers.
          </p>
        </div>
        <Button asChild variant="link" className="h-auto px-0 font-semibold text-primary">
          <Link to="/jobs">
            All jobs <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {preview.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="p-8 text-center text-sm text-stone-600">
            No openings posted yet —{" "}
            <Link to="/jobs" className="font-semibold text-primary underline">
              post the first one
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(22,50,79,0.07)]">
          {preview.map((job: JobItem) => (
            <Link
              key={job.id}
              to="/jobs"
              className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/70 sm:px-4"
              aria-label={`${job.title.trim()} at ${job.company} — view on the jobs board`}
            >
              <CompanyMark name={job.company} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[15px] font-bold leading-snug text-navy">
                  {job.title.trim()}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                  {job.company} · {job.location}
                </span>
                {job.payRange && (
                  <span className="mt-0.5 block text-[13px] font-extrabold text-navy">
                    {formatPay(job.payRange)}
                  </span>
                )}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- how it works ---------------- */

const STEPS = [
  {
    Icon: CalendarSearch,
    title: "Find your thing",
    body: "Every festival, market, concert, and Friday-night light — searchable, filterable, all in one place.",
    tint: "#fbe7e7",
    color: "#c93a3a",
  },
  {
    Icon: Heart,
    title: "Save what you love",
    body: "Tap the heart on any event and it stays saved right here in your browser. Your weekend, planned in seconds.",
    tint: "#ece5fa",
    color: "#7c5cd6",
  },
  {
    Icon: Bell,
    title: "Never miss out",
    body: "Add any event straight to your own calendar with one tap — no sign-up, no spam, just the event file.",
    tint: "#e6f2e3",
    color: "#4c8c4a",
  },
];

export function HowItWorks() {
  return (
    <section aria-label="How Leander Live works" className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14">
      <div className="mb-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
          How it works
        </p>
        <h2 className="font-display mt-1 text-3xl font-bold text-navy">
          Your town, on one board
        </h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {STEPS.map(({ Icon, title, body, tint, color }, i) => (
          <Card key={title} className="border-border">
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex items-center justify-between">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: tint, color }}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="font-display text-4xl font-black text-border">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-navy">{title}</h3>
              <p className="text-sm leading-relaxed text-stone-600">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------- business CTA band (replaces the stale "coming soon" card) ---------------- */

export function BusinessCtaBand() {
  return (
    <section aria-label="For local businesses" className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14">
      <Card className="overflow-hidden border-0 bg-navy text-white">
        <CardContent className="relative flex flex-col items-start gap-4 p-8 sm:p-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            aria-hidden="true"
          >
            <img
              src="/brand/old-town-festival-night.jpg"
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="relative flex flex-col items-start gap-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-gold">
              <Building2 className="h-4 w-4" aria-hidden="true" /> For Leander businesses
            </p>
            <h2 className="font-display max-w-xl text-3xl font-bold leading-tight">
              Put your business in front of the whole town.
            </h2>
            <p className="max-w-xl text-[15px] text-white/80">
              Featured listings, sponsored events, and AI-qualified service leads —
              priced for local businesses, not agencies.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-full bg-gold font-bold text-navy hover:bg-gold/85"
              >
                <Link to="/advertise">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> See packages
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/community">Talk to us</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ---------------- featured events with working filters ---------------- */

const FILTER_CHIPS = ["All", "This weekend", "Music", "Family", "Food & Drink", "Outdoors"] as const;

export function FeaturedEvents({
  title = "Upcoming in Leander",
  subtitle,
  limit = 8,
}: {
  title?: string;
  subtitle?: string;
  limit?: number;
}) {
  const { saved, toggleSaved } = useSavedEvents();
  const [chip, setChip] = useState<(typeof FILTER_CHIPS)[number]>("All");
  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const events = ALL_EVENTS.slice(0, limit);
    if (chip === "All") return events;
    if (chip === "This weekend")
      return events.filter((e: EventItem) => inRange(e.startsAt, "This Weekend", now));
    return events.filter((e: EventItem) => e.category === chip);
  }, [chip, limit, now]);

  return (
    <section aria-label={title} className="mx-auto max-w-6xl px-4 pt-10 sm:pt-16 @container">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold text-navy">{title}</h2>
          {subtitle && <p className="mt-1.5 text-[15px] text-stone-600">{subtitle}</p>}
        </div>
        <Button asChild variant="link" className="h-auto px-0 font-semibold text-primary">
          <Link to="/events">
            View all events <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        role="group"
        aria-label="Filter events"
      >
        {FILTER_CHIPS.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={chip === c ? "default" : "outline"}
            className={cn(
              "shrink-0 rounded-full",
              chip === c
                ? "bg-navy text-white hover:bg-navy/90"
                : "border-border bg-white/70 hover:bg-white"
            )}
            onClick={() => setChip(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="p-8 text-center text-sm text-stone-600">
            Nothing in “{chip}” right now —{" "}
            <button
              className="font-semibold text-primary underline"
              onClick={() => setChip("All")}
            >
              show everything
            </button>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 @min-[40rem]:grid-cols-2 @min-[68rem]:grid-cols-3 pane-split">
          {filtered.map((event: EventItem, i: number) => (
            <EventCard
              key={event.id}
              event={event}
              saved={saved.has(event.id)}
              onToggleSaved={() => toggleSaved(event.id)}
              className={i >= 4 ? "hidden sm:flex" : i >= 3 ? "hidden sm:flex" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- navy call-to-action band ---------------- */

export function NavyCtaBand() {
  return (
    <section className="mt-10 sm:mt-16" style={{ backgroundColor: NAVY }} aria-label="Join the community">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center sm:py-14">
        <p className="font-script text-3xl text-gold">Same town. More together.</p>
        <h2 className="font-display max-w-2xl text-3xl font-bold text-white">
          Leander Live is your community hub — connecting people, places, and opportunities.
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            asChild
            className="rounded-full bg-gold font-semibold text-navy hover:bg-gold/85"
          >
            <Link to="/community">
              Be part of it <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link to="/reminders">Get event reminders</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
