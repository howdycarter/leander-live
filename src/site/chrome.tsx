import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Heart, House, Menu, Search, Store, X } from "lucide-react";
import { ALL_BUSINESSES, ALL_EVENTS, ALL_JOBS } from "./content";

export function BrandLockup({ className = "" }: { className?: string }) {
  return <Link to="/" className={`brand-lockup ${className}`} aria-label="Leander Live home"><span className="brand-word">leander<span className="brand-live">live</span><span className="brand-dot" aria-hidden="true">.</span></span><span className="brand-subtitle">A little more local.</span></Link>;
}
const NAV_LINKS = [{ to: "/events", label: "Events" }, { to: "/jobs", label: "Jobs" }, { to: "/businesses", label: "Businesses" }, { to: "/city-hall", label: "City Hall" }];
function Header() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); } }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [open]);
  return <header className="site-header"><div className="shell header-inner"><BrandLockup /><nav className="desktop-nav" aria-label="Primary">{NAV_LINKS.map(({ to, label }) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav><div className="header-actions"><Link className="header-icon" to="/search" aria-label="Search Leander Live"><Search size={20} /></Link><Link className="header-saved" to="/events?saved=1" aria-label="Saved events"><Heart size={19} /></Link><Button asChild className="header-submit"><Link to="/submit">Add a listing <ArrowUpRight size={16} /></Link></Button><Button ref={menuButton} className="menu-toggle" variant="ghost" size="icon" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close navigation" : "Open navigation"}>{open ? <X size={22} /> : <Menu size={22} />}</Button></div></div>{open && <nav className="mobile-menu shell" id="mobile-menu" aria-label="More navigation">{[...NAV_LINKS, { to: "/events?saved=1", label: "Saved events" }, { to: "/submit", label: "Add a listing" }, { to: "/advertise", label: "Promote locally" }, { to: "/about", label: "About Leander Live" }].map(({ to, label }) => <Link key={to} to={to}>{label}<ArrowUpRight size={16} /></Link>)}</nav>}</header>;
}
function Footer() {
  return <footer className="site-footer"><div className="shell footer-grid"><div><BrandLockup /><p>Good things happen when<br />you know your neighbors.</p><span className="footer-location">Leander, Texas</span></div><nav aria-label="Explore"><h2>Find your local</h2>{NAV_LINKS.map(({ to, label }) => <Link key={to} to={to}>{label}</Link>)}</nav><nav aria-label="Contribute"><h2>Be part of it</h2><Link to="/submit?type=event">Submit an event</Link><Link to="/submit?type=job">Post a job</Link><Link to="/submit?type=business">Add a business</Link><Link to="/advertise">Promotion options</Link></nav><nav aria-label="Information"><h2>The small print</h2><Link to="/about">About the board</Link><Link to="/reminders">Calendar help</Link><Link to="/privacy">Privacy</Link><a href="mailto:chris@howdycarter.com">Get in touch <ArrowUpRight size={13} /></a></nav></div><div className="shell footer-bottom"><p>© {new Date().getFullYear()} Leander Live · An independent community guide.</p><p>Built by <a href="https://howdycarter.com" target="_blank" rel="noopener noreferrer">Howdy Carter</a></p></div></footer>;
}
function TabBar() {
  return <nav className="mobile-tabs" aria-label="Quick navigation">{[{ to: "/", label: "Home", Icon: House }, { to: "/events", label: "Events", Icon: CalendarDays }, { to: "/jobs", label: "Jobs", Icon: BriefcaseBusiness }, { to: "/businesses", label: "Local", Icon: Store }].map(({ to, label, Icon }) => <NavLink end={to === "/"} to={to} key={to}><Icon size={20} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>;
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
  "Discover local events, jobs, businesses, and city information in Leander, Texas. Find your local on Leander Live.";

const ROUTE_META: Record<string, { title: string; description: string }> = {
  "/search": { title: "Search Leander — Leander Live", description: DEFAULT_DESCRIPTION },
  "/submit": { title: "Add a local listing — Leander Live", description: "Submit a local event, job, or business for review. Prepare your listing and send it by email." },
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
      "The Leander business directory — restaurants, shops, salons, services, and new openings, built from public Texas sales-tax permit records.",
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
      "Explore proposed promotion options for Leander events, jobs, and businesses. Inquiries are reviewed by email; no online payment is collected.",
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
    const job = pathname.startsWith("/jobs/") ? ALL_JOBS.find(item => `/jobs/${item.id}` === pathname) : undefined;
    const business = pathname.startsWith("/businesses/") ? ALL_BUSINESSES.find(item => `/businesses/${item.id}` === pathname) : undefined;
    if (job) { title = `${job.title} at ${job.company} — Leander Live`; description = `Explore ${job.title} with ${job.company} in ${job.location}. View details and apply with the employer.`; }
    if (business) { title = `${business.name} — Leander Live`; description = `${business.name}, ${business.category} in Leander, Texas. View public listing details and recorded address.`; }
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
  return <div className="site-root" id="top"><a className="skip-link" href="#route-content">Skip to content</a><Header /><div id="route-content" tabIndex={-1}><Outlet /></div><Footer /><TabBar /></div>;
}
