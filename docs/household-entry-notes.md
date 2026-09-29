# Household entry and compact furniture: HOME-022–043

Geometry authored in `tools/blender/household_entry.py`; 30 catalog entries represent 22 requested families. Original construction references and distinct original envelopes are recorded in `assets-source/household-entry-references.json`. No manufacturer image, texture, logo or downloaded mesh is embedded. The frame carries an original geometric sunset illustration made from editable geometry.

Current handoff status: Python syntax checked; geometry and rows ready for root-owned official Blender MCP execution. Exports, editable source saves, preview inspection, integration and browser acceptance are **not yet claimed** here. Root owns that review and release sequence.

## Important integration requirements

- `fabric-cubby-bin`: envelope 290 × 290 × 290 mm, including handles. The existing `cube-display-shelf` has 376 × 300 × 376 mm usable cubbies in `src/shelfSurfaces.ts`; the new bin fits with 10 mm depth clearance. Keep it independent.
- Cushions and throws are optional separately placeable surface props. Never add them automatically to sofas. Both cushions rest flat. Folded throw has a broad flat supporting underside; the sofa-arm throw has a **fixed saddle drape**, intended for an approximately 180 mm wide arm and manual height adjustment. A flat support snap may place that drape too high; do not advertise automatic arm fitting without a specific adapter.
- `underbed-drawer`: requires at least the actual 246 mm object-height clearance below a host bed. It must stay independently movable; no universal bed compatibility claim. Full-footprint collision needs to permit genuine free volume, not intersection with frame members. Do not silently attach it to the host.
- `loft-bed`: elevated deck is intentional. The raw authoring interior is approximately X −479…479, Y −986…986, Z 0…1455 mm; posts and side ladder occupy separate areas. Under-bed placement should test those actual free regions, rather than rejecting everything inside the bed footprint. Ladder remains inside the catalog envelope and has a real gap in the upper side guard. No desk or sofa is baked in.
- `overbed-table`: low caster base is intended to overlap a bed only in verified empty under-bed space. It uses a fixed authored tabletop height. No functional height control or medical suitability is claimed.
- Extending table, folding chair, gateleg table and recliner each have independent catalog IDs for meaningful fixed poses and correct footprints. Their descriptions explicitly state the pose. They do not yet imply a runtime articulated control. All parts remain individually editable in the saved source.
- Shoe rack is one standalone tier. The sockets are modeled construction; do not allow unlimited stacking or pretend a matching shelf definition alone validates stack strength. Single-tier placement is complete without stack behavior.
- Mirror dressing table is a fixed raised-lid pose with real shallow compartments and legroom. The mirror is an inset reflective material, not an opaque wood panel.
- Banquette straight/corner pieces are separate; no implicit grouping, movement of neighboring pieces, or merged L footprint.
- Screen is furniture. It does not cut walls or create architectural rooms. All three panels have connected alternating hinges and open modeled cane weave.
- Tilt shoe cabinet remains closed; internal cradle sides and pivot axes are authored for source completeness. No animated tilt control is claimed.

## Authored support planes

Numbers below are **raw Blender millimetres before parent normalization**. The parent should transform them with the same model bounding-box normalization used for export. Blender horizontal axes are X/Y; browser uses X/Z. Insets deliberately avoid frames, lips, backrests and bevels.

| ID | Raw support height | Usable width × depth | Raw center X/Y | Clearance / notes |
|---|---:|---:|---:|---|
| hall-tree | 185 | 710 × 280 | 0 / 0 | 240 mm below bench |
| hall-tree | 460 | 750 × 310 | 0 / −5 | 650 mm before hook zone |
| entry-console | 212 | 965 × 205 | 0 / 0 | 440 mm below apron |
| entry-console | 780 | 1050 × 250 | 0 / 0 | Open top |
| tilt-shoe-cabinet | 1282 | 910 × 220 | 0 / 0 | Top, closed pose |
| extending-table | 750 | 1360 × 810 | 0 / 0 | Compact continuous top |
| extending-table-open | 750 | 1960 × 810 | 0 / 0 | Includes inserted leaf |
| dressing-table | 752 | 435 × 410 | −160 / 0 | Left worktop only; do not cover raised mirror well |
| gateleg-table | 740 | 1460 × 760 | 0 / 0 | Both leaves supported |
| gateleg-table-closed | 740 | 260 × 760 | 0 / 0 | Central core only |
| gateleg-table-one-leaf | 740 | 860 × 760 | 300 / 0 | Core plus right leaf; root recentering applies |
| dining-banquette | 485 | 1000 × 460 | 0 / −32 | Flat seat only, clear of back and bevels |
| dining-banquette-corner | 485 | 460 × 460 | 43 / −43 | Keep clear of both backs |
| manual-recliner | 507.5 | 480 × 450 | 0 / −97.5 | Upright flat seat only, clear of lumbar bridge and arms |
| loft-bed | 1772 | 880 × 1390 | 0 / −225 | Covered mattress only, clear of baked pillow and guard rails |
| bar-cart | 146.5 | 545 × 340 | 0 / 0 | 475 mm below upper shelf; stay inside rails |
| bar-cart | 659.5 | 545 × 340 | 0 / 0 | Top tray interior |
| overbed-table | 985 | 720 × 370 | 0 / 0 | Inside shallow retaining lip |

Basket and bin cavities are real but contents support is deliberately not asserted without a dedicated interior region. Coat and clothes racks expose empty rails; automatic garment anchors are outside this static model baseline.

## Reference checks and duplicate decisions

The selected research queue, existing expansion JSON catalogs, and `src/interiorCatalog.ts` / `src/shelfSurfaces.ts` were examined. No exact independent-placement equivalent was found for these IDs. Existing benches, integral bed drawers, fitted sofa cushions, cabinetry and media tables do not satisfy the requested independent constructions. Existing IDs remain untouched.

Official IKEA pages were opened for NIPASEN, EKRAR, GURLI, DRONA, MALM, LAPPTAG, FLADIS, RIGGA, GREJIG, RODALM, NORDVIKEN, BRIMNES, FROSVI, TOLKNING, NORDEN and VITVAL. The HEMNES UK URL redirected, so official France/Sweden search results supplied the dimensional cross-check. Article product pages returned direct-open errors; official Article collection/search results and the Cotu assembly document supplied corroboration. These source limitations are recorded; original dimensions are not presented as exact branded reproductions.

The official La-Z-Boy Pinnacle page supplied upright and extended envelopes as a scale reference. Ballard's official banquette article supplied modular seating construction context. Drive Medical's official 13003 specification PDF supplied the offset-column and low-base reference for the original fixed-height overbed table.

## Rendered construction review

All 30 models are accepted after front, rear and underside review. The 12 corrected models were rebuilt and rechecked in `entry-repair-a` through `entry-repair-c`: matte cloth, smoothed throw folds, trimmed basket floor reeds and the closed recliner lumbar gap now read correctly. Named editable sources and nominal catalog envelopes are preserved. Seat/mattress metadata was checked against stored export normalization: the upright recliner has a 459.9 × 502.8 mm usable seat; straight and corner banquettes admit the 450 mm square cushion without crossing their backs or beveled edges. This is model/support acceptance; application tests and publication remain separate release gates.
