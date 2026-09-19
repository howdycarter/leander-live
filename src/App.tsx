import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ChatWidget } from "./components/ChatWidget";
import { AdminLeads } from "./components/AdminLeads";
import { AccountButton, SignInDialog } from "./components/Auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  House,
  Leaf,
  MapPin,
  Menu,
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
type DateFilter = (typeof DATE_FILTERS)[number];

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

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(ms: number) {
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

function inRange(startsAt: number, filter: DateFilter, now: Date): boolean {
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
const SMS_COPY =
  "I agree to receive text reminders about Leander events from Leander Live at the number provided. Message and data rates may apply. Reply STOP to opt out.";

/* ---------------- header / hero / footer ---------------- */

function BrandLockup({ iconClass = "h-12 w-12" }: { iconClass?: string }) {
  return (
    <a href="#top" className="flex items-center gap-3" aria-label="Leander Live home">
      <img
        src="/logo-icon.png"
        alt="Leander Live logo"
        className={cn(iconClass, "rounded-2xl shadow-sm")}
      />
      <span className="leading-tight">
        <span className="font-display block text-[26px] font-bold text-[#b5431f]">
          Leander Live
        </span>
        <span className="block whitespace-nowrap text-xs text-[#6b5d4f]">
          Events. People. A Stronger Leander.
        </span>
      </span>
    </a>
  );
}

function Header({ onSubmit, onSignIn }: { onSubmit: () => void; onSignIn: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#eadbc3] bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="mx-auto flex min-h-[76px] max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <BrandLockup />
        <nav className="hidden items-center gap-7 whitespace-nowrap text-[15px] font-medium lg:flex" aria-label="Primary">
          <a
            href="#events"
            className="text-[#b5431f] underline decoration-2 underline-offset-8"
            aria-current="page"
          >
            Events
          </a>
          <a href="#events" className="text-[#4a3d2f] hover:text-[#b5431f]">
            Calendar
          </a>
          <a href="#jobs" className="text-[#4a3d2f] hover:text-[#b5431f]">
            Jobs
          </a>
          <button
            type="button"
            onClick={onSubmit}
            className="text-[#4a3d2f] hover:text-[#b5431f]"
          >
            Submit Event
          </button>
          <a href="#businesses" className="text-[#4a3d2f] hover:text-[#b5431f]">
            Community
          </a>
          <a href="#about" className="text-[#4a3d2f] hover:text-[#b5431f]">
            About
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="hidden h-10 w-10 rounded-full border-[#eadbc3] bg-white text-[#4a3d2f] hover:text-[#b5431f] sm:inline-flex"
          >
            <a href="#events" aria-label="Search events">
              <Search className="h-4 w-4" />
            </a>
          </Button>
          <Button onClick={onSubmit} className="hidden rounded-full px-5 sm:inline-flex">
            <Plus className="h-4 w-4" /> Submit Event
          </Button>
          <AccountButton onSignIn={onSignIn} />
          <p className="font-script hidden -rotate-3 whitespace-nowrap text-[22px] leading-none text-[#c05a1e] xl:block">
            Good Things Happen Here
            <Heart className="ml-1 inline h-4 w-4 fill-current" aria-hidden="true" />
          </p>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="h-14 w-full bg-cover bg-center md:h-[72px]"
        style={{ backgroundImage: "url(/images/skyline-strip.jpg)" }}
      />
    </header>
  );
}

function Hero() {
  return (
    <section aria-label="Welcome" className="px-4 pt-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl text-white">
        <img
          src="/images/hero-concert.jpg"
          alt="Golden-hour community concert in Leander"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10"
          aria-hidden="true"
        />
        <div className="relative max-w-2xl px-6 py-16 md:px-12 md:py-24">
          <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">
            Leander Live
          </h1>
          <p className="mt-3 text-xl font-semibold text-white/95 md:text-2xl">
            Real Events. A Stronger Community.
          </p>
          <p className="mt-4 max-w-xl text-white/85">
            Discover local events, support local people, and be part of what makes
            Leander home.
          </p>
          <Button asChild size="lg" className="mt-8 rounded-full px-7">
            <a href="#events">
              Explore Events <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <p className="font-script absolute right-10 top-1/2 hidden -translate-y-1/2 rotate-2 text-right text-[32px] leading-snug text-white/95 md:block">
          Local People
          <br />
          Brighter Tomorrows
          <Heart className="ml-2 inline h-5 w-5 fill-current" aria-hidden="true" />
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-[#eadbc3] bg-[#fff6ea]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 md:flex-row md:justify-between">
        <BrandLockup iconClass="h-11 w-11" />
        <p className="text-center text-xs font-medium tracking-[0.22em] text-[#6b5d4f]">
          SMALL TOWN SPIRIT. A BRIGHTER TOMORROW.{" "}
          <Heart className="inline h-3.5 w-3.5 fill-[#c05a1e] text-[#c05a1e]" aria-hidden="true" />
        </p>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-5 text-sm font-medium" aria-label="Footer">
            <a href="#events" className="text-[#4a3d2f] hover:text-[#b5431f]">Events</a>
            <a href="#jobs" className="text-[#4a3d2f] hover:text-[#b5431f]">Jobs</a>
            <a href="#about" className="text-[#4a3d2f] hover:text-[#b5431f]">About</a>
            <a href="#businesses" className="text-[#4a3d2f] hover:text-[#b5431f]">For Organizers</a>
            <a href="#reminders" className="text-[#4a3d2f] hover:text-[#b5431f]">Contact</a>
            <a href="/privacy" className="text-[#4a3d2f] hover:text-[#b5431f]">Privacy</a>
          </nav>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-medium text-[#4a3d2f] md:justify-end">
            <a href="#top" className="hover:text-[#b5431f]">Facebook</a>
            <a href="#top" className="hover:text-[#b5431f]">Instagram</a>
            <a href="#top" className="hover:text-[#b5431f]">YouTube</a>
          </div>
        </div>
      </div>
      <Separator className="bg-[#eadbc3]" />
      <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
        Built for the Convex All Gas Hackathon.{" "}
        <a href="https://howdycarter.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
          Built by Howdy Carter
        </a>
        .
      </p>
    </footer>
  );
}

const TABS = [
  { id: "home", label: "Home", href: "#top", Icon: House },
  { id: "events", label: "Events", href: "#events", Icon: CalendarDays },
  { id: "jobs", label: "Jobs", href: "#jobs", Icon: Briefcase },
  { id: "saved", label: "Saved", href: "#events", Icon: Heart },
  { id: "more", label: "More", href: "#about", Icon: Menu },
] as const;

function TabBar({
  savedOnly,
  onToggleSaved,
}: {
  savedOnly: boolean;
  onToggleSaved: () => void;
}) {
  const [active, setActive] = useState<string>("home");
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadbc3] bg-cream/95 backdrop-blur md:hidden">
      <nav className="grid grid-cols-5 py-2" aria-label="Mobile">
        {TABS.map(({ id, label, href, Icon }) => {
          const isActive = id === "saved" ? savedOnly : active === id && !savedOnly;
          const itemClass = cn(
            "h-auto flex-col gap-1 rounded-none py-1 text-xs font-medium [&_svg]:size-5",
            isActive ? "text-[#c05a1e]" : "text-muted-foreground",
          );
          const content = (
            <>
              <Icon className={cn("h-5 w-5", id === "saved" && savedOnly && "fill-current")} />
              {label}
            </>
          );
          if (id === "saved") {
            return (
              <Button
                key={id}
                type="button"
                variant="ghost"
                onClick={() => {
                  onToggleSaved();
                  setActive("saved");
                }}
                aria-pressed={savedOnly}
                className={itemClass}
              >
                {content}
              </Button>
            );
          }
          return (
            <Button key={id} variant="ghost" asChild className={itemClass}>
              <a href={href} onClick={() => setActive(id)}>
                {content}
              </a>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------- event feed ---------------- */

type EventsResult = ReturnType<typeof useQuery<typeof api.events.listUpcoming>>;
type EventItem = NonNullable<EventsResult>[number];

function CategoryBadge({ event, className }: { event: EventItem; className?: string }) {
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

function SaveButton({
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

function EventCard({
  event,
  saved,
  onToggleSaved,
}: {
  event: EventItem;
  saved: boolean;
  onToggleSaved: () => void;
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
    <Card className="flex flex-col overflow-hidden border-[#eadbc3]">
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
            <CardTitle className="text-[15px] font-bold leading-snug">{title}</CardTitle>
            <CategoryBadge event={event} className="shrink-0 px-2 py-0.5 text-[11px]" />
          </div>
          <div className="mt-1.5 flex flex-col gap-1 text-[13px] text-[#5c4f40]">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#a08b6d]" />
              {formatDate(event.startsAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#a08b6d]" />
              {formatTime(event.startsAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#a08b6d]" />
              <span className="truncate">{event.venue}</span>
            </span>
          </div>
          {event.description && (
            <CardDescription className="mt-1 truncate text-xs">
              {event.description}
            </CardDescription>
          )}
        </div>
        <SaveButton saved={saved} onToggleSaved={onToggleSaved} className="self-center" />
      </CardContent>
    </Card>
  );
}

/* Filter pill built on the shadcn Badge system: a real <button> with
   badgeVariants driving the active (default) / inactive (outline) look. */
function FilterPill({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        badgeVariants({ variant: active ? "default" : "outline" }),
        "cursor-pointer rounded-full px-4 py-2 text-sm font-medium",
        !active &&
          "border-[#eadbc3] bg-white text-[#4a3d2f] hover:border-[#db5a1e] hover:text-[#b5431f]",
        className,
      )}
      {...props}
    />
  );
}

function FeedFilters({
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
        <Button
          asChild
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full border-[#eadbc3] bg-white text-[#4a3d2f] hover:text-[#b5431f]"
        >
          <a href="#events" aria-label="Jump to events">
            <CalendarDays className="h-4 w-4" />
          </a>
        </Button>
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

function SubmitDialogContent() {
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

type JobsResult = ReturnType<typeof useQuery<typeof api.jobs.listJobs>>;
type JobItem = NonNullable<JobsResult>[number];

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

function JobsBoard() {
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold">Leander Jobs</h2>
          <p className="mt-1 text-muted-foreground">
            Local work, right here in town — posted by Leander employers.
          </p>
        </div>
        <Button onClick={() => setPostOpen(true)} className="rounded-full">
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

function RemindersForm() {
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
                🎉 You're in! Watch for Leander events coming your way.
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
              <Label>I'm interested in</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SUBSCRIBER_INTERESTS.map((i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox checked={interests.includes(i)} onCheckedChange={() => setInterests((prev) => toggleInList(prev, i))} />
                    {i}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-muted/40 px-3 py-3 text-sm">
              <Checkbox checked={smsOptIn} onCheckedChange={(v) => setSmsOptIn(v === true)} className="mt-0.5" />
              <span>{SMS_COPY}</span>
            </label>
            <p className="text-xs text-muted-foreground">{PRIVACY_NOTE}</p>
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

function BusinessForm() {
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
        <CardDescription>We'll reach out with ways to get in front of Leander.</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="flex flex-col items-start gap-4">
            <Alert>
              <CircleCheck className="h-4 w-4 text-secondary" />
              <AlertDescription>
                🎉 Thanks, {doneName.contact ? doneName.contact.split(" ")[0] : "there"}! We'll be in
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
              <Label>I'm interested in</Label>
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

function About() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">About Leander</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-[15px] leading-relaxed">
        <p>
          <strong>Lee-AN-der</strong>, Texas was founded in <strong>1882</strong> when the
          Austin and Northwestern Railroad built through — named for railroad official
          Leander "Catfish" Brown. The town grew from the older settlement of Bagdad
          (1854), bypassed by the rail line, and incorporated in 1978.
        </p>
        <p>
          Locals call themselves <strong>"Leanderthals"</strong> — a nod to the Leanderthal
          Lady, a 10,000–13,000-year-old skeleton discovered here in 1982 and one of North
          America's oldest intact burials.
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

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream text-[#2e2620]">
      <div className="mx-auto w-full max-w-6xl px-4 py-4">
        <BrandLockup />
      </div>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <p className="font-script text-[28px] text-[#c05a1e]">Good Things Happen Here</p>
        <h1 className="font-display mt-2 text-4xl font-bold text-[#b5431f]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[#6b5d4f]">Effective September 19, 2026</p>

        <div className="prose-cream mt-8 space-y-6 text-[15px] leading-relaxed">
          <p>
            Leander Live is a community events board for Leander, Texas. This policy
            explains what information we collect and how we use it. In short: we use
            your info only for event updates and local business inquiries — never
            sold, never shared.
          </p>

          <section>
            <h2 className="font-display text-xl font-bold text-[#b5431f]">
              Information we collect
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong>Account info.</strong> If you sign in with Google, we receive
                your name, email address, and profile photo from Google so we can
                identify your account.
              </li>
              <li>
                <strong>Saved events.</strong> Events you heart are stored so they
                follow you across devices. If you're signed out, they're kept in your
                browser's local storage; if you're signed in, they're synced to your
                account.
              </li>
              <li>
                <strong>Event submissions &amp; inquiries.</strong> When you submit an
                event or contact us as a local business, we collect whatever details
                you provide (name, email, event info) so we can review and publish
                your listing.
              </li>
              <li>
                <strong>Text reminders.</strong> If you opt in, we collect your phone
                number to send event reminders. Message and data rates may apply; reply
                STOP to opt out at any time.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-[#b5431f]">
              How we use it
            </h2>
            <p>
              We use your information to run Leander Live: keeping you signed in,
              syncing your saved events, publishing events you submit, and sending
              reminders you asked for. We do not sell your personal information, and
              we do not share it with third parties for their own marketing.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-[#b5431f]">
              Third-party services
            </h2>
            <p>
              Sign-in is handled by Google under{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#b5431f] hover:underline"
              >
                Google's Privacy Policy
              </a>
              . Our app hosting and database are provided by Convex. Text reminders,
              when enabled, are delivered through our messaging provider.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-[#b5431f]">
              Your choices
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Unsave events any time by tapping the heart again.</li>
              <li>Sign out any time from the account menu.</li>
              <li>Reply STOP to any text reminder to opt out.</li>
              <li>
                Ask us to delete your account data by contacting us (see below).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-[#b5431f]">Contact</h2>
            <p>
              Leander Live was designed and built by{" "}
              <a
                href="https://howdycarter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#b5431f] hover:underline"
              >
                Howdy Carter
              </a>
              . Questions about this policy? Reach out through the Contact section on
              our homepage.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function CrossPromoCard() {  return (
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

/* ---------------- app ---------------- */

export default function App() {
  const getRoute = () => {
    if (
      window.location.pathname === "/admin/leads" ||
      window.location.hash === "#admin/leads"
    )
      return "admin";
    if (window.location.pathname === "/privacy") return "privacy";
    return "site";
  };
  const [route, setRoute] = useState(getRoute);
  useEffect(() => {
    const onChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);
  if (route === "admin") return <AdminLeads />;
  if (route === "privacy") return <PrivacyPage />;

  return <Site />;
}

function Site() {
  const events = useQuery(api.events.listUpcoming, { limit: 50 });
  const [modalOpen, setModalOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("All");
  const [category, setCategory] = useState<string>("All");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("leander-live:saved");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  // Signed-in users sync saved events to their profile (Convex Auth).
  const { isAuthenticated } = useConvexAuth();
  const serverSaved = useQuery(api.profiles.getSaved);
  const serverToggleSaved = useMutation(api.profiles.toggleSaved);
  const serverMergeSaved = useMutation(api.profiles.mergeSaved);

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (events ?? []).filter((e) => {
      if (savedOnly && !saved.has(e._id)) return false;
      if (category !== "All" && (e.category ?? "") !== category) return false;
      if (!inRange(e.startsAt, dateFilter, now)) return false;
      if (q && !`${e.title} ${e.venue} ${e.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, query, dateFilter, category, now, saved, savedOnly]);

  const hasFilters =
    savedOnly || dateFilter !== "All" || category !== "All" || query.trim() !== "";

  function clearFilters() {
    setQuery("");
    setDateFilter("All");
    setCategory("All");
    setSavedOnly(false);
  }

  function toggleSaved(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("leander-live:saved", JSON.stringify([...next]));
      } catch {
        /* storage unavailable — keep in-memory only */
      }
      return next;
    });
    // Persist server-side when signed in (guests stay local-only).
    if (isAuthenticated) {
      serverToggleSaved({ eventId: id as Id<"events"> }).catch(() => {});
    }
  }

  // On sign-in: merge guest (localStorage) saves into the server profile
  // once, then adopt the server list as the source of truth.
  const mergedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) {
      mergedRef.current = false;
      return;
    }
    if (mergedRef.current || serverSaved === undefined) return;
    mergedRef.current = true;
    let guestIds: string[] = [];
    try {
      const raw = localStorage.getItem("leander-live:saved");
      guestIds = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      /* ignore */
    }
    serverMergeSaved({ eventIds: guestIds as Id<"events">[] }).catch(() => {});
  }, [isAuthenticated, serverSaved, serverMergeSaved]);

  useEffect(() => {
    if (!isAuthenticated || !mergedRef.current || serverSaved === undefined) return;
    setSaved(new Set(serverSaved));
    try {
      localStorage.setItem("leander-live:saved", JSON.stringify(serverSaved));
    } catch {
      /* ignore */
    }
  }, [isAuthenticated, serverSaved]);

  return (
    <div className="min-h-screen pb-20 md:pb-0" id="top">
      <Header onSubmit={() => setModalOpen(true)} onSignIn={() => setSignInOpen(true)} />
      <Hero />

      <main className="mx-auto max-w-6xl px-4">
        <section id="events" aria-label="Events" className="pt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold">
              {savedOnly ? "Saved Events" : "Featured Events"}
            </h2>
            {hasFilters && (
              <Button
                variant="link"
                onClick={clearFilters}
                className="h-auto shrink-0 px-0 text-sm font-semibold text-[#b5431f]"
              >
                View All Events <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <FeedFilters
            query={query}
            setQuery={setQuery}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            category={category}
            setCategory={setCategory}
            onSubmit={() => setModalOpen(true)}
          />
          {events === undefined ? (
            <div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Loading events"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <Skeleton className="h-44 w-full rounded-xl" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {filtered.length === 1 ? "1 event" : `${filtered.length} events`}
                {hasFilters ? " matching your filters" : " upcoming"}
              </p>
              {filtered.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold">
                      {savedOnly ? "No saved events yet" : "No events match those filters"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {savedOnly
                        ? "Tap the heart on any event to save it here."
                        : "Try widening the dates or categories — or submit the event yourself."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {filtered.map((event) => (
                    <EventCard
                      key={event._id}
                      event={event}
                      saved={saved.has(event._id)}
                      onToggleSaved={() => toggleSaved(event._id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section id="jobs" aria-label="Jobs" className="pt-14">
          <JobsBoard />
        </section>

        <section id="reminders" aria-label="Get reminders" className="pt-14">
          <h2 className="font-display mb-2 text-3xl font-bold">Never miss what's happening</h2>
          <p className="mb-6 text-muted-foreground">
            Sign up for reminders about the events you care about — pick your interests and we'll
            only nudge you about those.
          </p>
          <div className="max-w-2xl">
            <RemindersForm />
          </div>
        </section>

        <section id="businesses" aria-label="For local businesses" className="pt-14">
          <div className="mb-6 overflow-hidden rounded-2xl bg-secondary px-6 py-10 text-white md:px-10">
            <h2 className="font-display text-3xl font-bold">Put your business in front of Leander</h2>
            <p className="mt-2 max-w-xl text-white/85">
              Featured listings, sponsored events, and qualified local leads — from the community
              board Leander actually reads.
            </p>
          </div>
          <div className="grid max-w-4xl gap-6">
            <BusinessForm />
            <CrossPromoCard />
          </div>
        </section>

        <section id="about" aria-label="About Leander" className="pt-14">
          <div className="max-w-3xl">
            <About />
          </div>
        </section>
      </main>

      <Footer />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <SubmitDialogContent />
      </Dialog>
      <ChatWidget />
      <TabBar savedOnly={savedOnly} onToggleSaved={() => setSavedOnly((v) => !v)} />
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  );
}
