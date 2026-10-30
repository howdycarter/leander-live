# UIARC provenance and integration

Leander Live uses the genuine free [UIARC / Arc Library](https://uiarc.dev) implementation, not a lookalike or a replacement UI library.

## Source and license

- Upstream: <https://github.com/kuratlielia/arc-library>
- Pinned upstream revision: `df3a600fd9ffca85ec8607438b599a4408ab8562`
- Installation documentation: <https://uiarc.dev/docs/installation>
- Retrieved: October 30, 2026
- License: MIT, Copyright (c) 2026 Elia Kuratli. The complete notice is retained in `src/components/arc/LICENSE`.
- Materialization route: files from upstream `public/r/*.json`, copied to each registry item's declared `@components/arc/` destination. This is the same source distributed by the documented UIARC registry; no Pro code, credentials, external asset substitutions, or invented UIARC components are used.

The installed items are `arc-foundation`, `arc-motion-tokens`, `button`, `card`, `input`, `textarea`, `search-field`, `checkbox`, `dialog`, `select`, `badge`, and `alert`. `components.json` registers the authentic `@uiarc` namespace for subsequent additions.

UIARC's own Motion and Radix dependencies provide animation and accessible behavior. React and ReactDOM are upgraded together to React 19, as required by UIARC; TypeScript targets ES2023. `foundation.css` is imported once before the product theme in `src/main.tsx`. The product theme may override documented CSS tokens; the upstream foundation remains intact.

## Local compatibility changes

The existing site has compound component call sites. Thin adapters in `src/components/ui/` keep that API while rendering UIARC components and CSS, allowing the underlying feed, form and routing behavior to remain unchanged.

Declared extensions to the copied upstream implementation:

1. `Input` and `Textarea` accept an optional internal `label` and omit that element when an existing external native label already names the control. Generated IDs, errors, hint associations and input behavior are unchanged.
2. `Card` accepts an optional title and omits its generated heading when the caller composes a heading in its children. Its actual UIARC surface, hover treatment and motion are retained. Compound helpers provide semantic content/header/footer slots using the foundation tokens.
3. `DialogContent` accepts an optional React header slot; compound call sites use UIARC's layout and native Radix Title/Description semantics without flattening rich job/business metadata into a string. The source's presence animation, portal, focus trap, Escape dismissal and outside-pointer handling remain in place.
4. `Checkbox` does not insert the generic accessible name “Checkbox” when a surrounding label already supplies the meaningful name. Explicit `aria-label` still works.
5. The button adapter maps old variant names to UIARC variants. `asChild` links remain actual anchors/React Router links styled with UIARC's source CSS; they do not become nested interactive buttons. Native button actions render the actual animated UIARC Button.
6. The select adapter turns the existing compound option tree into the actual UIARC Select `options` API. It preserves option text, value, disabled states, required validation, selected value and callbacks. Radix remains the underlying accessible select because it is UIARC's own implementation.
7. Dialog adapters remember the active opener before autofocus and restore it after close, including programmatically opened dialogs without a Radix Trigger. Custom autofocus handlers retain their cancellation behavior.
8. Alert and badge adapters map old props to the actual UIARC components. A native label and separator use UIARC field styles/foundation tokens; these are semantic composition helpers, not falsely attributed standalone UIARC components.

`src/components/ui/compat.css` only handles composition and legacy layout slots; it is not a separate visual component library. Site-level design and application composition live outside the vendored source.

## Updating

Compare the pinned revision and declared local changes before replacing vendored files. Preserve the MIT notice. Run `npm run test:uiarc` (eight focused SSR compatibility checks) and `npm run build`, then verify keyboard navigation, dialog open/close/reopen, Escape and focus return, required form validation, select changes, and reduced-motion behavior after upgrading.
