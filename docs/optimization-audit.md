# Nook & Nest implementation and asset audit

Reviewed 9 September 2026. Current master: e18646e0031efce8d08e060054c5b32e3054064d; published Sites release 96. Source inspection used E:/Codex-worktrees/water-grass-coverage, whose feature tree was merged into this master. The original furnishing checkout was left untouched.

This is an engineering audit, not a claim that every execution path or every model has been visually tested. It covers rendering, vegetation, terrain/water, assets, state/history, persistence, loading and UI architecture. All 636 deployed GLBs were structurally scanned. CPU benchmarks used the supplied dense-grass project and synthetic terrain histories. No cross-device GPU/FPS or thermal testing was performed. The existing successful CI is useful functional evidence, not proof of performance on phones.

## Measurements

- Deployed asset library: 1,396 files, 314,082,101 bytes. GLBs account for 216,294,764 bytes. These are library totals, not the amount automatically loaded on every visit.
- Main JavaScript asset: 2,998,386 uncompressed bytes. This is not the compressed network transfer size.
- Shared dense-grass project: 22,077 placements, including 22,000 grass clumps; compact JSON is 5,347,267 bytes.
- Local Node CPU benchmark: cloning that project averaged 37.4 ms; serialization averaged 11.0 ms. Retaining 40 full clones added approximately 318 MiB of JavaScript heap. These numbers are machine-specific and exclude GPU memory.
- Sampling one 161 × 161 terrain grid took 66 ms with 64 stroke points, 504 ms with 1,024, 1,984 ms with 4,096, and 4,484 ms with 8,192. These are synthetic stress histories, not the user's current terrain timings.
- Confirmed backup round-trip failure: a valid variant of the shared project with an allowed material color on each grass placement occupies 6,381,267 bytes compactly, but exports to 9,256,846 bytes. Import rejects it with “Project exceeds the 8 MB limit.”

## Priority 1 — fix first

### 1. Valid backups can fail to reopen — confirmed correctness bug
Source: [domain.ts](E:/Codex-worktrees/water-grass-coverage/src/domain.ts:33).

Export adds indentation, while import applies an 8 MB limit to the resulting text. A valid project can therefore produce an unusable backup even though its compact form fits the server limit.

**Plan:** use a consistent canonical representation and size policy for export/import/server storage. Preserve resource limits, and add round-trip tests near the maximum supported project size, including existing indented backups. Do not simply remove size guards.

### 2. Undo retains expensive copies of the whole project — measured
Source: [store.ts](E:/Codex-worktrees/water-grass-coverage/src/store.ts:56).

A small edit clones the entire plan, including thousands of plants. Forty history snapshots consumed about 318 MiB in the local benchmark. Some turn operations also compare whole furniture arrays through serialization.

**Plan:** use immutable structural sharing or reversible commands that store changed IDs and values; preserve one undo step per gesture. Add a history memory budget and exact undo/redo/save compatibility tests.

### 3. Terrain work grows with accumulated stroke history — measured
Sources: src/terrain.ts and src/scene/TerrainScene.ts.

Terrain sampling repeatedly evaluates stroke segments over an entire grid. A preview timer cannot make that work responsive when a single update takes hundreds of milliseconds or seconds. Terrain picking also repeatedly samples the field.

**Plan:** cache a height field, spatially index stroke bounds, update only dirty brush regions and reuse grid buffers. Move substantial calculations to a worker where appropriate. Preserve protected foundations, stroke semantics and undo. Benchmark a long painting session, not only an empty scene.

### 4. Vegetation patches duplicate geometry unnecessarily — confirmed source behavior
Source: [GrassRenderer.ts](E:/Codex-worktrees/water-grass-coverage/src/scene/GrassRenderer.ts:40).

Each patch makes geometry unique for both near and far variants. Instancing reduces draw submissions, but copying the underlying mesh for each patch wastes memory, especially for detailed plants.

**Plan:** prepare shared geometry once per species and detail level, then let patches own only instance transforms and bounds. Retain per-plant picking IDs. Check memory over repeated painting, erasing and project switching.

