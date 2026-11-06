import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "./conceptA";
import { CompanyMark, formatDate } from "./content";
import { SourceStatusBanner } from "./sourceStatus";
import { cn } from "@/lib/utils";
import openingsRaw from "../data/openings.json";
import {
  OPENINGS_EMPTY_BODY,
  OPENINGS_EMPTY_TITLE,
  loadOpenings,
  statusDisplay,
  statusLabel,
} from "../../scripts/lib/openings-radar.mjs";

type OpeningStatus = "permit filed" | "opening";

type OpeningSource = {
  kind: string;
  label: string;
  url?: string;
  date?: number;
};

type OpeningRecord = {
  id: string;
  name: string;
  address: string;
  zip: string;
  category: string;
  permitIssuedAt: number;
  firstSalesAt?: number;
  sources: OpeningSource[];
};

const ALL_OPENINGS: OpeningRecord[] = loadOpenings(openingsRaw) as OpeningRecord[];

function asStatus(value: string): OpeningStatus {
  return value === "opening" ? "opening" : "permit filed";
}

function statusClass(status: OpeningStatus): string {
  switch (status) {
    case "opening":
      return "font-bold text-[#bc4519]";
    case "permit filed":
      return "font-bold text-navy/70";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function sourceLine(source: OpeningSource): string {
  const when = source.date ? formatDate(source.date) : null;
  return when ? `${source.label} · ${when}` : source.label;
}

function EmptyFeed({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="border-dashed border-border bg-muted">
      <CardContent className={cn("pt-6", compact && "p-8 text-center")}>
        <h3 className="font-semibold text-navy">{OPENINGS_EMPTY_TITLE}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{OPENINGS_EMPTY_BODY}</p>
      </CardContent>
    </Card>
  );
}

function OpeningRow({ opening }: { opening: OpeningRecord }) {
  const status = asStatus(statusLabel(opening.sources));
  const mapsQuery = `${opening.name} ${opening.address} Leander TX ${opening.zip}`.trim();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  return (
    <article className="flex items-start gap-3 px-3.5 py-3 sm:px-4 @min-[42rem]:rounded-2xl @min-[42rem]:border @min-[42rem]:border-border @min-[42rem]:bg-card @min-[42rem]:shadow-[0_1px_2px_rgba(22,50,79,0.07)]">
      <CompanyMark name={opening.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h3 className="text-[15px] font-bold leading-snug text-navy">{opening.name}</h3>
          <span className={statusClass(status)}>{statusDisplay(status)}</span>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {opening.category || "Local business"}
          {opening.address ? ` · ${opening.address}` : ""}
          {opening.zip ? `, ${opening.zip}` : ""}
        </p>
        {opening.firstSalesAt ? (
          <p className="mt-0.5 text-[13px] text-foreground/80">
            Permit lists first sales {formatDate(opening.firstSalesAt)}
          </p>
        ) : null}
        <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
          {opening.sources.map((source) => (
            <li key={`${source.kind}-${source.label}-${source.date ?? ""}`}>
              {source.url ? (
                <a
                  href={source.url}
                  className="hover:text-navy hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {sourceLine(source)}
                </a>
              ) : (
                sourceLine(source)
              )}
            </li>
          ))}
        </ul>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 shrink-0 text-primary hover:text-navy"
        aria-label={`Directions to ${opening.name}`}
      >
        <MapPin className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

export function OpeningsBoard() {
  return (
    <div className="@container">
      <SourceStatusBanner kind="openings" />
      <p className="mb-4 text-sm text-muted-foreground">
        A sales-tax permit is an intent to open, not proof a storefront is
        open. Listings stay labeled <strong>permit filed</strong> until a
        second source — such as a Chamber ribbon cutting — confirms an
        opening.
      </p>
      <p className="mb-4 text-sm font-semibold text-foreground/70">
        {ALL_OPENINGS.length === 1
          ? "1 recent permit"
          : `${ALL_OPENINGS.length} recent permits`}
        {" "}in Leander
      </p>
      {ALL_OPENINGS.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(22,50,79,0.07)] @min-[42rem]:grid @min-[42rem]:grid-cols-2 @min-[42rem]:gap-3 @min-[42rem]:divide-y-0 @min-[42rem]:overflow-visible @min-[42rem]:rounded-none @min-[42rem]:border-0 @min-[42rem]:bg-transparent @min-[42rem]:shadow-none">
          {ALL_OPENINGS.map((opening) => (
            <OpeningRow key={opening.id} opening={opening} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OpeningsPreview() {
  const preview = ALL_OPENINGS.slice(0, 3);
  return (
    <section aria-label="Coming soon to Leander" className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Permit radar
          </p>
          <h2 className="font-display mt-1 text-3xl font-bold text-navy">
            Coming soon to Leander
          </h2>
          <p className="mt-1.5 text-[15px] text-stone-600">
            Recent storefront permits. A permit alone is labeled permit filed,
            not an opening.
          </p>
        </div>
        <Button asChild variant="link" className="h-auto px-0 font-semibold text-primary">
          <Link to="/openings">
            All permits <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      {preview.length === 0 ? (
        <EmptyFeed compact />
      ) : (
        <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(22,50,79,0.07)]">
          <CardContent className="divide-y divide-border p-0">
            {preview.map((opening) => {
              const status = asStatus(statusLabel(opening.sources));
              return (
                <Link
                  key={opening.id}
                  to="/openings"
                  className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/70 sm:px-4"
                  aria-label={`${opening.name} — ${statusDisplay(status)}`}
                >
                  <CompanyMark name={opening.name} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[15px] font-bold leading-snug text-navy">
                      {opening.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                      {opening.category}
                      {opening.address ? ` · ${opening.address}` : ""}
                    </span>
                    <span className={cn("mt-0.5 block text-[13px]", statusClass(status))}>
                      {statusDisplay(status)}
                      {opening.sources[0]?.date
                        ? ` · ${formatDate(opening.sources[0].date)}`
                        : ""}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export function OpeningsPage() {
  return (
    <>
      <PageHero
        eyebrow="Permit radar"
        title="Coming soon to Leander"
        subtitle="Recent Texas sales-tax permits for Leander storefronts. A permit is labeled “permit filed” until a second source confirms an opening."
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
        <OpeningsBoard />
      </main>
    </>
  );
}
