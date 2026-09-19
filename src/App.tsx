import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { ChatWidget } from "./components/ChatWidget";
import { AdminLeads } from "./components/AdminLeads";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  BookOpen,
  Building2,
  CalendarDays,
  MapPin,
  Music,
  Search,
  Sparkles,
  TreePine,
  Users,
  UtensilsCrossed,
  Heart,
  Plus,
  Info,
  Bell,
  Send,
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

/* Category accents sampled from the real City of Leander logo palette. */
const CATEGORY_STYLE: Record<string, { label: string; color: string; soft: string; Icon: LucideIcon }> = {
  Music: { label: "Music", color: "#215ba3", soft: "#e3edf9", Icon: Music },
  "Food & Drink": { label: "Food & Drink", color: "#a97e1f", soft: "#f9efcf", Icon: UtensilsCrossed },
  Family: { label: "Family", color: "#47704c", soft: "#e6efe4", Icon: Users },
  Outdoors: { label: "Outdoors", color: "#6d7f3c", soft: "#eef1dd", Icon: TreePine },
  Learn: { label: "Learning", color: "#4982c1", soft: "#e6eff9", Icon: BookOpen },
  Community: { label: "Community", color: "#1e3a6e", soft: "#e2e8f4", Icon: Building2 },
};
const DEFAULT_CATEGORY = { label: "Community", color: "#1e3a6e", soft: "#e2e8f4", Icon: Sparkles };

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

