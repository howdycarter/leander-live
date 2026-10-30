// Manual submitted listings (source compliance).
//
// Employers, organizers and businesses can send listings directly. Each one
// is added by hand to src/data/submitted-listings.json and must pass this
// validator. The schema is documented in docs/submitted-listings.schema.json.

const KINDS = new Set(['job', 'event']);
const ID = /^sub-[a-z0-9-]{3,60}$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const MAX_TEXT = 2000;

/** A real calendar time: Date.parse alone rolls Feb 30 over to Mar 2. */
function isIso(v) {
  if (typeof v !== 'string') return false;
  const m = ISO.exec(v);
  if (!m) return false;
  const [y, mo, d, h, mi, sec = '0'] = m.slice(1, 7).map(Number);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth || h > 23 || mi > 59 || sec > 59) return false;
  if (m[9] !== undefined && (Number(m[9]) > 14 || Number(m[10]) > 59)) return false;
  return !Number.isNaN(Date.parse(v));
}

/** One https link given as a string (URL would coerce an array to a string). */
function isHttpsUrl(v) {
  if (typeof v !== 'string') return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname !== '';
  } catch {
    return false;
  }
}

/**
 * Validates one listing. Returns a list of problems (empty when valid).
 * @param {unknown} l
 */
export function listingProblems(l) {
  const p = [];
  if (!l || typeof l !== 'object' || Array.isArray(l)) return ['listing must be an object'];
  if (typeof l.id !== 'string' || !ID.test(l.id)) p.push('id must look like "sub-" plus 3 to 60 lowercase letters, digits or dashes');
  if (!KINDS.has(l.kind)) p.push('kind must be "job" or "event"');
  for (const f of ['title', 'organization']) {
    if (typeof l[f] !== 'string' || l[f].trim() === '') p.push(`${f} is required`);
    else if (l[f].length > 200) p.push(`${f} must be 200 characters or fewer`);
  }
  if (l.description !== undefined && (typeof l.description !== 'string' || l.description.length > MAX_TEXT)) {
    p.push(`description must be text of ${MAX_TEXT} characters or fewer`);
  }
  if (!isHttpsUrl(l.url)) p.push('url must be an https link to the original posting, given as one string');
  if (!isIso(l.submittedAt)) p.push('submittedAt must be an ISO 8601 time with a zone');
  if (!isIso(l.expiresAt)) p.push('expiresAt must be an ISO 8601 time with a zone');
  else if (isIso(l.submittedAt) && Date.parse(l.expiresAt) <= Date.parse(l.submittedAt)) p.push('expiresAt must be after submittedAt');
  if (l.kind === 'event') {
    if (!isIso(l.startsAt)) p.push('events need startsAt as an ISO 8601 time with a zone');
    if (l.endsAt !== undefined && (!isIso(l.endsAt) || Date.parse(l.endsAt) < Date.parse(l.startsAt))) p.push('endsAt must be a valid time not before startsAt');
  }
  if (l.rights !== 'submitter-owns-or-may-share') p.push('rights must be "submitter-owns-or-may-share" (the submitter confirmed it)');
  if (typeof l.paid !== 'boolean') p.push('paid must be true or false');
  return p;
}

/**
 * Validates the whole file. Returns { ok, problems } with problems keyed by index.
 * @param {unknown} list
 */
export function validateSubmittedListings(list) {
  if (!Array.isArray(list)) return { ok: false, problems: ['file must contain a JSON array'] };
  const problems = [];
  const seen = new Set();
  list.forEach((l, i) => {
    for (const msg of listingProblems(l)) problems.push(`[${i}] ${msg}`);
    if (l && typeof l.id === 'string') {
      if (seen.has(l.id)) problems.push(`[${i}] duplicate id ${l.id}`);
      seen.add(l.id);
    }
  });
  return { ok: problems.length === 0, problems };
}

/** Listings that are still current: not expired at `now` (ms). */
export function activeListings(list, now) {
  return list.filter((l) => Date.parse(l.expiresAt) > now);
}
