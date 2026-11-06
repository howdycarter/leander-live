# Leander Live — Component Inventory & Primary Color

Chris's directives, Nov 6, 2026 (Linear CHR-2357):

1. **Uiarc-only component layer** — every component is Uiarc (Arc UI Pro);
   where Uiarc has no component, shadcn fills the gap. No hand-rolled
   duplicates of things either library provides.
2. **Primary color = Leander blue, not clay orange.**

Branch: `uiarc-only-leander-blue` (off `rebuild/vercel-static`).

## Primary color — Leander blue

- **Adopted: `#002454`.**
- **Evidence:** sampled from the site's own header logo lockup,
  `public/brand/logo-leander-live.png` — the median of 43,678 opaque blue
  pixels is `#002454` (dominant cluster #002453–#012455); the wordmark gold
  in the same asset is `#e8a504`.
- **Discrepancy noted:** `public/brand/logo-mark.png` (the standalone mark)
  reads a slightly lighter blue, median `#012d5d`, gold `#f1a902`. Per the
  ruling's tie-break, the header lockup — the logo actually kept and shown
  on every page — wins. The previous token value `#16324f` did not match
  either asset; it is retained only as `--color-secondary`, a lighter
  mid-blue tier for secondary surfaces so primary keeps its hierarchy.
- **Changed tokens** (`src/index.css`): `--color-primary`, `--color-ring`,
  `--color-navy` → `#002454`; UIARC foundation overrides `--accent`,
  `--control-on`, `--focus-outline` → `#002454`, `--accent-strong` →
  `#001a3e` (derived darker shade for hover/pressed), `--accent-subtle` →
  `#00245414`. `NAVY` constant in `src/site/conceptA.tsx` (hero + CTA band
  backgrounds) → `#002454`.
- **Untouched:** gold accent `--color-accent: #d98a1f` (featured/sponsored
  highlights — an accent, not the primary), all photography, content, data.
- **Known leftover:** `src/site/businesses.tsx` lines 74 + 125 hardcode
  `text-[#bc4519]` ("Opening soon" labels). That file belongs to the
  businesses chat-search lane (CHR-2355) and was deliberately not touched;
  those two spans are the only clay-orange left on the site and should be
  switched to `text-primary` when that lane's work merges.

## Component inventory — before → after

### Uiarc (Arc) — vendored in `src/components/arc/`, used directly

| Component | Used from |
|---|---|
| AnnouncementBar | `src/site/chrome.tsx` |
| SearchField | `src/site/upliftSearch.tsx` |
| ChipGroup | businesses, conceptA, content |
| EmptyState | businesses, conceptA, content, pages |
| MetricCard, MetricTicker | conceptA (homepage) |
| SegmentedControl | content, paymentStep |
| AnimatedCounter | homepage stats (via MetricTicker composition) |
| foundation.css + motion tokens | global (`ui/arc-entry.css`) |

### Uiarc behind the compat layer — `src/components/ui/*`

The previous redesign gave these files a shadcn-shaped API, but every one
is implemented on the genuine Arc component (verified by
`src/components/ui/__tests__/compat.test.mjs`, 11/11 passing):

| File | Backing |
|---|---|
| button.tsx | Arc Button (+ Radix Slot for `asChild`) |
| badge.tsx | Arc Badge |
| card.tsx | Arc Card; Header/Title/Description/Content/Footer are layout compositions |
| alert.tsx | Arc Alert |
| checkbox.tsx | Arc Checkbox |
| input.tsx / textarea.tsx | Arc Input / Arc Textarea |
| label.tsx | Arc Input module label styles |
| select.tsx | Arc Select (compound shadcn call sites are translated) |
| dialog.tsx | Arc Dialog (+ Radix Title/Description/Portal semantics) |

### shadcn — gap-fillers only (Uiarc has no equivalent)

Registry availability was checked firsthand against both the free
registry (`uiarc.dev/r/{name}.json`) and the Pro registry on Nov 6, 2026:

| File | Why it stays |
|---|---|
| separator.tsx | Uiarc has **no** separator/divider (404 on free + Pro registries). Plain div implementation, used by chrome/content. |
| table.tsx | Uiarc has **no** table/data-table (404 on both). Currently unused; retained as the sanctioned fallback. |
| dropdown-menu.tsx | Uiarc has **no** dropdown-menu/menu (404 on both; it offers popover/context-menu instead, different semantics). Currently unused; retained as the sanctioned fallback. |

### Removed — shadcn duplicates of components Uiarc provides

All four were dead code (imported nowhere in the repo) **and** duplicate a
component Uiarc ships (each verified present in the free registry):

| Removed file | Uiarc equivalent |
|---|---|
| ui/avatar.tsx (Radix Avatar) | `avatar` |
| ui/tabs.tsx (Radix Tabs) | `tabs` |
| ui/sheet.tsx (Radix Dialog) | `drawer` |
| ui/skeleton.tsx (hand-rolled pulse div) | `skeleton` |

Note: `@radix-ui/react-avatar` and `@radix-ui/react-tabs` in package.json
are now unreferenced; left in place to avoid package.json churn against
parallel lanes — remove on the next dependency pass.

### Hand-rolled — reviewed, kept with reasons

| Item | Verdict |
|---|---|
| Full-card click-layer `<button>` (content.tsx jobs card; businesses.tsx business card) | Composition pattern (invisible stretched hit-area over a card), not a Button duplicate — neither library provides it. Kept. |
| Footer "Privacy choices" `<button>` (chrome.tsx) | Deliberately styled byte-identical to the sibling `FooterLink` anchors (`inline-block py-1 text-body text-white/80`). Arc Button's control chrome (min-height, hover surface) visibly regresses the footer link row. Kept as a documented exception. |
| TabBar mobile nav (chrome.tsx) | App navigation composition (router Links + active state); Uiarc has no tab-bar/bottom-navigation (404 on both registries). Kept. |
| Page compositions (PageHero, BusinessRow, MeetingCard, NewsCard, cards in conceptA/cityHall, CookieConsent banner) | Page-level compositions built **from** the library components above — not library primitives. Kept. |
| CookieConsent | Composition of ui Buttons + layout; no Uiarc consent primitive. Kept. |

## Verification (Nov 6, 2026, this branch)

- `npm run build` — passes.
- `npm run test:uiarc` — 11 pass / 0 fail.
- `npm run test:preservation` — 24 pass / 2 fail. The brand-token test was
  updated to pin the new blue (Chris's ruling supersedes the pinned
  orange). The 2 remaining failures are pre-existing at the base commit
  and belong to the data lane's in-flight source-status work
  ("original assets, routes, data…" — driven by other lanes' uncommitted
  edits in the shared tree; "truthful source states…" — source-status
  metadata). Baseline check with these changes stashed reproduced the
  same failures.
- `npm test` (scripts) — failures limited to the same pre-existing
  source-compliance item from the data lane.
- **Rendered check** (Playwright/Chromium against `vite preview`,
  1440×900 and 390×844, routes `/`, `/events`, `/jobs`, `/businesses`,
  `/city-hall`, `/advertise`): primary CTA computed background is
  `rgb(0, 36, 84)` (#002454) with white text on every route; computed-style
  sweep found **zero** elements using the old orange `rgb(188, 69, 25)`
  except the flagged businesses.tsx "Opening soon" spans; Advertise page
  shows the $5 Standard / $10 Sponsored cards intact with blue CTAs; the
  Submit Event dialog opens with the Arc Select working and a blue
  "Continue to payment" button (paid-posting flow intact, still
  fail-closed on payment as before). Screenshots reviewed at both widths:
  no layout regressions; gold remains only as the accent (script tagline,
  location pill, hero Search button, sponsored highlights).
