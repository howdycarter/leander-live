import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, CalendarPlus, Check, Heart, MapPin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ALL_BUSINESSES, ALL_EVENTS, ALL_JOBS, formatDate, formatPay, formatTimeRange, isEventFeatured, textParagraphs } from "./content";
import { LocalEventCard, SectionHeading } from "./discovery";
import { useSavedEvents } from "./state";
import { downloadEventIcs } from "./ics";
import { buildEventJsonLd } from "./eventJsonLd";
import { trackEvent } from "./analytics";
import { ListingStatus } from "./sourceStatus";

function BackLink({ to, children }: { to: string; children: React.ReactNode }) { return <Link className="back-link" to={to}><ArrowLeft size={16} />{children}</Link>; }
function Missing({ type, to }: { type: string; to: string }) { return <main id="main-content" className="shell detail-page"><BackLink to={to}>All {type}</BackLink><h1>This listing isn’t on the board.</h1><p>It may have passed or been removed. There’s still plenty to explore.</p><Button asChild><Link to={to}>Browse {type}</Link></Button></main>; }

export function EventDetailPage() {
  const { id } = useParams();
  const event = ALL_EVENTS.find(item => item.id === id);
  const { saved, toggleSaved } = useSavedEvents();
  const [shareStatus, setShareStatus] = useState("");
  useEffect(() => {
    if (!event) return;
    trackEvent("event_detail_view", { event_id: event.id });
    const script = document.createElement("script"); script.type = "application/ld+json"; script.dataset.eventJsonld = event.id; script.textContent = JSON.stringify(buildEventJsonLd(event)); document.head.appendChild(script);
    return () => { script.remove(); };
  }, [event]);
  useEffect(() => { setShareStatus(""); }, [id]);
  if (!event) return <Missing type="events" to="/events" />;
  async function share() {
    if (!event) return;
    if (navigator.share) { try { await navigator.share({ title: event.title, url: window.location.href }); return; } catch (error) { if (error instanceof Error && error.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(window.location.href); setShareStatus("Link copied"); } catch { setShareStatus("Copy the page address from your browser to share this event."); }
  }
  const sourceUrl = event.url || event.sourceUrl;
  const related = ALL_EVENTS.filter(item => item.id !== event.id && item.category === event.category).slice(0, 3);
  return <main id="main-content" className="shell detail-page"><BackLink to="/events">All events</BackLink><div className="detail-layout"><article><p className="eyebrow">{event.category === "Learn" ? "Learning" : event.category}{isEventFeatured(event) && " · Sponsored"}</p><h1>{event.title}</h1><ListingStatus item={event} /><p className="detail-lead">{event.venue || "Location details from the organizer"}</p>{event.image && <img className="detail-image" src={event.image} alt="" />}<section className="detail-copy"><h2>About this event</h2>{textParagraphs(event.description).length ? textParagraphs(event.description).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>Visit the organizer’s page for the full event details.</p>}</section><div className="source-note"><p className="eyebrow">Before you go</p><p>Times are shown in Leander’s time zone. Check the organizer’s page for pricing, registration, accessibility, and any last-minute changes.</p>{sourceUrl && <a className="text-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">View original listing <ArrowUpRight size={15} /></a>}</div></article><aside><Card className="detail-action-card"><CardContent><p className="eyebrow">Make a plan</p><dl className="detail-facts"><div><dt><CalendarDays size={18} />When</dt><dd>{formatDate(event.startsAt)}<small>{formatTimeRange(event)}</small></dd></div><div><dt><MapPin size={18} />Where</dt><dd>{event.venue || "See organizer"}{event.address && <small>{event.address}</small>}</dd></div></dl><Button className="w-full" onClick={() => { downloadEventIcs(event); trackEvent("ics_downloaded", { event_id: event.id }); }}><CalendarPlus size={17} />Add to calendar</Button><Button variant="outline" className="w-full" aria-pressed={saved.has(event.id)} onClick={() => toggleSaved(event.id)}><Heart size={17} fill={saved.has(event.id) ? "currentColor" : "none"} />{saved.has(event.id) ? "Saved on this device" : "Save this event"}</Button><Button variant="ghost" className="w-full" onClick={share}>{shareStatus === "Link copied" ? <Check size={17} /> : <Share2 size={17} />}{shareStatus === "Link copied" ? shareStatus : "Share with a friend"}</Button><p className="fine-print" role="status">{shareStatus && shareStatus !== "Link copied" ? shareStatus : "No account needed. Saved events stay in this browser."}</p></CardContent></Card><Link className="correction-link" to="/submit?type=event">Something changed? Send a correction</Link></aside></div>{related.length > 0 && <section className="section-block"><SectionHeading title="Keep exploring." to="/events" link="All events" /><div className="event-grid">{related.map(item => <LocalEventCard key={item.id} event={item} />)}</div></section>}</main>;
}

export function JobDetailPage() {
  const { id } = useParams();
  const job = ALL_JOBS.find(item => item.id === id);
  if (!job) return <Missing type="jobs" to="/jobs" />;
  return <main id="main-content" className="shell detail-page"><BackLink to="/jobs">All jobs</BackLink><div className="detail-layout"><article><p className="eyebrow">{job.company}{job.featured && " · Sponsored"}</p><h1>{job.title}</h1><ListingStatus item={job} /><p className="detail-lead">{job.location} · {job.type}</p><section className="detail-copy"><h2>The opportunity</h2>{textParagraphs(job.description).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section><div className="source-note"><p className="eyebrow">From the source</p><p>This listing links to the employer’s application process. Confirm that the role is still open and check the employer’s full requirements before applying.</p></div></article><aside><Card className="detail-action-card"><CardContent><p className="eyebrow">At a glance</p><dl className="detail-facts"><div><dt>Employer</dt><dd>{job.company}</dd></div><div><dt>Work type</dt><dd>{job.type}</dd></div>{job.payRange && <div><dt>Listed compensation</dt><dd>{formatPay(job.payRange)}</dd></div>}{job.postedAt && <div><dt>Posted by employer</dt><dd>{formatDate(job.postedAt)}</dd></div>}{job.closesAt && <div><dt>Closes</dt><dd>{formatDate(job.closesAt)}</dd></div>}</dl><Button asChild className="w-full"><a href={job.applyUrl} target="_blank" rel="noopener noreferrer">Apply with employer <ArrowUpRight size={17} /></a></Button><p className="fine-print">Opens the employer’s site. Leander Live does not collect your application.</p></CardContent></Card><Link className="correction-link" to="/submit?type=job">Report an outdated listing</Link></aside></div></main>;
}

export function BusinessDetailPage() {
  const { id } = useParams();
  const business = ALL_BUSINESSES.find(item => item.id === id);
  if (!business) return <Missing type="businesses" to="/businesses" />;
  const address = `${business.address}, Leander, TX ${business.zip}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${address}`)}`;
  return <main id="main-content" className="shell detail-page"><BackLink to="/businesses">All businesses</BackLink><div className="detail-layout"><article><p className="eyebrow">{business.category}{business.featured && " · Sponsored"}</p><h1>{business.name}</h1><p className="detail-lead">{address}</p><section className="detail-copy"><h2>In the neighborhood</h2><p>{business.name} appears in public sales-tax permit records for Leander, Texas. This directory helps you discover businesses in the area; a permit record does not confirm opening status, hours, or available services.</p><p>Check with the business before making a trip.</p></section><div className="source-note"><p className="eyebrow">Is this your business?</p><p>Help neighbors find accurate information. Send your website, hours, and any corrections for review.</p><Button asChild variant="outline"><Link to="/submit?type=business">Update this listing <ArrowUpRight size={16} /></Link></Button></div></article><aside><Card className="detail-action-card"><CardContent><p className="eyebrow">Business details</p><dl className="detail-facts"><div><dt>Category</dt><dd>{business.category}</dd></div><div><dt><MapPin size={18} />Recorded address</dt><dd>{address}</dd></div>{business.permitIssuedAt && <div><dt>Permit issued</dt><dd>{formatDate(business.permitIssuedAt)}</dd></div>}</dl><Button asChild className="w-full"><a href={mapsUrl} target="_blank" rel="noopener noreferrer">Open in Maps <ArrowUpRight size={17} /></a></Button>{business.sourceUrl && <a className="text-link" href={business.sourceUrl} target="_blank" rel="noopener noreferrer">Public record source <ArrowUpRight size={14} /></a>}<p className="fine-print">Public directory data, not an endorsement or verification that the business is open.</p></CardContent></Card></aside></div></main>;
}
