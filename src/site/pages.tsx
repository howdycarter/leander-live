import { overlapsDateFilter } from "./eventTime";
import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import {
  About,
  ALL_EVENTS,
  ALL_JOBS,
  BusinessForm,
  BusinessesBoard,
  CrossPromoCard,
  EventCard,
  FeedFilters,
  JobsBoard,
  RemindersContent,
  inRange,
  type DateFilter,
} from "./content";
import {
  BusinessCtaBand,
  FeaturedEvents,
  HomeHero,
  HowItWorks,
  JobsPreview,
  NavyCtaBand,
  PageHero,
  WeekendSpotlight,
} from "./conceptA";
import { CityHallPage } from "./cityHall";
import { EventDetailPage } from "./eventDetail";
import { useSavedEvents } from "./state";

/* ---------------- home — Concept A: Bright & Bold ---------------- */

export function HomePage() {
  return (
    <main>
      <HomeHero />
      <WeekendSpotlight />
      <FeaturedEvents
        title="Upcoming in Leander"
        subtitle="Festivals, markets, live music, and Friday-night lights."
      />
      <JobsPreview />
      <HowItWorks />
      <BusinessCtaBand />
      <NavyCtaBand />
    </main>
  );
}

export { EventDetailPage, CityHallPage };

/* ---------------- events ---------------- */