### 5. Most vegetation has no cheaper distant geometry — confirmed source behavior
Source: src/scene/GrassRenderer.ts.

The distant variant actually reduces geometry only for grass-clump. Other species still use their full authored geometry. A fern has about 81,872 authored triangles and a willow 116,584; instancing does not eliminate the cost of processing those triangles.

**Plan:** create species-specific derived LODs and distant representations, selected by screen size with transition hysteresis. Keep the detailed original Blender sources and close-up models. Preserve the user's accepted botanical appearance through visual comparison.

### 6. Whole-map grass needs a different storage/rendering representation
Source: [vegetation.ts](E:/Codex-worktrees/water-grass-coverage/src/vegetation.ts:4).

The current vegetation limit is 22,000, and each grass clump remains an individually serialized placement. Raising this number alone increases state, history, geometry and save costs. At 660 triangles each, 22,000 full-detail clumps represent a theoretical 14.52 million triangles before shadows if all are drawn at that detail; this is not a measured frame count.

**Plan:** add a tiled grass coverage/density field with deterministic procedural placement and a bounded visible-instance budget. Render detailed blades nearby and cheaper coverage farther away. Preserve separate editable trees and intentional plant placements, and migrate old grass only with compatible visual results. Allow full-map coverage without claiming unlimited full-detail rendering.

## Priority 2 — rendering and runtime scalability

### 7. Unrelated edits can rebuild scenery
Sources: src/scene/OutdoorScene.ts and src/sceneUpdate.ts.

Outdoor invalidation includes furniture transforms; rebuilding background scenery is unnecessary when only a chair moves. Several scene keys and update passes also scan large placement arrays.

**Plan:** separate architecture, backdrop, vegetation occupancy and placement versions. Update changed IDs/chunks only. Keep existing incremental furniture updates rather than replacing them with a full-scene rebuild.

### 8. Repeated furniture still has substantial per-object overhead
Source: src/scene/FurnitureModelLibrary.ts, instantiateModelsToScene with doNotInstantiate:true.

Regular repeated furniture is cloned rather than hardware-instanced. Geometry can already be shared by clones, but individual meshes and material submissions still add CPU/draw-call costs.

**Plan:** batch compatible repeated static parts by geometry/material, retaining placement identity and independent editing. Keep special animated or independently configured models separate when batching would compromise behavior.

### 9. Model and material caches have no bounded eviction
Source: src/scene/FurnitureModelLibrary.ts.

Loaded containers and color variants remain for the scene lifetime. Browsing many models and recoloring repeatedly can retain growing amounts of memory. Variant keys include colors irrelevant to some individual materials.

**Plan:** reference-count active assets, use a memory-budgeted inactive LRU, and key materials by their actual effective parameters. Preserve active meshes and avoid disposing shared resources still in use.

### 10. Model loading needs bounded concurrency and recovery
Source: src/scene/FurnitureModelLibrary.ts.

Distinct used models can start loading together. Completion notification waits until the pending batch empties; a slow request can delay successful models becoming visible. Failed entries are retained without an ordinary retry path.

**Plan:** introduce a small priority queue, progressive batched completion, cancellation/timeouts where supported, and recoverable retry state. Keep procedural fallbacks during loading/error.

### 11. Floor geometry uses many separate boxes
Source: src/scene/SceneController.ts, floor construction.

Separate floor rectangles become separate meshes. Large or fragmented floors increase scene traversal and draw submissions even though the surface is mostly static.

**Plan:** combine floor geometry into spatial chunks by finish. Derive editing/picking from exact floor data instead of requiring one rendered mesh per cell. Preserve partial-cell geometry and measured room boundaries.

### 12. Shadow work is not sufficiently adaptive
Sources: src/scene/SceneController.ts and src/scene/FurnitureLights.ts.

The scene has a sun shadow map plus up to four fixture shadow maps. Broad caster lists and repeated shadow rendering can cost more than the visible color pass. The fixture implementation describes caching but does not configure dirty-only shadow refresh.

