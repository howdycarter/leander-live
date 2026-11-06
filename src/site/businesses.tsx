import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowUpRight, Building2, ChevronRight, MapPin, Search, Star } from "lucide-react";
import type { Business } from "../data/types";
import businessesRaw from "../data/businesses.json";
import { CompanyMark, FeaturedJobBadge, formatDate } from "./content";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { cn } from "@/lib/utils";
import { PageHero } from "./conceptA";
import { BusinessChat } from "./businessChat";

/* Business directory data lives in this module on purpose: it is the site's
   largest dataset (800+ permit records) and this module is route-split, so
   the directory JSON only loads when a visitor opens /businesses. */

/** Business directory (Texas sales-tax permit records, NAICS-gated to
    storefront/service businesses — see scripts/scrape-businesses.mjs).
    Featured placements first, then A–Z. */
export const ALL_BUSINESSES: Business[] = (businessesRaw as Business[])
  .slice()
  .sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name),
  );

export type BusinessItem = Business;

/* ---------------- business directory (static JSON) ---------------- */

/** "Opening soon" = the permit's first-sales date is still ahead.
    "New" = permit issued within the last 90 days. Both derive from the
    permit record itself — no editorializing. */
function businessFreshness(b: BusinessItem, now: number): "opening" | "new" | null {
  if (b.firstSalesAt && b.firstSalesAt > now) return "opening";
  if (b.permitIssuedAt && now - b.permitIssuedAt < 90 * 24 * 3600 * 1000) return "new";
  return null;
}

export function BusinessRow({
  business,
  onSelect,
}: {
  business: BusinessItem;
  onSelect?: () => void;
}) {
  const fresh = businessFreshness(business, Date.now());
  const inner = (
    <>
      <CompanyMark name={business.name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <span className="line-clamp-2 text-body font-bold leading-snug text-navy">
            {business.name}
          </span>
          {business.featured && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" aria-label="Featured business" />
          )}
        </span>
        <span className="mt-0.5 block truncate text-small text-muted-foreground">
          {business.category} · {business.address}
        </span>
        {(fresh || business.featured) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-small">
            {fresh === "opening" && (
              <span className="font-bold text-[#bc4519]">Opening soon</span>
            )}
            {fresh === "new" && <span className="font-bold text-[#60712f]">New in town</span>}
            {business.featured && <FeaturedJobBadge />}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" aria-hidden="true" />
    </>
  );
  const rowClass =
    "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/70 sm:px-4 @min-[42rem]:rounded-2xl @min-[42rem]:border @min-[42rem]:border-border @min-[42rem]:bg-card @min-[42rem]:shadow-[0_1px_2px_rgba(22,50,79,0.07)]";
  if (!onSelect) {
    return <div className={rowClass}>{inner}</div>;
  }
  return (
    <Button asChild variant="ghost" className={cn(rowClass, "h-auto justify-start whitespace-normal rounded-none font-normal hover:text-foreground")}>
      <button type="button" onClick={onSelect} aria-label={`${business.name} — view details`}>
        {inner}
      </button>
    </Button>
  );
}

function BusinessDetailContent({ business }: { business: BusinessItem }) {
  const fresh = businessFreshness(business, Date.now());
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${business.name} ${business.address} Leander TX ${business.zip}`,
  )}`;
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-[22px] font-extrabold leading-tight tracking-tight text-navy">
          {business.name}
        </DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-1 pt-0.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {business.category}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {business.address}, Leander, TX {business.zip}
            </span>
          </div>
        </DialogDescription>
      </DialogHeader>
      {(fresh || business.permitIssuedAt) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted px-4 py-3 text-sm">
          {fresh === "opening" && business.firstSalesAt && (
            <span className="font-bold text-[#bc4519]">
              Opening soon — first sales {formatDate(business.firstSalesAt)}
            </span>
          )}
          {fresh === "new" && <span className="font-bold text-[#60712f]">New in town</span>}
          {business.permitIssuedAt && (
            <span className="text-muted-foreground">
              Permit issued {formatDate(business.permitIssuedAt)}
            </span>
          )}
          {business.featured && <FeaturedJobBadge />}
        </div>
      )}
      <p className="text-sm leading-relaxed text-foreground/90">
        {business.name} is listed in the Texas sales-tax permit records for
        Leander{business.firstSalesAt ? `, with first sales recorded ${formatDate(business.firstSalesAt)}` : ""}.
        A permit shows a business is registered to open — hours and opening
        status can change, so check before you go.
      </p>
      <Button asChild className="w-full rounded-full" size="lg">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          Directions <ArrowUpRight className="h-4 w-4" />
        </a>
      </Button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        Directory data: Texas Comptroller sales-tax permit records. Confirm current details with the business.
      </p>
    </DialogContent>
  );
}

