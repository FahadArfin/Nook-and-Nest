# Outdoor living model construction and acceptance notes

This batch contains 48 original, separately placeable assemblies. `src/outdoorLivingExpansion.json` declares the full millimetre envelope. `tools/blender/outdoor_living_models.py` contains the original editable-part builders, with one dispatch entry for every row. `assets-source/outdoor-collection-references.json` maps OUT-001–048 to reviewed public catalog references and distinguishes design targets from published manufacturer dimensions.

## Geometry and material treatment

Seating is structurally varied: interlaced dining cord, tensioned canvas, woven club shell, mesh-sided aluminium sofa, broad slatted daybed, suspended egg basket, elastic-laced recliner and steel folding chair. Upholstery has flat usable central faces, boxed seams, separate piping and fitted back pads. Piping transforms together with its back pad. Wood components include actual joinery, end caps and separate planks; shared licensed maps provide directional grain and fine fabric relief.

Gazebo construction includes eight inward knee braces, paired perimeter beams, individual rafters, diagonal hip members, a thin closed metal roof shell, seams, ridge cap, post shoes and exposed fasteners. Pergola blades, pivots, linkage, gutter beams and crank are distinct components. Awning, sail and parasol retain tensioning arms, canopy hems, ribs and supporting anchors. The awning's suggested minimum model-bottom placement is 2150 mm; its catalog height is the complete 540 mm sloping canopy/cassette envelope.

Pools have actual recessed floors and side walls. Above-ground liner pools include their supporting legs in the catalog footprint; the rectangular pool's 5490 × 2740 mm basin is smaller than its complete 5950 × 3450 mm catalog envelope. The timber plunge remains wholly above ground, with a submerged bench and steps. The four-seat spa has a separate shell, seat bodies, headrests, jet rings and controller. Water sits below the rim. There are no buried solids pretending to excavate the ground.

Outdoor sink walls surround a real open bowl. Glass-front refrigeration has inner wire shelving. Storage doors, cooler split lids, grill gasket bands, thermometer, ash vent, hopper, grease cup, cabinet vents and adjustable feet remain modeled. Planters have actual hollow troughs with recessed soil. The corrugated garden bed uses rounded soil corners that remain inside its curved metal walls.

The bar's rear support metadata is split into four compartments around actual dividers. The towel valet and prep trolley likewise use only their usable shelves. No support planes are published on roofs, canopies, pool water or garden soil. Slatted furniture support envelopes intentionally bridge narrow drainage gaps; this does not claim every point within the rectangle is filled by a solid slab.

The lantern and long-spout watering can have measured contact-footprint metadata. The watering can's footprint is its 184 mm diameter bottom, centered under its body rather than under the asymmetric complete spout/handle envelope.

## Functional limits

All mechanisms are fixed authored poses. The egg chair does not swing, loungers do not recline, pergola blades do not turn, awnings do not retract, tables do not extend and grill/cooler/storage doors do not open. These poses are named explicitly in catalog descriptions. Lamps use visual emission; heaters and the garden torch are off. Pools, ladders, access steps, pergolas and gazebo are independently editable layout objects, without swimming, weather, structural, plumbing or walk-through simulation.

## Verification

`python -m py_compile tools/blender/outdoor_living_models.py tools/blender/outdoor_catalog_report.py tools/blender/garage_outdoor_verify.py` checks source syntax. Static source inspection confirms 48 catalog IDs and 48 dispatch builders with no missing or extra IDs.

After all new collection assets exist, `python tools/blender/garage_outdoor_verify.py` reads real GLB binary positions, transforms, indices and UVs for the combined garage/outdoor collection. It checks exact declared dimensions, base/center alignment, finite UVs/normals, self-contained textures/buffers, stable unique canonical material keys, source tags, editable `.blend` and rendered PNG presence, audit counts and practical mesh/file limits. It tests actual coplanar support triangles using a staggered sample grid, allowing bounded slat gaps while requiring majority physical support. This read-only verifier does not open Blender or modify any asset.

All 48 models have final editable Blender sources, embedded-texture GLBs and reviewed front/rear/underside renders (144 views). The actual-binary verifier passed all 48 after the final geometry corrections. `assets-source/outdoor-living-review.json` records final asset hashes, dimensions, support contact samples, clearance rays and render hashes. `tools/blender/outdoor_preview_export.py` preserves source PNGs and checks pixel-identical lossless WebP catalog copies.

The final collection contains 3,354 editable construction parts and 317,736 triangles across all 48 models. The largest individual model has 25,480 triangles; the largest GLB is 3,688,888 bytes. Total GLB bytes are 68,657,648. Each GLB embeds its material maps and loads independently through the existing catalog pipeline.

Render review corrected the egg chair's fitted cushion footprint and continuous chain/yoke, daybed front arm supports, gazebo hip rafters and parallel metal seams, visible plunge-pool cedar cladding and downward-facing heater reflector. Timber UVs follow each component's local axes. Stone roughness maps retain a minimum 0.62 roughness; the red kamado keeps solid pigment with normal/roughness detail and a 0.4 roughness minimum. Large-structure previews scale studio light distance and size with the model, preserving exposure through squared energy scaling.

Application runtime acceptance, PR checks and publishing remain the parent release workflow's responsibility. No release is asserted by these asset checks.

The 48 catalog preview copies are pixel-identical lossless WebP: 21,815,816 source PNG bytes become 9,434,434 deployed WebP bytes (56.75% smaller). Original PNGs remain in assets-source/previews.