**Plan:** refresh static shadows only when relevant geometry/light changes, restrict casters, simplify distant vegetation casters, and use device quality tiers. Preserve the rule that hidden walls cast no shadows. Validate warm indoor lighting visually after each optimization.

### 13. Continuous rendering and fixed resolution waste power
Source: [SceneController.ts](E:/Codex-worktrees/water-grass-coverage/src/scene/SceneController.ts:147).

The engine keeps a render loop and preserveDrawingBuffer enabled. Resolution has a coarse-pointer cap, but no sustained frame-time adaptation. Browser background throttling helps, but it is not an explicit app power policy.

**Plan:** render on demand when static; explicitly suspend hidden work; keep animation active only when needed. Add adaptive resolution with hysteresis and an optional battery-friendly frame cap. Evaluate on-demand screenshot capture so the drawing buffer need not always be preserved.

### 14. Water updates a large surface even for small water areas
Source: src/scene/TerrainScene.ts.

The detailed water surface has approximately 103,041 vertices and 204,800 triangles. Full-grid updates and ongoing simulation scale with the domain rather than just the active pond/river.

**Plan:** maintain active wet/neighbor tiles, reusable buffers and dirty update ranges; sleep settled simulation when safe. Keep simulation resolution independent of visual shoreline detail. Preserve progressive filling, downhill flow and reduced-motion support.

### 15. Water continuity has edge cases
Source: src/scene/TerrainScene.ts.

Foundation/domain changes can reset or regrid transient water. Sealed boundaries and continuously fed sources impose behavior limits. Shader time wrapping may also introduce a phase discontinuity; that last point needs a rendered check.

**Plan:** reproject state locally after terrain/foundation edits, account for volume during regridding, define explicit outflow/source behavior and use seamless animation phases. Test connecting hollows, expanding bounds, changing foundations and long-running water.

### 16. Plants do not consistently follow later terrain/water changes
Sources: src/vegetation.ts and src/scene/GrassRenderer.ts.

Plant elevations are stored at placement, while vegetation update keys do not track terrain changes. Subsequent sculpting can leave plants buried or floating. Placement checks also need the actual simulated wet area, rather than only source terrain information.

**Plan:** distinguish terrain-anchored plants from manual height overrides; resample only affected patches after sculpting. Share a wetness mask with planting rules. Do not implicitly reposition ordinary indoor furniture.

### 17. Texture download size does not describe GPU memory
Evidence: deployed texture scan.

A 4096 × 4096 aerial image is about 5 MB on disk but can occupy approximately 85.3 MiB as RGBA8 with mipmaps, depending on runtime format. Several other textures are large PNG/JPEG assets. Mesh compression does not fix decoded texture memory.

**Plan:** add quality-reviewed GPU-compressed texture derivatives and resolution tiers where beneficial, retaining originals and fallbacks. Do not silently reduce full-quality artwork or aquarium textures. Measure actual residency rather than assuming file-size savings equal GPU savings.

### 18. Optional Google scenery has a separate large memory budget
Source: Google scenery quality configuration.

Its retained-cache target can be 512 MiB on devices without memory reporting and 1 GiB on higher-memory devices. System deviceMemory is not a reliable GPU budget. This scenery is optional and already has bounded downloads/LRU behavior.

**Plan:** coordinate scenery with the app's total resource budget and use conservative defaults with an explicit higher-detail choice. Test memory pressure on Safari and shared-memory GPUs.

## Priority 3 — loading, persistence and regression prevention

### 19. Broad UI subscriptions and large catalog DOM
Sources: src/App.tsx, panel subscriptions and CatalogLibrary.

Several components subscribe to the whole planner state. Large scene edits can rerender unrelated controls; the catalog still creates many entries even though images are lazy-loaded.

**Plan:** narrow selectors, cache derived lookups and virtualize large visible lists while preserving keyboard navigation and accessibility.

### 20. Startup JavaScript can be split further
Evidence: 2,998,386-byte raw main JS asset; static editor/scene imports.

A large entry bundle adds parsing/evaluation cost, particularly on phones. PDF and some scenery loading are already deferred.

**Plan:** load the 3D editor on entry, split optional feature/fallback code, and measure compressed bytes plus main-thread parse time. Avoid excessive tiny chunks.

