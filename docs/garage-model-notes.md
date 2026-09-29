# Garage model construction and placement notes

All 55 `garage-` IDs have final original editable Blender sources, exported GLBs and reviewed front/rear/underside renders. `tools/blender/garage_models.py` retains the construction generator; `assets-source/blender/garage-*.blend` retains individually editable parts. The official Blender MCP serialized authoring and rendering without altering other tasks' scenes.

The current source uses stable `garage-*` material names for slate/red/putty powder coating, satin machined steel, graphite cast metal, fine rubber, molded polymer, maple lamellae, transparent storage polymer, glass and small status lenses. Shared PBR attachment belongs to the parent pipeline after physical scaling. Existing material schemas and legacy model IDs are untouched.

## Measured supports

`support_surfaces(catalog_id)` provides raw millimetre planes for drawer-base top, corner-cabinet top, hutch worktop/lower shelf/top shelf, folding bench top and all three service-cart trays. Each plane excludes sidewalls, posts, hutch panels, lips, drawers and obstructions. The corner worktop offers its safe interior square rather than claiming the cut-off front triangle. The wire ceiling deck, tire cradle, lumber arms, long-tool stand, parts bins and molded case lids intentionally offer no solid tabletop plane. These are open/ribbed structures and can still be placed manually.

Drill and circular saw publish real support contact footprints. Their entire assemblies are rigidly turned 90degrees to match their catalog width, avoiding distortion of chucks and blades. The vise is also turned rigidly. Source dimensions are subsequently normalized once to catalog envelopes by the shared driver; no fake geometry extends bounds.

## Mounting defaults

Wall elevation values are distances from floor to model base, in millimetres. Recommended values are exposed in `DEFAULT_ELEVATIONS_MM`:

| ID suffix | Base elevation mm |
|---|---:|
| wall-cabinet |1400|
| folding-wall-bench |470|
| tire-rack |1200|
| lumber-rack |650|
| pegboard-tools |1050|
| hook-rail |1550|
| extension-ladder |1850|
| cord-reel |1650|
| air-hose-reel |1600|
| ev-charger |700|
| wall-fan |1550|
| first-aid-cabinet |1200|
| garden-tool-rack |1200|
| wall-opener |1880|
| door-keypad |1100|

Ceiling rack and shop heater use ceiling height minus model height minus a 50 mm mounting gap; they contain top fixing plates/yokes. Garage doors start at floor 0. The folding wall bench has a 430mm-tall bracket/top assembly, so base 470 places the top at 900mm. The extension ladder is a 2500mm long stored horizontal three-section ladder on two hooks, not a small upright ladder.

## Door compatibility

Each of the three new door functions first constructs `household_architecture.garage(M)` and preserves its original outer jambs, header, bottom seal, exterior pull handles, all rear section stiffeners/hinges, rollers, tracks, hangers, torsion shaft/springs and cable drums. Only old front slab/raised-panel/glazing construction is replaced. All three retain the existing raw wall anchor `[0,0,0]`, raw 2700 x 2130 aperture and 2850 x 2700 x 2400 catalog envelope. The final actual mesh audit confirms those bounds and raw center `[0,1259,0]`, producing the existing 1259 mm wall offset. The placement tests cover all four wall rotations and resized apertures. True glazing openings have no opaque backing. Doors are fixed closed models; the wall opener and keypad are independently placeable static accessories, without electrical or host linkage.

## Construction features and limits

- Cabinet doors and drawers are closed, with visible panel gaps, separate pulls, shelf parts inside, leveling feet and genuine modular silhouettes. The corner unit uses an actual five-sided case.
- Pegboard is a single perforated mesh of open holes; its tool hooks, hammer, pliers, screwdrivers and ring spanners are separate source parts. No hole decals or textured tool silhouettes.
- Open bins, tote, utility sink and yard cart have real recessed interior walls and bottom surfaces. The sink has a separate drain, exposed P-trap and faucet.
- Saws have blade teeth, guarded working areas, motors, fence/rail or shoe construction, handles and switches. Machinery stays stationary; no simulation, particle dust or animated cutting.
- Generator, fuel can, welding cart, jack/stands and motorized yard equipment are stored layout props. The authored displays do not represent an operating setup or establish clearances/load ratings. The welder bottle is capped; no active flame or weld.
- Snowblower augers are true curved helical flights in an open bucket. The mower is a distinct four-wheel electric zero-turn layout, with deck, turf wheels, caster forks, seat, twin lap bars and battery area. The cart is a balanced two-wheel cart, not another single-wheel barrow.
- Fan blades and guards, hoses, wire grids and tire tread use bounded repeated geometry. The actual-binary verifier checks final dimensions, triangle/byte budgets, canonical material tags and UVs.

## Status

GAR-001 through GAR-055 are complete for source authoring, export and visual review. All 55 passed `garage_outdoor_verify.py`, including actual vertex bounds and nine support planes across five hosts. Each plane received 25 contact samples and nine clearance rays; the drawer top passes 22/25 samples and the remaining eight pass 25/25. The two asymmetric tool contact footprints are retained separately.

The 55 models retain 3,928 editable construction parts and total 368,668 triangles / 30,931,684 GLB bytes. The largest individual model is the carriage garage door at 29,812 triangles and 2,690,604 bytes, below the collection's 50,000-triangle / 5 MB per-model limits. Wood components use the shared licensed physical PBR maps; metal, rubber and molded polymer use calibrated shader roughness with modeled construction and bounded detail, rather than claiming scanned textures on every surface.

All ten focused `garage-outdoor-placement.test.ts` tests passed with generated metadata: 103 combined catalog entries, mounts, doors, measured workbench/drill placement, save/share/history, lowest-ground outdoor placement, forbidden canopy/water support hosts, placement under an open pergola, and actual lantern/watering-can contacts. Root also reran this file after integrating current master.

Visual review corrected the corner cabinet's clipped-front foot location, drill ventilation and end cap, rounded shop-stool upholstery, pegboard tool supports, nested ladder sections, and table-saw leg/foot and top-frame connections. Six clipped and additional lower-resolution helper renders were replaced using synchronous fixed-resolution rendering through the official Blender MCP. Final review covers 165 full 640 x 640 views; contact sheets in `.generated/garage-review` were regenerated after the corrections.

`assets-source/garage-collection-review.json` records final model/source/render hashes, measured support evidence and pixel-identical lossless WebP receipts. `tools/blender/garage_preview_export.py` checks all 165 render dimensions, verifies the actual binaries and converts only this collection's source PNGs. The collection is ready for shared validation, browser acceptance and the parent release workflow; this report does not independently claim a deployed release.

All 55 deployed WebP previews are pixel-identical to their source PNGs: 24,545,725 PNG bytes become 10,529,770 WebP bytes (57.10% smaller). The original 640 x 640 PNGs remain preserved in `assets-source/previews`. All refreshed contact sheets show the final corrected construction rather than superseded views.
