# UIARC integration — original-design preservation

This branch upgrades Leander Live's **existing** interface to genuine [UIARC / Arc Library](https://uiarc.dev) primitives. It does not replace the original page layouts, photography, logo, copy, navigation, palette, or Archivo typography.

## Source and license

- Official source: <https://github.com/kuratlielia/arc-library>
- Pinned revision: `df3a600fd9ffca85ec8607438b599a4408ab8562`
- Installation documentation: <https://uiarc.dev/docs/installation>
- Copied from that revision's `public/r/*.json` file contents to the declared `@components/arc/` paths.
- License: MIT, Copyright (c) 2026 Elia Kuratli. Full original notice: `src/components/arc/LICENSE`. The full notice is also shipped as `public/third-party-notices.txt` → `dist/third-party-notices.txt`, with a license link in the document head. A distribution regression checks its complete contents.
- No Pro source, invented UIARC components, new image assets, or credentialed registry access is used.

Installed items: `arc-foundation`, `arc-motion-tokens`, `button`, `card`, `input`, `textarea`, `search-field`, `checkbox`, `dialog`, `select`, `badge`, and `alert`. `components.json` contains the documented `@uiarc` registry URL. UIARC's source uses Motion and Radix for its animation and accessible primitives. React and ReactDOM are upgraded together to React 19; TypeScript targets ES2023.

## Preserve the existing appearance

The existing application imports `src/components/ui/*`. These now adapt **actual UIARC components** while retaining the existing default utility classes and the caller's Tailwind overrides. Default buttons remain burnt orange; secondary remains navy; explicit white or navy page-level variants remain white or navy. Component corner radii, input/button heights and section/card padding continue to follow the existing site's utility contract.

CSS ordering is deliberate:

1. `src/components/ui/arc-entry.css`, imported before `App`, establishes `theme, base, components, utilities` cascade order.
2. The upstream `foundation.css` remains byte-for-byte unchanged and is imported in `base`.
3. Each of the ten upstream component CSS modules has only an enclosing `@layer components` added; its original contents are unchanged.
4. `compat.css` is in `components` and handles compound layout slots and the original dialog/checkbox proportions.
5. Existing Tailwind classes live in `utilities`, so application padding, colors, heights, radii, text sizes and responsive overrides outrank module styles regardless of selector specificity. Product token overrides remain in `src/index.css`. In particular, the shared `--text-*` names are explicitly restored to the original Tailwind xs–6xl scale at the product boundary, preventing UIARC foundation from enlarging existing headings. A compiled-CSS cascade regression checks the effective values.

The production CSS was inspected with PostCSS after build: UIARC button selectors are in `components`, and `.h-9`, `.rounded-full`, `.bg-navy`, and `.bg-white` are in `utilities`. This establishes cascade precedence without requiring a browser or changing the original design.

## Declared source extensions

Seven vendored files are byte-for-byte upstream; ten CSS modules differ only by their cascade-layer wrapper. Six TSX files have these compatibility extensions:

- **Input / Textarea:** optional internal label, omitted when a native external label already names the control. IDs, error/hint associations and field behavior remain intact.
- **Card:** optional generated title, omitted when the caller composes its own heading. The actual UIARC surface and hover/reduced-motion implementation remain in use.
- **Checkbox:** do not replace an external label's meaningful accessible name with the upstream generic “Checkbox” fallback. An explicit `aria-label` still works.
- **DialogContent:** an optional React header slot supports existing rich title/description content while retaining UIARC's portal, motion, focus trap, Escape dismissal and outside-pointer handling.
- **Alert:** optional title and icon let existing confirmation messages retain their original copy and supplied icon without adding an invented heading. The actual UIARC alert layout and presence behavior remain in use.

Other adapters:

- Button maps existing variant names to UIARC variants and retains the original utility defaults. `asChild` uses a semantic Slot so anchors and React Router Links remain links, with merged refs and event handlers, styled using genuine UIARC CSS. Native button actions render the animated UIARC Button.
- Compound Select options become UIARC's real `options` API, preserving values, labels, disabled states, required validation and change callbacks. Its internal accessible label is visually hidden to avoid duplicating the site's original labels.
- Compound Card and Dialog slots retain their semantic heading/description elements and existing spacing. Programmatically opened dialogs capture the opener before autofocus and restore it on close, including when no Radix Trigger is present.
- Badge keeps every original variant, including `accent`, through brand utilities on the real UIARC Badge.
- Native Label and Separator helpers use the existing utility contract and UIARC field/foundation styles; they are not claimed as standalone upstream components.

Existing unused avatar, dropdown-menu, sheet, skeleton, table and tabs files/dependencies are intentionally retained. Repository inspection found no application imports of them; this task does not falsely claim they were migrated or delete historical code unnecessarily.

## Verification and boundaries

- `npm run test:uiarc`: eight focused SSR compatibility checks (buttons, semantic links, card headings, external/internal labels, checkbox naming, Select mapping, and closed Dialog state).
- `npm run build`: TypeScript plus production Vite build.
- Existing feed/parser/date and listing validation tests are untouched.
- SSR/source checks establish component structure and CSS layer precedence, **not** visual fidelity or full keyboard/browser behavior. Browser/native actions were not performed in this source-only task.
- No deployment, preview, push, reference mutation, or formal PR approval is performed by this component lane.
