# Preservation-first UIARC uplift: source review checkpoint

## User direction and boundaries

The user rejected PR16's replacement design and asked to uplift the **old** design with UIARC while retaining the photography and logo. This is a new, separate source-only worktree/branch, `uplift/uiarc-preserve`, based on `rebuild/vercel-static` at `d2c6b3c3445d16bc0d34c80c0cf78f82c7def8b0`. The rejected branch and its preview are untouched. No deployment, push or remote ref update is part of this checkpoint.

## Verified original baseline

A fresh build of original source `3db9a86a9123ea1705ac83427effc3ecb1c4d694` reproduced production `dpl_45yHF2R9d2ytYvjWtCkWUWUW7Xv7` byte-for-byte:

| Runtime file | SHA-1, matches deployment |
|---|---|
| index.html | 19e26132dc8639107b267b306cc6a03fa1d15476 |
| assets/index-CRGrW2-l.js | b5e70f04cc5f70e27c885e30809e6635570416bb |
| assets/index-nQcGk_gY.css | b3010d79d997d40cfeef512cb6a3fb137a9dce82 |

The selected d2c6b3c base preserves that visual identity while adding independently reviewed feed/date/source safeguards. Reverting those safeguards is not needed to preserve the design.

## Source changes in this first gate

- Actual pinned UIARC foundation, Button, Card, SearchField, Input, Textarea, Badge, Alert, Checkbox, Select and Dialog implementations, with documented compatibility adapters.
- Existing logo, hero and event photography, Archivo font, navy/orange/gold/paper palette, content, section order and routes retained.
- Home hero's existing pill search now contains genuine UIARC SearchField and Button, without changing its search destination or headline.
- Event search now uses UIARC SearchField, retaining visible placeholder/copy and adding its clear-search behavior.
- Compact event-photo cards now render on the genuine UIARC Card surface, with the original image, thumbnail sizing, colored edge, date chip, title/details/save behavior and shared all-day labels.
- Original default utility classes and callsite overrides outrank component CSS through an explicit cascade layer order. This avoids inadvertently replacing original brand colors, corner radii, heights or padding.
- No changes to data files, scraper/automation code, source gates, routes, page order, chrome or shared date/ICS/JSON-LD helpers.

Provenance and the exact upstream adaptations are in `UIARC.md`. The original foundation remains byte-exact; ten CSS modules receive only a cascade-layer wrapper. There are no generated/replacement images.

## Verification

- `npm test`: 88 feed/parser/date/source-compliance tests pass.
- `npm run test:uiarc`: 8 adapter tests pass, including actual Arc rendering, semantic links, labels and preservation of caller color/radius/spacing overrides.
- `npm run test:preservation`: 10 tests pass; the non-executable fixture `scripts/lib/fixtures/uiarc-preserved-files.json` hashes 70 original files (all public assets, data, scripts, safeguards, routes, chrome, page composition and shared time/ICS/JSON-LD files).
- `npm run validate:listings`: pass.
- `npm run build`: TypeScript and production Vite pass.
- `git diff --check`: pass.
- Main-bundle warning remains: approximately 1.1 MB uncompressed / 285 KB gzip. This checkpoint does not claim a performance improvement.

## Visual and runtime status — NOT RUN for the uplift

Before captures were taken from the actual production home/events pages at 1180 CSS pixels. They are preserved outside this worktree at `../leander-original-evidence/live-home-20261030.png` and `live-events-20261030.png`.

`qa/render-preservation.mjs` creates local, script-free static HTML from the actual React pages and production CSS. It has CSP rules disabling scripts, connections and form submissions, and does not host or publish anything. Current fixtures are outside this worktree at `../leander-original-evidence/uplift/`.

Attempting to render the 193KB home fixture in the cloud browser was blocked before execution: **“JavaScript execution exceeds the 64000-byte strict auto-review limit.”** The action was stopped. There was no chunking, alternate-route attempt, deployment or retry of the earlier managed-DevTools restriction. The new browser tab remained blank. Therefore:

- **No after-screenshots, side-by-side visual approval, narrow-layout approval, or runtime interaction pass is claimed.**
- The source must receive independent review, then use a separately permitted browser-accessible preview or test environment for that gate.
- Required runtime checks include actual logo/hero crop/spacing at desktop and narrow widths; search/clear and repeated filtering; save/unsave/reload; select keyboard operation; dialog open/Escape/close/reopen and focus restoration; form validation and reduced motion.

## Remaining component migration and release scope

1. Review the four original native action controls before claiming every application component is migrated: job row and business row detail buttons (`content.tsx`), footer submission action (`chrome.tsx`), and the legacy filter control in `conceptA.tsx`. The latter's actual route usage should be confirmed before changing it. Semantic article/nav/links are not automatically replacement component libraries.
2. Review job/business row surfaces and home jobs-preview grouping, event-detail actions, City Hall and submission/promotion pages in the original visual language after the home/events visual gate. Shared field/select/dialog imports already use UIARC, but their runtime flows have not been verified in this branch.
3. Unused historical avatar/dropdown/sheet/skeleton/table/tabs files remain untouched and are not claimed as migrated; no application imports were found.
4. Original inherited issues remain outside this initial visual checkpoint: ambiguous salary formatting may guess hourly units, source-paused metadata needs visible presentation, and existing promotion/lead/freshness wording must be reconciled with actual email-only operations before release. Do not interpret visual preservation as approval to publish misleading availability/payment claims.
5. Preserve all reviewed source flags OFF. No feed activation, Stripe activation, new checkout, or automated fulfillment is implemented.

This is a reviewable first-gate source patch, not a completed production release or a visually approved redesign.

## Source-review correction (v2)

Independent review found the first patch's aggregate feed result was 86/88, not 88/88 once all new files were tracked. The original local run preceded `git add -N`; two existing `git grep` import-boundary tests did not see the then-untracked checksum manifest. After it became tracked, its literal source paths were incorrectly counted as imports. The original patch is retained for audit.

The manifest is now a non-executable fixture under the existing `scripts/lib/fixtures` test-data directory, consistent with the existing boundary exclusion. The two boundary tests, all production modules, and all manifest checksum entries are unchanged. Every file is included in Git's tracked-file view before the v2 full test run. This fixes the metadata false positive without adding an exception or weakening source import boundaries.

A second review finding identified collisions between UIARC foundation and Tailwind's globally named text-size tokens. The product boundary now explicitly restores the original xs–6xl scale (including 4xl=2.25rem and 5xl=3rem); upstream foundation remains untouched. A compiled-CSS cascade regression resolves global root declarations by actual cascade layer precedence and checks every preserved size, rather than relying only on asset/source hashes. Build must precede `test:preservation` for this check.

The complete authentic Arc MIT license is now included in the production distribution as `third-party-notices.txt`, referenced by a document-head license link. A regression checks the built artifact contains the full original notice. This adds a notice file, not a replacement photo/brand asset.
