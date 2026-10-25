import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  MapPin,
  Share2,
} from "lucide-react";
import {
  ALL_EVENTS,
  CategoryBadge,
  EventCard,
  FeaturedEventBadge,
  SaveButton,
  formatDate,
  formatTime,
  inRange,
  isEventFeatured,
  textParagraphs,
  type EventItem,
} from "./content";
import { downloadEventIcs } from "./ics";
import { useSavedEvents } from "./state";
import { trackEvent } from "./analytics";
import { buildEventJsonLd } from "./eventJsonLd";

function eventImage(event: EventItem) {
  return event.image ?? "/images/event-night-market.jpg";
}

function ShareButton({ event }: { event: EventItem }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: event.title,
          text: event.blurb ?? event.description,
          url,
        });
        trackEvent("event_shared", { event_id: event.id, method: "webshare" });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent("event_shared", { event_id: event.id, method: "copy_link" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Button variant="outline" className="rounded-full" onClick={share}>
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}

function RelatedEvents({ event, all }: { event: EventItem; all: EventItem[] }) {
  const { saved, toggleSaved } = useSavedEvents();
  const related = all
    .filter((e) => e.id !== event.id && e.category === event.category)
    .slice(0, 3);
  const fill =
    related.length < 3
      ? all.filter(
          (e) =>
            e.id !== event.id &&
            e.category !== event.category &&
            !related.some((r) => r.id === e.id),
        )
      : [];
  const picks = [...related, ...fill].slice(0, 3);
  if (picks.length === 0) return null;
  return (
    <section aria-label="More events you might like" className="mt-14 @container">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-navy">More to explore</h2>
        <Button asChild variant="link" className="h-auto px-0 font-semibold text-primary">
          <Link to="/events">View all events</Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 @min-[40rem]:grid-cols-2 @min-[68rem]:grid-cols-3 pane-split">
        {picks.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            saved={saved.has(e.id)}
            onToggleSaved={() => toggleSaved(e.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { saved, toggleSaved } = useSavedEvents();
  const event = ALL_EVENTS.find((e) => e.id === id);

  useEffect(() => {
    if (event) trackEvent("event_detail_view", { event_id: event.id });
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // schema.org Event JSON-LD for this page. Client-rendered app, so inject
  // into document.head (the Canonical/RouteMeta pattern) and remove on exit.
  useEffect(() => {
    if (!event) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.dataset.eventJsonld = event.id;
    el.textContent = JSON.stringify(buildEventJsonLd(event));
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-10 @container">
      <Button asChild variant="ghost" className="-ml-2 mb-5 rounded-full">
        <Link to="/events">
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>
      </Button>

      {!event ? (
        <Card className="mx-auto max-w-md text-center">
          <CardContent className="flex flex-col items-center gap-4 pt-8">
            <h1 className="font-display text-4xl font-bold text-primary">Hmm.</h1>
            <p className="text-muted-foreground">
              That event isn&apos;t on the board anymore — it may have passed or been
              removed. Here&apos;s what&apos;s coming up instead.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/events">Browse events</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <article>
            {/* banner */}
            <div className="relative overflow-hidden rounded-2xl shadow-sm">
              <img
                src={eventImage(event)}
                alt=""
                className="h-60 w-full object-cover sm:h-80 md:h-96"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <CategoryBadge event={event} className="bg-white/95 shadow-sm" />
                {isEventFeatured(event) && <FeaturedEventBadge />}
              </div>
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6">
                <h1 className="font-display max-w-3xl text-3xl font-black leading-tight text-white drop-shadow md:text-5xl">
                  {event.title}
                </h1>
              </div>
            </div>

            {/* blurb */}
            {event.blurb && (
              <p className="mt-6 border-l-4 border-gold pl-4 text-lg font-semibold leading-relaxed text-foreground md:text-xl">
                {event.blurb}
              </p>
            )}

            <div className="mt-8 grid grid-cols-1 gap-8 @min-[42rem]:grid-cols-[1.5fr_1fr] pane-split">
              {/* details */}
              <div className="min-w-0">
                <Card className="overflow-hidden">
                  <ul className="divide-y divide-border">
                    <li className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fbe7e7] text-[#a52f2f]">
                        <CalendarDays className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Date
                        </span>
                        <span className="font-semibold">{formatDate(event.startsAt)}</span>
                      </span>
                    </li>
                    <li className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e2eefb] text-[#205d99]">
                        <Clock className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Time
                        </span>
                        <span className="font-semibold">
                          {formatTime(event.startsAt)}
                          {event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}
                        </span>
                      </span>
                    </li>
                    <li className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e6f2e3] text-[#3c6b39]">
                        <MapPin className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Venue
                        </span>
                        <span className="block font-semibold">{event.venue}</span>
                        {event.address && (
                          <span className="block truncate text-sm text-muted-foreground">
                            {event.address}
                          </span>
                        )}
                      </span>
                    </li>
                  </ul>
                </Card>

                <div className="mt-6 text-[16px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
                  {textParagraphs(event.description).map((p, i) => (
                    <p key={i} className="mb-4">
                      {p}
                    </p>
                  ))}
                </div>
              </div>

              {/* action rail */}
              <aside className="min-w-0">
                <Card className="@min-[42rem]:sticky @min-[42rem]:top-24">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Going?
                      </span>
                      <SaveButton
                        saved={saved.has(event.id)}
                        onToggleSaved={() => toggleSaved(event.id)}
                        className="border border-border"
                      />
                    </div>
                    <Button
                      className="w-full rounded-full"
                      size="lg"
                      onClick={() => {
                        downloadEventIcs(event);
                        trackEvent("ics_downloaded", { event_id: event.id });
                      }}
                    >
                      <CalendarPlus className="h-4 w-4" /> Add to calendar
                    </Button>
                    <div className="flex gap-2">
                      <ShareButton event={event} />
                      {event.url && (
                        <Button asChild variant="outline" className="flex-1 rounded-full">
                          <a href={event.url} target="_blank" rel="noopener noreferrer">
                            Official page <ArrowUpRight className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      Free to attend unless noted. Details subject to change — check the
                      official page before you head out.
                    </p>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </article>

          <RelatedEvents event={event} all={ALL_EVENTS} />
        </>
      )}
    </main>
  );
}

/** Re-export for pages that need the weekend check without importing content internals. */
export function isThisWeekend(startsAt: number, now: Date): boolean {
  return inRange(startsAt, "This Weekend", now);
}
