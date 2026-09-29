# Creative planning roadmap: first expansion

The authoritative 32-feature inventory and acceptance criteria live in `roadmap-progress.json`. Status distinguishes implemented code, integrated validation and released behavior. This batch advances NN-01/02/03/04/06/09 and the portable portion of NN-29; it does not complete the whole roadmap.

## Where to find it

- **Furniture library → Arrangements**: six recipes, private reusable kits, My furniture, Groups & locks, and Check fit.
- **Project → Layout ideas**: independent named alternatives and a matched-scale comparison.
- **Project → Selections & budget**: manual product specifications, prices, targets and CSV/print exports.
- **Project → Backups**: portable plan/media/reference packages, now including personal photos and references used only by saved layouts.

## Behavior and limits

Groups include only explicit selections; moving a shelf does not implicitly include decor. Groups keep rigid relative transforms and a common floor. There are at most 80 selected/grouped pieces, 100 groups, 2,000 individually locked pieces, 40 pieces per kit and 40 private kits. Structural/wall/ceiling/terrain attachments use their individual tools. Locks block ordinary edits, native-agent proposals and floor deletion; a deliberately confirmed layout restore remains a whole-design action. Shift/Ctrl/Meta-click adds or removes furniture; selected-group dragging and turning are a single undo step. Canvas dimensions are observed so opening the inspector does not misalign pointer picking.

Personal furniture uses measured dimensions with an explicitly approximate catalog visual. Original catalog definitions are never modified. Photos and notes are private, device-local assets with bounded storage (100 items/photos, 64 MB, 5 MB per original). Saving plan metadata online does not upload these image bytes. A portable backup carries referenced originals; missing files are reported. Public shares and furnishing tools omit notes, private image IDs and purchase details.

Fit review checks modeled footprints rather than complete mesh collision. It checks up to 600 solid items per floor, 120 neighboring obstacles per owner and 200 issues; vegetation does not consume that item budget. Truncation is shown. Door/drawer operating regions are optional, explicitly approximate and only offered for supported authored models. This is not code/accessibility certification or a moving-route assessment. Review preferences are editor-only and do not mutate geometry/history. Closing its settings retains the overlay; disabling it removes it. Listing captures omit the guides.

Named layouts retain immutable reference IDs, groups and budgets. Existing reference files receive versions when an idea is saved. Unavailable historical source files cannot be recreated; opening/restoring reports missing files. The comparison renders two compact SVGs, never two live 3D scenes. Preview paths are batched to bound DOM cost.

Specifications are manual, never scraped. Unknown prices are not zero; currencies are not converted; owned items are separate. A product URL and price date do not establish stock, rights, purchase readiness or exact-model geometry. Named room totals use current blueprint geometry and flag ambiguous/stale room membership. Personal proxies stay labeled in schedules. Printing uses the browser's Print / Save PDF flow; no certified drawing claim is made.

## Validation

Focused regression suites cover group/lock/history behavior, native-agent lock rejection, personal storage/hash/privacy, reference-version backups, recipes and missing-item replacement, fit geometry/cache/lifecycle, selection math/budgets/escaping and UI previews. Browser checks cover personal-item reload/placement/undo, recipe placement, group drag/undo, fit review, matched-scale comparison and manual budget entry. Full application, model, hosting, type and production build gates are required before release. GitHub Validate and the successful master artifact remain the publication gates; see `release-workflow.md`.
