import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, Heart, Landmark, MapPin, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchField } from "@/components/arc/search-field/search-field";
import { ALL_BUSINESSES, ALL_EVENTS, ALL_JOBS, companyInitials, formatPay, formatShortDate, formatTimeRange, inRange, isEventFeatured, plainText, type DateFilter, type EventItem, type JobItem, type BusinessItem } from "./content";
import { useSavedEvents } from "./state";
import { ListingStatus, SourceStatusBanner } from "./sourceStatus";

const DATE_FILTERS: DateFilter[] = ["All", "Today", "This Weekend", "This Month"];
const EVENT_CATEGORIES = ["All", "Music", "Food & Drink", "Family", "Outdoors", "Learn", "Community"];
const JOB_TYPES = ["All", "full-time", "part-time", "contract", "temporary"];
const jobType = (type: string) => type === "All" ? "All work types" : type.charAt(0).toUpperCase() + type.slice(1);
const matches = (value: string, query: string) => value.toLowerCase().includes(query.trim().toLowerCase());
const eventMatches = (event: EventItem, query: string) => matches(`${event.title} ${event.venue} ${event.category} ${plainText(event.description)}`, query);
const jobMatches = (job: JobItem, query: string) => matches(`${job.title} ${job.company} ${job.location} ${plainText(job.description)}`, query);
const businessMatches = (business: BusinessItem, query: string) => matches(`${business.name} ${business.category} ${business.address}`, query);

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <section className="page-intro shell"><p className="eyebrow">{eyebrow}</p><div className="page-intro-row"><div><h1>{title}</h1><p className="intro-copy">{description}</p></div>{action}</div></section>;
}

export function SectionHeading({ eyebrow, title, to, link = "View all" }: { eyebrow?: string; title: string; to?: string; link?: string }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{to && <Link className="text-link" to={to}>{link}<ArrowRight size={16} aria-hidden="true" /></Link>}</div>;
}

/** Uses the shared date formatter so scraper all-day and Central-time fixes remain authoritative. */
export function LocalEventCard({ event }: { event: EventItem }) {
  const { saved, toggleSaved } = useSavedEvents();
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" }).formatToParts(event.startsAt);
  const datePart = (type: string) => date.find(part => part.type === type)?.value;
  return <Card className="local-event-card">
    <CardContent className="event-card-content">
      <div className="event-topline"><span className="category-label">{event.category === "Learn" ? "Learning" : event.category}</span><Button variant="ghost" size="icon" aria-label={saved.has(event.id) ? `Unsave ${event.title}` : `Save ${event.title}`} aria-pressed={saved.has(event.id)} onClick={() => toggleSaved(event.id)}><Heart size={19} fill={saved.has(event.id) ? "currentColor" : "none"} /></Button></div>
      <div className="event-main"><div className="date-tile" aria-hidden="true"><span>{datePart("month")}</span><strong>{datePart("day")}</strong></div><h3><Link to={`/events/${event.id}`}>{event.title.trim()}</Link></h3></div>
      <ListingStatus item={event} /><p className="event-schedule">{formatShortDate(event.startsAt)} · {formatTimeRange(event)}</p>
      <p className="event-venue"><MapPin size={14} aria-hidden="true" /><span>{event.venue || "See organizer for location"}</span></p>
      <div className="event-card-bottom">{isEventFeatured(event) ? <span className="sponsor-label">Sponsored</span> : <span>Local event</span>}<Link to={`/events/${event.id}`} aria-label={`Details for ${event.title}`}>Details <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    </CardContent>
  </Card>;
}

export function LocalJobCard({ job }: { job: JobItem }) {
  return <Card className="local-job-card"><CardContent className="job-card-content"><div className="company-mark" aria-hidden="true">{companyInitials(job.company)}</div><div className="job-card-main"><p className="category-label">{job.company}{job.featured && <span className="sponsor-label"> · Sponsored</span>}</p><h3><Link to={`/jobs/${job.id}`}>{job.title.trim()}</Link></h3><p>{job.location} <span aria-hidden="true">·</span> {jobType(job.type)}</p><ListingStatus item={job} />{job.payRange && <p className="pay-range">{formatPay(job.payRange)}</p>}</div><Link className="arrow-link" to={`/jobs/${job.id}`} aria-label={`View ${job.title}`}><ArrowUpRight size={20} aria-hidden="true" /></Link></CardContent></Card>;
}