function Header({ onSubmit }: { onSubmit: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="#top" className="flex items-center gap-3" aria-label="Leander Live home">
          <img src="/logo.png" alt="Leander Live logo" className="h-10 w-10 rounded-lg" />
          <span className="leading-tight">
            <span className="font-display block text-xl font-bold">Leander Live</span>
            <span className="block text-xs text-muted-foreground">
              Events. People. A Stronger Leander.
            </span>
          </span>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex" aria-label="Primary">
          <a href="#events" className="text-muted-foreground hover:text-foreground">Events</a>
          <a href="#reminders" className="text-muted-foreground hover:text-foreground">Reminders</a>
          <a href="#businesses" className="text-muted-foreground hover:text-foreground">For Businesses</a>
          <a href="#about" className="text-muted-foreground hover:text-foreground">About</a>
        </nav>
        <Button size="sm" className="whitespace-nowrap" onClick={onSubmit}>
          <Plus className="h-4 w-4" /> Submit Event
        </Button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-label="Welcome" className="px-4 pt-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[#1a4a86] to-secondary px-6 py-14 text-white md:px-12 md:py-20">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/30 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
        <Badge variant="accent" className="mb-4">
          All Aboard Leander.
        </Badge>
        <h1 className="font-display max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
          Real Events. A Stronger Community.
        </h1>
        <p className="mt-4 max-w-xl text-white/85">
          Discover local events, support local people, and be part of what makes
          Leander home.
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-6 bg-white text-primary hover:bg-white/90">
          <a href="#events">
            <CalendarDays className="h-4 w-4" /> Explore Events
          </a>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Leander Live logo" className="h-9 w-9 rounded-lg" />
            <span className="font-display text-lg font-bold">Leander Live</span>
          </div>
          <p className="mt-2 text-sm font-medium text-secondary">All Aboard Leander.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The Leander Live tagline — our invitation, not the city's motto.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm" aria-label="Footer">
          <a href="#events" className="text-muted-foreground hover:text-foreground">Events</a>
          <a href="#reminders" className="text-muted-foreground hover:text-foreground">Reminders</a>
          <a href="#businesses" className="text-muted-foreground hover:text-foreground">For Businesses</a>
          <a href="#about" className="text-muted-foreground hover:text-foreground">About</a>
        </nav>
      </div>
      <Separator />
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

function TabBar({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
      <nav className="grid grid-cols-3 py-2" aria-label="Mobile">
        <a href="#events" className="flex flex-col items-center gap-1 py-1 text-xs font-medium text-muted-foreground">
          <CalendarDays className="h-5 w-5" /> Events
        </a>
        <button type="button" onClick={onSubmit} className="flex flex-col items-center gap-1 py-1 text-xs font-medium text-primary">
          <Plus className="h-5 w-5" /> Submit
        </button>
        <a href="#about" className="flex flex-col items-center gap-1 py-1 text-xs font-medium text-muted-foreground">
          <Info className="h-5 w-5" /> About
        </a>
      </nav>
    </div>
  );
}

/* ---------------- event feed ---------------- */

type EventsResult = ReturnType<typeof useQuery<typeof api.events.listUpcoming>>;
type EventItem = NonNullable<EventsResult>[number];

function EventCard({
  event,
  saved,
  onToggleSaved,
}: {
  event: EventItem;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const style = CATEGORY_STYLE[event.category ?? ""] ?? DEFAULT_CATEGORY;
  const Icon = style.Icon;
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative flex h-28 items-center justify-center" style={{ background: style.color }}>
        <Icon className="h-10 w-10 text-white/90" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSaved}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save this event"}
          className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/20 text-white hover:bg-white/30 hover:text-white"
        >
          <Heart className={cn("h-4 w-4", saved && "fill-current")} />
        </Button>
        <Badge
          className="absolute left-3 top-3 border-0"
          style={{ backgroundColor: style.soft, color: style.color }}
        >
          {style.label}
        </Badge>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg leading-snug">{event.title}</CardTitle>
        <CardDescription className="flex flex-col gap-1 pt-1">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {event.venue}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {event.blurb && (
          <p className="rounded-md bg-accent/25 px-3 py-2 text-sm">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-[#a97e1f]" />
            <strong>Why go:</strong> {event.blurb}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{event.description}</p>
        <div className="mt-auto pt-2">
          {event.url && (
            <Button asChild variant="link" className="h-auto p-0">
              <a href={event.url} target="_blank" rel="noreferrer">
                Details <Send className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedFilters({
  query,
  setQuery,
  dateFilter,
  setDateFilter,
  category,
  setCategory,
}: {
  query: string;
  setQuery: (v: string) => void;
  dateFilter: DateFilter;
  setDateFilter: (v: DateFilter) => void;
  category: string;
  setCategory: (v: string) => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events, places, or categories…"
          aria-label="Search events"
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by date">
        {DATE_FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={dateFilter === f ? "default" : "outline"}
            onClick={() => setDateFilter(f)}
            aria-pressed={dateFilter === f}
          >
            {f}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {["All", ...CATEGORIES].map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? "secondary" : "outline"}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
          >
            {c === "Learn" ? "Learning" : c}
          </Button>
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
          <p>🎉 Got it — your event was submitted and is pending review.</p>
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
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={sending}>
            {sending ? "Submitting…" : "Submit event"}
          </Button>
        </form>
      )}
    </DialogContent>
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
            <p>🎉 You're in! Watch for Leander events coming your way.</p>
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
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
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
            <p>
              🎉 Thanks, {doneName.contact ? doneName.contact.split(" ")[0] : "there"}! We'll be in
              touch about <strong>{doneName.business}</strong> soon.
            </p>
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
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
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

function CrossPromoCard() {
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

/* ---------------- app ---------------- */

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(() =>
    window.location.pathname === "/admin/leads" ||
    window.location.hash === "#admin/leads",
  );
  useEffect(() => {
    const onChange = () =>
      setIsAdminRoute(
        window.location.pathname === "/admin/leads" ||
          window.location.hash === "#admin/leads",
      );
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);
  if (isAdminRoute) return <AdminLeads />;

  return <Site />;
}

function Site() {
  const events = useQuery(api.events.listUpcoming, { limit: 50 });
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("All");
  const [category, setCategory] = useState<string>("All");
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("leander-live:saved");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (events ?? []).filter((e) => {
      if (category !== "All" && (e.category ?? "") !== category) return false;
      if (!inRange(e.startsAt, dateFilter, now)) return false;
      if (q && !`${e.title} ${e.venue} ${e.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, query, dateFilter, category, now]);

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
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0" id="top">
      <Header onSubmit={() => setModalOpen(true)} />
      <Hero />

      <main className="mx-auto max-w-6xl px-4">
        <section id="events" aria-label="Events" className="pt-10">
          <h2 className="font-display mb-4 text-3xl font-bold">Featured Events</h2>
          <FeedFilters
            query={query}
            setQuery={setQuery}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            category={category}
            setCategory={setCategory}
          />
          {events === undefined ? (
            <p className="text-muted-foreground">Loading events…</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {filtered.length === 1 ? "1 event" : `${filtered.length} events`}
                {dateFilter !== "All" || category !== "All" || query.trim()
                  ? " matching your filters"
                  : " upcoming"}
              </p>
              {filtered.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold">No events match those filters</h3>
                    <p className="text-sm text-muted-foreground">
                      Try widening the dates or categories — or submit the event yourself.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      <TabBar onSubmit={() => setModalOpen(true)} />
    </div>
  );
}
