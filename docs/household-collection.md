# Household collection

## Garage, backyard and material realism extension

The September 29 extension addresses the user's latest four requests: broader garage/shed equipment, richer existing sofas, more believable floor/wall materials, and a broad backyard collection. Its selected build scope is **55 new garage/shed items and 48 new outdoor/backyard items**, plus a material and tailoring rebuild of **all 35 existing sofa-family models**. These are 138 affected model IDs, a different count from the previously released 138 research families documented below. Research is linked per item, with original chosen layout envelopes separated from quoted manufacturer dimensions.

- [Garage catalog and construction research](garage-collection-research.md): garage doors, storage, workstations, power tools, shop machines, vehicle care, utilities and shed equipment.
- [Outdoor catalog and construction research](outdoor-collection-research.md): patio seating, dining, pergolas, gazebos, awnings, pools/spas, outdoor kitchens, garden storage and accessories.
- [Every-sofa audit and rebuild criteria](sofa-realism-audit.md): baseline texture omissions, textile families, timber, tailoring and retained compatibility.
- [Architectural material research](realism-material-research.md): licensed photographic surface maps, scale, finish variety and PBR browser behavior.

| Latest request | Concrete coverage | Current acceptance |
| --- | --- | --- |
| Shed/garage furniture, hardware and appliances | GAR-001–055: cabinets, corner/hutch/folding workstations, overhead/tire/lumber storage, pegboard/bins, portable and stationary tools, air/dust/welding equipment, vehicle care, charging, utility appliances, yard machines and three garage-door constructions | All 55 editable sources, GLBs, 165 front/rear/underside views, binary/support checks and pixel-identical previews accepted; representative garage placement, recoloring and door aperture browser checks accepted; final release gates remain |
| Re-review every sofa's color, fabric and timber | All 35 existing sofa, sectional, loveseat, chaise and single-chair sleeper-state IDs; six textile families, naturally colored wood, fine seams, preserved individual material keys and richer defaults | All 35 editable sources, GLBs, four-view renders, binary compatibility checks and lossless previews accepted; representative browser recoloring accepted; final release gates remain |
| Improve floors | Existing wood, laminate, carpet, stone and tile IDs receive compatible material treatment; six additional choices cover rubber garage tiles, concrete, paving, aged decking, honed cream stone and terrazzo | Licensed/prepared maps, runtime implementation and representative room-scale browser review complete; final release acceptance remains |
| Improve walls | Existing paint, stone, brick, tile and wallpaper choices retain their IDs; eight additional choices cover limewash, grey/unfinished plaster, microcement, travertine, onyx, ceramic and exposed brick | Licensed/prepared maps and runtime material implementation complete; custom paint colors and familiar decorative motifs are retained; representative browser review complete; final release acceptance remains |
| Backyard pools, patio furniture, pergolas and related pieces | OUT-001–048: eight seating constructions, four dining/conversation tables, five shelters, three above-ground/raised pools and spa, poolside accessories, outdoor kitchen modules, garden storage/planters, heaters, lights and utility pieces | All 48 editable sources, GLBs and 144 front/rear/underside views accepted; binary dimensions, material resources and measured support/contact checks pass; twelve-piece browser fixture, independent shelf placement and undo accepted; final release gates remain |

The [garage final asset receipt](../assets-source/garage-collection-review.json), [outdoor construction notes](outdoor-living-model-notes.md), [outdoor final asset audit](../assets-source/outdoor-living-review.json), [sofa final audit](../assets-source/sofa-realism-audit.json) and [combined authoring measurements](../assets-source/garage-outdoor-collection-audit.json) distinguish completed asset work from application and publication acceptance. The outdoor review includes a [48-model visual overview](../assets-source/previews/outdoor-living-contact.webp). Existing basic garage equipment and outdoor catalog pieces remain available; the selection adds distinct constructions rather than duplicating every retailer's inventory.

The final garage/outdoor receipts account for **all 103 new models and 309 reviewed views**. The combined audit records each accepted GLB hash, its source review receipt and pixel-identical preview receipt. All 103 current model and preview hashes match those receipts. These are authoring measurements before the production packaging pipeline:

| Final new-model measurement | Result |
| --- | ---: |
| Independently editable Blender construction parts | 7,282 |
| Triangles across 103 models | 686,404 |
| Maximum triangles in one model | 29,812 |
| GLB bytes across 103 models | 99,589,332 |
| Maximum individual GLB bytes | 3,688,888 |
| Preserved source PNG preview bytes | 46,361,541 |
| Pixel-identical lossless WebP preview bytes | 19,964,204 |
| Preview byte reduction | 56.94% |

The 35 existing sofa updates have their own four-view and compatibility receipts and are additional to these 103 new-model totals. This keeps the new-model size figures distinct from the larger material enrichment of existing sofas.