export function LocalBusinessCard({ business }: { business: BusinessItem }) {
  return <Card className="local-business-card"><CardContent className="business-card-content"><div className="business-icon" aria-hidden="true"><Store size={22} /></div><p className="category-label">{business.category}</p><h3><Link to={`/businesses/${business.id}`}>{business.name}</Link></h3><p className="event-venue"><MapPin size={14} aria-hidden="true" />{business.address}</p><div className="event-card-bottom"><span>{business.featured ? "Sponsored" : "Public directory"}</span><Link to={`/businesses/${business.id}`} aria-label={`Details for ${business.name}`}><ArrowUpRight size={17} aria-hidden="true" /></Link></div></CardContent></Card>;
}

export function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const weekend = ALL_EVENTS.filter(event => inRange(event.startsAt, "This Weekend", now));
  function search(event: FormEvent) { event.preventDefault(); navigate(`/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`); }
  return <main id="main-content">
    <section className="home-hero shell" aria-labelledby="home-title">
      <div className="hero-copy"><p className="eyebrow"><span className="live-dot" /> Leander, Texas · Your local field guide</p><h1 id="home-title">A little closer<br />to <span>everything.</span></h1><p className="hero-description">The plans, people, and possibilities that make this place home. Find your next thing in Leander.</p>
        <form className="hero-search" role="search" onSubmit={search}><SearchField label="Search Leander" placeholder="Events, jobs, businesses…" value={query} onValueChange={setQuery} /><Button type="submit" size="lg">Explore <ArrowRight size={17} aria-hidden="true" /></Button></form>
        <div className="popular-searches"><span>Start here</span><Link to="/events?date=This+Weekend">This weekend <ArrowUpRight size={13} /></Link><Link to="/jobs">Local jobs <ArrowUpRight size={13} /></Link><Link to="/businesses">Around town <ArrowUpRight size={13} /></Link></div>
      </div>
      <aside className="town-board" aria-label="Explore Leander"><div className="town-board-heading"><span className="eyebrow">Small town. Lots happening.</span><span className="board-coordinate">30.58° N / 97.85° W</span></div><div className="town-board-title">Find your<br />kind of local.</div>
        {[{ to: "/events", Icon: CalendarDays, title: "Make a plan", detail: `${ALL_EVENTS.length} upcoming events` }, { to: "/jobs", Icon: BriefcaseBusiness, title: "Work close to home", detail: `${ALL_JOBS.length} job listings` }, { to: "/businesses", Icon: Store, title: "Discover the neighborhood", detail: `${ALL_BUSINESSES.length} directory listings` }].map(({ to, Icon, title, detail }) => <Link to={to} className="town-board-link" key={to}><span className="board-icon"><Icon size={20} aria-hidden="true" /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={19} aria-hidden="true" /></Link>)}
        <div className="town-board-footer"><span className="live-dot" /> Made for the place we call home.</div>
      </aside>
    </section>
    <div className="local-strip"><div className="shell"><span><CalendarDays size={16} /> Plan a good weekend</span><span><BriefcaseBusiness size={16} /> Find work nearby</span><span><Store size={16} /> Keep it local</span><Link to="/city-hall"><Landmark size={16} /> Stay in the know <ArrowRight size={14} /></Link></div></div>
    <section className="shell section-block"><SectionHeading eyebrow="Out & about" title={weekend.length ? "Your weekend, made." : "Good things on the calendar."} to="/events" link="All events" /><div className="event-grid">{(weekend.length ? weekend : ALL_EVENTS).slice(0, 3).map(event => <LocalEventCard key={event.id} event={event} />)}</div>{!ALL_EVENTS.length && <EmptyState title="The next plans are on their way." description="Check the calendar again soon, or share something happening in town." />}</section>
    <section className="shell home-split section-block"><div><SectionHeading eyebrow="A shorter commute" title="Opportunity lives here." to="/jobs" link="All jobs" /><div className="job-list">{ALL_JOBS.slice(0, 3).map(job => <LocalJobCard key={job.id} job={job} />)}</div>{!ALL_JOBS.length && <EmptyState title="No jobs listed right now." description="Have a local role? Share it with your neighbors." />}</div><aside className="community-note"><p className="eyebrow">The community board</p><h2>Something good<br />to share?</h2><p>A grand opening. An extra pair of hands. A Saturday worth getting out for. Let your neighbors know.</p><Button asChild><Link to="/submit">Add to the board <ArrowUpRight size={17} /></Link></Button><p className="fine-print">Free basic submissions · Reviewed before publishing</p><div className="note-rule" /><Link to="/advertise" className="text-link">Want a little more visibility?<ArrowRight size={16} /></Link><p className="fine-print">Explore proposed promotion options. No payment is collected on this site.</p></aside></section>
    <section className="shell section-block"><SectionHeading eyebrow="Around the neighborhood" title="Meet the local directory." to="/businesses" link="Explore businesses" /><div className="business-grid">{ALL_BUSINESSES.slice(0, 3).map(business => <LocalBusinessCard key={business.id} business={business} />)}</div><p className="data-note">Directory listings come from public permit records, not endorsements. Check opening status and hours before visiting.</p></section>
    <section className="shell civic-callout"><div><p className="eyebrow">Know your town</p><h2>Local decisions. Open information.</h2><p>Council meetings, agendas, and news from the City of Leander.</p></div><Button asChild variant="outline"><Link to="/city-hall">Visit City Hall <ArrowRight size={16} /></Link></Button></section>
  </main>;
}

