import { useMemo, useState, type ButtonHTMLAttributes, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trackEvent } from "./analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CircleCheck,
  Clock,
  Heart,
  Leaf,
  MapPin,
  Music,
  Plus,
  Search,
  Send,
  Star,
  TreePine,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- constants ---------------- */

const CATEGORIES = ["Music", "Food & Drink", "Family", "Outdoors", "Learn", "Community"] as const;

const SUBSCRIBER_INTERESTS = [
  "Families",
  "Food & Drink",
  "Home & Garden",
  "Nightlife",
  "Arts & Culture",
] as const;

const BUSINESS_VERTICALS = [
  "Home Services",
  "Real Estate",
  "Restaurant/Food",
  "Health & Wellness",
  "Events/Venues",
  "Other",
] as const;

const BUSINESS_INTERESTS = ["Featured listing", "Buy leads", "Sponsored event"] as const;

const DATE_FILTERS = ["All", "Today", "This Weekend", "This Month"] as const;
export type DateFilter = (typeof DATE_FILTERS)[number];

/* Category badge accents sampled from the approved mockups. */
const CATEGORY_STYLE: Record<string, { label: string; color: string; soft: string; Icon: LucideIcon }> = {
  Music: { label: "Music", color: "#c93a3a", soft: "#fbe7e7", Icon: Music },
  "Food & Drink": { label: "Food & Drink", color: "#d97a1f", soft: "#fceedb", Icon: UtensilsCrossed },
  Family: { label: "Family", color: "#7c5cd6", soft: "#ece5fa", Icon: Users },
  Outdoors: { label: "Outdoors", color: "#7a8f3c", soft: "#ebf1da", Icon: TreePine },
  Learn: { label: "Learning", color: "#2f7fd0", soft: "#e2eefb", Icon: BookOpen },
  Community: { label: "Community", color: "#4c8c4a", soft: "#e6f2e3", Icon: Leaf },
};
const DEFAULT_CATEGORY = { label: "Community", color: "#4c8c4a", soft: "#e6f2e3", Icon: Leaf };

/* Photo shown on an event card: the event's own image, else a category fallback. */
const CATEGORY_IMAGE: Record<string, string> = {
  Music: "/images/event-music-park.jpg",
  "Food & Drink": "/images/event-food-truck.jpg",
  Family: "/images/event-kids-craft.jpg",
  Outdoors: "/images/event-sunrise-yoga.jpg",
  Learn: "/images/event-resume-workshop.jpg",
  Community: "/images/event-night-market.jpg",
};

/* ---------------- helpers ---------------- */

export function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function endOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

export function inRange(startsAt: number, filter: DateFilter, now: Date): boolean {
  const day = startOfDay(now);
  switch (filter) {
    case "All":
      return true;
    case "Today":
      return startsAt >= day.getTime() && startsAt <= endOfDay(now).getTime();
    case "This Weekend": {
      const dow = day.getDay();
      const daysToSat = (6 - dow + 7) % 7;
      const sat = new Date(day);
      sat.setDate(sat.getDate() + daysToSat);
      const sunEnd = endOfDay(new Date(sat.getTime() + 86400000));
      return startsAt >= sat.getTime() && startsAt <= sunEnd.getTime();
    }
    case "This Month": {
      const end = new Date(day.getFullYear(), day.getMonth() + 1, 0, 23, 59, 59, 999);
      return startsAt >= day.getTime() && startsAt <= end.getTime();
    }
  }
}

function toggleInList(prev: string[], item: string) {
  return prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item];
}

const PRIVACY_NOTE =
  "We use your info only for event updates and local business inquiries — never sold, never shared.";

/* ---------------- event feed ---------------- */

export type EventsResult = ReturnType<typeof useQuery<typeof api.events.listUpcoming>>;
export type EventItem = NonNullable<EventsResult>[number];

