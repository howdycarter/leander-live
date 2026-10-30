/** Read-only UI for the reviewed source-compliance metadata. No fetches or source activation. */
import sourceRows from "../data/source-status.json";
import { Alert, AlertDescription } from "@/components/ui/alert";
export interface SourceStatusRow {
  id: string; state: "paused" | "ok" | "failed"; reason: string | null;
  basis: string | null; lastSuccessAt: string | null; checkedAt: string;
  recordsKept: number; historical: boolean;
}
const rows = sourceRows as SourceStatusRow[];
const SOURCE_LABELS: Record<string, string> = {
  'leandertx-city-calendar': 'City of Leander calendar',
  chamber: 'Leander Chamber events',
  'governmentjobs-city-of-leander': 'City of Leander job postings',
  'governmentjobs-williamson-county': 'Williamson County job postings',
  'lisd-applitrack-jobs': 'Leander ISD job postings',
  'lisd-board-agendas': 'Leander ISD board agendas',
  'leandertx-city-news': 'City of Leander news',
  'civicclerk-meetings': 'City board meetings (CivicClerk)',
  'tx-sales-tax-businesses': 'Texas sales-tax business directory',
};
export type ListingSource = { source?: string; company?: string; id?: string };
export function sourceStatusFor(item: ListingSource): SourceStatusRow | undefined {
  const id = item.source === "leandertx-city-news" ? "leandertx-city-news"
    : item.source === "city-calendar" ? "leandertx-city-calendar"
    : item.company === "City of Leander" ? "governmentjobs-city-of-leander"
    : item.company === "Williamson County" ? "governmentjobs-williamson-county"
    : item.company === "Leander ISD" || item.source === "applitrack" ? "lisd-applitrack-jobs"
    : item.id?.startsWith("lisd-board-") ? "lisd-board-agendas"
    : item.id?.startsWith("civic-") ? "civicclerk-meetings"
    : item.source === "chamber" ? "chamber"
    : item.source === "tx-sales-tax" ? "tx-sales-tax-businesses" : undefined;
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
type NoticeKind = "jobs" | "events" | "civic";
const NOTICE_SOURCES: Record<NoticeKind, string[]> = {
  events: ['leandertx-city-calendar', 'chamber'],
  jobs: ['governmentjobs-city-of-leander', 'governmentjobs-williamson-county', 'lisd-applitrack-jobs'],
  civic: ['civicclerk-meetings', 'lisd-board-agendas', 'leandertx-city-news'],
};
export function sourceNotice(kind: NoticeKind, statusRows: SourceStatusRow[] = rows) {
  const relevant = statusRows.filter(row => NOTICE_SOURCES[kind].includes(row.id));
  const affected = relevant.filter(row => row.state === 'paused' || row.state === 'failed');
  const failed = affected.some(row => row.state === 'failed');
  return {
    relevant, affected,
    title: failed ? 'Some source updates failed.' : affected.length ? 'Some source updates are paused.' : 'Check the source before making plans.',
  };
}
export function SourceStatusBanner({ kind }: { kind: NoticeKind }) {
  const { relevant, affected, title } = sourceNotice(kind);
  return <div className="mb-4"><Alert role="note" className="rounded-xl border-border bg-muted text-foreground/80" aria-label="Listing freshness"><AlertDescription>
    <strong className="font-semibold text-navy">{title} </strong>
    {affected.length > 0 ? <>This applies to {affected.map(row => SOURCE_LABELS[row.id]).join(', ')}. Previously collected listings from these sources may be out of date. Confirm details with the original source.</> : 'These are collected listings, not a live availability feed.'}
  </AlertDescription></Alert>
    {relevant.length > 0 && <details className="mt-2 px-4 text-sm text-muted-foreground" aria-label="Source freshness details"><summary className="cursor-pointer font-medium">Source details</summary><ul className="mt-1 space-y-1">{relevant.map(row => <li key={row.id}>{SOURCE_LABELS[row.id]}: {statusText(row)}</li>)}</ul></details>}
  </div>;
}
