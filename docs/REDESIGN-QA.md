# UIARC redesign — review notes

Tracking: CHR2013. Base: `rebuild/vercel-static`, not `main`.

## Scope

- Search-first responsive home, full navigation at phone/tablet/desktop widths.
- URL-backed event/job/business search and filters, saved-event views, stable detail routes.
- Event JSON-LD, canonical URLs, source links, Central-time formatting and ICS remain on shared helpers.
- Genuine UIARC foundation, search, buttons, cards, fields and selection/dialog primitives. See `UIARC.md` for pinned source and adaptations.
- Submission review step generates a draft, never claims it was sent, and offers email/copy/manual fallback. Promotions are proposed rates/inquiries only. No payment processing, lead service, automated email delivery, or publication is implied.
- No scraper, feed data, feed helper, calendar or deployment edits.

## Verified so far

- `npm run build`: pass (TypeScript + Vite).
- `npm run test:uiarc`: 8 tests pass.
- Submission draft generator: 14 isolated assertions pass (timed/all-day, job/business, proposed plan, URL encoding, no sent/paid claim).
- `git diff --check`: pass.

## Pending before release

- Rendered desktop/mobile and keyboard/interaction QA on browser-accessible preview. Cloud browser and shell localhost are separate surfaces; CUA receives connection refused. No production deployment performed.
- Coordinated integration of feed PRs, including source-paused status metadata and all-day corrections. Do not cherry-pick this redesign without preserving those protections.
- Final source metadata integration, full rerun, independent code/design review.
- Vite reports a large main chunk; static source JSON and UIARC motion contribute. This is a performance warning, not a build failure.
