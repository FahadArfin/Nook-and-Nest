# Household compact furniture variety: HOME-093–105

20 original catalog models cover 13 research families. `tools/blender/household_entry_variety.py` exposes `create(catalog_id, M)` and conservative `support_surfaces(catalog_id)` raw-millimetre metadata. The root-owned driver normalizes mesh and support data together, preserves named editable components and performs official Blender MCP export and review.

Handoff status: geometry, rows, original dimensions and reference evidence authored; Python syntax checked. Root still owns rendered acceptance, export checks, browser integration and publication. These files do not claim a release.

All opening and articulation choices are clearly labeled fixed poses, independently placeable with distinct IDs and footprint. This preserves simple saved catalog IDs and does not pretend to add a live motor or conversion simulation. Manufacturer links in `assets-source/household-entry-variety-references.json` are construction references only; dimensions and geometry are original designs, not exact branded reproductions.

## Construction and behavior

- **HOME-093 blanket chest:** open framed lid, real wood interior, short tenoned feet and paired articulated lid stays. Contents may use the explicit interior support plane. The open envelope includes the raised lid.
- **HOME-094 plant stand:** three empty circular steel trays at staggered levels. Support metadata uses conservative inscribed square regions inside each tray. Plants are never baked in or auto-added.
- **HOME-095 adjustable bed:** common queen-like footprint, separate deck and mattress segments, raised head and underside actuator rods. The foot and hip remain flat in this fixed pose. It is a planning asset with no medical claims or live adjustment UI.
- **HOME-096 floor chair:** legless upholstered pan with ratchet joints, a separate padded head panel and articulation seams. Upright and relaxed poses have separate envelopes; no scaled armchair or spherical seat was used.
- **HOME-097 valet:** empty original bamboo-like shoulder hanger and forward trouser rail, discreet accessory hooks and a low tray. Future garment anchors are not implied.
- **HOME-098 dry bar cabinet:** pocket leaves stowed in side channels, open serving area, individual stemware rails and bottle partitions. No bottles/glasses are mandatory clutter. The serving plane is inset from the doors and side rails.
- **HOME-099 expanding daybed:** the narrow pose stacks two thin fitted mattresses. The expanded pose puts the same mattresses side by side on an interleaved sliding slatted deck. The drawer assembly shifts with the deployed base; it is not represented as two freestanding beds.
- **HOME-100 wall bed:** separate closed and deployed queen-sized cabinet models. Deployed bed includes timber slats, mattress straps, lift struts and folded-down steel support. It is floor-standing cabinetry against a wall, not a wall aperture or structural simulation.
- **HOME-101 storage ottoman:** true felt-lined hollow well, upholstered walls, separately padded raised lid and short solid feet. Existing fixed upholstered or woven ottomans lack this storage construction and remain unchanged.
- **HOME-102 lift recliner:** original terracotta waterfall back, side pocket, corded controller, steel lift chassis and actuator. The raised forward-tilt and reclined versions expose different usable footprints. Keep these labeled poses; do not imply clinical/accessibility certification.
- **HOME-103 single-chair sleeper:** folded layered mattress and front webbing in chair mode; three independent aligned mattress sections on telescoping guides and legs when open. Low arms remain at the head; no extra seat-side pillows.
- **HOME-104 vinyl cabinet:** individual LP partitions, split-level equipment bays, flat turntable top and an actual opening through the rear panel for cables. Turntable and LP accessories remain independent. Shelf metadata respects every divider and overhead height limit.
- **HOME-105 wall drop-leaf:** two wall-mounted fixed poses, with an actual backplate, shallow shelves, leaf hinge and diagonal supports. Mounting height must be set from the usable tabletop, not the whole object height. For the open pose, the raw tabletop plane is 487 mm and raw lowest point approximately 35 mm; after measured normalization, choose the default wall elevation to put this plane around 750 mm above the floor. For folded pose, the hanging leaf reaches raw Z −171 mm; use its separately measured bounds. Do **not** use the kitchen default 1500 mm bottom elevation.

## Support and collision notes

The `support_surfaces` function is authoritative for the driver's transform. Blender X/Y map to browser X/Z; the parent negates Y. Support footprints avoid frame edges, drawer dividers, tray lips and raised-lid swing volume. Tables with separate levels must not receive a generic single rectangular surface spanning the whole model.

Blanket chest interior is approximately 1004 × 434 mm, floor at raw Z 88 mm; advertised content region is further inset to 970 × 400 with 370 mm height allowance. Ottoman lined well is approximately 910 × 590, floor at raw Z 123 mm; conservative support is 865 × 535 with 258 mm height allowance. Plant tray interior radius is approximately 125 mm, so the 170 × 170 support rectangles remain inside it.

Open sleeping poses need their full catalog envelope to remain clear. No neighboring furniture is automatically moved when selecting a different pose. The raised and relaxed seating entries preserve normal independent placement and per-part material recoloring.

The following additional raw millimetre planes support optional flat cushions/throws. Each is inset from the modeled bevels and adjacent construction. `z` in source dictionaries is Blender Y. Metadata can be refreshed from stored export bounds without rebuilding geometry.

| Model / plane | Center X / Y | Width × depth | Height | Clearance |
|---|---:|---:|---:|---:|
| expanding-daybed / mattress | 0 / 0 | 1840 × 750 | 686 | 600 |
| expanding-daybed-wide / rear mattress | 0 / 0 | 1840 × 750 | 543 | 600 |
| expanding-daybed-wide / front mattress | 0 / −890 | 1840 × 750 | 543 | 600 |
| wall-bed-open / mattress between straps | 0 / −795 | 1350 × 1300 | 639 | 800 |
| chair-sleeper / flat seat | 0 / −125 | 635 × 460 | 499 | 350 |
| chair-sleeper-open / foot panel | 0 / −1360 | 650 × 560 | 438.5 | 600 |
| chair-sleeper-open / middle panel | 0 / −715 | 650 × 560 | 438.5 | 600 |
| chair-sleeper-open / head panel | 0 / −80 | 650 × 560 | 438.5 | 400 |

Separate mattress planes deliberately do not bridge physical gaps or fold seams. Tilted adjustable beds, raised/reclined lift seats and closed wall-bed faces expose no bedding support planes.

## Reference evidence

Official Simply Amish, IKEA, MUJI, Resource Furniture, Crate & Barrel and La-Z-Boy pages were opened and inspected. The Tempur-Pedic storefront was text-limited; its official owner-manual help page was available. Article product URLs returned errors, so the official indexed Cotu result and official JOKUNA assembly PDF were used, with that limitation explicitly recorded. No third-party product dimensions are passed off as verified manufacturer specifications.

## Rendered construction review

All 20 models are accepted after front, rear and underside review. Open cavities, connected deployed supports, wall-table braces, the expanded daybed deck and the raised-chair mechanism remain legible. Rebuilt views in `entry-repair-d` confirm the three lift-recliner lumbar gaps are closed and the upholstery is matte. Bedding support planes remain distinct from the full furniture footprint and avoid straps, pillows, arms and fold gaps. The closed sleeper chair's normalized clear seat is 634.4 × 469.4 mm, sufficient for the independent 450 mm square cushion. Application tests and publication remain separate release gates.
