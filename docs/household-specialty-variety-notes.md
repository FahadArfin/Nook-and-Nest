# Specialty and outdoor variety

HOME-115–134 are represented by 22 original models, including an independently placeable drum throne and an independent commuter bicycle in a fixed vertical storage pose. Every family was checked against the current expansion catalog; no exact existing model matched. No existing ID or source is replaced.

Official reference pages were opened on 29 September 2026. The Canopia, Brabantia and AMES pages required an official-domain search fallback after direct open errors; Werner's direct page returned a dynamic template, and its indexed official product result supplied construction evidence. All original target dimensions remain separate from manufacturer specifications. No logos, product photography, CAD, meshes or certification marks are embedded. Details and source links are in `assets-source/household-specialty-variety-references.json`.

`household_specialty_variety.create(catalog_id, M)` adds editable millimetre parts in the current scene. It imports the existing shared `beam`/`wheel` construction helpers and the utility Boolean/grille helpers; retain those modules together. It does not clear scenes, call export, save files, create lights or publish. Parent owns exact bounds normalization, retained `.blend`, production GLB, material registration and previews.

## Placement and supports

| Item | Behavior |
| --- | --- |
| Drum kit and throne | Separate floor pieces. Fixed assembled pad/seat poses; no sound or animation. |
| Pegboard | Surface-mounted whole divider. Small fixed shelf and cup remain editable source parts; no arbitrary peg/hole snapping. Optional shelf usable support is 200 × 65 mm at approximately196 mm above model base, centred x=-119, y=-48 before normalization. Root must measure final normalized values before enabling support. |
| Footrest, pet ramp, easel, stroller, dumbbell rack, ladder, shop vacuum | Floor pieces with fixed authored poses. No implied exercise, folding, tilt, drawer or animal interactions. Do not register broad generic shelf supports on exercise or access equipment. |
| Cat bridge | Wall assembly; bottom default about1200 mm, adjustable. Complete slat/rope/landing width1300 mm; no automatic jumping route. Do not treat the sagging bridge as a general decor shelf. |
| Empty bicycle rack | Wall mount with editable height, 150 × 330 × 720 mm. Distinct empty rack ID preserves independent control. |
| Vertical commuter bicycle | Separate wall-mounted fixed storage pose, 650 × 900 × 1900 mm. Suggested bottom150 mm; represents full projecting handlebar/pedal envelope. No automatic attachment or move-together behavior. A coordinated placement preset must preserve both identities and be validated by root before claiming it. |
| Hutch/run, greenhouse, shed, composter, barrel, clothesline, wheelbarrow | Outdoor category ground/paving behavior, lowest-layer terrain anchor; preserve house foundations. |
| Hose reel | Exterior wall mount without aperture, suggested bottom700 mm, adjustable. Hoses remain short within bounds; no tap connection. |

The greenhouse and shed are explicitly **static exterior yard props**. Their original editable wall/roof/door parts exist, and the greenhouse uses transparent panels, but they are not walkable or editable rooms. Root must verify glass rendering/picking/shadows. No opening doors, dynamic roof hiding, climate, interior snapping or architecture capabilities are claimed. Their closed doors remain fixed.

The rotary clothesline's catalog bounds include its full2600 ×2600 mm overhead span. Do not advertise a walkable collision volume beneath it unless the engine actually supports it; it remains one selectable static furniture prop. The rain barrel depth is820 mm rather than the proposal's770 mm so the physical front tap is honestly contained.

## Modeled construction

