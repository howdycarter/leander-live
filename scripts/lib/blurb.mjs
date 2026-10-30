// Card blurb derivation, moved from scripts/scrape-events.mjs so it can be tested.
const BOILERPLATE_DESC_RE = /see the (City of Leander|Leander Chamber of Commerce) calendar for details/i;

/**
 * Card blurb: neither source publishes a short hook, so derive one
 * mechanically from the event's own description — its first sentence,
 * clamped. Never invented copy; events whose only text is the boilerplate
 * placeholder get no blurb.
 */
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", mdash: "\u2014", ndash: "\u2013", hellip: "\u2026" };

/** Strip tags and decode entities, so truncation counts visible text only. */
export function htmlToPlain(raw) {
  return String(raw ?? "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") {
        const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
      }
      return NAMED[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveBlurb(ev) {
  if (ev.blurb && String(ev.blurb).trim()) return;
  const desc = htmlToPlain(ev.description);
  if (desc.length < 60 || BOILERPLATE_DESC_RE.test(desc)) return;
  const firstSentence = (desc.match(/^[^.!?]+[.!?]+/) || [desc])[0].trim();
  let blurb = firstSentence.length >= 40 ? firstSentence : desc;
  if (blurb.length > 140) {
    blurb = blurb.slice(0, 140).replace(/\s+\S*$/, "").trim() + "…";
  }
  if (blurb) ev.blurb = blurb;
}
