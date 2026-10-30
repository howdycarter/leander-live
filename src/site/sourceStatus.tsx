/** Read-only UI for the reviewed source-compliance metadata. No fetches or source activation. */
import sourceRows from "../data/source-status.json";
import { Alert, AlertDescription } from "@/components/ui/alert";
export interface SourceStatusRow {
  id: string; state: "paused" | "ok" | "failed"; reason: string | null;
  basis: string | null; lastSuccessAt: string | null; checkedAt: string;
  recordsKept: number; historical: boolean;
}
const rows = sourceRows as SourceStatusRow[];
export type ListingSource = { source?: string; company?: string; id?: string };
export function sourceStatusFor(item: ListingSource): SourceStatusRow | undefined {
  const id = item.source === "leandertx-city-news" ? "leandertx-city-news"
    : item.source === "city-calendar" ? "leandertx-city-calendar"
    : item.company === "City of Leander" ? "governmentjobs-city-of-leander"
    : item.company === "Williamson County" ? "governmentjobs-williamson-county"
    : item.company === "Leander ISD" || item.source === "applitrack" ? "lisd-applitrack-jobs"
    : item.id?.startsWith("lisd-board-") ? "lisd-board-agendas" : undefined;
  return rows.find(row => row.id === id);
}
export function statusText(row?: SourceStatusRow): string {
  if (!row) return "Freshness not verified — check the source";
  const date = row.lastSuccessAt && new Date(row.lastSuccessAt);
  const last = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : null;
  const history = last ? ` · Last successful update ${last}` : " · Last successful update unknown";
  if (row.state === "paused") return (row.historical ? "Source paused · Historical listing" : "Source updates paused") + history;
  if (row.state === "failed") return "Latest refresh failed — check the source" + history;
  return last ? `Source refreshed ${last}` : "Last successful refresh unknown";
}
/** An inline note fits original compact rows without replacing their layout. */
export function ListingStatus({ item, compact = false }: { item: ListingSource; compact?: boolean }) {
  const status = sourceStatusFor(item);
  return <span className="mt-1 block text-xs font-normal leading-snug text-muted-foreground" title={statusText(status)}>{compact && status?.state === "paused" ? (status.historical ? "Source paused · Historical listing" : "Source updates paused") : statusText(status)}</span>;
}
export function SourceStatusBanner({ kind }: { kind: "jobs" | "events" | "civic" }) {
  const relevant = rows.filter(row => kind === "jobs" ? /jobs|governmentjobs/.test(row.id) : kind === "events" ? row.id === "leandertx-city-calendar" : /board-agendas|city-news/.test(row.id));
  const paused = relevant.some(row => row.state === "paused");
  return <Alert role="note" className="mb-4 rounded-xl border-border bg-muted text-foreground/80" aria-label="Listing freshness"><AlertDescription><strong className="font-semibold text-navy">{paused ? "Some source updates are paused. " : "Check the source before making plans. "}</strong>{paused ? "Previously collected listings are kept for reference and may be out of date. Confirm current availability with the source." : "These are collected listings, not a live availability feed."}</AlertDescription></Alert>;
}
