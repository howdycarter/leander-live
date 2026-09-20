import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Check, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCard, type EventItem } from "./content";
import { useSavedEvents } from "./state";

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
    <div className="relative overflow-hidden" style={{ backgroundColor: NAVY }}>
      <div className="absolute inset-0 opacity-25" aria-hidden="true">
        <img src={SUNSET} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ backgroundColor: NAVY, opacity: 0.6 }} />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">{eyebrow}</p>
        <h1 className="font-display mt-2 text-4xl font-black text-white md:text-5xl">{title}</h1>
        {subtitle && <div className="mt-3 max-w-2xl text-white/80">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

/* ---------------- homepage hero ---------------- */

export function HomeHero() {
  return (
    <section aria-label="Welcome to Leander Live" className="relative overflow-hidden">
      <img
        src={SUNSET}
        alt="Sunset over a street festival in Old Town Leander"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#16324f]/85 via-[#16324f]/55 to-[#16324f]/25"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 pb-32 pt-16 text-white md:pt-24">
        <Badge className="bg-amber-400/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#16324f]">
          <MapPin className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Leander, Texas
        </Badge>
        <h1 className="font-display max-w-3xl text-5xl font-black leading-[1.05] md:text-6xl">
          Find events, businesses, and jobs in Leander.
        </h1>
        <p className="max-w-xl text-lg text-white/85">
          People <span className="text-amber-300">•</span> Places{" "}
          <span className="text-amber-300">•</span> Opportunities — your front porch for
          everything happening in town.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-[#d98a1f] px-8 font-bold text-white hover:bg-[#c67a14]"
          >
            <Link to="/events">
              Explore Events <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link to="/jobs">Browse Jobs</Link>
          </Button>
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
    to: "#businesses",
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
          <Card className="h-full border-[#eadbc3] bg-white/95 shadow-lg backdrop-blur transition-transform duration-200 group-hover:-translate-y-1">
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
                <h3 className="font-display text-xl font-bold text-[#16324f]">{t.title}</h3>
                <p className="hidden text-sm text-stone-600 sm:block">{t.blurb}</p>
              </div>
              <ArrowRight
                className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition-colors group-hover:text-[#b5431f]"
                aria-hidden="true"
              />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/* ---------------- business directory teaser ---------------- */

export function BusinessSoon() {
  const [joined, setJoined] = useState(false);
  return (
    <section
      id="businesses"
      aria-label="Local businesses"
      className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-10 sm:pt-16"
    >
      <Card className="border-dashed border-[#d9c9a8] bg-[#fff6ea]">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <img
            src="/brand/icon-businesses.png"
            alt=""
            className="h-14 w-14 rounded-full object-cover shadow"
            loading="lazy"
          />
          <h2 className="font-display text-2xl font-bold text-[#16324f]">
            The Leander business directory is coming soon
          </h2>
          <p className="max-w-lg text-sm text-stone-600">
            We&apos;re building the home for every local shop, restaurant, and service in
            town — starting with the businesses that make Leander, Leander.
          </p>
          {joined ? (
            <Badge className="gap-1.5 bg-emerald-600 px-4 py-2 text-sm text-white">
              <Check className="h-4 w-4" aria-hidden="true" /> You&apos;re on the list — we&apos;ll reach out
            </Badge>
          ) : (
            <Button
              onClick={() => setJoined(true)}
              className="rounded-full bg-[#b5431f] font-semibold text-white hover:bg-[#9c3a1a]"
            >
              Notify me at launch
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ---------------- featured events with working filters ---------------- */

const FILTER_CHIPS = ["All", "This weekend", "Music", "Family", "Food & Drink", "Outdoors"] as const;

function withinDays(startsAt: number, days: number) {
  const now = Date.now();
  return startsAt >= now && startsAt <= now + days * 86400000;
}

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
  const events = useQuery(api.events.listUpcoming, { limit });
  const [chip, setChip] = useState<(typeof FILTER_CHIPS)[number]>("All");

  const filtered = useMemo(() => {
    if (!events) return undefined;
    if (chip === "All") return events;
    if (chip === "This weekend")
      return events.filter((e: EventItem) => withinDays(e.startsAt, 7));
    return events.filter((e: EventItem) => e.category === chip);
  }, [events, chip]);

  return (
    <section aria-label={title} className="mx-auto max-w-6xl px-4 pt-10 sm:pt-16">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold text-[#16324f]">{title}</h2>
          {subtitle && <p className="mt-1.5 text-[15px] text-stone-600">{subtitle}</p>}
        </div>
        <Button asChild variant="link" className="h-auto px-0 font-semibold text-[#b5431f]">
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
                ? "bg-[#16324f] text-white hover:bg-[#16324f]/90"
                : "border-[#d9c9a8] bg-white/70 hover:bg-white"
            )}
            onClick={() => setChip(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      {filtered === undefined ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading events">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-[#d9c9a8]">
          <CardContent className="p-8 text-center text-sm text-stone-600">
            Nothing in “{chip}” right now —{" "}
            <button
              className="font-semibold text-[#b5431f] underline"
              onClick={() => setChip("All")}
            >
              show everything
            </button>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.slice(0, 4).map((event: EventItem, i: number) => (
            <EventCard
              key={event._id}
              event={event}
              saved={saved.has(event._id)}
              onToggleSaved={() => toggleSaved(event._id)}
              className={i >= 3 ? "hidden sm:flex" : undefined}
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
        <p className="font-script text-3xl text-amber-300">Same town. More together.</p>
        <h2 className="font-display max-w-2xl text-3xl font-bold text-white">
          Leander Live is your community hub — connecting people, places, and opportunities.
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            asChild
            className="rounded-full bg-[#d98a1f] font-semibold text-white hover:bg-[#c67a14]"
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
