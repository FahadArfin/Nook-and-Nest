# Next Home Opportunities Implementation Plan

> **For agentic workers:** Use subagent-driven development for the three independent feature modules. Parent owns integration, final review, Git and publishing.

**Goal:** Complete NN-33, NN-35 and NN-36 from the user-approved next-opportunities guide with usable private planning workflows.

**Architecture:** Extend existing Listing Studio, Site notes/drawing exports and private project storage. Keep each module lazy or locally scoped. Preserve originals, project identity, schema compatibility, history and existing sharing boundaries.

**Tech stack:** Existing React/TypeScript, Canvas, SVG, IndexedDB, Vitest; no new dependencies or external providers.

**Spec:** `docs/feature-opportunities.md`, NN-33/35/36. The user asked to proceed with the remaining opportunities. Implement and publish under the existing authorization.

## Global constraints

- Work only in the new `codex/next-home-opportunities` worktree from fetched master d09823a.
- Keep personal source photos and original candidate projects intact. User selection controls outputs and copies.
- Bound imports, output size, record counts and expensive checks. No automatic privacy, moving-fit or electrical compliance claim.
- Keep public and private projections intact; optional metadata absent in older saves remains valid.
- No new billing, account access, provider setup or library model changes.

## Task 1 — NN-33 Photo privacy

- [x] Add bounded opaque-mask, crop and quarter-turn rotation editor in Listing Studio.
- [x] Keep immutable private source and a flattened reviewed derivative; explicit selection chooses reviewed output. Never leak original source/paired bytes alongside a chosen derivative in packs, review sharing or video-provider requests.
- [x] Centralize selected-output resolution, reject stale/incomplete privacy metadata, regenerate metadata-free pixel output and use it in previews and downloads.
- [x] Cover transformation geometry, state invalidation, malformed/oversize records and all export consumers with focused tests; verify actual pixels in browser.

Owned files: photoPrivacy helpers/editor/styles/tests; listingTypes/ListingStudio/listingExport; ClientReviewPanel, ListingVideoPanel, LocalVideoPanel and their directly related tests. Parent handles unrelated discoverability/docs.

## Task 2 — NN-35 Service points

- [x] Add optional bounded `SiteSurvey.servicePoints` to its existing private validated record, with outlet/switch/data/vent kind, measured wall offset, face, height and explicit verification.
- [x] Record geometry fingerprints; keep invalidated wall/floor anchors visible as stale, never silently reverify them.
- [x] Build a Site notes subpanel with floor/wall selection and 2D preview. Add default-off overlay to Blueprint Studio, its visible-layer SVG export, and a measured service-point schedule export. Wall-elevation integration is deferred to keep this increment focused.
- [x] Test exact/angled anchors, validation, stale geometry, private stripping, snapshot/undo behavior and selected export visibility.

Owned files: siteSurveySchema, SiteSurveyPanel, servicePoints helpers/panel/overlay/styles/tests; BlueprintStudio and directly related tests. No root plan-schema field required.

## Task 3 — NN-36 Compare homes

- [x] Select 2–3 distinct private local/explicitly loaded online projects and a single immutable owned-item snapshot.
- [x] Preview equal-dimension furniture copies using the same fit preferences, explicit floor/position assumptions and missing/unknown warnings. Do not rank a best home or treat initial placement as optimized fit.
- [x] Save independent editable project copies with stable identities in one atomic transaction. Preserve active edits and all sources; rollback the full batch on failure and never overwrite an existing identity.
- [x] Test exact dimensions across grids, source immutability, duplicated/oversize selections, stale async operations and copy failures.

Owned files: homeComparison.ts, homeComparisonStorage.ts, CompareHomesPanel.tsx, home-comparison.css and focused tests. Persist one bounded private device workspace with source fingerprints and copy IDs, frozen owned measurements, positions, preferences and assumptions. Retain no duplicate full source plans in that workspace. Editable copies remain ordinary private projects.

Panel interface: localPlans, onlineProjects, disabled, onLoadOnline(id):Promise<PlanDocumentV1>, onRefreshLocal():Promise<PlanDocumentV1[]>, optional onCopiesSaved():Promise<void>, optional onOpenCopy(plan):Promise<void>, optional onBusyChange(busy). Parent implements callbacks and lazy ProjectLibrary integration. Panel-owned storage helper guards collaboration and saves copies plus workspace in the existing projects database without touching its active key.

## Review focus

1. Masked output must not include another hidden original in ZIP, review thumbnail or provider payload.
2. Crop/rotation and stale source changes must not shift a mask away from its intended pixels.
3. Wall/floor edits must invalidate service-point verification without losing the original record.
4. Async project changes/storage failures must never replace originals or falsely report all copies saved.
5. Comparison results must state whether dimensions and arrangement were verified, keeping unknowns visible.

## Integration, validation and release

- [x] Parent integrates Compare homes in Project → Planning, contextual help and documentation.
- [x] Independently review all three features, resolve material findings, then run typecheck, targeted integration tests, full required checks and production build.
- [x] Run the local preview and verify desktop/mobile workflows and browser-generated exports. Record actual screenshots and limitations.
- [ ] Fetch/merge latest master, push PR, require Validate, merge, wait for master CI exact artifact, publish original Sites URL and verify live bytes/assets.
- [ ] Update the feature guide with actual release evidence; retain original 32-feature totals and unrelated external acceptance limits.

Validation (2026-10-03): 1,237 application tests (188 files), 5 model tests, 26 hosting tests and 5 library tests passed; 13 asset recipes verified; TypeScript, production build and release integrity passed. The 26.4 MB slim package retains the unchanged 2,150-asset library. Browser evidence is in E:/Codex-reviews/roadmap-implementation/next-home-opportunities. All three independent review findings were repaired with regression tests.
