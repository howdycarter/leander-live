import { useEffect, useState } from "react";
import records from "./data/guide.json";
import { formatDate, formatTime } from "./lib/eventTime";
import { isCurrentGuideEvent } from "./lib/guidePolicy";
export { isCurrentGuideEvent } from "./lib/guidePolicy";

export const BOOKING_URL = "https://howdycarter.com/book?source=leander-live";
export function currentGuide(now: number) {
  return records.filter(event => isCurrentGuideEvent(event, now));
}

export function GuidePage({ path = "/", now: initialNow = Date.now() }: { path?: string; now?: number }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const slug = path.replace(/^\/events\//, "").replace(/\/$/, "");
  const detail = path.startsWith("/events/") ? records.find(event => event.slug === slug) : undefined;
  const unknownRoute = path.startsWith("/events/") && !detail;
  const current = currentGuide(now);
  const visible = detail ? [detail] : current;
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#main" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>
    <header className="border-b"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <a href="/" className="font-display text-2xl font-bold">Leander Live</a>
      <nav aria-label="Main" className="flex gap-5 text-sm"><a className="underline" href="/#guide">Local guide</a><a className="underline" href="#businesses">For businesses</a></nav>
    </div></header>
    <main id="main" className="mx-auto max-w-5xl px-5 pb-16">
      <section className="py-12 md:py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-secondary">Leander, Texas</p>
        <h1 className="font-display max-w-3xl text-4xl font-bold leading-tight md:text-5xl">{detail ? detail.title : unknownRoute ? "That event is not in this guide" : "A useful starting point for your next local plan."}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">A small, source-linked guide to Leander. Dates use Central time. Check the organizer's original page for changes, registration, and access before heading out.</p>
      </section>
      <section id="guide" aria-label="Reviewed local events" className="grid gap-6">
        {!detail && <h2 className="font-display text-2xl font-bold">Locally sourced plans</h2>}
        {unknownRoute && <p><a className="underline" href="/">Return to the local guide</a></p>}
        {!detail && current.length === 0 && <p className="rounded-xl border p-6">We're checking the next selections. The official calendars below have more current options.</p>}
        {visible.map(event => <article key={event.slug} className="rounded-xl border bg-card p-6 shadow-sm">
          {!detail && <h3 className="font-display text-xl font-bold"><a className="underline decoration-primary/40 underline-offset-4" href={`/events/${event.slug}/`}>{event.title}</a></h3>}
          {Date.parse(event.endsAt) <= now ? <p className="font-semibold">This event has ended.</p> : !isCurrentGuideEvent(event, now) ? <p className="font-semibold">This source snapshot needs a current check. Confirm details with the city before making plans.</p> : null}
          <p className="mt-3 font-medium">{formatDate(Date.parse(event.startsAt))} · {formatTime(Date.parse(event.startsAt))}–{formatTime(Date.parse(event.endsAt))}</p>
          <p className="mt-1">{event.venue} · {event.address}</p>
          <p className="mt-4 max-w-3xl leading-relaxed">{event.description}</p>
          <p className="mt-3 text-sm">Cost: {event.cost}. Who: {event.audience}.</p>
          {detail && <p className="mt-3 text-sm text-muted-foreground">{event.accessibility}</p>}
          <p className="mt-4 text-sm text-muted-foreground">Source snapshot reviewed {formatDate(Date.parse(event.checkedAt))}. {event.sourceName} is the source; Leander Live is an independent guide.</p>
          <a href={event.sourceUrl} className="mt-4 inline-block rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground">Check original event details</a>
        </article>)}
      </section>
      <section className="mt-12 rounded-xl bg-muted p-6" aria-labelledby="sources-title">
        <h2 id="sources-title" className="font-display text-2xl font-bold">Keep exploring Leander</h2>
        <p className="mt-3">Follow the source for the newest schedule and official notification options.</p>
        <ul className="mt-4 flex flex-col gap-3"><li><a className="underline" href="https://www.leandertx.gov/calendar.aspx">City calendar: library, parks, and community events</a></li><li><a className="underline" href="https://visitleandertx.com/">Visit Leander: local places and visitor information</a></li></ul>
      </section>
      <section id="businesses" className="mt-12 rounded-xl border border-primary/25 p-6 md:p-8" aria-labelledby="business-title">
        <p className="text-sm font-semibold text-secondary">For local business owners</p>
        <h2 id="business-title" className="font-display mt-2 text-2xl font-bold">What happens after someone finds your business?</h2>
        <p className="mt-4 max-w-2xl">Howdy Carter helps improve websites and follow-up so interested people have a clear next step. Start with a free 15-minute mapping conversation and a one-page plan for one useful improvement.</p>
        <a className="mt-5 inline-block rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground" href={BOOKING_URL}>Book a free growth mapping</a>
        <p className="mt-3 text-sm text-muted-foreground">Continue to Howdy Carter to choose a time. Opening the booking page does not confirm an appointment. No signup is required to use this guide.</p>
      </section>
    </main>
    <footer className="border-t px-5 py-6 text-center text-sm text-muted-foreground">An independent project by <a className="underline" href="https://howdycarter.com">Howdy Carter</a>. No city endorsement or established audience is implied.</footer>
  </div>;
}