export function EventsPage() {
  const { saved, toggleSaved } = useSavedEvents();
  const [searchParams, setSearchParams] = useSearchParams();
  const savedOnly = searchParams.get("saved") === "1";

  // Concept-page search links here with ?q= — honor it on first load.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [dateFilter, setDateFilter] = useState<DateFilter>("All");
  const [category, setCategory] = useState<string>("All");

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_EVENTS.filter((e) => {
      if (savedOnly && !saved.has(e.id)) return false;
      if (category !== "All" && (e.category ?? "") !== category) return false;
      if (dateFilter === "Today" || dateFilter === "This Month") {
        if (!overlapsDateFilter(e, dateFilter, now.getTime())) return false;
      } else if (!inRange(e.startsAt, dateFilter, now)) return false;
      if (q && !`${e.title} ${e.venue} ${e.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, dateFilter, category, now, saved, savedOnly]);

  const hasFilters =
    savedOnly || dateFilter !== "All" || category !== "All" || query.trim() !== "";

  function clearFilters() {
    setQuery("");
    setDateFilter("All");
    setCategory("All");
    setSearchParams({});
  }

  return (
    <>
      <PageHero
        title={savedOnly ? "Saved Events" : "Upcoming Events"}
        subtitle={
          savedOnly
            ? "Everything you've hearted, in one place."
            : "Every festival, market, concert, and Friday-night light — all in one place."
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-6 @container">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-navy">
          {savedOnly ? "Your saved events" : "Find your thing"}
        </h2>
        {hasFilters && (
          <Button
            variant="link"
            onClick={clearFilters}
            className="h-auto shrink-0 px-0 text-sm font-semibold text-primary"
          >
            View All Events <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <FeedFilters
        query={query}
        setQuery={setQuery}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        category={category}
        setCategory={setCategory}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        {filtered.length === 1 ? "1 event" : `${filtered.length} events`}
        {hasFilters ? " matching your filters" : " upcoming"}
      </p>
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">
              {savedOnly ? "No saved events yet" : "No events match those filters"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {savedOnly
                ? "Tap the heart on any event to save it here."
                : "Try widening the dates or categories — or submit the event yourself."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 @min-[40rem]:grid-cols-2 @min-[68rem]:grid-cols-3 pane-split">
          {filtered.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              saved={saved.has(event.id)}
              onToggleSaved={() => toggleSaved(event.id)}
            />
          ))}
        </div>
      )}
      </main>
    </>
  );
}

/* ---------------- jobs ---------------- */

export function JobsPage() {
  return (
    <>
      <PageHero
        title="Jobs in Leander"
        subtitle="Local work, right here in town — posted by Leander employers."
      />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <JobsBoard />
      </main>
    </>
  );
}

/* ---------------- business directory ---------------- */

export function BusinessesPage() {
  return (
    <>
      <PageHero
        eyebrow="Local directory"
        title="Businesses in Leander"
        subtitle="Every storefront, kitchen, salon, and service in town — from official Texas permit records, refreshed twice a day."
      />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <BusinessesBoard />
      </main>
    </>
  );
}

/* ---------------- community (businesses) ---------------- */

export function CommunityPage() {
  return (
    <>
      <PageHero
        eyebrow="For local businesses"
        title="Put your business in front of Leander"
        subtitle="Featured listings, sponsored events, and qualified local leads — from the community board Leander actually reads."
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid max-w-4xl gap-6">
          <BusinessForm />
          <CrossPromoCard />
        </div>
      </main>
    </>
  );
}

/* ---------------- reminders → add to calendar ---------------- */

export function RemindersPage() {
  return (
    <>
      <PageHero
        title="Never miss what's happening"
        subtitle="Add any event straight to your calendar — no sign-up, no spam, just the .ics file."
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="max-w-2xl">
          <RemindersContent />
        </div>
      </main>
    </>
  );
}

/* ---------------- about ---------------- */

export function AboutPage() {
  return (
    <>
      <PageHero
        title="What is Leander Live?"
        subtitle="People • Places • Opportunities — the community hub for Leander, Texas."
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="max-w-3xl">
          <About />
        </div>
      </main>
    </>
  );
}

/* ---------------- privacy ---------------- */

export function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-primary">Leander Live</p>
      <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-navy">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective September 27, 2026</p>

      <div className="prose-cream mt-8 space-y-6 text-[15px] leading-relaxed">
        <p>
          Leander Live is a community events board for Leander, Texas. This policy
          explains what information we collect and how we use it. In short: there
          are no accounts, no sign-in, and no tracking of who you are — the site
          is a static page that reads public event listings.
        </p>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            Information we collect
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Saved events.</strong> Events you heart are stored only in
              your own browser&apos;s local storage. They never leave your device,
              and clearing your browser data removes them.
            </li>
            <li>
              <strong>Event, job &amp; business submissions.</strong> When you email
              us a submission through the site&apos;s forms, we receive whatever
              details you put in that email so we can review and publish your
              listing.
            </li>
            <li>
              <strong>Analytics.</strong> We use Google Analytics to see aggregate
              page views (which pages are popular). It does not identify you
              personally.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            How we use it
          </h2>
          <p>
            We use submissions to keep the board fresh and accurate. We do not
            sell your personal information, and we do not share it with third
            parties for their own marketing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            Your choices
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Unsave events any time by tapping the heart again.</li>
            <li>
              Ask us to remove a submission by emailing{" "}
              <a
                href="mailto:chris@howdycarter.com"
                className="font-semibold text-primary hover:underline"
              >
                chris@howdycarter.com
              </a>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">Contact</h2>
          <p>
            Leander Live was designed and built by{" "}
            <a
              href="https://howdycarter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Howdy Carter
            </a>
            . Questions about this policy? Email{" "}
            <a
              href="mailto:chris@howdycarter.com"
              className="font-semibold text-primary hover:underline"
            >
              chris@howdycarter.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

/* ---------------- 404 ---------------- */

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-16">
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8">
          <h1 className="font-display text-5xl font-black tracking-tight text-navy">404</h1>
          <p className="text-muted-foreground">
            That page isn&apos;t on the board. Let&apos;s get you back to what&apos;s happening.
          </p>
          <Button asChild className="rounded-full">
            <Link to="/">
              Back home <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

/* ---------------- advertise ---------------- */

import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { AD_PACKAGES, SERVICE_LEAD_STEPS, formatPrice, type AdPackage } from "./monetization";
import { trackEvent } from "./analytics";

function PackageCard({ pkg, onInterested }: { pkg: AdPackage; onInterested: (pkg: AdPackage) => void }) {
  const live = pkg.stripeUrl.length > 0;
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <h3 className="font-display text-xl font-bold">{pkg.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{pkg.tagline}</p>
        </div>
        <p className="font-display text-4xl font-black tracking-tight text-navy">
          ${pkg.price}
          <span className="text-base font-semibold text-muted-foreground">{pkg.cadence}</span>
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {pkg.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-2">
          <Button
            className="w-full rounded-full"
            onClick={() => {
              if (live) {
                trackEvent("stripe_checkout_started", { package: pkg.id, price: pkg.price });
                window.open(pkg.stripeUrl, "_blank", "noopener");
              } else {
                trackEvent("advertise_cta_clicked", { package: pkg.id });
                onInterested(pkg);
              }
            }}
          >
            {pkg.cta} <ArrowRight className="h-4 w-4" />
          </Button>
          {!live && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Checkout opens soon — reserve your spot below.
            </p>
          )}
          {pkg.exclusivity && pkg.exclusivity.stripeUrl.length > 0 && (
            <Button
              variant="outline"
              className="mt-3 w-full rounded-full"
              onClick={() => {
                trackEvent("stripe_checkout_started", {
                  package: `${pkg.id}-exclusivity`,
                  price: pkg.exclusivity!.price,
                });
                window.open(pkg.exclusivity!.stripeUrl, "_blank", "noopener");
              }}
            >
              Own your category — ${pkg.exclusivity.price}
              {pkg.exclusivity.cadence} <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdvertisePage() {
  const formRef = useRef<HTMLDivElement>(null);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);

  function scrollToForm(pkg: AdPackage) {
    setSelectedPkg(pkg.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <PageHero
        eyebrow="For Leander businesses"
        title="Get found by the whole town."
        subtitle="Featured placements and AI-qualified service leads — priced for local businesses, not agencies."
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <Badge className="bg-white/15 text-white hover:bg-white/25">
            {ALL_EVENTS.length} upcoming events
          </Badge>
          <Badge className="bg-white/15 text-white hover:bg-white/25">
            {ALL_JOBS.length} local jobs
          </Badge>
          <Badge className="bg-white/15 text-white hover:bg-white/25">One community board</Badge>
        </div>
      </PageHero>

      <main className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="sr-only">Advertising packages</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {AD_PACKAGES.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} onInterested={scrollToForm} />
          ))}
        </div>

        <section className="mt-16">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Service leads
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold">
            Neighbors ask. We qualify. You get the job.
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Tell us what you do and where you work. When a neighbor needs your
            trade, we route the qualified lead to you — {formatPrice(AD_PACKAGES[3])}, or own
            your trade exclusively for $299/mo.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {SERVICE_LEAD_STEPS.map((s, i) => (
              <Card key={s.title}>
                <CardContent className="p-6">
                  <p className="font-display text-3xl font-black text-primary">{i + 1}</p>
                  <h3 className="mt-2 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section ref={formRef} className="mt-16 scroll-mt-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold">Reserve your spot</h2>
            <p className="mt-2 text-muted-foreground">
              {selectedPkg
                ? `You picked ${AD_PACKAGES.find((p) => p.id === selectedPkg)?.name} — tell us about your business and we'll get you set up.`
                : "Tell us about your business and what you want — we'll get you set up personally."}
            </p>
            <div className="mt-6">
              <BusinessForm
                packageName={
                  selectedPkg
                    ? AD_PACKAGES.find((p) => p.id === selectedPkg)?.name
                    : undefined
                }
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
