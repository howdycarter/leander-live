import { useMemo } from "react";
import { ArrowUpRight, CalendarDays, FileText, Landmark, MapPin, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "./conceptA";
import { SourceStatusBanner, ListingStatus } from "./sourceStatus";
import { formatDate, formatTime } from "./content";
import type { CivicMeeting, NewsItem } from "../data/types";
import meetingsRaw from "../data/civic.json";
import newsRaw from "../data/news.json";

const MEETINGS: CivicMeeting[] = (meetingsRaw as CivicMeeting[])
  .filter((m) => m.startsAt >= Date.now() - 24 * 60 * 60 * 1000)
  .sort((a, b) => a.startsAt - b.startsAt);

const NEWS: NewsItem[] = (newsRaw as NewsItem[])
  .slice()
  .sort((a, b) => b.publishedAt - a.publishedAt)
  .slice(0, 10);

function MeetingCard({ meeting }: { meeting: CivicMeeting }) {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gap-1 rounded-md bg-navy px-2.5 py-0.5 text-white">
            <Landmark className="h-3 w-3" aria-hidden="true" />
            {meeting.body}
          </Badge>
        </div>
        <ListingStatus item={meeting} /><h3 className="font-display text-lg font-bold leading-snug text-navy">
          {meeting.title}
        </h3>
        <div className="flex flex-col gap-1.5 text-sm text-foreground/75">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            {formatDate(meeting.startsAt)} · {formatTime(meeting.startsAt)}
          </span>
          {meeting.location && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              {meeting.location}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {meeting.agendaUrl ? (
            <Button asChild size="sm" className="rounded-full">
              <a href={meeting.agendaUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="h-3.5 w-3.5" /> Agenda packet
              </a>
            </Button>
          ) : (
            meeting.sourceUrl && (
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <a href={meeting.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Meeting details <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            )
          )}
          {meeting.minutesUrl && (
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <a href={meeting.minutesUrl} target="_blank" rel="noopener noreferrer">
                Minutes <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
        <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
        {formatDate(item.publishedAt)}
      </p>
      <h3 className="font-display mt-1.5 font-bold leading-snug text-navy group-hover:text-primary">
        {item.title}
      </h3>
      {item.summary && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
      )}
      <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        Read on leandertx.gov <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}

export function CityHallPage() {
  const bodies = useMemo(() => {
    const order: string[] = [];
    for (const m of MEETINGS) {
      if (!order.includes(m.body)) order.push(m.body);
    }
    return order;
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Civic Leander"
        title="City Hall"
        subtitle="Council and board meetings, agenda packets, and city news — what your local government is up to, in plain sight."
      />
      <main className="mx-auto max-w-6xl px-4 py-6"><SourceStatusBanner kind="civic" />
        {/* Upcoming meetings */}
        <section aria-label="Upcoming meetings">
          <div className="mb-4">
            <h2 className="font-display text-2xl font-bold text-navy">
              Upcoming meetings
            </h2>
            <p className="mt-1 text-[15px] text-stone-600">
              City Council, Planning &amp; Zoning, and other boards — with agenda
              packets when they&apos;re published.
            </p>
          </div>
          {MEETINGS.length === 0 ? (
            <Card className="border-dashed border-border">
              <CardContent className="p-8 text-center text-sm text-stone-600">
                No upcoming meetings posted yet —{" "}
                <a
                  href="https://www.leandertx.gov/AgendaCenter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline"
                >
                  check the city&apos;s Agenda Center
                </a>
                .
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-8">
              {bodies.map((body) => (
                <div key={body}>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-primary">
                    {body}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {MEETINGS.filter((m) => m.body === body).map((m) => (
                      <MeetingCard key={m.id} meeting={m} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ordinances */}
        <section aria-label="Code of ordinances" className="mt-12">
          <Card className="overflow-hidden border-0 bg-navy text-white">
            <CardContent className="flex flex-col items-start gap-3 p-8">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-gold">
                <FileText className="h-4 w-4" aria-hidden="true" /> Code of Ordinances
              </p>
              <h2 className="font-display text-2xl font-bold">
                The rules of the town, in full.
              </h2>
              <p className="max-w-2xl text-[15px] text-white/80">
                Zoning, permits, noise, signage, short-term rentals — the complete
                Code of Ordinances lives on the city&apos;s Document Center, free for
                anyone to read.
              </p>
              <Button
                asChild
                className="rounded-full bg-gold font-bold text-navy hover:bg-gold/85"
              >
                <a
                  href="https://www.leandertx.gov/DocumentCenter"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Browse the Document Center <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* City news */}
        <section aria-label="City news" className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-navy">City news</h2>
              <p className="mt-1 text-[15px] text-stone-600">
                Fresh from leandertx.gov — announcements, road work, and public notices.
              </p>
            </div>
            <Button asChild variant="link" className="h-auto px-0 font-semibold text-primary">
              <a href="https://www.leandertx.gov/" target="_blank" rel="noopener noreferrer">
                leandertx.gov <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
          {NEWS.length === 0 ? (
            <Card className="border-dashed border-border">
              <CardHeader>
                <CardTitle className="text-base">No recent headlines</CardTitle>
              </CardHeader>
              <CardContent className="-mt-2 text-sm text-stone-600">
                Headlines refresh automatically — check back soon.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {NEWS.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
