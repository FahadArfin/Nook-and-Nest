# Nook & Nest Beta 2 — engineering report

Separate worktree: `feature-optimization`; branch: `codex/feature-optimization`. This beta has its own Site, database and asset storage. Production is unchanged. The PR remains a draft to prevent merging the Beta identity into production.

## What changed

| Audit item | Implementation | Evidence / limits |
|---|---|---|
| 1 Backups | Compact export and canonical 8 MB import policy; older indented backups accepted within a 32 MB input guard | Round-trip tests; resource limits retained |
| 2 History | Frozen structurally shared snapshots; approximately 64 MiB retention budget and 40-entry ceiling | Undo/redo regression; estimate is not measured heap residency |
| 3 Terrain | Spatial segment index plus cached height field, resampling changed stroke bounds | Matching baseline checksums; 8,192-point synthetic grid approximately 25 ms versus 5,152 ms in paired local run |
| 4 Vegetation memory | Shared reference-counted static vertex buffers; separate patch geometry and instance buffers | Independent patch ownership regression |
| 5 Vegetation LOD | Screen-size thresholds with hysteresis; distant foliage retains whole disconnected botanical components | Close geometry preserved. Runtime-derived LOD, not a newly authored model set; every species still needs visual comparison |
| 6 Whole-map grass | Optional density coverage tiles, deterministic camera-local blades, 12,000 detailed instance ceiling | 158,132 tiles serialize to 1.88 MB in synthetic map; individually placed grass keeps its limit |
| 7 Scenery invalidation | Narrowed backdrop/architecture/occupancy keys | Moving ordinary furniture within unchanged bounds avoids backdrop reconstruction |
| 8 Furniture batching | Compatible static leaf parts share hardware instance sources by geometry/material | Eight-chair browser preview, independent recoloring and source-disposal regression; animated/special models excluded |
| 9 Cache growth | Inactive model LRU with estimated 128 MiB target; bounded unused material variants; finish texture reuse | Active assets protected; estimates cannot guarantee total GPU memory |
| 10 Loading | Four concurrent requests, 30-second abort, progressive completion and retry state | Existing asset/placement tests |
| 11 Floors | Large floors grouped by material and spatial chunk; picking maps back to exact floor data | Existing measured-floor and editing regressions |
| 12 Shadows | Dirty-only static sun/fixture shadow refresh | Dynamic effects continue refreshing; no physical mobile GPU comparison yet |
| 13 Power/resolution | Background suspension, static idle rendering at 1 Hz, adaptive resolution hysteresis, on-demand capture | CPU submission timing drives adaptation, not GPU timer queries; animated scenes remain active |
| 14 Water work | Active solver bounds, reusable buffers, settled-state sleep; render indices exclude dry quads | Visual grid still uses full vertex interpolation/uploads while changing; GPU dirty subranges remain a follow-up |
| 15 Water continuity | Conservative regridding, linear redistribution around new foundations, continuous shader phase | Volume/sleep tests. Bounded sealed domain and replenishing sources remain explicit simulation assumptions |
| 16 Plant attachment | Terrain anchors, manual height override, resampling after sculpting; placement uses actual wetness | Indoor furniture unaffected. Existing coverage can be submerged; no per-frame wetness-driven blade rebuild |
| 17 GPU textures | Full-resolution UASTC KTX2 aerial derivative with original JPEG fallback | Approximately 75% smaller estimated GPU residency on supported formats; 22.37 MB transfer versus 4.96 MB JPEG, so download is larger. PSNR 45.38 dB; not lossless |
| 18 Google scenery | Conservative 128 MiB default for unknown/low-memory devices; explicit higher choices retained | Independent soft budgets, not a globally enforced GPU allocator |
| 19 UI | Catalog membership selector avoids rerenders on unrelated transforms; content visibility skips offscreen layout/paint | DOM remains present for keyboard/accessibility. Full list virtualization is deferred pending measured need |
| 20 Startup | Welcome screen separated from lazy 3D editor; editor load failure boundary | Entry around 590 kB raw / 176 kB gzip versus baseline 2.998 MB raw; final CI enforces 700/220 kB limits |
| 21 Import/autosave | Single active project record plus pointer; bounded legacy decompression; large imports in a terminable worker; image headers checked first | Unsupported Worker fallback remains bounded and synchronous; local/offline compatibility retained |
| 22 Regression visibility | CPU benchmark script, local p95/long-task/triangle/resolution diagnostics, geometry/state tests and entry budgets | iPhone, Android, integrated-GPU and sustained thermal runs remain outstanding; no universal FPS claim |

