# Catalog Realism Overhaul Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task by task. The user has authorized implementation and pipeline improvements; review of generated artifacts is evidence, not a repeated implementation permission request.

**Goal:** Improve every one of the 902 catalog models with richer original editable construction and physically scaled materials, preserving saved placement contracts and making the result available only in Beta.

**Architecture:** Freeze the actual bundled runtime catalog and each original asset contract before authoring. Extend the detailed Blender workflow with bounded family recipes, separate candidate artifacts, reproducible receipts and explicit visual review. Resume by item and verified hashes; never infer approval from successful generation or file presence.

**Tech Stack:** Blender Python, glTF/GLB, Babylon.js, TypeScript, Node.js, esbuild and Node test runner.

**Spec:** The user's current whole-catalog Beta-only request, repository `AGENTS.md`, and `docs/detailed-model-pipeline.md` supply the scope and preserved contracts. The prior sofa/sectional studies supply construction and material references rather than universal geometry recipes.

**Infrastructure and progress checkpoint (October 3, 2026):** See [the catalog pipeline guide](../../catalog-realism-pipeline.md) for current modules and commands. The first discovery pass had about 235 receipts and roughly 667 items awaiting a first-pass receipt. Helper changes can make those receipts stale; this is not a count of validated or reviewed models. Checked infrastructure below does not mark all 902 candidates complete.

## Global Constraints

- Work in `codex/catalog-realism-overhaul`, isolated from the primary checkout and other tasks. Do not merge to master or publish production for this Beta-only work.
- Preserve all 902 catalog IDs, dimensions, material keys, placement origins/orientation, independent recoloring, support surfaces and saved-data compatibility.
- Preserve aquarium geometry, fish, interior plants, textures and motion exactly unless the user explicitly authorizes a change to that fidelity requirement.
- Keep editable Blender sources and full-quality textures. Use bounded exports and lossless compression before simplification. Reuse the existing Beta R2 library for this catalog; add no production storage infrastructure.
- Save candidates under `assets-source/catalog-realism/candidates/` and `public/experiments/catalog-realism/models/`; preserve baseline files.
- Keep production routing and hosted infrastructure intact. A successful build or receipt is not proof of visual acceptance or a Beta deployment.

## Review Focus

- Every runtime catalog item must be present, including older items hidden from ordinary browsing; scenery assets outside the catalog do not inflate completion counts.
- Changed catalog inputs, baseline bytes or output artifacts must invalidate stale receipts and review.
- Material names/factors, display UVs, authored motion roles, sliding travel and branch instancing must survive export.
- Geometry must retain real support planes, contact points, origin and orientation; matching only outer dimensions is insufficient.
- Richer models must remain practical in a furnished room, including close zoom, recoloring, reduced motion and repeated placements.

## Task 1: Freeze inventory and resumable progress

Files: `scripts/catalog-realism.mjs`, `scripts/lib/catalog-realism-inventory.mjs`, `tests/catalog-realism-inventory.test.mjs`, `assets-source/catalog-realism/catalog.json`.

- [x] Test missing coverage, duplicate IDs, changed baseline/input/output hashes and premature review claims.
- [x] Bundle the actual catalog, type classification and support helpers in memory; freeze all 902 records, material contracts and protected glTF metadata.
- [x] Provide deterministic `inventory` and read-only `status` commands. Initial records remain pending.
- [x] Verify manifest determinism, complete coverage and fail-closed stale detection. `node --test tests/catalog-realism-inventory.test.mjs` passes all nine checks; the initial status is 902 pending and zero processed/reviewed.

## Task 2: Capability-safe Blender recipes and materials

Files: new catalog-recipe modules and material inputs under `tools/blender/` and `assets-source/catalog-realism/`; existing detailed pipeline helpers only where they are reusable without weakening sofa checks.

- [x] Inspect the connected Blender scene and authoring capabilities before changing owned candidate scenes. Blender MCP 5.2.1 LTS is live; owned scene imports and cleanup preserve the previous 38 scenes and 1,981 objects.
- [x] Implement bounded family helpers for tailoring/bedding, selected supports and hard parts, ceramics/leaves, books, the original table lamp and explicit additive construction; retain ownership-safe source cleanup.
- [x] Implement exact-key material plans, original neutral maps, matched licensed scan sets and protected-channel gates with hash-bound provenance.
- [ ] Group by construction/material family, but provide item-specific geometry and named editable parts; preserve recognizable silhouettes and functional openings.
- [ ] Apply physically scaled neutral tintable maps with provenance. Preserve original artwork and exact material-control keys.
- [ ] Protect aquariums and dynamic nodes explicitly. Test at least one representative of each capability before processing that family.

## Task 3: Bounded export and receipts

Files: candidate `.blend`/GLB outputs, `assets-source/catalog-realism/receipts/{id}.json`, separate catalog validator and tests.

- [x] Implement separate editable-source and evaluated-mesh export paths, protected subtree/material reconciliation, and targeted metric-UV/tangent repair.
- [x] Implement semantic/glTF validation gates for finite bounds, origin, dimensions, triangle/primitive/byte budgets, material keys and dynamic contracts.
- [x] Bind receipt inputs and outputs to SHA-256, reject a changed loaded build module, and resume bounded queues with actionable failures without claiming review. The 76 Python catalog regression tests and 66 focused Node catalog tests pass at this checkpoint.
- [ ] Complete current candidate exports and passing compatibility/format checks for every one of the 902 models.
- [x] Reopen representative saved Blender candidates and import actual GLBs to verify editability and export parity. Bed, plant and ceramic-lamp sources reopen with named separate meshes and packed images; the ceramic Subdivision modifiers remain editable. Render review imports actual exported GLBs.

## Task 4: Five-view and browser review

Files: per-item front/rear/detail/underside/clay renders, review evidence, Beta integration and relevant interaction tests.

- [ ] Render all five views from the exported candidate and inspect each changed model; record concrete observations and limitations.
- [ ] Exercise the actual Babylon candidate with canonical recolors, application lighting, close zoom, placement, support surfaces and motion/reduced-motion controls.
- [x] Implement hash-bound five-view rendering, contact-sheet evidence, explicit per-view decision recording and rejection of stale, absent or incomplete review evidence.
- [ ] Fix failed models and repeat their affected checks and explicit visual reviews across the entire catalog.

## Task 5: Coverage and Beta-only publication

- [x] Implement the offline Beta-only packager with all-902 review gates, optimized-asset/source provenance, app cache/color bindings and verified-library requirements. This infrastructure check records no publication.
- [ ] Require a status report accounting for all 902 items with pending, processed, reviewed, stale and failed items distinguished.
- [ ] Run meaningful catalog contract tests, `npm.cmd run check`, application tests, `npm.cmd run test:assets`, `npm.cmd run build` and `npm.cmd run test:sites`.
- [ ] Review candidate size changes and test furnished-room runtime costs; do not call all models complete while any required review remains.
- [ ] Use the Beta-only publication path authorized by the user. Verify the exact deployed candidate assets and source revision while preserving the production site.
