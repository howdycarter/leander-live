import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Briefcase,
  CalendarDays,
  Heart,
  House,
  Menu,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteActions } from "./state";
import { trackEvent } from "./analytics";
import { ALL_EVENTS } from "./content";

/* ---------------- brand ---------------- */

export function BrandLockup({ className = "h-10" }: { className?: string }) {
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label="Leander Live home">
      <img
        src="/brand/logo-leander-live.png"
        alt="Leander Live — People, Places, Opportunities"
        className={cn(className, "w-auto")}
      />
    </Link>
  );
}

/* ---------------- header ---------------- */

const NAV_LINKS = [
  { to: "/events", label: "Events" },
  { to: "/jobs", label: "Jobs" },
  { to: "/businesses", label: "Businesses" },
  { to: "/city-hall", label: "City Hall" },
  { to: "/community", label: "Community" },
  { to: "/about", label: "About" },
];

function Header() {
  const { openSubmit } = useSiteActions();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <BrandLockup className="h-9" />
        {/* Nav appears at md (768px), not lg: the bottom TabBar is md:hidden,
            so gating the header nav to lg left 768–1023px viewports
            (unfolded foldables, small tablets) with no navigation at all. */}
        <nav className="hidden items-center gap-3 text-sm font-semibold md:flex lg:gap-6 lg:text-[15px]" aria-label="Primary">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "py-2",
                  isActive
                    ? "text-navy underline decoration-gold decoration-[3px] underline-offset-8"
                    : "text-foreground/60 hover:text-navy",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              trackEvent("submit_event_opened");
              openSubmit();
            }}
            className="rounded-full px-4 font-bold"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Submit Event</span>
            <span className="sm:hidden">Submit</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- footer ---------------- */

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="inline-block py-1 text-[15px] text-white/80 hover:text-white"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gold">
      {children}
    </p>
  );
}

function Footer() {
  const { openSubmit } = useSiteActions();
  return (
    <footer className="mt-16 bg-navy text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-8 sm:py-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10">
        <div className="col-span-2 lg:col-span-1">
          <span className="inline-flex rounded-xl bg-white px-2.5 py-1.5">
            <BrandLockup className="h-9" />
          </span>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/75">
            Real events, local people, a stronger Leander — one community board for
            the whole town.
          </p>
          <p className="mt-3 hidden text-xs font-semibold tracking-[0.22em] text-white/50 lg:block">
            SMALL TOWN SPIRIT. A BRIGHTER TOMORROW.
          </p>
        </div>
        <nav aria-label="Explore">
          <FooterHeading>Explore</FooterHeading>
          <ul className="flex flex-col gap-1 font-medium">
            <FooterLink to="/events">Events</FooterLink>
            <FooterLink to="/jobs">Jobs</FooterLink>
            <FooterLink to="/businesses">Businesses</FooterLink>
            <FooterLink to="/city-hall">City Hall</FooterLink>
            <FooterLink to="/community">Community</FooterLink>
          </ul>
        </nav>
        <nav aria-label="Company">
          <FooterHeading>Company</FooterHeading>
          <ul className="flex flex-col gap-1 font-medium">
            <FooterLink to="/about">About</FooterLink>
            <FooterLink to="/reminders">Get reminders</FooterLink>
            <FooterLink to="/advertise">Advertise</FooterLink>
            <li>
              <button
                type="button"
                onClick={openSubmit}
                className="inline-block py-1 text-left text-[15px] text-white/80 hover:text-white"
              >
                Submit an event
              </button>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal" className="col-span-2 lg:col-span-1">
          <FooterHeading>Legal</FooterHeading>
          <ul className="flex flex-row gap-5 font-medium lg:flex-col lg:gap-1">
            <FooterLink to="/privacy">Privacy</FooterLink>
          </ul>
        </nav>
      </div>
      <Separator className="bg-white/15" />
      <div className="mx-auto max-w-6xl px-4 py-3.5 text-center text-[13px] text-white/60">
        <p>
          © 2026 Leander Live · Built by{" "}
          <a
            href="https://howdycarter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gold hover:underline"
          >
            Howdy Carter
          </a>
        </p>
      </div>
    </footer>
  );
}

/* ---------------- mobile tab bar ---------------- */

type TabDef = {
  id: string;
  label: string;
  to: string;
  Icon: LucideIcon;
  isActive: (pathname: string, params: URLSearchParams) => boolean;
};