- Drums: four rack posts, curved rails, snare/three tom shells, mesh heads, tuning lugs, shaped cymbal pads, support arms, pedals, kick beater and module. Stool separately carries a padded seat, threaded post and braced tripod.
- Shredder: separate head/bin, feed slit, visible paper-window detail and slider.
- Pegboard:84 genuine through-slots in an original panel mesh, wide feet, a hooked shelf and hollow hanging cup.
- Footrest: raised tread plate has tilt, axle, tubular cradle and rubber floor contacts.
- Ramp: full sloped carpeted deck, side lips, upper landing, under-braces and legs. Fixed635 mm height; do not stretch automatically to another bed height.
- Easel: open A-frame, contrasted drawing faces, trays, tension straps and spindle/roll. Chalk house and sun are original geometry.
- Stroller: curved folding chassis, forked wheels, tailored seat/back, visible harness and buckle, storage basket, segmented tailored canopy and ribs.
- Hutch/run: doorway cut through front, tray, vented shelter, rear panel, repeated open run wires, front wire door and latch. No pet included.
- Cat bridge:18 individual boards follow the sag, two rope paths on each side, separate landings and braced cleats.
- Weight rack:3 tiers with12 fixed hex dumbbells, steel handles, restrained grip bands and independent saddles. Loaded pose clearly named.
- Ladder: splayed rails, wide grooved steps, rear rungs, hinged limit braces, tool top and rubber boots. Fixed open pose.
- Bicycle/rack: original independent bicycle has two truly open spoked wheels, tubular diamond frame, fork, saddle/post, swept handlebars, grips, pedals, chain and brake cable. Empty rack has wall spine, pivot, wheel hoop and lower tire rest.
- Workshop vacuum: latched shaped drum, motor head/handle, outriggers/casters, restrained coiled hose corrugation, stored wand/nozzle.
- Greenhouse: slim structural bars, side/roof/gable glazing, separate closed door and outlined closed roof vent.
- Shed: floor/plinth, horizontal boards, actual front window openings, framed glazing, double doors/hasp/hinges, gable vents and layered roof/seams.
- Composter: polygonal drum and ends, bearing/axle, hatch/handles/vents and wide braced stand/locking pin.
- Barrel: hollow lathed vessel, strengthening hoops, removable lid, low tap and capped overflow.
- Hose reel: side covers, hub, wall pivot, fasteners, hose guide, short hoses and stored nozzle.
- Clothesline: mast/socket, sliding collar/release, four arms, braces and7 taut nested loops.
- Wheelbarrow: continuous genuinely recessed tray and rolled rim, wheel/axle, underside cross braces, long handles/grips and resting legs.

Python AST and22 unique catalog rows passed local checks. Intended bounded mesh budgets require parent measurement; no render, GLB budget, browser or release acceptance is claimed by this authoring handoff. Review small mechanisms close up and inspect back/underside views before publishing.

## Multiview review corrections

Reviewed all 22 models in the `outdoor-a.jpg` through `outdoor-f.jpg` front/rear/underside contacts. Six source corrections require fresh exports and previews before acceptance:

- `electronic-drum-kit`: support the kick pad with a floor plate and upright trigger tower.
- `paper-shredder`: cut a real viewing opening through the front bin wall so the paper detail is visible behind the glass.
- `compact-stroller`: raise the canopy's leading edge, model an open storage basket and settle the harness onto the reclined back/seat.
- `stored-commuter-bicycle`: replace the block saddle with a rounded, narrow-nose mesh and bent mounting rails.
- `compost-tumbler`: move buried ventilation marks to visible end-cap recesses.
- `steel-wheelbarrow`: connect both resting-leg ends to the handles, add a cross brace, and support the extended axle with bearing plates.

The other 16 reviewed assemblies have no new visual blocker in these views. This source review does not replace root's regenerated-render, browser, budget or release acceptance.

Five corrected models passed a further front/rear/underside inspection in `specialty-variety-final-a.jpg` and `specialty-variety-final-b.jpg`: drum kit, shredder, bicycle, composter and wheelbarrow. The raised stroller canopy exposed an absent connection to its seat/back, so explicit side hinge caps and curved stays now support it. Only `compact-stroller` needs another visual export/review from this six-model correction set.

Final stroller front/rear/underside renders, written at 03:00:22–03:00:28 local time on September 29, were reviewed in `stroller-final.jpg`. Its side pivots and stays now visibly connect the canopy to the seat/back. All 22 specialty variety models have completed this construction/silhouette visual review; no further visual source repair is requested. Browser placement and release acceptance remain separate gates.
