# Family, fitness and garden construction

HOME-072 is **covered by existing `high-chair`**, whose 550 × 600 × 900 mm catalog entry, editable Blender source, GLB and rendered preview were checked. It already has the named raised seat, broad tray and footrest. The research proposal had omitted this exact existing model. It is preserved without a redundant catalog addition.

HOME-073–084 add twelve original models. `household_specialty.create(catalog_id, M)` creates millimetre-scale editable parts in the active scene and never clears, saves, exports or changes shared catalog integration. Front is negative Y, Z is up. Reference evidence is in `assets-source/household-specialty-references.json`; all authored dimensions are original design targets. Official source pages were opened on 29 September 2026. The first Gladiator collection URL failed, so the working official product endpoint was checked via search. The high-chair proposal's Stokke URL returned 404, but an existing model already fulfills that queue entry.

## Support and mounting

All twelve models are floor placed. Outdoor mower, deck box and refuse bin must use existing Outdoor ground/paving behavior; they must not float at apartment slab height on the lowest level.

`garage-workbench` needs a usable flat tabletop at **900 mm**, full original top bounds 1830 × 635 mm. Use a small edge margin of 10 mm each side, giving **1810 × 615 mm** usable support, centred on the footprint. The worktop is independent of its legs and has no baked tools.

`rolling-tool-cabinet` has a top rubber mat at **953.5 mm** before exact bounds normalization (947 mm centre plus6.5 mm half thickness), with side lips projecting to960 mm. Use raw support height **953.5 mm** and usable top **610 ×530 mm**; raw support centre is x=0 and y=0. The driver transforms that centre and size using actual bounds; the projecting side handle makes the normalized centre slightly off the overall footprint centre. Do not treat the side push handle as additional support.

The nursery platform, exercise pads, mower, bin and wire crate should not register generic decoration shelves. The deck box is a storage chest, not automatically a seat. Each is independent and fixed pose; opening crate door/chest lid, adjusting nursery platform, inclining bench, folding treadmill or moving exercise parts is not implemented. Catalog descriptions say flat/deployed where relevant. None claims operational or child/pet safety certification.

## Review focus

- Crate: welded-wire silhouette, base tray and distinct closed hinged door/latch; no solid opaque substitute panels.
- Play yard: visible open mesh pattern, padded rails and floor, angled legs, hinge hubs and side zipper. Mesh uses bounded actual threads plus a translucent neutral backing, without downloaded texture.
- Learning tower: broad stabilizing feet, two steps, adjustable standing platform and surrounding open rails. No child figure or stove relationship.
- Weight bench: split pads with visible gap, real incline ladder under the flat backrest, pivot, wheels and handle.
- Rower: inspect full 2440 mm long footprint, fan cage from side, rail/seat rollers, angled footplates/straps, handle, monitor arm. Screen is an original static graphic.
- Workbench: thick separate laminated boards, telescopic sleeves, pin holes, cross brace and leveling feet.
- Treadmill: belt sits within the raised rails, front motor hood, nonfloating uprights/handrails, static original screen, cup recesses and safety-key block. Fixed deployed pose.
- Exercise bike: weighted flywheel with bands/hubs, welded diagonal frame, real seat post/slider, saddle nose, handlebar, crank/pedals and resistance knob. No animations.
- Tool cabinet: seven graduated drawers, pull profiles, labels, top mat, side grip and braked caster construction.
- Mower: four detailed wheel hubs, deck/battery housing, collector, push handle hinges, bail and control cable.
- Deck box: closed lid overlaps paneled sides, side grips, rear hinges and front latch.
- Refuse bin: tapering body has an editable hollow inner wall under its separate lid; large rear wheels, axle and push handle are inside final declared bounds.

No per-object lights or downloaded images. Python syntax and twelve JSON rows checked locally. Parent owns official Blender execution, exact bounds, triangle-budget measurement, multi-angle rendered approval, browser checks and release. This authoring handoff does not claim those acceptance steps complete.

## Rendered review follow-up

Initial front, rear and underside renders for all12 models were visually inspected. Crate mesh/door, play-yard mesh, helper-tower joinery, bench adjustment ladder, rower cage/rail, workbench sleeves, tool drawers, deck chest and refuse bin read as the intended constructions. Three source corrections followed: treadmill display moved outside the case onto the runner-facing console and its assembly now faces the runner entrance toward catalog front; exercise-bike saddle now uses one continuous shaped planform; mower collector is a tapered sewn bag with bindings and lifting strap. These corrected sources require fresh parent renders before final acceptance.

Added `support_surfaces()` for the workbench and tool cabinet. The cabinet's exact raw mat surface is953.5 mm; the earlier approximate955 mm note was corrected against the authored6.5 mm half-thickness. Driver normalization handles actual footprint centring and millimetre dimensions, including the side-handle offset.

The corrected bike saddle, mower bag, workbench and cabinet passed a further front/rear/underside visual inspection in `specialty-final-review.jpg`. That inspection exposed a gap under the treadmill display because its panel tilt opposed the console. The display now follows the console's minus-12-degree plane and is inset against the housing; `folding-treadmill` needs one further export/render before visual acceptance. Browser and release acceptance remain pending.

Final treadmill front/rear/underside renders were reviewed in `treadmill-final.jpg`, including its full-resolution underside. The display now seats against the console with readable static controls. All 12 authored specialty models have completed this construction/silhouette visual review; no further visual source repair is requested. Browser placement and release acceptance remain separate gates.