Every selected new catalog row must have an original editable Blender source, bounded GLB, reviewed rendered preview, stable material keys and practical placement metadata before release. Above-ground pools have genuine recessed liners and water below their rims; they do not claim to excavate terrain. Research reports identify static equipment poses and distinguish layout models from operating machinery.

`tools/blender/build_garage_outdoor.py` serializes the two new construction modules in its own tagged Blender scene. `tools/blender/enrich_sofas.py` appends and enriches the existing editable parts. Both retain exact catalog envelopes. `scripts/realism-assets.mjs` updates material metadata only for the approved 138 model IDs. `garageOutdoorShelfSurfaces.json` records actual usable worktops and storage surfaces; roofs and pool water are not decoration support surfaces.

New equipment is a layout model: tools do not operate, a stored generator does not provide power, and the separate opener/keypad does not control a door. The three garage-door styles reuse the existing wall anchor, aperture and overhead-track envelope in code; the glazed variant passed browser aperture and wall-visibility checks, and shared placement/persistence behavior is covered by the focused suite. Outdoor hinges, folding/extension mechanisms, reclining seats, pergola blades and awnings are fixed authored poses. Pools, hot tubs and their separate accessories do not implement excavation, swimming or plumbing. Gazebos/pergolas remain independently placed furniture, and lamps use visual emission rather than a new live-light system. Materials add color, normal and roughness detail without dense displacement, new terrain, or automatic changes to saved layouts.

This extension is **not yet published**. Its asset and source acceptance does not replace the updated PR's Validate check, sequential merge, successful master workflow, exact-artifact Sites publishing and live verification described in [the release workflow](release-workflow.md).

Browser placement, finish and preview-isolation evidence is recorded in [garage/outdoor browser acceptance](garage-outdoor-browser-acceptance.md).

## Previously released household collection

The research queue covers 138 household families. HOME-001–008 were released through PR 115 and Sites version 113. HOME-072 is already covered by the existing `high-chair`; its catalog entry, editable source and rendered preview were inspected, so no duplicate is added. The remaining families are authored as original editable Blender constructions in this collection. `assets-source/household-progress.json` maps every family to its actual independent catalog IDs, including separate accessories and fixed-pose alternatives.

| Research range | Scope |
| --- | --- |
| HOME-001–008 | Released kitchen and table essentials |
| HOME-009–021 | Bathroom hardware, accessories and laundry |
| HOME-022–043 | Entry, living, bedroom and flexible dining furniture |
| HOME-044–057 | Household utility, HVAC and safety details |
| HOME-058–071 | Lighting, window dressing, indoor plants, office and music |
| HOME-072–084 | Family, pets, fitness, workshop and garden equipment |
| HOME-085–097 | Additional kitchen, laundry and bathroom fixtures |
| HOME-098–106 | Additional indoor furniture and storage |
| HOME-107–114 | Lighting and botanical variety |
| HOME-115–134 | Music, office accessories, family/pet equipment and outdoor utilities |
| HOME-135–138 | Skylight, secondary entry door, sectional garage door and spiral stair; architecture behavior requires separate acceptance |

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

## Household validation and release history

`tests/household-assets.test.ts` checks real binary vertex bounds against catalog dimensions, base/centre alignment, a single isolated scene without startup Cube/camera, self-contained GLB resources, original source/preview presence, material-key agreement, mount metadata and full 138-family coverage. A 50,000-triangle/3 MB per-model ceiling bounds regressions; any exception requires a measured, recorded justification rather than silently increasing all limits.

All 138 research families are accounted for: 157 new models, 12 previously released kitchen pieces and the existing high chair. All new models have original editable Blender sources, GLBs, source PNGs, pixel-identical WebP previews, stable material mappings and accepted front/rear/underside renders. Preview output totals 28,644,782 bytes versus 68,211,614 bytes for the preserved PNG sources.

The PR 117 pre-release branch included master `032ede453bef0543b5c296487e6eb53b9452a8b0`. Its historical browser placement, color, undo, architecture and performance observations are recorded in [household browser acceptance](household-browser-acceptance.md). Required local validation for that release passed: 803 application tests across 102 files, type checking, asset-pipeline verification, model integrity tests, production build, hosting tests, library tests and release integrity/size checks. That production build included 1,735 external library assets; these historical counts are not the validation results for the current extension.

The household collection was subsequently released through [PR 117](https://github.com/FahadArfin/Nook-and-Nest/pull/117), merged as master `8745059e6a80184f52b1d830f5af97be6b03fa58`, and published as Sites version **116**. Publication of that collection is complete, not pending. [PR 118](https://github.com/FahadArfin/Nook-and-Nest/pull/118) followed at master `9160f99` and Sites version **117**, which is the live release preceding this extension.

The new 103 garage/outdoor models, 35 sofa updates and architectural material changes at the top of this report belong to the next release. Do not infer their publication from PR 117/118, historical test counts or completed local exports. The integrating release receipt must identify the new validated master SHA, exact artifact, Sites version and live verification.
