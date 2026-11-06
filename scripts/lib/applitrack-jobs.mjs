/**
 * Leander ISD public job listings from Frontline AppliTrack.
 *
 * The JS board at JobPostings/view.asp?all=1 injects Output.asp and is empty
 * without a renderer. The same page publishes a noscript listing at
 * view.asp?all=1&embed=1 — that HTML is the official public board, allowed by
 * robots.txt (only district /onlineapp/admin paths are disallowed). No paid renderer.
 */
import * as cheerio from 'cheerio';

export const APPLITRACK_LIST_URL =
  'https://www.applitrack.com/leander/onlineapp/JobPostings/view.asp?all=1&embed=1';

export const APPLITRACK_DETAIL_URL = (id) =>
  `https://www.applitrack.com/leander/onlineapp/default.aspx?AppliTrackJobId=${id}`;

export const ISD_MAX_JOBS = 60;
export const ISD_MAX_AGE_DAYS = 150;

function normalizeLabel(text) {
  return String(text || '').replace(/:/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function inferType(text) {
  const t = (text || '').toLowerCase();
  if (/\bpart[\s-]?time\b/.test(t)) return 'part-time';
  if (/\btemporar/.test(t) || /\bseasonal\b/.test(t) || /\bintern/.test(t) || /\bsubstitute\b/.test(t)) {
    return 'temporary';
  }
  if (/\bcontract\b/.test(t)) return 'contract';
  return 'full-time';
}

function fieldMap($, $root) {
  const fields = {};
  if (!$root.length) return fields;
  $root.find('span.label, td.label').each((_, el) => {
    const $el = $(el);
    const label = normalizeLabel($el.text());
    if (!label) return;
    if ($el.is('td')) {
      const idx = $el.parent().children('td').index($el);
      const val = cleanText($el.closest('tr').next('tr').children('td').eq(idx).text());
      if (val) fields[label] = val;
      return;
    }
    const val = cleanText($el.closest('li').find('span.normal').first().text());
    if (val) fields[label] = val;
  });
  return fields;
}

function parseClosing(value) {
  const raw = cleanText(value);
  const m = raw.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
  if (!m) return undefined;
  const closesAt = Date.parse(m[0]);
  return Number.isFinite(closesAt) ? closesAt : undefined;
}

export function parseAppliTrackListingHtml(html) {
  if (typeof html !== 'string' || html.trim() === '') {
    throw new Error('AppliTrack listing is empty');
  }
  const $ = cheerio.load(html);
  const jobs = [];
  let jobIdBlocks = 0;
  $('table.title').each((_, table) => {
    const $table = $(table);
    const title = cleanText($table.find('td#wrapword').first().text());
    const idMatch = $table.find('.title2').first().text().match(/JobID:\s*(\d+)/i);
    if (!idMatch || !title) return;
    jobIdBlocks += 1;
    const $details = $table.next('div');
    const fields = fieldMap($, $details.length ? $details : $table.parent());
    const datePostedStr = fields['date posted'] || '';
    const postedAt = datePostedStr ? Date.parse(datePostedStr) : NaN;
    if (!Number.isFinite(postedAt)) return;

    const positionType = fields['position type'] || '';
    const location = fields.location || 'Leander, TX';
    const closingStr = fields['closing date'] || '';
    const salary = fields['salary range'] || '';
    const ftpt = fields['full/part-time'] || '';
    const closesAt = parseClosing(closingStr);

    jobs.push({
      id: `applitrack-${idMatch[1]}`,
      title,
      company: 'Leander ISD',
      location,
      type: inferType(`${ftpt} ${positionType}`),
      ...(salary ? { payRange: salary } : {}),
      description:
        `${positionType || 'District'} position at Leander ISD — ${location}. ` +
        `Posted ${datePostedStr}${closingStr ? `; closing: ${closingStr}` : ''}. ` +
        `See the Leander ISD job board for the full posting and application.`,
      applyUrl: APPLITRACK_DETAIL_URL(idMatch[1]),
      postedAt,
      ...(closesAt ? { closesAt } : {}),
      source: 'applitrack',
      sourceUrl: APPLITRACK_LIST_URL,
    });
  });
  if (jobIdBlocks === 0) throw new Error('no JobID blocks in AppliTrack listing');
  if (jobs.length === 0) throw new Error('no dated ISD postings in AppliTrack listing');
  return jobs;
}

export function selectFreshIsdJobs(
  jobs,
  { now = Date.now(), maxAgeDays = ISD_MAX_AGE_DAYS, maxJobs = ISD_MAX_JOBS } = {},
) {
  if (!Array.isArray(jobs)) throw new Error('ISD jobs result must be an array');
  const cutoff = now - maxAgeDays * 24 * 3600 * 1000;
  const fresh = jobs
    .filter((j) => Number.isFinite(j.postedAt) && j.postedAt >= cutoff)
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, maxJobs);
  if (fresh.length === 0) throw new Error('no fresh ISD postings parsed');
  return fresh;
}
