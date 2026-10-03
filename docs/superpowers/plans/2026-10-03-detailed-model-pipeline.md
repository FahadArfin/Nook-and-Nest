# Detailed model pipeline implementation plan

> **For agentic workers:** Use the existing parallel authoring, research and validation assignments; the root agent exclusively operates Blender and Sites.

**Goal:** Turn the Beta model experiments into a reusable, measured high-detail Blender production pipeline, demonstrated on a richer sofa.

**Architecture:** A versioned asset specification drives isolated editable master and browser-target collections. Paired high-to-low bakes preserve fine construction in glTF-compatible PBR maps. Binary export verification and a hash-bound visual review receipt gate readiness; the separate Beta model lab shows the actual output.

**Tech stack:** Blender 5.2 Python, Cycles, glTF 2.0, Node, Babylon.js, Vite.

**Spec:** The user's requested heavily detailed models, editable Blender sources, accurate catalog dimensions/material keys and Beta-only feature-branch deployment; the existing `docs/blender-realism-lab.md` supplies the prior experiment baseline.

## Constraints

- Work only in `codex/detailed-model-pipeline`; do not merge master or publish production.
- Preserve the sofa's 2000 × 850 × 780 mm envelope and four existing material keys.
- Maximum browser export: 80,000 triangles, 12 MiB, eight primitives. Dense authoring source is retained separately.
- No automatic claim of aesthetic acceptance; inspect exported multi-view renders and the browser.
- Preserve all unrelated Blender scenes, application/catalog state and Beta's existing R2 inventory.

## Review focus

- Wrong coordinate transforms must fail measured export bounds checks.
- Rebuilt geometry/maps/source must invalidate previous visual acceptance.
- Missing or export-incompatible PBR maps must fail inspection.
- Bake rays must not transfer frame details onto cushions; inspect close-ups and normals.
- Beta overlays must reject changes outside the experiment and verify the existing library hash.

## Deliverables

- [x] Primary-source research and construction/UV/bake guidance in `docs/detailed-model-pipeline.md`.
- [x] `tools/blender/detail_pipeline/`: reusable prepare, bake and finish stages plus a sofa recipe and versioned JSON specification.
- [x] Dense editable source, deliberately detailed browser geometry, baked normal/base/roughness/AO maps and measured build receipt.
- [x] `scripts/model-pipeline.mjs`: inspect, explicit review and readiness gates; focused failure/staleness tests.
- [x] Exported front, rear, detail, underside and clay renders; correct visible issues before acceptance.
- [x] Add the pipeline output and understandable comparison to `/model-lab/` without altering saved-plan behavior.
- [ ] Run focused checks, stable production build and hosting tests, then refreshed-master draft PR / Validate.
- [ ] Publish matching experiment only to Beta 1; verify live status and actual asset bytes.

The user's standing instruction to work autonomously already authorizes implementation and Beta publishing. This plan is a reviewable record, not another approval pause.