export function EmptyState({ title, description, onReset }: { title: string; description: string; onReset?: () => void }) {
  return <div className="empty-state"><Search size={28} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{onReset && <Button variant="outline" onClick={onReset}>Clear filters</Button>}</div>;
}

function useFilters() {
  const [params, setParams] = useSearchParams();
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (!value || value === "All") next.delete(key); else next.set(key, value); setParams(next, { replace: true }); };
  return { params, update, reset: () => setParams({}) };
}

export function EventsPage() {
  const { params, update, reset } = useFilters();
  const query = params.get("q") || "";
  const savedOnly = params.get("saved") === "1";
  const category = params.get("category") || "All";
  const date = DATE_FILTERS.includes(params.get("date") as DateFilter) ? params.get("date") as DateFilter : "All";
  const { saved } = useSavedEvents();
  const now = useMemo(() => new Date(), []);
  const events = ALL_EVENTS.filter(event => (!savedOnly || saved.has(event.id)) && eventMatches(event, query) && (category === "All" || event.category === category) && inRange(event.startsAt, date, now));
  return <main id="main-content"><PageIntro eyebrow="The local calendar" title={savedOnly ? "Your saved plans." : "Go out. Get together."} description={savedOnly ? "A few good things to look forward to. Saved on this device, just for you." : "From family afternoons to a night out. Find what’s happening in and around Leander."} action={<Button asChild><Link to="/submit?type=event">Submit an event <ArrowUpRight size={16} /></Link></Button>} />
    <section className="shell discovery-results"><SourceStatusBanner kind="events" /><div className="filter-panel"><SearchField label="Search events" value={query} onValueChange={value => update("q", value)} placeholder="Try a name, place, or activity" /><div className="filter-row"><div className="filter-chips" role="group" aria-label="Event dates">{DATE_FILTERS.map(filter => <Button variant={date === filter ? "default" : "outline"} aria-pressed={date === filter} onClick={() => update("date", filter)} key={filter}>{filter === "All" ? "Any date" : filter}</Button>)}</div><label className="select-label"><span>Category</span><select value={category} onChange={event => update("category", event.target.value)}>{EVENT_CATEGORIES.map(value => <option value={value} key={value}>{value === "All" ? "All categories" : value}</option>)}</select></label></div></div><div className="results-heading"><p role="status">{events.length} {events.length === 1 ? "event" : "events"}{savedOnly ? " saved" : " to explore"}</p><Button variant="ghost" onClick={() => update("saved", savedOnly ? "" : "1")} aria-pressed={savedOnly}><Heart size={16} />{savedOnly ? "Show all events" : "Saved events"}</Button></div><div className="event-grid">{events.map(event => <LocalEventCard key={event.id} event={event} />)}</div>{events.length === 0 && <EmptyState title={savedOnly ? "Nothing saved here yet." : "No plans match just yet."} description={savedOnly ? "Tap a heart on an event to keep it on your list." : "Try another search, a wider date range, or a different category."} onReset={reset} />}<p className="data-note">Times are shown in Leander’s time zone. Confirm details with the organizer before you go.</p></section>
  </main>;
}

