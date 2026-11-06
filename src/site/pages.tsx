import { overlapsDateFilter } from "./eventTime";
import { SourceStatusBanner } from "./sourceStatus";
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
  CATEGORIES,
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
  IconTrio,
  HowItWorks,
  JobsPreview,
  NavyCtaBand,
  PageHero,
  TownTicker,
  WeekendSpotlight,
} from "./conceptA";
import { CityHallPage } from "./cityHall";
import { EventDetailPage } from "./eventDetail";
import { useSavedEvents } from "./state";
import { EmptyState } from "@/components/arc/empty-state/empty-state";

/* ---------------- home — Concept A: Bright & Bold ---------------- */

export function HomePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <HomeHero />
      <IconTrio overlap />
      <TownTicker />
      <WeekendSpotlight />
      <FeaturedEvents
        title="Upcoming in Leander"
        subtitle="Festivals, markets, live music, and Friday-night lights."
        withRail
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
  // Hero quick chips land here with ?when= / ?cat= — seed the existing
  // filters from them; unrecognized values fall back to unfiltered.
  const [dateFilter, setDateFilter] = useState<DateFilter>(() =>
    searchParams.get("when") === "weekend" ? "This Weekend" : "All",
  );
  const [category, setCategory] = useState<string>(() => {
    const cat = searchParams.get("cat");
    return cat && (CATEGORIES as readonly string[]).includes(cat) ? cat : "All";
  });

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_EVENTS.filter((e) => {
      if (savedOnly && !saved.has(e.id)) return false;
      if (category !== "All" && (e.category ?? "") !== category) return false;
      if (dateFilter === "Today" || dateFilter === "This Weekend" || dateFilter === "This Month") {
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
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 @container">
      <SourceStatusBanner kind="events" />
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
        <EmptyState
          title={savedOnly ? "No saved events yet" : "No events match those filters"}
          description={
            savedOnly
              ? "Tap the heart on any event to save it here."
              : "Try widening the dates or categories — or submit the event yourself."
          }
          action={
            hasFilters ? (
              <Button onClick={clearFilters} className="rounded-full font-bold">
                View all events
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 @min-[40rem]:grid-cols-2 @min-[68rem]:grid-cols-3 pane-split sm:gap-5">
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
        subtitle="Collected local job listings — confirm current openings with the employer."
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
        <JobsBoard />
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
        subtitle="Ask about featured listings, sponsored events, and job placements on Leander’s community board."
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
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
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
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
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-10"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-primary">
        Leander Live
      </p>
      <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-navy">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Effective November 2, 2026
      </p>

      <div className="prose-cream mt-8 space-y-6 text-body leading-relaxed">
        <p>
          Leander Live is a community events, jobs, and business board for
          Leander, Texas, operated by Newton &amp; Carter LLC
          (&ldquo;we,&rdquo; &ldquo;us&rdquo;). This policy explains what
          information we collect and how we use it. In short: there are no
          accounts and no sign-in; the site&rsquo;s forms never send
          anything by themselves — they prepare an email draft in your own
          email app; and analytics cookies stay off unless you accept them.
        </p>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            Information we collect
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Submissions and inquiries you email us.</strong> The
              forms on this site (submit an event, post a job, ask about a
              business listing or a paid placement) compose a draft in your
              email app. Nothing reaches us until you send that email. When
              you do, we receive what you put in it — typically your name,
              email address, phone number if you add one, and the listing
              details — so we can review it, publish the listing, and reply.
            </li>
            <li>
              <strong>Saved events.</strong> Events you heart are stored
              only in your own browser&rsquo;s local storage. They never
              leave your device, and clearing your browser data removes
              them.
            </li>
            <li>
              <strong>Analytics, only with your consent.</strong> We use
              Google Analytics (loaded through Google Tag Manager) to see
              aggregate page views — which pages are popular. Analytics
              storage starts off and is enabled only if you accept in the
              consent banner; your choice is stored on your device and you
              can change it any time from the &ldquo;Privacy
              choices&rdquo; link in the footer. When enabled, we also use
              PostHog for aggregate product analytics: it is configured to
              run anonymously — no accounts, no names or email addresses,
              no automatic click or form tracking, no session recording,
              and page addresses are reported without their query strings.
              If your browser sends a Do Not Track signal, PostHog is not
              loaded at all.
            </li>
            <li>
              <strong>Hosting logs.</strong> Our hosting provider (Vercel)
              processes standard technical logs — IP address, browser type,
              and pages requested — to serve and secure the site.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            Cookies and local storage
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Essential (always, on your device only):</strong>{" "}
              your saved events and your analytics consent choice, stored
              in local storage. These never leave your device.
            </li>
            <li>
              <strong>Analytics (only after you accept):</strong> Google
              Analytics cookies (such as <em>_ga</em>) that distinguish
              visits in aggregate, and PostHog&rsquo;s anonymous identifier
              stored in local storage when PostHog is enabled. We run no
              advertising cookies and no cross-site ad tracking.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            How we use it, and who receives it
          </h2>
          <p>
            We use submissions and inquiries to review and publish
            listings, arrange paid placements, and answer you. Analytics
            tell us, in aggregate, which parts of the board are useful. We
            do not sell your personal information, and we do not share it
            for anyone else&rsquo;s marketing. The service providers that
            process data for us are Google (analytics and tag management),
            PostHog (product analytics, when enabled), and Vercel
            (hosting). We may disclose information if required by law or to
            protect the site and its users.
          </p>
          <p>
            Details you submit for publication — a business&rsquo;s name,
            address, hours, and contact links, an event&rsquo;s organizer
            details, a job posting — are published on the public board, as
            the submission forms explain. Do not submit private personal
            information (such as a home address or a personal phone number)
            that you do not want published.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            How long we keep it
          </h2>
          <p>
            Emails you send us are kept while the listing or placement is
            active and for a reasonable period afterward for our records,
            then deleted. Analytics data is retained in aggregate by our
            providers under their standard retention settings.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            Your choices and rights
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Unsave events any time by tapping the heart again.</li>
            <li>
              Change your analytics choice any time via &ldquo;Privacy
              choices&rdquo; in the footer.
            </li>
            <li>
              Ask us to correct or remove a listing or submission, or to
              delete personal information you emailed us, by writing to{" "}
              <a
                href="mailto:chris@newtonandcarter.com"
                className="font-semibold text-primary hover:underline"
              >
                chris@newtonandcarter.com
              </a>
              . We respond to requests within 30 days.
            </li>
          </ul>
          <p>
            If you are in the European Economic Area or the UK, you also
            have the rights to access, correct, delete, and restrict or
            object to our processing of your personal data, and to data
            portability. Our lawful basis for analytics is your consent
            (which you may withdraw at any time, as above); for handling
            submissions and placements it is our legitimate interest in
            operating the board and performing the arrangement you asked
            for. Data is processed in the United States. You may also
            complain to your local data protection authority.
          </p>
          <p>
            This board is a general-audience community service and is not
            directed to children under 13.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold text-navy">
            Changes and contact
          </h2>
          <p>
            If we change this policy, we will post the updated version here
            with a new effective date. Leander Live is operated by Newton
            &amp; Carter LLC. Questions about this policy, or reports of a
            listing that should not be public, go to{" "}
            <a
              href="mailto:chris@newtonandcarter.com"
              className="font-semibold text-primary hover:underline"
            >
              chris@newtonandcarter.com
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
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-16">
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
import { AD_PACKAGES, SERVICE_LEAD_STEPS, type AdPackage } from "./monetization";
import { trackEvent } from "./analytics";

function PackageCard({ pkg, onInterested }: { pkg: AdPackage; onInterested: (pkg: AdPackage) => void }) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <h3 className="font-display text-xl font-bold">{pkg.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{pkg.tagline}</p>
        </div>
        <p className="font-display text-4xl font-black tracking-tight text-navy">
          {pkg.unavailable ? "Unavailable" : `$${pkg.price}`}
          <span className="text-base font-semibold text-muted-foreground">{pkg.unavailable ? "" : `${pkg.cadence}`}</span>
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
              trackEvent("advertise_cta_clicked", { package: pkg.id });
              onInterested(pkg);
            }}
          >
            {pkg.cta} <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Paid posting — goes live only after payment is confirmed.
          </p>
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
        subtitle="Flat local pricing: any posting is $5/month, sponsored placement $10/month. Every posting is paid before it goes live — there is no free posting."
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

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-12">
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
            Questions welcome. Service leads are not available.
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            No lead qualification, delivery, or exclusive categories are offered.
            You can use the email form to ask about advertising placements;
            preparing an inquiry does not send it.
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
            <h2 className="font-display text-3xl font-bold">Start your posting</h2>
            <p className="mt-2 text-muted-foreground">
              {selectedPkg
                ? `Start a ${AD_PACKAGES.find((p) => p.id === selectedPkg)?.name} — paid before it goes live, reviewed before it appears.`
                : "Tell us about your business to start a posting. Every posting is paid before it goes live — standard $5/mo, sponsored $10/mo."}
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