export function BusinessesBoard({
  selected,
  onSelect,
}: {
  selected: BusinessItem | null;
  onSelect: (business: BusinessItem | null) => void;
}) {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  // Hero quick chips land here with ?cat= — honor a real category name
  // (e.g. "Restaurants & Food") as the initial filter, ignore the rest.
  const [category, setCategory] = useState<string>(() => {
    const cat = searchParams.get("cat");
    return cat && ALL_BUSINESSES.some((b) => b.category === cat) ? cat : "All";
  });

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of ALL_BUSINESSES) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_BUSINESSES.filter((b) => {
      if (category !== "All" && b.category !== category) return false;
      if (q && !`${b.name} ${b.category} ${b.address}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, category]);

  return (
    <div className="@container">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground/70">
          {filtered.length === 1 ? "1 business" : `${filtered.length} businesses`}
          {category !== "All" || query.trim() ? " · filtered" : " in Leander"}
        </p>
      </div>

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants, salons, repair…"
          className="rounded-full bg-white pl-10"
          aria-label="Search businesses"
        />
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ChipGroup
          label="Filter by category"
          multiple={false}
          options={["All", ...categories].map((c) => ({
            value: c,
            label: c === "All" ? "All categories" : c,
          }))}
          value={[category]}
          onValueChange={(v) => setCategory(v[0] ?? "All")}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No businesses match that"
          description="Try a different search or category — the directory covers every storefront and service business with an active Leander sales-tax permit."
          action={
            <Button
              variant="outline"
              className="rounded-full font-semibold"
              onClick={() => {
                setQuery("");
                setCategory("All");
              }}
            >
              Clear search & filters
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(22,50,79,0.07)] @min-[42rem]:grid @min-[42rem]:grid-cols-2 @min-[42rem]:gap-3 @min-[42rem]:divide-y-0 @min-[42rem]:overflow-visible @min-[42rem]:rounded-none @min-[42rem]:border-0 @min-[42rem]:bg-transparent @min-[42rem]:shadow-none @min-[64rem]:grid-cols-3">
          {filtered.map((business) => (
            <BusinessRow
              key={business.id}
              business={business}
              onSelect={() => onSelect(business)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) onSelect(null);
        }}
      >
        {selected && <BusinessDetailContent business={selected} />}
      </Dialog>
    </div>
  );
}
/* ---------------- business directory page ---------------- */

export function BusinessesPage() {
  const [selected, setSelected] = useState<BusinessItem | null>(null);
  return (
    <>
      <PageHero
        eyebrow="Local directory"
        title="Businesses in Leander"
        subtitle="Ask in plain language — answers name real businesses from Texas permit records (name, category, address, ZIP, and permit dates only). The full directory is below if you would rather browse."
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
        <BusinessChat
          listings={ALL_BUSINESSES}
          onSelectBusiness={(id) => {
            const listing = ALL_BUSINESSES.find((business) => business.id === id) ?? null;
            setSelected(listing);
          }}
        />
        <h2 className="font-display mb-3 text-xl font-extrabold text-navy">
          Browse the directory
        </h2>
        <BusinessesBoard selected={selected} onSelect={setSelected} />
      </main>
    </>
  );
}
