import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Bell,
  Check,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCard, type EventItem } from "./content";
import { useSavedEvents } from "./state";

/* ================================================================
   Shared building blocks for the three homepage concepts.
   These live outside the main site chrome so each concept can
   own its full look. Preview-only: not linked from the live nav.
   ================================================================ */

const NAVY = "#16324f";
const SUNSET = "/brand/hero-old-town-sunset.jpg";
const FIREWORKS = "/images/real/hero-concert-real.jpg";

function ConceptBar({ active }: { active: "A" | "B" | "C" }) {
  const tabs = [
    { id: "A", label: "Concept A · Bright & Bold" },
    { id: "B", label: "Concept B · Search-first" },
    { id: "C", label: "Concept C · Hybrid ★" },
  ] as const;
  return (
    <div
      className="sticky top-0 z-50 border-b border-white/10 text-white"
      style={{ backgroundColor: NAVY }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <span className="font-semibold text-amber-300">Preview only — not the live site</span>
        <nav className="flex items-center gap-1" aria-label="Concepts">
          {tabs.map((t) => (
            <Link
              key={t.id}
              to={`/design/${t.id.toLowerCase()}`}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition-colors",
                active === t.id
                  ? "bg-white text-[#16324f]"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <Link to="/" className="ml-auto font-medium text-white/80 hover:text-white hover:underline">
          ← Back to live site
        </Link>
      </div>
    </div>
  );
}

function HeroSearch({ dark = false }: { dark?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      className={cn(
        "flex w-full max-w-2xl items-center gap-2 rounded-full p-2 pl-5 shadow-xl",
        dark ? "bg-white" : "bg-white/95"
      )}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q.trim() ? `/events?q=${encodeURIComponent(q.trim())}` : "/events");
      }}
    >
      <Search className="h-5 w-5 shrink-0 text-stone-400" aria-hidden="true" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search events, businesses, jobs, or keywords…"
        className="border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
        aria-label="Search Leander Live"
      />
      <Button type="submit" className="shrink-0 rounded-full bg-[#d98a1f] px-8 font-semibold text-white hover:bg-[#c67a14]">
        Search
      </Button>
    </form>
  );
}

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

function IconTrio({ overlap = false }: { overlap?: boolean }) {
  return (
    <div className={cn("mx-auto grid max-w-5xl gap-5 px-4 sm:grid-cols-3", overlap && "-mt-20")}>
      {TRIO.map((t) => (
        <Link key={t.title} to={t.to} className="group">
          <Card className="h-full border-[#eadbc3] bg-white/95 shadow-lg backdrop-blur transition-transform duration-200 group-hover:-translate-y-1">
            <CardContent className="flex items-center gap-4 p-5">
              <img
                src={t.icon}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full object-cover shadow"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#d98a1f]">{t.chip}</p>
                <h3 className="font-display text-xl font-bold text-[#16324f]">{t.title}</h3>
                <p className="text-sm text-stone-600">{t.blurb}</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition-colors group-hover:text-[#b5431f]" aria-hidden="true" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function BusinessSoon({ dark = false }: { dark?: boolean }) {
  const [joined, setJoined] = useState(false);
  return (
    <section id="businesses" aria-label="Local businesses" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-16">
      <Card className={cn("overflow-hidden border-dashed", dark ? "border-white/30 bg-white/5" : "border-[#d9c9a8] bg-[#fff6ea]")}>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <img src="/brand/icon-businesses.png" alt="" className="h-14 w-14 rounded-full object-cover shadow" loading="lazy" />
          <h2 className={cn("font-display text-2xl font-bold", dark ? "text-white" : "text-[#16324f]")}>
            The Leander business directory is coming soon
          </h2>
          <p className={cn("max-w-lg text-sm", dark ? "text-white/70" : "text-stone-600")}>
            We're building the home for every local shop, restaurant, and service in town —
            starting with the businesses that make Leander, Leander.
          </p>
          {joined ? (
            <Badge className="gap-1.5 bg-emerald-600 px-4 py-2 text-sm text-white">
              <Check className="h-4 w-4" aria-hidden="true" /> You're on the list — we'll reach out
            </Badge>
          ) : (
            <Button onClick={() => setJoined(true)} className="rounded-full bg-[#b5431f] font-semibold text-white hover:bg-[#9c3a1a]">
              Notify me at launch
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

const FILTER_CHIPS = ["All", "This weekend", "Music", "Family", "Food & Drink", "Outdoors"] as const;

function withinDays(startsAt: number, days: number) {
  const now = Date.now();
  return startsAt >= now && startsAt <= now + days * 86400000;
}

function FeaturedEvents({
  title = "Upcoming in Leander",
  subtitle,
  chips = true,
  limit = 8,
  dark = false,
}: {
  title?: string;
  subtitle?: string;
  chips?: boolean;
  limit?: number;
  dark?: boolean;
}) {
  const { saved, toggleSaved } = useSavedEvents();
  const events = useQuery(api.events.listUpcoming, { limit });
  const [chip, setChip] = useState<(typeof FILTER_CHIPS)[number]>("All");

  const filtered = useMemo(() => {
    if (!events) return undefined;
    if (chip === "All") return events;
    if (chip === "This weekend") return events.filter((e: EventItem) => withinDays(e.startsAt, 7));
    return events.filter((e: EventItem) => e.category === chip);
  }, [events, chip]);

  return (
    <section aria-label={title} className="mx-auto max-w-6xl px-4 pt-16">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cn("font-display text-3xl font-bold", dark ? "text-white" : "text-[#16324f]")}>{title}</h2>
          {subtitle && <p className={cn("mt-1 text-sm", dark ? "text-white/70" : "text-stone-600")}>{subtitle}</p>}
        </div>
        <Button asChild variant="link" className="h-auto px-0 font-semibold text-[#b5431f]">
          <Link to="/events">
            View all events <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {chips && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter events">
          {FILTER_CHIPS.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={chip === c ? "default" : "outline"}
              className={cn(
                "rounded-full",
                chip === c
                  ? "bg-[#16324f] text-white hover:bg-[#16324f]/90"
                  : dark
                    ? "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    : "border-[#d9c9a8] bg-white/70 hover:bg-white"
              )}
              onClick={() => setChip(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}

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
        <Card className={cn("border-dashed", dark ? "border-white/20 bg-white/5" : "border-[#d9c9a8]")}>
          <CardContent className={cn("p-8 text-center text-sm", dark ? "text-white/70" : "text-stone-600")}>
            Nothing in “{chip}” right now —{" "}
            <button className="font-semibold text-[#b5431f] underline" onClick={() => setChip("All")}>
              show everything
            </button>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.slice(0, 4).map((event: EventItem) => (
            <EventCard
              key={event._id}
              event={event}
              saved={saved.has(event._id)}
              onToggleSaved={() => toggleSaved(event._id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NavyCtaBand() {
  return (
    <section className="mt-16" style={{ backgroundColor: NAVY }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-14 text-center">
        <p className="font-script text-3xl text-amber-300">Same town. More together.</p>
        <h2 className="font-display max-w-2xl text-3xl font-bold text-white">
          Leander Live is your community hub — connecting people, places, and opportunities.
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="rounded-full bg-[#d98a1f] font-semibold text-white hover:bg-[#c67a14]">
            <Link to="/community">
              Be part of it <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link to="/about">What is Leander Live?</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ConceptFooter() {
  return (
    <footer className="border-t border-[#eadbc3] bg-[#fff6ea]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-stone-500 sm:flex-row">
        <p className="flex items-center gap-2">
          <img src="/brand/logo-mark.png" alt="" className="h-6 w-6 rounded-full" />
          © 2026 Leander Live · Built for the Leander community.
        </p>
        <Link to="/" className="font-semibold text-[#b5431f] hover:underline">
          ← Back to the live site
        </Link>
      </div>
    </footer>
  );
}

/* ================================================================
   CONCEPT A — "Bright & Bold"  (from mockup 1)
   Big marketing hero, icon trio overlapping, navy CTA band.
   ================================================================ */

export function VariantA() {
  return (
    <div className="min-h-screen bg-cream font-sans text-[#2e2620]">
      <ConceptBar active="A" />
      <section className="relative overflow-hidden">
        <img src={SUNSET} alt="Sunset over Old Town Leander" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#16324f]/85 via-[#16324f]/55 to-[#16324f]/25" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 pb-32 pt-20 text-white md:pt-28">
          <Badge className="bg-amber-400/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#16324f]">
            <MapPin className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Leander, Texas
          </Badge>
          <h1 className="font-display max-w-3xl text-5xl font-black leading-[1.05] md:text-6xl">
            Find events, businesses, and jobs in Leander.
          </h1>
          <p className="max-w-xl text-lg text-white/85">
            People <span className="text-amber-300">•</span> Places <span className="text-amber-300">•</span> Opportunities —
            your front porch for everything happening in town.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full bg-[#d98a1f] px-8 font-bold text-white hover:bg-[#c67a14]">
              <Link to="/events">Explore Events <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link to="/jobs">Browse Jobs</Link>
            </Button>
          </div>
        </div>
      </section>

      <IconTrio overlap />

      <FeaturedEvents title="Upcoming in Leander" subtitle="Festivals, markets, live music, and Friday-night lights." />

      <BusinessSoon />

      <NavyCtaBand />
      <ConceptFooter />
    </div>
  );
}

/* ================================================================
   CONCEPT B — "Search-first"  (from mockup 2)
   "Same Town. More Together." hero, giant search, sidebar layout.
   ================================================================ */

export function VariantB() {
  return (
    <div className="min-h-screen bg-cream font-sans text-[#2e2620]">
      <ConceptBar active="B" />
      <section className="relative overflow-hidden">
        <img src={SUNSET} alt="Golden hour on a Leander street festival" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#16324f]/70 via-[#16324f]/45 to-[#16324f]/70" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pb-24 pt-20 text-center text-white md:pt-28">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">Leander, Texas</p>
          <h1 className="font-display text-5xl font-black leading-[1.05] md:text-7xl">
            Same Town.<br />More Together.
          </h1>
          <p className="max-w-xl text-lg text-white/85">
            Your go-to spot for events, local businesses, jobs, and everything happening in Leander.
          </p>
          <HeroSearch dark />
          <div className="flex flex-wrap justify-center gap-2" aria-label="Quick filters">
            {["Events this weekend", "Family friendly", "Hiring now", "Outdoor", "Live music"].map((c) => (
              <Link
                key={c}
                to="/events"
                className="rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-12">
        <div className="grid gap-5 sm:grid-cols-3">
          {TRIO.map((t) => (
            <Link key={t.title} to={t.to} className="group">
              <Card className="h-full border-[#eadbc3] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
                <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                  <img src={t.icon} alt="" className="h-20 w-20 rounded-full object-cover shadow-md" loading="lazy" />
                  <h3 className="font-display text-xl font-bold text-[#16324f]">{t.title}</h3>
                  <p className="text-sm text-stone-600">{t.blurb}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#b5431f]">
                    Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FeaturedEvents title="Featured Events" subtitle="Hand-picked happenings around town." />
          </div>
          <aside className="space-y-5 pt-16" aria-label="Community sidebar">
            <Card className="overflow-hidden border-0 text-white" style={{ backgroundColor: NAVY }}>
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <img src="/brand/logo-mark.png" alt="" className="h-16 w-16 rounded-full shadow-lg" />
                <h3 className="font-display text-2xl font-bold">A Stronger Leander Together</h3>
                <p className="text-sm text-white/75">
                  Leander Live connects people, places, and opportunities to help our town thrive.
                </p>
                <Button asChild className="mt-1 rounded-full bg-[#d98a1f] font-semibold text-white hover:bg-[#c67a14]">
                  <Link to="/community">Be Part of It <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <div className="mt-2 grid w-full grid-cols-3 gap-2 text-center text-xs text-white/70">
                  <div><p className="font-bold text-white">Support</p>Local</div>
                  <div><p className="font-bold text-white">Find</p>Your people</div>
                  <div><p className="font-bold text-white">Build</p>Tomorrow</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#eadbc3] bg-[#fff6ea]">
              <CardContent className="flex items-start gap-3 p-6">
                <span className="rounded-full bg-[#b5431f]/10 p-2.5">
                  <Bell className="h-5 w-5 text-[#b5431f]" aria-hidden="true" />
                </span>
                <div>
                  <h4 className="font-bold text-[#16324f]">Never miss a thing</h4>
                  <p className="mt-1 text-sm text-stone-600">Get a nudge before the events you care about.</p>
                  <Button asChild variant="link" className="h-auto px-0 text-sm font-semibold text-[#b5431f]">
                    <Link to="/reminders">Set up reminders <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <BusinessSoon />
      <div className="pt-16" />
      <ConceptFooter />
    </div>
  );
}

/* ================================================================
   CONCEPT C — "Hybrid" ★ recommended
   Current site's warmth + real photography + search + icon trio.
   ================================================================ */

export function VariantC() {
  return (
    <div className="min-h-screen bg-cream font-sans text-[#2e2620]">
      <ConceptBar active="C" />
      <section className="relative overflow-hidden">
        <img src={FIREWORKS} alt="Fireworks over Liberty Fest at Devine Lake Park" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-20 md:py-28">
          <img src="/brand/logo-leander-live.png" alt="Leander Live" className="h-14 w-auto drop-shadow-lg" />
          <h1 className="font-display max-w-2xl text-5xl font-black leading-[1.05] text-white md:text-6xl">
            Real Events.<br />A Stronger Community.
          </h1>
          <p className="max-w-xl text-lg text-white/85">
            Discover what's actually happening in Leander — festivals, markets, music,
            and Friday-night lights — all in one place.
          </p>
          <HeroSearch />
          <p className="font-script text-2xl text-amber-200">Local people · Brighter tomorrows</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-12">
        <div className="mb-8 text-center">
          <Badge className="bg-[#b5431f] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
            <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Browse by
          </Badge>
          <h2 className="font-display mt-2 text-3xl font-bold text-[#16324f]">What brings you to town?</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {TRIO.map((t) => (
            <Link key={t.title} to={t.to} className="group">
              <Card className="h-full border-[#eadbc3] bg-white transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl">
                <CardContent className="flex items-center gap-4 p-5">
                  <img src={t.icon} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover shadow" loading="lazy" />
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#16324f]">{t.title}</h3>
                    <p className="text-sm text-stone-600">{t.blurb}</p>
                  </div>
                  <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition-all group-hover:translate-x-1 group-hover:text-[#b5431f]" aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <FeaturedEvents
        title="This week in Leander"
        subtitle="Real events, real photos, real neighbors."
      />

      <section aria-label="Get reminders" className="mx-auto max-w-6xl px-4 pt-16">
        <div className="overflow-hidden rounded-2xl bg-secondary px-6 py-10 text-white md:px-10">
          <h2 className="font-display flex items-center gap-2 text-3xl font-bold">
            <Bell className="h-7 w-7" aria-hidden="true" /> Never miss what's happening
          </h2>
          <p className="mt-2 max-w-xl text-white/85">
            Pick your interests and we'll only nudge you about the Leander events you actually care about.
          </p>
          <Button asChild variant="outline" className="mt-6 rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link to="/reminders">
              Get reminders <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <BusinessSoon />
      <div className="pt-16" />
      <ConceptFooter />
    </div>
  );
}

/* ================================================================
   Index — /design
   ================================================================ */

const CONCEPT_META = [
  {
    id: "a",
    name: "Concept A — Bright & Bold",
    from: "Draws from your first mockup",
    points: [
      "Full-bleed sunset hero with a big marketing headline",
      "Your three brand icons as cards overlapping the hero",
      "Navy call-to-action band + business directory teaser",
    ],
    recommended: false,
  },
  {
    id: "b",
    name: "Concept B — Search-first",
    from: "Draws from your second mockup",
    points: [
      "“Same Town. More Together.” hero with a giant search bar",
      "Quick-filter chips and a community sidebar card",
      "Centered icon cards for Events / Businesses / Jobs",
    ],
    recommended: false,
  },
  {
    id: "c",
    name: "Concept C — Hybrid ★",
    from: "My recommendation",
    points: [
      "Real Liberty Fest fireworks hero with your logo lockup",
      "Search + working category filters on live event data",
      "Your icons, warm cream palette, reminders call-to-action",
    ],
    recommended: true,
  },
] as const;

export function VariantsIndex() {
  return (
    <div className="min-h-screen bg-cream font-sans text-[#2e2620]">
      <div style={{ backgroundColor: NAVY }} className="text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm">
          <span className="font-semibold text-amber-300">Design concepts — preview only</span>
          <Link to="/" className="font-medium text-white/80 hover:text-white hover:underline">
            ← Back to live site
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-10 max-w-2xl">
          <h1 className="font-display text-4xl font-black text-[#16324f]">Three homepage directions</h1>
          <p className="mt-3 text-lg text-stone-600">
            Each concept below is a fully working page — real event data, working search and filters.
            Walk through all three, then tell me which one and I'll build it out across the whole site.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {CONCEPT_META.map((c) => (
            <Card
              key={c.id}
              className={cn(
                "flex flex-col border-[#eadbc3]",
                c.recommended && "border-2 border-[#b5431f] shadow-lg"
              )}
            >
              <CardContent className="flex flex-1 flex-col gap-3 p-6">
                {c.recommended && (
                  <Badge className="w-fit bg-[#b5431f] text-white">
                    <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Recommended
                  </Badge>
                )}
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#16324f]">{c.name}</h2>
                  <p className="text-sm font-medium text-stone-500">{c.from}</p>
                </div>
                <Separator className="bg-[#eadbc3]" />
                <ul className="flex-1 space-y-2 text-sm text-stone-700">
                  {c.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Button asChild className={cn("mt-2 w-full rounded-full font-semibold", c.recommended ? "bg-[#b5431f] text-white hover:bg-[#9c3a1a]" : "")}>
                  <Link to={`/design/${c.id}`}>
                    View {c.name.split(" — ")[0]} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-stone-500">
          Mix-and-match welcome — e.g. “C's hero with B's sidebar” is a perfectly good answer.
        </p>
      </main>
      <ConceptFooter />
    </div>
  );
}
