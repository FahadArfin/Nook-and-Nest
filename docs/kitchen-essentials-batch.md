# Kitchen and table essentials — HOME-001–008

Original models built in an isolated `codex/kitchen-table-essentials` worktree from `c0c88319`, using the official interactive Blender MCP. The research handoff is `E:/Codex-reviews/catalog-2026-09-29/blender-build-brief.md`. Its eight relevant reference records are retained in `assets-source/kitchen-essentials-references.json`; the rest of that research queue is not included in this release.

## References and dimensions

- Countertop dishwasher: [Danby DDW621WDB](https://www.danby.com/en-us/shop/ddw621wdb/), official dimensions 549.9 × 500.1 × 437.9 mm, rounded to 550 × 500 × 438 mm. This original sage, glazed-door design is not a branded replica.
- Water dispenser: [Avalon A4](https://www.avalonh2o.com/products/a4-bottom-loading-water-dispenser), for the bottom-loading cabinet, dispensing bay, buttons and drip tray.
- Dinnerware: IKEA [365+ bowl](https://www.ikea.com/us/en/p/ikea-365-bowl-rounded-sides-white-00468130/) and [FÄRGKLAR mug](https://www.ikea.com/us/en/p/faergklar-mug-light-blue-70604879/), for hollow ceramic construction and foot/rim proportions.
- Boards: [IKEA APTITLIG](https://www.ikea.com/us/en/p/aptitlig-cutting-board-bamboo-60233426/), for laminated timber construction. The handled board is a separate original design.
- Cookware: [IKEA 365+ pan](https://www.ikea.com/us/en/p/ikea-365-frying-pan-stainless-steel-70582735/) and the cookware family linked in the reference record, for formed vessels, rolled rims and handles.
- Freezer: [GE FCM7STWW](https://www.geappliances.com/appliance/GE-7-0-Cu-Ft-Manual-Defrost-Chest-Freezer-FCM7STWW), for insulated chest construction, lid, hinges and controls.
- Rail: [IKEA KUNGSFORS](https://www.ikea.com/us/en/p/kungsfors-rail-stainless-steel-40334916/), for stand-off wall brackets and hook construction.

Except for the rounded dishwasher envelope above, catalog sizes are **original design targets**, not claims of exact manufacturer dimensions. Product references informed construction; retailer photographs, branding and downloaded meshes are not embedded.

## Batch ledger

All rows: reference checked, source authored, exported, multi-angle visual review passed, catalog integrated, browser loaded. Release is pending the required checks and publication.

| Research | Catalog IDs | Placement |
| --- | --- | --- |
| HOME-001 | kitchen-counter-dishwasher | Countertop; real support footprint |
| HOME-002 | kitchen-dinner-plate, kitchen-cereal-bowl | Separate tabletop/shelf pieces |
| HOME-003 | kitchen-everyday-mug | Separate tabletop/shelf piece |
| HOME-004 | kitchen-water-dispenser | Floor |
| HOME-005 | kitchen-cutting-board, kitchen-handled-board | Separate tabletop props; handled board has a fixed leaning pose |
| HOME-006 | kitchen-saucepan, kitchen-stockpot, kitchen-frying-pan | Separate tabletop/shelf pieces; stockpot lid closed |
| HOME-007 | kitchen-chest-freezer | Floor; closed lid, editable interior basket |
| HOME-008 | kitchen-utensil-rail | Wall mounted at 1500 mm; no wall opening |

The exact research-to-model mapping is recorded in the source reference JSON; these are independent display objects, without opening-door or appliance simulation.

## Source and review

`tools/blender/build_kitchen_essentials.py` authors only its tagged scene. Through `execute_blender_code`, run `runpy.run_path(path)['build'](id)`, then `render_viewport_to_path` for the configured front view. Run `set_view('rear')` / `set_view('underside')` and render again. The MCP renderer returns a temporary output path: copy that returned file into the preview source directory, then run `scripts/compress-previews.py` with only the batch IDs. It does not purge other scenes or their data.

Sources retain 2–90 named, separately editable construction parts per piece. All twelve `.blend` files were reopened through MCP and checked for matching catalog metadata, one model scene, UV layers and no external image dependencies. The original startup Cube/Camera/Light were preserved and excluded from exports. Exported static parts are joined to reduce browser overhead, retaining material slots.

Reviewed 36 front/rear/underside renders. Corrected a tube-frame flip in the mug handle, restricted exports to the owned scene, and replaced a stepped handled-board assembly with one continuous beveled silhouette. Plate/bowl/mug/pan interiors are actual cavities; dish basket wires, utensil slots, hanging holes, recessed bays and routed board grooves are geometry.

Raw total: 41,660 triangles, 2,186,712 GLB bytes, no embedded textures. Each model is below 10,000 triangles and 450 KB. Original preview PNGs total 4,906,094 bytes; pixel-identical lossless WebP total 2,032,342 bytes. Production lossless geometry compression is measured by the existing build pipeline.

## Validation

- Type checking and 15 focused kitchen tests passed, including new asset bounds/origins/materials, surface/wall routing, dishwasher fit/rejection, independent recoloring, undo/redo and save/share round trips.
- Existing kitchen wall tests include the rail and verify no aperture is cut.
- Browser: all twelve assets loaded in the disposable kitchen fixture with 24 repeated small props plus appliances and existing cabinets; no browser errors observed.
- Two 60-second captures after a five-second warmup, with brief manual camera drags, completed on Windows desktop in-app Chromium at 1280 � 720. Both auto and battery profiles measured p50 3.6 ms / p95 3.7 ms requestAnimationFrame intervals. Scene telemetry reported 183,164 triangles and 547 meshes including the existing cabinets, room and rendering infrastructure. Battery resolution scale was 1.7 versus auto 1.0. See `assets-source/kitchen-essentials-performance.json`. These are primarily stationary desktop frame intervals, not GPU timings, sustained-orbit benchmarks, or mobile/integrated-GPU results.

Final local checks: asset references, TypeScript, model integrity/compression, production build, hosting tests, library routing tests and release verification passed. The full application run passed 738 tests and exposed one expected-count assertion (391 versus 403); after updating the count, all nine affected/new regression tests passed. GitHub Validate remains the merge gate. Browser search returned the new dinnerware; keyboard drafting and cancellation left the piece count and undo history unchanged.
