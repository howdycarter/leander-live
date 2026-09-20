import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import {
  About,
  BusinessForm,
  CrossPromoCard,
  EventCard,
  FeedFilters,
  JobsBoard,
  RemindersForm,
  inRange,
  type DateFilter,
} from "./content";
import {
  BusinessSoon,
  FeaturedEvents,
  HomeHero,
  IconTrio,
  NavyCtaBand,
  PageHero,
} from "./conceptA";
import { useSavedEvents, useSiteActions } from "./state";

/* ---------------- home — Concept A: Bright & Bold ---------------- */

export function HomePage() {
  return (
    <>
      <HomeHero />
      <IconTrio overlap />
      <FeaturedEvents
        title="Upcoming in Leander"
        subtitle="Festivals, markets, live music, and Friday-night lights."
      />
      <BusinessSoon />
      <NavyCtaBand />
    </>
  );
}

/* ---------------- events ---------------- */

export function EventsPage() {
  const { saved, toggleSaved } = useSavedEvents();
  const { openSubmit } = useSiteActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const savedOnly = searchParams.get("saved") === "1";

  const events = useQuery(api.events.listUpcoming, { limit: 50 });
  // Concept-page search links here with ?q= — honor it on first load.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [dateFilter, setDateFilter] = useState<DateFilter>("All");
  const [category, setCategory] = useState<string>("All");

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (events ?? []).filter((e) => {
      if (savedOnly && !saved.has(e._id)) return false;
      if (category !== "All" && (e.category ?? "") !== category) return false;
      if (!inRange(e.startsAt, dateFilter, now)) return false;
      if (q && !`${e.title} ${e.venue} ${e.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, query, dateFilter, category, now, saved, savedOnly]);

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
      <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-2xl font-bold text-[#16324f]">
          {savedOnly ? "Your saved events" : "Find your thing"}
        </h2>
        {hasFilters && (
          <Button
            variant="link"
            onClick={clearFilters}
            className="h-auto shrink-0 px-0 text-sm font-semibold text-[#b5431f]"
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
        onSubmit={openSubmit}
      />
      {events === undefined ? (
        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Loading events"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((event) => (
                <EventCard
                  key={event._id}
                  event={event}
                  saved={saved.has(event._id)}
                  onToggleSaved={() => toggleSaved(event._id)}
                />
              ))}
            </div>
          )}
        </>
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
      <main className="mx-auto max-w-6xl px-4 py-10">
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

/* ---------------- reminders ---------------- */

export function RemindersPage() {
  return (
    <>
      <PageHero
        title="Never miss what's happening"
        subtitle="Sign up for reminders about the events you care about — pick your interests and we'll only nudge you about those."
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="max-w-2xl">
          <RemindersForm />
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
      <p className="font-script text-[28px] text-[#c05a1e]">Good Things Happen Here</p>
      <h1 className="font-display mt-2 text-4xl font-bold text-[#b5431f]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[#6b5d4f]">Effective September 19, 2026</p>

      <div className="prose-cream mt-8 space-y-6 text-[15px] leading-relaxed">
        <p>
          Leander Live is a community events board for Leander, Texas. This policy
          explains what information we collect and how we use it. In short: we use
          your info only for event updates and local business inquiries — never
          sold, never shared.
        </p>

        <section>
          <h2 className="font-display text-xl font-bold text-[#b5431f]">
            Information we collect
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Account info.</strong> If you sign in with Google, we receive
              your name, email address, and profile photo from Google so we can
              identify your account.
            </li>
            <li>
              <strong>Saved events.</strong> Events you heart are stored so they
              follow you across devices. If you&apos;re signed out, they&apos;re kept in your
              browser&apos;s local storage; if you&apos;re signed in, they&apos;re synced to your
              account.
            </li>
            <li>
              <strong>Event submissions &amp; inquiries.</strong> When you submit an
              event or contact us as a local business, we collect whatever details
              you provide (name, email, event info) so we can review and publish
              your listing.
            </li>
            <li>
              <strong>Text reminders.</strong> If you opt in, we collect your phone
              number to send event reminders. Message and data rates may apply; reply
              STOP to opt out at any time.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-[#b5431f]">
            How we use it
          </h2>
          <p>
            We use your information to run Leander Live: keeping you signed in,
            syncing your saved events, publishing events you submit, and sending
            reminders you asked for. We do not sell your personal information, and
            we do not share it with third parties for their own marketing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-[#b5431f]">
            Third-party services
          </h2>
          <p>
            Sign-in is handled by Google under{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#b5431f] hover:underline"
            >
              Google&apos;s Privacy Policy
            </a>
            . Our app hosting and database are provided by Convex. Text reminders,
            when enabled, are delivered through our messaging provider.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-[#b5431f]">
            Your choices
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Unsave events any time by tapping the heart again.</li>
            <li>Sign out any time from the account menu.</li>
            <li>Reply STOP to any text reminder to opt out.</li>
            <li>
              Ask us to delete your account data by contacting us (see below).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-[#b5431f]">Contact</h2>
          <p>
            Leander Live was designed and built by{" "}
            <a
              href="https://howdycarter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#b5431f] hover:underline"
            >
              Howdy Carter
            </a>
            . Questions about this policy? Reach out through the{" "}
            <Link to="/reminders" className="font-semibold text-[#b5431f] hover:underline">
              reminders page
            </Link>
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
          <p className="font-display text-5xl font-bold text-[#b5431f]">404</p>
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
