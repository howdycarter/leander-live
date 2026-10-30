# Preservation preview QA — exact head 69d04599

## Identity

- Draft PR: https://github.com/howdycarter/leander-live/pull/19
- Head: `69d04599073db67d6262e35b81a7f71de158ca40`
- Tree: `f1d54b19340e1b1079ebb94a00ad32eb7e6b4e47`
- Preview: https://leander-live-9s4tc662p-howdycarter.vercel.app/
- Deployment: `dpl_DTgicnN3cJmXLtSdXPzvtG6QHgCu`; target null (preview); aliases empty.
- Production remains `dpl_45yHF2R9d2ytYvjWtCkWUWUW7Xv7`.
- Access share token is private and deliberately omitted.

## Verified in the actual browser

| Area | Result and evidence |
|---|---|
| Home, desktop 1180 CSS px | Original actual logo, hero photo/crop, Archivo, navy/orange/gold/paper palette, headline, copy and section order match original captures. H1 60px. Document/client width 1165/1165, no horizontal overflow. |
| Events, desktop | Original photo header, 44px title, filter layout, compact photo cards/category edge/date chips retained. |
| Home, narrow 400 CSS px | Actual logo/photo/mobile bottom navigation retained. H1 36px. Document/client width 388/388, no overflow. |
| Events, narrow 400 CSS px | Original header/card composition retained; filter strip scrolls horizontally within its own container, not the document. Document/client width 388/388. |
| Search | Hero search Halloween navigates to `/events?q=Halloween`, 3 results. Clear resets the query and returns focus to search input. |
| Category keyboard flow | Open select, ArrowDown through Music/Food & Drink/Family, Enter selects Family: 22 results; focus returns to combobox. Reset gives 81 events. |
| Saved events | Save Halloween Flash Tattoo Day, saved view shows 1, reload preserves it; unsave returns the original empty saved state. |
| Event dialog | Opens with Close dialog focused; Escape dismisses and returns focus to Submit Event. Reopen and explicit close work. |
| Event detail, narrow | Halloween Flash Tattoo Day renders correctly after one host-crash reload. Document/client width 388/388. Date/time correctly display Oct 30, 10AM–6PM Central. Official link points to the Chamber page. JSON-LD includes `-05:00` start/end and canonical leanderlive.com event URL. |
| Console sampled | No app-origin errors observed. Captured errors were extension-origin browser-metadata messages, not application code. |

Narrow viewport was obtained by ordinary native window resize (508×848 window) and 125% browser zoom, yielding 400 CSS px. This is a narrow desktop layout test, **not** touch-device emulation or a real mobile-device test.

## Not verified / interrupted

- Calendar download: attempted via documented download-event wait/click; CDP prepare-tab operation timed out and the control kernel reset. Completion is unknown; do not call it passed or blindly repeat it.
- Share action was queued after the download but not reached/verified.
- Job/business detail interactions, new draft validation, email-app cancellation, copy failure and back/forward interruptions: not run on this exact preview.
- Reduced-motion preference/device behavior: not run.
- No narrow before-capture of original production: only desktop before/after comparisons are available.
- Later source/payment honesty corrections are **not present in this preview**. Their form retention has source-level evidence and regression coverage, but not runtime or visual approval.

## Infrastructure failure and stop boundary

On event-detail navigation Chromium displayed “Aw, Snap! Error code: 9.” One ordinary reload recovered the page and the detail checks above passed. Subsequently CDP prepare-tab timed out during calendar testing. Reattachment timed out and a native desktop screenshot showed the entire Chromium window had disappeared. The parent confirmed it did not restart or close the browser and classified this as a shared-browser infrastructure failure. Muse/Grok tabs were not touched. Browser width/zoom restoration could not execute because no window remained. No replacement browser, managed DevTools, hidden browser API, or oversized local-render retry was used.

## Preserved artifacts

Outside the source worktree, in `../leander-original-evidence/`:

- `live-home-20261030.png`, `live-events-20261030.png` — original production before captures.
- `qa-69d04599/home-desktop.png`, `events-desktop.png` — preview desktop.
- `qa-69d04599/home-narrow.png`, `events-narrow.png`, `detail-narrow.png` — actual narrow preview.
- Side-by-side PDF: `../output/pdf/leander-preservation-visual-review.pdf` from the workspace root; screenshots are embedded unchanged, no synthetic reconstruction. Three rendered PDF pages were visually inspected.

These results verify the preservation direction, not production readiness. Required next gate: independent source review of the later safety fixes, then an authorized exact-head preview and resumed runtime QA when the supported browser is healthy.
