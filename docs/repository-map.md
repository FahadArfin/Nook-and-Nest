# Repository map

Start with `AGENTS.md` for current requirements. This map is navigation, not a replacement for those rules. Historical batch documents describe prior work; verify current behavior in source and tests.

## Where to look

| Area | Entry points | Important boundary |
| --- | --- | --- |
| Startup and editor UI | `src/main.tsx`, `src/Welcome.tsx`, `src/App.tsx` | Keep the 3D editor lazy; do not import Babylon into the welcome bundle. |
| Saved plan and history | `src/types.ts`, `src/domain.ts`, `src/planValidation.ts`, `src/store.ts`, `src/historyBudget.ts` | Saved data must survive old backups, undo, local save and sharing. Never put frame-by-frame animation in the plan. |
| Floor plan studio | `src/BlueprintStudio.tsx`, `src/blueprint.ts`, `src/blueprintImport.ts` | References remain local. Confirm before replacing architecture; unit display changes must not resize it. |
| 3D scene and interaction | `src/scene/SceneController.ts` | Picking, camera, drafts and scene synchronization meet here. Ordinary furniture edits must not reconstruct unchanged architecture. |
| Furniture models | `src/catalog.ts`, `src/modelAssetPath.ts`, `src/scene/FurnitureModelLibrary.ts`, `src/scene/StaticPartInstances.ts` | Catalog IDs, material keys, dimensions and independent edits are compatibility contracts. |
| Original and exported assets | `assets-source/`, `public/models/`, `public/textures/`, `tools/`, `scripts/` | Keep editable sources. Catalog metadata and generated exports must stay consistent. Preserve aquarium fidelity. |
| Individual vegetation | `src/planting.ts`, `src/vegetation.ts`, `src/scene/GrassRenderer.ts` | Saved per-plant placements; current 22,000 individual-plant ceiling. |
| Meadow coverage | `src/grassCoverage.ts`, `src/meadowScatter.ts`, `src/scene/GrassCoverageRenderer.ts` | Compact density tiles, stable procedural samples and bounded camera-local detail. Separate from individual plants. |
| Terrain and water | `src/terrain.ts`, `src/terrainField.ts`, `src/shallowWater.ts`, `src/scene/TerrainScene.ts`, `src/scene/ArtisticWater.ts` | Terrain is saved; evolving water is runtime state. Preserve foundation protection and one undo per stroke. |
| Lighting and scenery | `src/scene/FurnitureLights.ts`, `src/scene/OutdoorScene.ts`, `src/scene/GoogleTorontoScene.ts` | Optional effects, bounded resources, hidden-wall shadow rules and reduced motion. |
| Agent tools | `src/webmcp.ts`, `src/agentDesign.ts`, `src/agentSchema.ts` | Review first, revision validation, one-step undo; no private library or account exposure. |
| Hosted storage and assets | `worker/`, `db/`, `drizzle/` | Device autosave differs from explicit private online save. Public assets differ from private projects. |
| Validation and release | `tests/`, `.github/workflows/validate-release.yml`, `scripts/package-ci-release.py`, `docs/release-workflow.md` | Publish exact validated artifacts; CI success alone is not deployment success. |

## Find evidence efficiently

1. Find the user-facing control in its React component, then follow its store action into pure logic and the renderer.
2. Search `tests/` for the exported function or related feature before changing a contract.
3. Read the relevant feature document, rather than every historical batch report.
4. Use `docs/beta-2-optimization.md` for implemented performance measures and honest remaining limits; `docs/optimization-audit.md` is the earlier audit, not current completion status.

Useful checks: `npm run check`, `npm test`, `npm run test:assets`, `npm run build`, `npm run test:sites`, and `node scripts/verify-release.mjs`. On Windows, use `npm.cmd` if needed. Existing model exports are enough to run the editor; rebuilding originals requires the relevant Blender toolchain.

## Beta and production

Production uses `master`. Beta 2 has a separate Site identity, database and asset storage. The Beta branches carry a different hosting manifest and release configuration: do not merge that identity into production. Verify `.openai/hosting.json` and the current Site before deploying. Keep source, generated assets and deployment receipts distinguishable.

## Recommended next organization work

- **Extract interaction controllers incrementally.** `SceneController.ts` mixes camera, picking, terrain/planting strokes and scene updates. Extract one tested responsibility at a time; avoid a giant move-only rewrite alongside behavioral changes.
- **Split editor workbenches from the app shell.** `App.tsx` and `BlueprintStudio.tsx` are large. Move cohesive panels and their state hooks behind clear interfaces while keeping saved-plan ownership centralized.
- **Add small architecture decision records.** Record why coverage differs from individual plants, why water is shallow-water simulation, and how Beta release isolation works. Link decisions from this map rather than duplicating requirements everywhere.
- **Make generated-file ownership explicit.** Add an input/generator/output manifest for model metadata, previews and GLBs, then verify it in CI. This prevents editing an output that a later export overwrites.
- **Add a reproducible performance scene pack.** Include small, dense meadow, mixed vegetation and water-edit fixtures with fixed camera positions and a short device test procedure. Record frame-time percentiles and memory, not only subjective smoothness.
- **Separate current guidance from historical notes carefully.** The growing `AGENTS.md` contains superseded UI directions. A reviewed consolidation into current contracts plus linked history would reduce ambiguity; do not silently delete user requirements.

These are recommendations, not completed refactors. This change adds the map and fixes natural meadow scatter only.
