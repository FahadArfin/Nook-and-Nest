# Delivery and home manual implementation plan

> Execute with independent feature agents and a shared integration owner. Existing user authorization covers choosing useful roadmap additions and releasing validated changes.

**Goal:** Help people check furniture access before buying and retain useful ownership records after move-in.

**Architecture:** Two optional, bounded plan fields, lazy panels in Project > Planning, existing atomic commit/Undo and portable save paths. No new service, dependency, media upload, reminder scheduler or changes to models/rendering.

**Design basis:** NN-34 and NN-37 in `docs/feature-opportunities.md`. This increment implements measured delivery checks and a manual/link-based home register; attachment uploads remain a later increment.

## Shared contracts

- Root owns `types.ts`, plan validation, layout snapshots, public/privacy stripping, ProjectLibrary navigation and integration tests.
- Delivery owner adds `deliveryPlanning.ts`, `DeliveryPlanningPanel.tsx`, scoped CSS and focused tests. Export `DeliveryPlanning`, `parseDeliveryPlanning(unknown)` and panel props `{plan, disabled?, onCommit(base,next)}`. Store under optional `plan.deliveryPlanning`.
- Home manual owner adds `homeManual.ts`, `HomeManualPanel.tsx`, scoped CSS and focused tests. Export `HomeManual`, `parseHomeManual(unknown)` and same panel props. Store under optional `plan.homeManual`.
- Both fields are private planning records, carried by Undo, alternatives, milestones, JSON and portable backups, removed from public/remix/agent output. Missing object links preserve records with a visible warning.
- Every mutation checks the draft's base plan against the current plan and shared validation before calling commit. No silent form reset when external changes occur.
- Match the existing cozy palette, rounded choice buttons, no unnecessary repeated tags or select menus. Use accessible names, keyboard controls, compact readable forms and mobile layouts.

## Tasks and acceptance

- [x] Delivery: bounded measured route steps and furniture/box records, packaged versus assembled basis, fixed orientation, missing measurements visible. Straight openings compare width/height; lift door and cabin must clear in the same orientation; turns/stairs remain manual checks. Source item changes invalidate model-derived confidence. Search placed items, manual entry, explicit saves/removal, printable escaped summary. Tests cover unknowns, clearance equality, lift orientation, hostile imports, stale edits.
- [x] Home manual: named records optionally linked to existing furniture, product/manual links, purchase/warranty dates, maintenance due dates and dated service notes. Search/filter, explicit saves, completion history, removal, selected printable handover. No automatic notifications or inferred dates. Bound text/records/history; validate URLs and calendar dates. Tests cover due dates, invalid inputs, deleted links, stale saves and escaped selective export.
- [x] Shared persistence/privacy: validate optional fields including snapshots, preserve old saves, capture/restore metadata in alternatives, strip private fields recursively from public exports, verify Undo and backup round-trip. Do not expose home notes to WebMCP.
- [ ] Review and release: focused tests, type check, responsive real-browser workflows, independent patch review, production build and hosting checks; then PR/Validate/master exact artifact, live bundle/API/library verification, and updated feature guide.

## Review focus

Unknown measurements must not become zero or a pass. Source furniture deletion/resizing must not delete records or imply verified fit. Stale forms must not overwrite a newer project. Dates use local calendar days and valid leap dates. Private metadata must not leak via nested snapshots or generated exports unless explicitly selected.