export function CategoryBadge({ event, className }: { event: EventItem; className?: string }) {
  const style = CATEGORY_STYLE[event.category ?? ""] ?? DEFAULT_CATEGORY;
  const Icon = style.Icon;
  return (
    <Badge
      className={cn("gap-1.5 rounded-full px-3 py-1", className)}
      style={{ backgroundColor: style.soft, color: style.color }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {style.label}
    </Badge>
  );
}

export function SaveButton({
  saved,
  onToggleSaved,
  className,
}: {
  saved: boolean;
  onToggleSaved: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggleSaved}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this event"}
      className={cn(
        "rounded-full [&_svg]:size-5",
        saved ? "text-[#c05a1e]" : "text-[#b09a7d] hover:text-[#c05a1e]",
        className,
      )}
    >
      <Heart className={cn("h-5 w-5", saved && "fill-current")} />
    </Button>
  );
}

export function EventCard({
  event,
  saved,
  onToggleSaved,
  className,
}: {
  event: EventItem;
  saved: boolean;
  onToggleSaved: () => void;
  className?: string;
}) {
  const img = event.image ?? CATEGORY_IMAGE[event.category ?? ""] ?? CATEGORY_IMAGE.Community;
  const title = event.url ? (
    <a href={event.url} target="_blank" rel="noreferrer" className="hover:text-[#b5431f] hover:underline">
      {event.title}
    </a>
  ) : (
    event.title
  );
  return (
    <Card className={cn("flex flex-col overflow-hidden border-[#eadbc3]", className)}>
      {/* Desktop: vertical card */}
      <div className="hidden flex-col sm:flex sm:flex-1">
        <div className="relative h-44 shrink-0 overflow-hidden">
          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
          <CategoryBadge
            event={event}
            className="absolute bottom-0 right-4 translate-y-1/2 shadow-sm"
          />
        </div>
        <CardHeader className="px-4 pb-1 pt-6">
          {isEventFeatured(event) && (
            <div className="mb-2">
              <FeaturedEventBadge />
            </div>
          )}
          <CardTitle className="text-[17px] font-bold leading-snug">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 px-4 py-0">
          <div className="flex flex-col gap-1.5 text-sm text-[#5c4f40]">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#a08b6d]" />
              {formatDate(event.startsAt)}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-[#a08b6d]" />
              {formatTime(event.startsAt)}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-[#a08b6d]" />
              {event.venue}
            </span>
          </div>
        </CardContent>
        <CardFooter className="justify-end px-3 pb-3 pt-1">
          <SaveButton saved={saved} onToggleSaved={onToggleSaved} />
        </CardFooter>
      </div>
      {/* Mobile: horizontal card */}
      <CardContent className="flex gap-3 p-3 sm:hidden">
        <img
          src={img}
          alt=""
          loading="lazy"
          className="h-28 w-28 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {isEventFeatured(event) && (
                <div className="mb-1">
                  <FeaturedEventBadge />
                </div>
              )}
              <CardTitle className="text-[17px] font-bold leading-snug">{title}</CardTitle>
            </div>
            <CategoryBadge event={event} className="shrink-0 px-2 py-0.5 text-[11px]" />
          </div>
          <div className="mt-1.5 flex flex-col gap-1 text-sm text-[#5c4f40]">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#a08b6d]" />
              {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#a08b6d]" />
              <span className="truncate">{event.venue}</span>
            </span>
          </div>
          {event.description && (
            <CardDescription className="mt-1 hidden truncate text-[13px] sm:block">
              {event.description}
            </CardDescription>
          )}
        </div>
        <SaveButton saved={saved} onToggleSaved={onToggleSaved} className="self-center" />
      </CardContent>
    </Card>
  );
}

/* Filter pill built on the shadcn Button primitive: the default (active) /
   outline (inactive) variants carry the color story, with pill overrides
   for the mockup look (rounded-full, auto height, cream-theme borders). */
export function FilterPill({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      className={cn(
        "h-auto cursor-pointer rounded-full border border-transparent px-4 py-2 text-sm font-medium hover:bg-primary/80",
        !active &&
          "border-[#eadbc3] bg-white text-[#4a3d2f] shadow-none hover:border-[#db5a1e] hover:bg-white hover:text-[#b5431f]",
        className,
      )}
      {...props}
    />
  );
}

export function FeedFilters({
  query,
  setQuery,
  dateFilter,
  setDateFilter,
  category,
  setCategory,
  onSubmit,
}: {
  query: string;
  setQuery: (v: string) => void;
  dateFilter: DateFilter;
  setDateFilter: (v: DateFilter) => void;
  category: string;
  setCategory: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events, places, or categories…"
          aria-label="Search events"
          className="h-12 rounded-full border-[#eadbc3] bg-white pl-11"
        />
      </div>

      <Button onClick={onSubmit} className="h-12 rounded-full text-base font-semibold md:hidden">
        <Plus className="h-5 w-5 rounded-full bg-white/25" /> Submit Event
        <ArrowRight className="h-4 w-4" />
      </Button>

      {/* Desktop filter row */}
      <div className="hidden items-center gap-2 md:flex" role="group" aria-label="Filter events">
        {DATE_FILTERS.map((f) => (
          <FilterPill key={f} active={dateFilter === f} onClick={() => setDateFilter(f)}>
            {f}
          </FilterPill>
        ))}
        <Separator orientation="vertical" className="mx-2 h-6 bg-[#eadbc3]" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger
            aria-label="Filter by category"
            className="h-10 w-auto gap-2 rounded-full border-[#eadbc3] bg-white px-4 text-sm font-medium text-[#4a3d2f]"
          >
            <SelectValue>{category === "All" ? "All Categories" : category}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {["All", ...CATEGORIES].map((c) => (
              <SelectItem key={c} value={c}>
                {c === "All" ? "All Categories" : c === "Learn" ? "Learning" : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile category pills */}
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden"
        role="group"
        aria-label="Filter by category"
      >
        {["All", ...CATEGORIES].map((c) => (
          <FilterPill
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            className="shrink-0"
          >
            {c === "Learn" ? "Learning" : c}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}

/* ---------------- submit event dialog ---------------- */

export function SubmitDialogContent() {
  const submit = useMutation(api.events.submit);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState<string>("");
  const [url, setUrl] = useState("");
  const [when, setWhen] = useState(() => toLocalInputValue(new Date(Date.now() + 7 * 86400000)));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setVenue("");
    setCategory("");
    setUrl("");
    setWhen(toLocalInputValue(new Date(Date.now() + 7 * 86400000)));
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await submit({
        title,
        description,
        venue,
        category: category ? (category as (typeof CATEGORIES)[number]) : undefined,
        url: url.trim() || undefined,
        startsAt: new Date(when).getTime(),
      });
      setSent(true);
      reset();
      trackEvent("event_submitted", { category: category || "uncategorized" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Submit an event</DialogTitle>
        <DialogDescription>
          Community submissions are reviewed before they appear on the board.
        </DialogDescription>
      </DialogHeader>
      {sent ? (
        <div className="flex flex-col items-start gap-4 py-2">
          <Alert>
            <CircleCheck className="h-4 w-4 text-secondary" />
            <AlertDescription>
              🎉 Got it — your event was submitted and is pending review.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => setSent(false)}>
            Submit another
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ev-title">Event name</Label>
            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Friday Night Market" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required placeholder="What should people expect?" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ev-when">Date &amp; time</Label>
              <Input id="ev-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-venue">Venue</Label>
              <Input id="ev-venue" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={160} required placeholder="Robin Bledsoe Park" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c === "Learn" ? "Learning" : c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-url">Link (optional)</Label>
              <Input id="ev-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={sending}>
            {sending ? "Submitting…" : "Submit event"}
          </Button>
        </form>
      )}
    </DialogContent>
  );
}

/* ---------------- jobs board ---------------- */

const JOB_TYPES = ["full-time", "part-time", "contract", "temporary"] as const;

const JOB_TYPE_LABEL: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  temporary: "Temporary",
};

/* Job-type badge accents (same soft-pill language as the event categories). */
const JOB_TYPE_STYLE: Record<string, { color: string; soft: string }> = {
  "full-time": { color: "#2f7fd0", soft: "#e2eefb" },
  "part-time": { color: "#7c5cd6", soft: "#ece5fa" },
  contract: { color: "#d97a1f", soft: "#fceedb" },
  temporary: { color: "#7a8f3c", soft: "#ebf1da" },
};

export type JobsResult = ReturnType<typeof useQuery<typeof api.jobs.listJobs>>;
export type JobItem = NonNullable<JobsResult>[number];

function JobTypeBadge({ type }: { type: string }) {
  const style = JOB_TYPE_STYLE[type] ?? JOB_TYPE_STYLE["full-time"];
  return (
    <Badge
      className="gap-1 rounded-full px-2.5 py-0.5"
      style={{ backgroundColor: style.soft, color: style.color }}
    >
      <Briefcase className="h-3 w-3" aria-hidden="true" />
      {JOB_TYPE_LABEL[type] ?? type}
    </Badge>
  );
}

function FeaturedJobBadge() {
  return (
    <Badge className="gap-1 rounded-full bg-accent px-2.5 py-0.5 text-accent-foreground">
      <Star className="h-3 w-3" aria-hidden="true" />
      Featured
    </Badge>
  );
}

/** True while an event's paid featured placement is active. */
export function isEventFeatured(event: { featuredUntil?: number }): boolean {
  return (event.featuredUntil ?? 0) > Date.now();
}

export function FeaturedEventBadge() {
  return (
    <Badge className="gap-1 rounded-full bg-accent px-2.5 py-0.5 text-accent-foreground">
      <Star className="h-3 w-3" aria-hidden="true" />
      Sponsored
    </Badge>
  );
}

function PayBadge({ payRange }: { payRange: string }) {
  return (
    <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
      {payRange}
    </Badge>
  );
}

function JobCard({ job, onSelect }: { job: JobItem; onSelect: () => void }) {
  return (
    <Card
      className="flex cursor-pointer flex-col transition-shadow hover:shadow-md"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${job.title} at ${job.company} — view details`}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {job.featured && <FeaturedJobBadge />}
          <JobTypeBadge type={job.type} />
          {job.payRange && <PayBadge payRange={job.payRange} />}
        </div>
        <CardTitle className="pt-1.5 font-display text-xl leading-snug">
          {job.title}
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {job.company}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {job.location}
        </p>
        <p className="mt-2 line-clamp-3 text-sm">{job.description}</p>
      </CardContent>
      <CardFooter>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#b5431f]">
          View details &amp; apply <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </CardFooter>
    </Card>
  );
}

function JobDetailContent({ job }: { job: JobItem }) {
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          {job.featured && <FeaturedJobBadge />}
          <JobTypeBadge type={job.type} />
          {job.payRange && <PayBadge payRange={job.payRange} />}
        </div>
        <DialogTitle className="font-display text-2xl">{job.title}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-1 pt-1">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {job.company}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {job.location}
            </span>
          </div>
        </DialogDescription>
      </DialogHeader>
      <p className="whitespace-pre-line text-sm leading-relaxed">{job.description}</p>
      <Button asChild className="w-full">
        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
          Apply now <ArrowUpRight className="h-4 w-4" />
        </a>
      </Button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        You&rsquo;ll apply on the employer&rsquo;s site.
      </p>
    </DialogContent>
  );
}

function PostJobDialogContent() {
  const submit = useMutation(api.jobs.submitJob);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("Leander, TX");
  const [type, setType] = useState<string>("full-time");
  const [payRange, setPayRange] = useState("");
  const [description, setDescription] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  function reset() {
    setTitle("");
    setCompany("");
    setLocation("Leander, TX");
    setType("full-time");
    setPayRange("");
    setDescription("");
    setApplyUrl("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await submit({
        title,
        company,
        location,
        type: type as (typeof JOB_TYPES)[number],
        payRange: payRange.trim() || undefined,
        description,
        applyUrl,
      });
      setSent(true);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Post a job</DialogTitle>
        <DialogDescription>
          Job posts are reviewed before they appear on the board.
        </DialogDescription>
      </DialogHeader>
      {sent ? (
        <div className="flex flex-col items-start gap-4 py-2">
          <Alert>
            <CircleCheck className="h-4 w-4 text-secondary" />
            <AlertDescription>
              Thanks — your job was submitted and is pending review.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => setSent(false)}>
            Post another
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="job-title">Job title</Label>
              <Input
                id="job-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
                placeholder="Line Cook"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-company">Company</Label>
              <Input
                id="job-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={120}
                required
                placeholder="Main Street Diner"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="job-location">Location</Label>
              <Input
                id="job-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={160}
                required
                placeholder="Leander, TX"
              />
            </div>
            <div className="grid gap-2">
              <Label>Job type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {JOB_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="job-pay">Pay range (optional)</Label>
              <Input
                id="job-pay"
                value={payRange}
                onChange={(e) => setPayRange(e.target.value)}
                maxLength={80}
                placeholder="$16–$19/hr"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-apply">Apply link</Label>
              <Input
                id="job-apply"
                type="url"
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                required
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="job-desc">Description</Label>
            <Textarea
              id="job-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              placeholder="What does the role involve? Any requirements?"
            />
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
            <Checkbox id="job-featured" disabled />
            <div className="grid gap-1">
              <Label htmlFor="job-featured" className="text-muted-foreground">
                Feature this job — coming soon
              </Label>
              <p className="text-xs text-muted-foreground">
                Paid featured placement is on the way. Posting is free for now.
              </p>
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={sending}>
            {sending ? "Posting…" : "Post job"}
          </Button>
        </form>
      )}
    </DialogContent>
  );
}

export function JobsBoard() {
  const jobs = useQuery(api.jobs.listJobs, {});
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [postOpen, setPostOpen] = useState(false);
  const [selected, setSelected] = useState<JobItem | null>(null);

  const filtered = useMemo(
    () => (jobs ?? []).filter((j) => typeFilter === "All" || j.type === typeFilter),
    [jobs, typeFilter],
  );

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => setPostOpen(true)}
          className="rounded-full bg-[#b5431f] font-semibold text-white hover:bg-[#9c3a1a]"
        >
          <Plus className="h-4 w-4" /> Post a job
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Label htmlFor="job-type-filter" className="text-sm font-medium">
          Job type
        </Label>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger id="job-type-filter" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All types</SelectItem>
            {JOB_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {JOB_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {typeFilter !== "All" && (
          <Button
            variant="link"
            onClick={() => setTypeFilter("All")}
            className="h-auto px-0 text-sm font-semibold text-[#b5431f]"
          >
            Clear filter
          </Button>
        )}
      </div>

      {jobs === undefined ? (
        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Loading jobs"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">No jobs here yet</h3>
            <p className="text-sm text-muted-foreground">
              {typeFilter !== "All"
                ? "Try a different job type — or post the opening yourself."
                : "Be the first to post a local opening."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {filtered.length === 1 ? "1 opening" : `${filtered.length} openings`}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((job) => (
              <JobCard key={job._id} job={job} onSelect={() => setSelected(job)} />
            ))}
          </div>
        </>
      )}

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <PostJobDialogContent />
      </Dialog>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && <JobDetailContent job={selected} />}
      </Dialog>
    </div>
  );
}

/* ---------------- lead forms ---------------- */

export function RemindersForm() {
  const subscribe = useMutation(api.leads.subscribe);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await subscribe({
        name,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        interests,
        smsOptIn,
      });
      setDone(true);
      trackEvent("reminder_subscribed", {
        sms_opt_in: smsOptIn,
        interest_count: interests.length,
      });
      setName("");
      setEmail("");
      setPhone("");
      setInterests([]);
      setSmsOptIn(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Get event reminders
        </CardTitle>
        <CardDescription>Tell us what you love and we'll send the good stuff your way.</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="flex flex-col items-start gap-4">
            <Alert>
              <CircleCheck className="h-4 w-4 text-secondary" />
              <AlertDescription>
                🎉 You&apos;re in! Watch for Leander events coming your way.
              </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => setDone(false)}>Add another person</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rm-name">Name</Label>
              <Input id="rm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required placeholder="Your name" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rm-email">Email</Label>
                <Input id="rm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rm-phone">Phone</Label>
                <Input id="rm-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(512) 555-0123" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">At least one of email or phone is required.</p>
            <div className="grid gap-2">
              <Label>I&apos;m interested in</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SUBSCRIBER_INTERESTS.map((i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox checked={interests.includes(i)} onCheckedChange={() => setInterests((prev) => toggleInList(prev, i))} />
                    {i}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{PRIVACY_NOTE}</p>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
              <Checkbox
                checked={smsOptIn}
                onCheckedChange={(v) => setSmsOptIn(v === true)}
                className="mt-0.5"
                aria-label="Text me event reminders"
              />
              <span>
                Text me reminders too
                <span className="block text-xs text-muted-foreground">
                  I agree to receive automated text messages from Leander Live at the number
                  above. Message &amp; data rates may apply. Reply STOP to opt out.
                </span>
              </span>
            </label>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={sending}>
              {sending ? "Signing you up…" : "Sign me up"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function BusinessForm() {
  const submitLead = useMutation(api.leads.submitBusinessLead);
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vertical, setVertical] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [doneName, setDoneName] = useState({ contact: "", business: "" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await submitLead({
        businessName,
        contactName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        vertical,
        interests,
      });
      setDoneName({ contact: contactName, business: businessName });
      setDone(true);
      trackEvent("business_lead_submitted", {
        vertical,
        interest_count: interests.length,
      });
      setBusinessName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setVertical("");
      setInterests([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-secondary" /> Tell us about your business
        </CardTitle>
        <CardDescription>We&apos;ll reach out with ways to get in front of Leander.</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="flex flex-col items-start gap-4">
            <Alert>
              <CircleCheck className="h-4 w-4 text-secondary" />
              <AlertDescription>
                🎉 Thanks, {doneName.contact ? doneName.contact.split(" ")[0] : "there"}! We&apos;ll be in
                touch about <strong>{doneName.business}</strong> soon.
              </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => setDone(false)}>Submit another business</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bz-name">Business name</Label>
                <Input id="bz-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={160} required placeholder="Main Street Bakery" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bz-contact">Contact name</Label>
                <Input id="bz-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={120} required placeholder="Your name" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bz-email">Email</Label>
                <Input id="bz-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bz-phone">Phone</Label>
                <Input id="bz-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(512) 555-0123" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">At least one of email or phone is required.</p>
            <div className="grid gap-2">
              <Label>Business vertical</Label>
              <Select value={vertical} onValueChange={setVertical} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a vertical…" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_VERTICALS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>I&apos;m interested in</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {BUSINESS_INTERESTS.map((i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox checked={interests.includes(i)} onCheckedChange={() => setInterests((prev) => toggleInList(prev, i))} />
                    {i}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{PRIVACY_NOTE}</p>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={sending}>
              {sending ? "Sending…" : "Get in touch"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- about / crosspromo ---------------- */

export function About() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">About Leander</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-[15px] leading-relaxed">
        <p>
          <strong>Lee-AN-der</strong>, Texas was founded in <strong>1882</strong> when the
          Austin and Northwestern Railroad built through — named for railroad official
          Leander &quot;Catfish&quot; Brown. The town grew from the older settlement of Bagdad
          (1854), bypassed by the rail line, and incorporated in 1978.
        </p>
        <p>
          Locals call themselves <strong>&quot;Leanderthals&quot;</strong> — a nod to the Leanderthal
          Lady, a 10,000–13,000-year-old skeleton discovered here in 1982 and one of North
          America&apos;s oldest intact burials.
        </p>
        <p>
          From <strong>59,202</strong> people in 2020 to an estimated <strong>~91,132</strong>{" "}
          in 2025 — the fastest-growing city in America in 2018–2019, now planning for
          250,000 — Leander keeps its Old Town soul while the new town booms around it.
        </p>
        <p>
          Anchor traditions: Old Town Street Festival (first Saturday of June), Liberty Fest
          (July 3 at Devine Lake Park), the Floating Pumpkin Patch, ArtFest, the Devine Lake
          Kite Festival, and the Old Town Christmas Festival.
        </p>
        <Separator />
        <p className="text-sm text-muted-foreground">
          <em>
            Leander Live was designed and built by{" "}
            <a href="https://howdycarter.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
              Howdy Carter
            </a>{" "}
            — one neighbor helping the whole town find its next favorite night out.
          </em>
        </p>
      </CardContent>
    </Card>
  );
}

export function CrossPromoCard() {
  return (
    <Card className="border-dashed border-accent bg-accent/10">
      <CardHeader>
        <CardTitle className="text-lg">Want a website that turns visitors into customers?</CardTitle>
        <CardDescription>
          Leander Live was designed and built by Howdy Carter — product fixes for local
          businesses, shipped fast.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <a href="https://howdycarter.com" target="_blank" rel="noopener noreferrer">
            See how <Send className="h-3.5 w-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
