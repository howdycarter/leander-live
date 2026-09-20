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
import { AccountButton } from "../components/Auth";
import { ChatWidget } from "../components/ChatWidget";
import { useSiteActions } from "./state";
import { trackEvent } from "./analytics";

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
  { to: "/community", label: "Community" },
  { to: "/about", label: "About" },
];

function Header() {
  const { openSubmit, openSignIn } = useSiteActions();
  return (
    <header className="sticky top-0 z-40 border-b border-[#eadbc3] bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <BrandLockup />
        <nav className="hidden items-center gap-6 text-[15px] font-medium lg:flex" aria-label="Primary">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  isActive
                    ? "text-[#b5431f] underline decoration-2 underline-offset-8"
                    : "text-[#4a3d2f] hover:text-[#b5431f]",
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
            className="rounded-full px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Submit Event</span>
            <span className="sm:hidden">Submit</span>
          </Button>
          <AccountButton onSignIn={openSignIn} />
        </div>
      </div>
    </header>
  );
}

/* ---------------- footer ---------------- */

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-[#4a3d2f] hover:text-[#b5431f]">
        {children}
      </Link>
    </li>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#6b5d4f]">
      {children}
    </p>
  );
}

function Footer() {
  const { openSubmit } = useSiteActions();
  return (
    <footer className="mt-16 border-t border-[#eadbc3] bg-[#fff6ea]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <BrandLockup />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#6b5d4f]">
            Real events, local people, a stronger Leander — one community board for
            the whole town.
          </p>
          <p className="mt-4 text-xs font-medium tracking-[0.22em] text-[#6b5d4f]">
            SMALL TOWN SPIRIT. A BRIGHTER TOMORROW.
          </p>
        </div>
        <nav aria-label="Explore">
          <FooterHeading>Explore</FooterHeading>
          <ul className="flex flex-col gap-2.5 text-sm font-medium">
            <FooterLink to="/events">Events</FooterLink>
            <FooterLink to="/jobs">Jobs</FooterLink>
            <FooterLink to="/community">Community</FooterLink>
          </ul>
        </nav>
        <nav aria-label="Company">
          <FooterHeading>Company</FooterHeading>
          <ul className="flex flex-col gap-2.5 text-sm font-medium">
            <FooterLink to="/about">About</FooterLink>
            <FooterLink to="/reminders">Get reminders</FooterLink>
            <FooterLink to="/advertise">Advertise</FooterLink>
            <li>
              <button
                type="button"
                onClick={openSubmit}
                className="text-[#4a3d2f] hover:text-[#b5431f]"
              >
                Submit an event
              </button>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <FooterHeading>Legal</FooterHeading>
          <ul className="flex flex-col gap-2.5 text-sm font-medium">
            <FooterLink to="/privacy">Privacy</FooterLink>
          </ul>
        </nav>
      </div>
      <Separator className="bg-[#eadbc3]" />
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
        <p>© 2026 Leander Live · Built for the Leander community.</p>
        <p>
          Built by{" "}
          <a
            href="https://howdycarter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadbc3] bg-cream/95 backdrop-blur md:hidden">
      <nav className="grid grid-cols-5 py-2" aria-label="Mobile">
        {TABS.map(({ id, label, to, Icon, isActive }) => {
          const active = isActive(pathname, params);
          return (
            <Link
              key={id}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-none py-1 text-xs font-medium",
                active ? "text-[#c05a1e]" : "text-muted-foreground",
              )}
            >
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
    <div className="min-h-screen bg-cream pb-20 text-[#2e2620] md:pb-0" id="top">
      <Header />
      <Outlet />
      <Footer />
      <ChatWidget />
      <TabBar />
    </div>
  );
}
