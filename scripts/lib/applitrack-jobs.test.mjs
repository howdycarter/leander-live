import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APPLITRACK_LIST_URL,
  parseAppliTrackListingHtml,
  selectFreshIsdJobs,
} from './applitrack-jobs.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const NOW = Date.parse('2026-11-04T12:00:00-06:00');

test('the listing URL is the official noscript AppliTrack board, not a paid renderer', () => {
  assert.match(APPLITRACK_LIST_URL, /applitrack\.com\/leander\/onlineapp\/JobPostings\/view\.asp/);
  assert.match(APPLITRACK_LIST_URL, /[?&]all=1/);
  assert.match(APPLITRACK_LIST_URL, /[?&]embed=1/);
  assert.doesNotMatch(APPLITRACK_LIST_URL, /firecrawl/i);
});

test('parses current Leander ISD postings from the embed HTML listing', () => {
  const jobs = parseAppliTrackListingHtml(fixture('applitrack-embed.html'));
  assert.equal(jobs.length, 3);
  const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));

  const teacher = byId['applitrack-10217'];
  assert.equal(teacher.title, '2026/27 Elementary Dual Language Teacher, Grades K-5th ($7,000 Stipend)');
  assert.equal(teacher.company, 'Leander ISD');
  assert.equal(teacher.location, '*Various Elementary Schools');
  assert.equal(teacher.type, 'full-time');
  assert.equal(teacher.payRange, 'Teacher Salary + Stipend');
  assert.equal(teacher.postedAt, Date.parse('9/17/2026'));
  assert.equal(teacher.closesAt, undefined);
  assert.equal(teacher.source, 'applitrack');
  assert.equal(teacher.sourceUrl, APPLITRACK_LIST_URL);
  assert.equal(
    teacher.applyUrl,
    'https://www.applitrack.com/leander/onlineapp/default.aspx?AppliTrackJobId=10217',
  );

  const chief = byId['applitrack-10873'];
  assert.equal(chief.title, '2026/27 Chief of Police');
  assert.equal(chief.location, 'Police Department');
  assert.equal(chief.payRange, '$150,062 + approved work experience');
  assert.equal(chief.postedAt, Date.parse('10/28/2026'));
  assert.match(chief.description, /17 - POLICE DEPARTMENT/);

  const sub = byId['applitrack-10870'];
  assert.equal(sub.title, '2026/27 Substitute - Classroom Teacher');
  assert.equal(sub.type, 'part-time');
  assert.equal(sub.closesAt, Date.parse('12/15/2026'));
});

test('malformed or empty AppliTrack listings fail instead of returning zero jobs', () => {
  assert.throws(() => parseAppliTrackListingHtml(''), /empty|no JobID/i);
  assert.throws(() => parseAppliTrackListingHtml('   '), /empty|no JobID/i);
  assert.throws(
    () => parseAppliTrackListingHtml('<html><body>Open Positions</body></html>'),
    /no JobID/i,
  );
  const jsShell = `<html><body>
    <h1>Open Positions for Leander Independent School District</h1>
    <script>var targetURL = "Output.asp"; document.write('<script src="' + targetURL + '"><\\/script>');</script>
    <noscript><a href="view.asp?embed=1">Click here to view the Job Postings.</a></noscript>
    FMLA regulations require all employers to post the updated FMLA notice.
  </body></html>`;
  assert.throws(() => parseAppliTrackListingHtml(jsShell), /no JobID/i);
});

test('undated postings are skipped, and a listing with no dated jobs fails', () => {
  const html = `<ul class='postingsList'>
    <table class='title'><tr>
      <td id='wrapword'>Undated posting</td>
      <td><span class='title2'> JobID: 1 </span></td>
    </tr></table>
    <div><li><span class='label'>Position Type:</span><span class='normal'>Teacher</span></li></div>
  </ul>`;
  assert.throws(() => parseAppliTrackListingHtml(html), /no dated|no JobID|posted/i);
});

test('freshness selection fails loudly when every posting is outside the age window', () => {
  const jobs = parseAppliTrackListingHtml(fixture('applitrack-embed.html'));
  assert.throws(
    () => selectFreshIsdJobs(jobs, { now: Date.parse('2028-01-01T00:00:00Z'), maxAgeDays: 150, maxJobs: 60 }),
    /no fresh ISD postings/i,
  );
  const fresh = selectFreshIsdJobs(jobs, { now: NOW, maxAgeDays: 150, maxJobs: 2 });
  assert.deepEqual(fresh.map((j) => j.id), ['applitrack-10873', 'applitrack-10870']);
});