The implemented alternatives cover each audit area, but the explicit follow-ups above are not represented as completed device certification or complete authored LOD/virtualization/global-memory work. Original Blender files, GLB geometry, dimensions, placement IDs, and aquarium fidelity are preserved.

## Research and rationale

The existing WebGL/Babylon pipeline is retained. Instancing reduces submission overhead, but processing millions of vertices still costs time: [Babylon thin instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances/). Inspection of installed Babylon source confirmed that independent thin-instance buffers require independent geometry ownership; static vertex buffers can remain shared.

A coverage field plus bounded nearby detail is a better match for whole-map grass than unlimited independent objects. [GPU Gems grass rendering](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-7-rendering-countless-blades-waving-grass) motivates patch representations; [geometry clipmaps](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry) motivate stable grids and incremental terrain regions. These are design references, not performance evidence for this app.

[Meshoptimizer](https://meshoptimizer.org/v1) documents simplification constraints around topology and attributes. Botanical components need silhouette-aware treatment: this beta retains complete leaf/blade components in distant geometry instead of arbitrary triangle deletion. Near originals remain intact.

[Immer performance guidance](https://immerjs.github.io/immer/performance/) supports reusing immutable unchanged branches. This removes whole-plan cloning from routine history, while external replacement inputs are copied once to prevent caller mutations.

Water remains a bounded shallow-water height field. [WebFlood](https://github.com/aeplay/WebFlood) and its [interactive shallow-water paper](https://aeplay.github.io/WebFlood/interactive_shallow_water.pdf) are closer to landscape pooling and downhill flow than smoke/dye screen effects or unrestricted 3D particle fluids. Active bounds and sleep reduce work while preserving progressive filling. No claim is made of full Navier–Stokes 3D splashes or volumetric particle simulation.

[Khronos KTX](https://www.khronos.org/ktx/) and the [KTX 2 specification](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html) distinguish transfer compression from GPU formats. The aerial derivative prioritizes GPU memory while retaining source resolution. It increases transfer bytes, so it is optional by supported GPU format and falls back to the original image. [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) reinforce conservative per-device budgets and avoiding unnecessary preserved drawing buffers.

[Content visibility](https://web.dev/articles/content-visibility) skips offscreen rendering work while keeping content in the document. This is a deliberate first step rather than claiming DOM virtualization or changing keyboard navigation.

## Reproduction and remaining acceptance

Run `npm run check`, `npm test`, `npm run test:assets`, `npm run build`, `npm run test:sites`, `node --test tests/library-assets.test.mjs`, and `node scripts/verify-release.mjs`. Run `node scripts/benchmark-optimization.mjs` in a checkout containing baseline commit e18646e; paired timings are machine-specific and exclude GPU work. See `beta-2-measurements.json` for recorded values.

Before treating Beta 2 as production-ready, compare botanical silhouettes, dense mixed vegetation, changing river banks and warm interior shadows on real desktop integrated graphics, iPhone Safari and midrange Android. Record sustained p95 frame time and memory/recovery after painting, erasing and switching projects. Targets are stable 30 FPS low-power / 60 FPS capable desktop, not guarantees.

Beta deployment uses the exact successful feature-branch CI artifact. A temporary manifest-allowlisted integrity-checked bootstrap copies only public catalog assets into Beta storage; it is disabled after verification. No private project records are copied.