export function JobsPage() {
  const { params, update, reset } = useFilters();
  const query = params.get("q") || "";
  const type = params.get("type") || "All";
  const jobs = ALL_JOBS.filter(job => (type === "All" || job.type === type) && jobMatches(job, query));
  return <main id="main-content"><PageIntro eyebrow="Work local" title="Your next chapter, nearby." description="Explore collected job listings around Leander. Confirm availability and apply directly with the employer." action={<Button asChild><Link to="/submit?type=job">Post a job <ArrowUpRight size={16} /></Link></Button>} /><section className="shell discovery-results"><SourceStatusBanner kind="jobs" /><div className="filter-panel"><SearchField label="Search jobs" value={query} onValueChange={value => update("q", value)} placeholder="Job title, company, or keyword" /><div className="filter-chips" role="group" aria-label="Work types">{JOB_TYPES.map(value => <Button key={value} variant={type === value ? "default" : "outline"} aria-pressed={type === value} onClick={() => update("type", value)}>{jobType(value)}</Button>)}</div></div><div className="results-heading"><p role="status">{jobs.length} {jobs.length === 1 ? "job listing" : "job listings"}</p><Link className="text-link" to="/advertise">Hiring? Stand out <ArrowRight size={16} /></Link></div><div className="jobs-grid">{jobs.map(job => <LocalJobCard job={job} key={job.id} />)}</div>{!jobs.length && <EmptyState title="No openings match that search." description="Try a different keyword or work type." onReset={reset} />}<p className="data-note">Availability and compensation are provided by the source. Confirm current details on the employer’s site.</p></section></main>;
}

export function BusinessesPage() {
  const { params, update, reset } = useFilters();
  const query = params.get("q") || "";
  const category = params.get("category") || "All";
  const categories = [...new Set(ALL_BUSINESSES.map(business => business.category))].sort();
  const businesses = ALL_BUSINESSES.filter(business => (category === "All" || business.category === category) && businessMatches(business, query));
  return <main id="main-content"><PageIntro eyebrow="The neighborhood directory" title="Good neighbors. Local businesses." description="Explore shops, restaurants, and services listed in Leander’s public business records." action={<Button asChild><Link to="/submit?type=business">Add your business <ArrowUpRight size={16} /></Link></Button>} /><section className="shell discovery-results"><div className="filter-panel directory-filters"><SearchField label="Search businesses" value={query} onValueChange={value => update("q", value)} placeholder="Business name, category, or street" /><label className="select-label"><span>Category</span><select value={category} onChange={event => update("category", event.target.value)}><option value="All">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label></div><div className="results-heading"><p role="status">{businesses.length} {businesses.length === 1 ? "business" : "businesses"}</p><Link className="text-link" to="/submit?type=business">Suggest a correction <ArrowRight size={16} /></Link></div><div className="business-grid">{businesses.map(business => <LocalBusinessCard key={business.id} business={business} />)}</div>{!businesses.length && <EmptyState title="No businesses match that search." description="Try a different name or category. You can also suggest a listing." onReset={reset} />}<p className="data-note">Public permit records do not confirm that a business is open. Verify hours, address, and availability directly. Listings are not endorsements.</p></section></main>;
}

export function SearchPage() {
  const { params, update } = useFilters();
  const query = params.get("q") || "";
  const events = ALL_EVENTS.filter(event => eventMatches(event, query));
  const jobs = ALL_JOBS.filter(job => jobMatches(job, query));
  const businesses = ALL_BUSINESSES.filter(business => businessMatches(business, query));
  const total = events.length + jobs.length + businesses.length;
  return <main id="main-content"><PageIntro eyebrow="Find your local" title="What are you looking for?" description="One search for the plans, opportunities, and places around you." /><section className="shell discovery-results"><div className="filter-panel"><SearchField label="Search all of Leander Live" placeholder="Search events, jobs, and businesses" value={query} onValueChange={value => update("q", value)} /></div><p className="data-note" role="status">{query ? `${total} matches for “${query}”` : "Start exploring, or type to narrow things down."}</p>{events.length > 0 && <section className="search-section"><SectionHeading title={`Events · ${events.length}`} to={`/events?q=${encodeURIComponent(query)}`} /><div className="event-grid">{events.slice(0, 3).map(event => <LocalEventCard key={event.id} event={event} />)}</div></section>}{jobs.length > 0 && <section className="search-section"><SectionHeading title={`Jobs · ${jobs.length}`} to={`/jobs?q=${encodeURIComponent(query)}`} /><div className="job-list">{jobs.slice(0, 3).map(job => <LocalJobCard key={job.id} job={job} />)}</div></section>}{businesses.length > 0 && <section className="search-section"><SectionHeading title={`Businesses · ${businesses.length}`} to={`/businesses?q=${encodeURIComponent(query)}`} /><div className="business-grid">{businesses.slice(0, 3).map(business => <LocalBusinessCard key={business.id} business={business} />)}</div></section>}{!total && <EmptyState title="Nothing matches just yet." description="Try a broader search, or browse one of the local boards." onReset={() => update("q", "")} />}</section></main>;
}
