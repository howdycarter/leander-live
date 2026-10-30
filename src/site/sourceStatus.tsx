/** Read-only presentation of the source-compliance contract (PR #15).
 * Optional at build time so this UI branch can be reviewed before that stack lands.
 * Missing status means unknown freshness, never a successful refresh.
 */
export interface SourceStatusRow { id: string; state: "paused" | "ok" | "failed"; reason: string | null; basis: string | null; lastSuccessAt: string | null; checkedAt: string; recordsKept: number; historical: boolean }
const files = import.meta.glob<{ default: SourceStatusRow[] }>("../data/source-status.json", { eager: true });
const rows = Object.values(files)[0]?.default ?? [];
export type ListingSource = { source?: string; company?: string; id?: string };
export function sourceStatusFor(item: ListingSource): SourceStatusRow | undefined {
  const id = item.source === "city-calendar" ? "leandertx-city-calendar"
    : item.company === "City of Leander" ? "governmentjobs-city-of-leander"
    : item.company === "Williamson County" ? "governmentjobs-williamson-county"
    : item.company === "Leander ISD" || item.source === "applitrack" ? "lisd-applitrack-jobs"
    : item.id?.startsWith("lisd-board-") ? "lisd-board-agendas" : undefined;
  return rows.find(row => row.id === id);
}
export function statusText(row?: SourceStatusRow): string {
  if (!row) return "Freshness not verified — check the source";
  if (row.state === "paused") return row.historical ? "Source paused · Historical listing" : "Source updates paused";
  if (row.state === "failed") return "Latest refresh failed — check the source";
  const date = row.lastSuccessAt && new Date(row.lastSuccessAt);
  return date && Number.isFinite(date.getTime()) ? `Source refreshed ${date.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}` : "Last successful refresh unknown";
}
export function ListingStatus({ item }: { item: ListingSource }) { const status = sourceStatusFor(item); return <p className={`listing-status${status?.state === "paused" ? " is-paused" : ""}`}>{statusText(status)}</p>; }
export function SourceStatusBanner({ kind }: { kind: "jobs" | "events" | "civic" }) {
  const relevant = rows.filter(row => kind === "jobs" ? /jobs|governmentjobs/.test(row.id) : kind === "events" ? row.id === "leandertx-city-calendar" : /board-agendas|city-news/.test(row.id));
  const paused = relevant.some(row => row.state === "paused");
  return <aside className="source-status-banner" aria-label="Listing freshness"><strong>{paused ? "Some source updates are paused." : "Check the source before making plans."}</strong><span>{paused ? "Previously collected listings are kept for reference and may be out of date. A past listing is not confirmation of current availability." : "These are collected listings, not a live availability feed. A last successful update is not recorded for every source."}</span>{paused && <span>Sources without a status record are not assumed paused.</span>}</aside>;
}
