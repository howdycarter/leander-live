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
  type EventItem,
} from "./content";
import { downloadEventIcs } from "./ics";
import { useSavedEvents } from "./state";
import { trackEvent } from "./analytics";

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
    <section aria-label="More events you might like" className="mt-14">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-[#16324f]">More to explore</h2>
        <Button asChild variant="link" className="h-auto px-0 font-semibold text-[#b5431f]">
          <Link to="/events">View all events</Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <Button asChild variant="ghost" className="-ml-2 mb-5 rounded-full">
        <Link to="/events">
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>
      </Button>

      {!event ? (
        <Card className="mx-auto max-w-md text-center">
          <CardContent className="flex flex-col items-center gap-4 pt-8">
            <h1 className="font-display text-4xl font-bold text-[#b5431f]">Hmm.</h1>
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
              <blockquote className="mt-6 border-l-4 border-[#d98a1f] pl-4">
                <p className="font-display text-xl italic leading-relaxed text-[#4a3d2f] md:text-2xl">
                  {event.blurb}
                </p>
              </blockquote>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
              {/* details */}
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fbe7e7] text-[#c93a3a]">
                        <CalendarDays className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Date
                        </span>
                        <span className="font-semibold">{formatDate(event.startsAt)}</span>
                      </span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e2eefb] text-[#2f7fd0]">
                        <Clock className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Time
                        </span>
                        <span className="font-semibold">{formatTime(event.startsAt)}</span>
                      </span>
                    </CardContent>
                  </Card>
                  <Card className="sm:col-span-2">
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e6f2e3] text-[#4c8c4a]">
                        <MapPin className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Venue
                        </span>
                        <span className="font-semibold">{event.venue}</span>
                      </span>
                    </CardContent>
                  </Card>
                </div>

                <div className="prose-cream mt-6 text-[16px] leading-relaxed">
                  {event.description.split("\n").map((p, i) => (
                    <p key={i} className="mb-4">
                      {p}
                    </p>
                  ))}
                </div>
              </div>

              {/* action rail */}
              <aside>
                <Card className="lg:sticky lg:top-24">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Going?
                      </span>
                      <SaveButton
                        saved={saved.has(event.id)}
                        onToggleSaved={() => toggleSaved(event.id)}
                        className="border border-[#eadbc3]"
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
