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

## Maintenance tools

- Interaction owners: `CameraControls`, `PlacementController`, `FloorPaintController`, `LandscapeController`; `SceneController` remains the event-order and scene synchronization coordinator. Interfaces use live getters so plan changes do not leave stale snapshots.
- [Asset pipeline](asset-pipeline.md) and its checked JSON manifest identify source, generator and output ownership.
- [Performance scenes](performance-scenes.md) provide deterministic workloads and an exportable browser timing harness.
- [Current contracts](contracts/editor.md) and the root guide resolve active requirements; [original history](history/AGENTS-before-maintenance.md) preserves the complete prior guide.

Next candidates are extracting cohesive App/BlueprintStudio panels and adding hardware benchmark evidence. These are not claimed complete by this maintenance pass.