const TABS: TabDef[] = [
  { id: "home", label: "Home", to: "/", Icon: House, isActive: (p) => p === "/" },
  {
    id: "events",
    label: "Events",
    to: "/events",
    Icon: CalendarDays,
    isActive: (p, s) => p === "/events" && s.get("saved") !== "1",
  },
  { id: "jobs", label: "Jobs", to: "/jobs", Icon: Briefcase, isActive: (p) => p === "/jobs" },
  {
    id: "saved",
    label: "Saved",
    to: "/events?saved=1",
    Icon: Heart,
    isActive: (p, s) => p === "/events" && s.get("saved") === "1",
  },
  { id: "more", label: "More", to: "/about", Icon: Menu, isActive: (p) => p === "/about" },
];

function TabBar() {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <nav className="grid grid-cols-5" aria-label="Mobile">
        {TABS.map(({ id, label, to, Icon, isActive }) => {
          const active = isActive(pathname, params);
          return (
            <Link
              key={id}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold",
                active ? "text-navy" : "text-foreground/45",
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-6 top-0 h-[3px] rounded-full bg-gold"
                />
              )}
              <Icon className={cn("h-5 w-5", id === "saved" && active && "fill-current")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------- route helpers ---------------- */

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/* ---------------- per-route title & description ---------------- */

const DEFAULT_DESCRIPTION =
  "A real-time community events board for Leander, Texas. Browse local events or submit your own.";

const ROUTE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Leander Live — What's happening in Leander, TX",
    description: DEFAULT_DESCRIPTION,
  },
  "/events": {
    title: "Upcoming Events in Leander, TX — Leander Live",
    description:
      "Festivals, markets, live music, and family events in Leander, Texas — every upcoming event on one community board.",
  },
  "/jobs": {
    title: "Jobs in Leander, TX — Leander Live",
    description:
      "Local jobs posted by Leander employers — full-time, part-time, and contract work in Leander, Texas.",
  },
  "/businesses": {
    title: "Businesses in Leander, TX — Leander Live",
    description:
      "The Leander business directory — restaurants, shops, salons, services, and new openings, built from official Texas sales-tax permit records and refreshed twice daily.",
  },
  "/city-hall": {
    title: "City Hall — Leander Live",
    description:
      "City Council and board meetings, agenda packets, and city news for Leander, Texas — local government in plain sight.",
  },
  "/community": {
    title: "For Businesses — Leander Live",
    description:
      "Put your business in front of Leander — featured listings, sponsored events, and qualified local leads from the community board.",
  },
  "/reminders": {
    title: "Event Reminders — Leander Live",
    description:
      "Add Leander events straight to your calendar — no sign-up, no spam, just the event file.",
  },
  "/about": {
    title: "About — Leander Live",
    description:
      "What is Leander Live? The community events, jobs, and city-hall board for Leander, Texas — plus a short history of the town.",
  },
  "/advertise": {
    title: "Advertise — Leander Live",
    description:
      "Featured placements and AI-qualified service leads for Leander businesses, priced for local businesses — not agencies.",
  },
  "/privacy": {
    title: "Privacy Policy — Leander Live",
    description:
      "How Leander Live handles your information: no accounts, no sign-in, and saved events that never leave your browser.",
  },
};

/** Give every route its own document title and meta description (the SPA
    ships a single index.html, so without this every page shares one). */
export function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    let title = "Page not found — Leander Live";
    let description = DEFAULT_DESCRIPTION;
    const eventMatch = pathname.match(/^\/events\/(.+)$/);
    if (ROUTE_META[pathname]) {
      ({ title, description } = ROUTE_META[pathname]);
    } else if (eventMatch) {
      const ev = ALL_EVENTS.find((e) => e.id === eventMatch[1]);
      title = ev ? `${ev.title} — Leander Live` : "Event — Leander Live";
      if (ev) {
        const blurb = (ev.blurb ?? ev.description ?? "").replace(/\s+/g, " ").trim();
        if (blurb) description = blurb.slice(0, 155);
      }
    }
    document.title = title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.setAttribute("content", description);
  }, [pathname]);
  return null;
}

/** Keep the canonical URL pinned to leanderlive.com on every page. */
export function Canonical() {
  const { pathname } = useLocation();
  useEffect(() => {
    let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!el) {
      el = document.createElement("link");
      el.rel = "canonical";
      document.head.appendChild(el);
    }
    el.href = `https://leanderlive.com${pathname}`;
  }, [pathname]);
  return null;
}

/* ---------------- layout ---------------- */

export function SiteLayout() {
  return (
    <div className="min-h-screen bg-background pb-20 text-foreground md:pb-0" id="top">
      <Header />
      <Outlet />
      <Footer />
      <TabBar />
    </div>
  );
}
