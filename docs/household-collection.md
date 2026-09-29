# Household collection

The research queue covers 138 household families. HOME-001â€“008 were released through PR 115 and Sites version 113. HOME-072 is already covered by the existing `high-chair`; its catalog entry, editable source and rendered preview were inspected, so no duplicate is added. The remaining families are authored as original editable Blender constructions in this collection. `assets-source/household-progress.json` maps every family to its actual independent catalog IDs, including separate accessories and fixed-pose alternatives.

| Research range | Scope |
| --- | --- |
| HOME-001â€“008 | Released kitchen and table essentials |
| HOME-009â€“021 | Bathroom hardware, accessories and laundry |
| HOME-022â€“043 | Entry, living, bedroom and flexible dining furniture |
| HOME-044â€“057 | Household utility, HVAC and safety details |
| HOME-058â€“071 | Lighting, window dressing, indoor plants, office and music |
| HOME-072â€“084 | Family, pets, fitness, workshop and garden equipment |
| HOME-085â€“097 | Additional kitchen, laundry and bathroom fixtures |
| HOME-098â€“106 | Additional indoor furniture and storage |
| HOME-107â€“114 | Lighting and botanical variety |
| HOME-115â€“134 | Music, office accessories, family/pet equipment and outdoor utilities |
| HOME-135â€“138 | Skylight, secondary entry door, sectional garage door and spiral stair; architecture behavior requires separate acceptance |

All sources are linked in the collection's `assets-source/household-*-references.json` files. Manufacturer pages, galleries and technical drawings guide proportions and construction. Chosen original millimetre envelopes are distinguished from quoted manufacturer dimensions and installation clearances. Models contain original geometry and original static graphics; manufacturer photographs, logos and downloaded meshes are not embedded.

## Authoring and reproducibility

`tools/blender/build_household_collection.py` owns a tagged scene and calls the family modules without clearing unrelated scenes. It measures all authored geometry, normalizes the declared width/depth/height, keeps independently editable original parts in `assets-source/blender/{id}.blend`, then joins the static browser export. Its audit records actual bounds, source centring, normalization, triangles, materials, byte counts and editable part count. Surface metadata uses that same transformation, rather than assuming every tabletop is centred in the full footprint.

Front, rear and underside renders are reviewed. Recognizable construction, open basins/cages, practical controls, correct upholstery and source details are acceptance criteria. The source PNG remains preserved; catalog WebP compression must be pixel-identical. Animation and saved placement IDs/material keys remain stable for pre-existing models.

Run `node scripts/household-assets.mjs` after exports to refresh material metadata **only for IDs in household expansion files**. Unrelated metadata is retained. `--ids id,id` limits a repair to named collection IDs; `--available` supports an in-progress authoring pass without fabricating missing exports. `--check` is read-only and fails on stale material metadata.

Before the collection's first release, run `node scripts/household-assets.mjs --canonicalize` after Blender exports finish. This removes only terminal Blender dot-number suffixes from the new collection's GLB material names, rejects canonical-name collisions, preserves BIN/extension chunks exactly, and refreshes the matching material metadata. It excludes the previously released kitchen essentials and every unrelated catalog ID. `assets-source/household-material-keys.json` retains each original Blender material name and its stable export key; subsequent canonical no-op runs retain the source mapping. Rebuild aliases are accumulated rather than discarded. Exact runtime names such as `surface-stone` remain unchanged.

Canonicalization also refreshes only the selected household audit's `glbBytes` measurements; every other field and model is retained. Existing editable sources need no resave or rerender: the source-to-export map preserves their suffixed source names while the original files remain unchanged.

Future driver builds call `household_materials.tag_used_materials(objects)` before saving the editable source, then `household_materials.canonicalize_glb(out)` immediately after GLB export and before reading final bytes for the audit. Source custom properties record canonical keys without renaming global Blender materials. A single-file GLB rewrite and the bulk script both enforce membership in the new household catalogs. `python tools/blender/test_household_materials.py` verifies the rewrite, chunk preservation, collision rejection, source mapping retention, source tagging and released-asset exclusion using temporary fixtures.

After reviewed source renders exist, `node scripts/household-assets.mjs --previews --progress` performs targeted lossless WebP output with one compression worker and refreshes file observations. It imports the existing compressor's single-file function so it cannot trigger an unrelated all-library PNG migration. `--progress` does not mark anything visually accepted or released. The exact procedure and inputs/outputs are indexed by the household recipe in `docs/asset-pipeline.json`.

Explicit reviewed, validated, released and covered-existing statuses survive observation refreshes. Missing required files cause an error for those accepted states; incomplete export-only observations are downgraded to the appropriate pending export state. `node --test tests/household-asset-state.test.mjs` checks these rules and audit-byte preservation without touching project assets.

## Placement and functional limits

Each small requested accessory remains independently placeable where practical: bathroom hardware, dishes, cleaning pieces, paired stools and the bicycle/rack keep distinct IDs. Fixed authored mechanisms are named and documented; a rendered open or closed pose is not an implemented hinge/physics feature. Static displays contain original graphics, not live device integrations.

Tabletop and shelf hosts need actual usable planes with edge margins and height limits. The pipeline records conservative supported surfaces. Wall utility fixtures sit against solid hosts without apertures. Ceiling fixtures show their downward-facing controls/light surfaces. Outdoor objects follow existing lowest-layer ground/paving elevation behavior and preserve house foundations. Existing furniture and the aquarium are preserved.

The portable AC has a bounded fixed hose and a separate adaptor, without automatic window linkage. The bicycle and empty wall rack are independent; associated placement must retain both identities. The greenhouse and shed are explicitly static exterior yard props, not enterable or editable rooms. The rotary clothesline includes its complete overhead span. No electrical, plumbing, HVAC, fitness, animal-care, child-safety or compliance simulation is asserted.

The four architecture families require genuine host/opening/clearance/persistence behavior and explicit browser acceptance before being treated as functioning architecture. A GLB alone cannot establish those behaviors. See the architecture implementation notes and tests added with that work.

## Validation and release state

`tests/household-assets.test.ts` checks real binary vertex bounds against catalog dimensions, base/centre alignment, a single isolated scene without startup Cube/camera, self-contained GLB resources, original source/preview presence, material-key agreement, mount metadata and full 138-family coverage. A 50,000-triangle/3 MB per-model ceiling bounds regressions; any exception requires a measured, recorded justification rather than silently increasing all limits.

All 138 research families are accounted for: 157 new models, 12 previously released kitchen pieces and the existing high chair. All new models have original editable Blender sources, GLBs, source PNGs, pixel-identical WebP previews, stable material mappings and accepted front/rear/underside renders. Preview output totals 28,644,782 bytes versus 68,211,614 bytes for the preserved PNG sources.

The integrated branch includes master `032ede453bef0543b5c296487e6eb53b9452a8b0`. Browser placement, color, undo, architecture and performance observations are recorded in `docs/household-browser-acceptance.md`. Required local validation passed: 803 application tests across 102 files, type checking, asset-pipeline verification, model integrity tests, production build, hosting tests, library tests and release integrity/size checks. The production build includes 1,735 external library assets.

Publication is pending the updated PR's Validate check, merge, successful master artifact and exact-artifact Sites deployment. Follow `docs/release-workflow.md`; do not mark exported or locally validated files as already live. The final release receipt will identify the merged GitHub SHA, exact artifact, Sites version and public byte-verification results.