### 21. Autosave and import need resource-aware processing
Sources: SaveControl, savePlan and domain import helpers.

Autosaving large plans writes duplicated plan records and performs serialization/copying. Legacy share decompression occurs before the decoded-size guard; image decoding can occur before pixel-size validation.

**Plan:** coalesce writes, avoid duplicate full records where compatibility allows, and use bounded worker processing for large inputs. Validate image headers before expensive decoding. Retain existing quota/error reporting and local/offline operation.

### 22. Current tests do not enforce performance budgets
Evidence: successful existing Validate run; functional and NullEngine tests.

Passing functional tests cannot reveal actual GPU bottlenecks, thermal throttling, visual LOD regressions or browser memory pressure.

**Plan:** add reproducible small-apartment, full-map-grass, dense-mixed-vegetation and water stress scenes. Track frame-time percentiles, long tasks, memory growth, load time, geometry/draw calls and recovery. Test desktop integrated graphics, Safari/iPhone and midrange Android, including a sustained session. Aim for 60 FPS on capable desktops and a stable 30 FPS low-power profile, then calibrate budgets from measurements; these are targets, not guarantees.

## Model hotspots

Counts below are authored node-referenced triangles, not actual per-frame rendered counts. Runtime culling, instancing and special handling can change workloads.

| Model | Triangles | File bytes | Proposed treatment |
|---|---:|---:|---|
| City backdrop | 612,402 | 24,343,432 | Spatial chunks and distant LODs; avoid unrelated rebuilds |
| Rural backdrop | 384,358 | 18,951,172 | Distance LODs and instanced repeated features |
| Weeping willow | 116,584 | 5,620,932 | Species LODs and shared geometry |
| Spruce | 98,822 | 5,371,256 | Preserve close-up needles; reduce distant complexity |
| Birch | 97,158 | 4,810,076 | Species LODs and shared geometry |
| Christmas tree | 86,014 | 746,072 | Audit runtime reuse before changes; small file does not mean low geometry |
| Fern clump | 81,872 | 4,125,076 | High priority for authored LODs |
| Maple | 57,384 | 2,855,608 | Species LODs and shared geometry |
| Lavender clump | 10,268 | 781,756 | Cheaper mass-planting LODs |
| Fountain grass | 7,875 | 596,764 | Cheaper mass-planting LODs |

Aquariums have substantial geometry/material complexity, but their exact fidelity is explicitly protected. Optimize visibility, scheduling and safe resource reuse; do not simplify their geometry, fish, plants, textures or animation.

## Existing strengths to preserve

The app already has vegetation thin instances and patch bounds, incremental furniture updates, lazy catalog images, deferred PDF loading, protected terrain foundations, undoable gestures, validation guards and local/cloud save error states. Optional scenery is not loaded as a mandatory default. The recommended work extends these mechanisms rather than discarding them.

## Implementation order

1. Backup round-trip correctness, history memory and terrain dirty-region processing.
2. Shared vegetation geometry, genuine species LODs and full-map grass coverage representation.
3. Scene invalidation, floor/furniture batching, cache/loading controls and shadow/resolution tiers.
4. Active-region water, terrain attachment correctness, persistence/import work and startup/UI reductions.
5. Cross-device visual/performance gates before publishing each batch.

Every batch should preserve saved schemas or provide tested migrations, original editable models, placement IDs, dimensions, colors, picking and undo. No implementation or deployment changes were made in this audit.

## Evidence and primary references

- [Full model CSV](E:/Codex-releases/project-audit/models.csv)
- [Model scan JSON](E:/Codex-releases/project-audit/models.json)
- [Texture scan](E:/Codex-releases/project-audit/textures.json)
- [Local CPU measurements](E:/Codex-releases/project-audit/benchmarks.json)
- [Babylon.js scene optimization guidance](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/scene/optimize_your_scene.md): batching, instancing and static-scene optimization.
- [Khronos KTX](https://www.khronos.org/ktx/) and [KTX developer guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXDeveloperGuide.md): GPU texture compression and deployment considerations.
