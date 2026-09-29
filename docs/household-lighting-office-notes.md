# Household lighting, plants and office models

HOME-058 through HOME-071 are authored in `tools/blender/household_lighting_office.py`.
The module supplies 15 distinct catalog entries, including a separate piano bench.
All are original construction studies. Manufacturer names identify research sources,
not branded reproductions. The catalog dimensions are deliberately stated original
design envelopes; source specifications are recorded separately in the reference JSON.

## Authoring handoff

Call `create(catalog_id, M)` in the active owned scene. It authors millimetre geometry
only. The parent collection harness must save editable named parts, normalize the
catalog envelope, export through Blender, render and inspect front/rear/underside
views, then validate exported bounds and practical triangle/material budgets.
No source photograph, downloaded mesh, image atlas or external image is embedded.

The four light types share warm emissive optics rather than allocating scene lights.
Track heads use a fixed varied aiming pose. Fan blades are static and the description
says so. The porch lantern has separate glass panes, open frame, an authored bulb,
a pitched roof, mounting arm and fixings. The underside bar has visible fastening
clips and a recessed diffuser.

Plants have individually curved petioles or vines and thick curved folded leaf
meshes, with actual holes/marginal splits in mature Monstera leaves. The snake plant
uses 11 tapered succulent blades with visible gold edging and restrained transverse
bands. Pothos leaves have a lighter original vein material. Pots have modeled wall
thickness, rim, soil and bottom. No alpha-card foliage or sphere clusters are used.
Non-fenestrated leaves use a smaller surface grid than the broad split leaves.

The guitar has a genuinely open sound hole into its body, binding, rosette, bridge,
six strings, frets, inlay and six tuning keys. The guitar and tripod remain separate
named source parts in one fixed display assembly. The piano has exactly 52 white
and 36 black keys (A0–C8), three pedals and a retracted cover; its independent bench
remains separately placeable. Neither instrument claims audio or interactive keys.
The sewing machine has an open throat, separate needle, slotted presser foot,
feed-dog detail, bobbin hatch, hand wheel and modeled thread path.

## Required integration details

- `under-cabinet-light-bar`: wall/manual-height placement beneath a cabinet. It is
  not registered as a ceiling pendant. Suggested starting bottom height: 1450 mm;
  adjust to the actual cabinet. This is a layout aid, not installation validation.
- `vertical-patio-door-blinds`: Windows category, `decor` shape, wall mount. Add it
  to window-treatment overlay recognition, with no architectural aperture. The
  fixed partly tilted vane pose does not claim interactive opening/closing.
- `trailing-pothos-in-shelf-pot`: the pot bottom is source Z=0; trailing foliage
  extends below it. `household_support_plane_mm=0` is stored on the source scene.
  After bounding-box normalization the harness must transform this plane and use
  the resulting offset for surface placement; otherwise the pot floats. Only the
  pot footprint is support-bearing; trailing leaves may overhang the shelf. The
  source support center is [0, 0, 0] and the contact circle is 131.4 mm across.
- `desk-monitor-arm`: source Z=0 is the underside of its upper desktop pad. The
  lower clamp extends below it. Transform `household_support_plane_mm=0` with the
  model and preserve the resulting surface offset. The source pad center is
  [-180, 65, 0], contact rectangle 82 by 95 mm. The rear spine is at Y=116 mm,
  so the pad belongs just inside the desk's back edge. A real desk-edge pose is
  required. This is an arm-only fixed model; automatic attachment of existing
  monitors is not implemented and must not be claimed. Existing screen stands
  must not be removed silently.
- Printer, sewing machine and pothos remain independent tabletop pieces.
- Guitar stand/piano and filing cabinet are floor pieces. Preserve space in front
  of instruments and drawers; no code-clearance or mechanical operation claim.

## Research and duplicate review

The existing `linear-pendant`, `recessed-linear`, `ceiling-opal-flush` and
`opal-wall-sconce` do not have track pivots, fan blades or a framed outdoor lantern.
Existing `blind-venetian`, `blind-roller`, Roman and cellular models use different
construction from long individual vertical vanes. Existing `large-plant` and
`small-plant` are generic pot plants, not these named leaf constructions.
`bambu-p2s` is a fabrication chamber rather than a paper printer or sewing machine.
`desktop-monitor` and `wide-monitor` retain their own stands; the clamp arm fills
the mounting-construction gap. Existing playback equipment and music posters do
not duplicate a modeled guitar or keyboard. Existing ordinary cabinets do not
duplicate the three deep file drawers. New row IDs were checked against all
current expansion JSON files and no collisions were found.

Official references were revisited on 2026-09-29. The Ergotron page exposed a
product title but not its dynamic specification panel, so no dimensions were
copied from it. Brother's unordered machine dimensions are stored verbatim,
without inventing a width/depth/height mapping. The Roland reference distinguishes
its opened and closed lid heights; the original model's low retracted cover is
not asserted to reproduce either branded configuration exactly.

## Validation state

The Monstera, snake plant and trailing pothos are accepted after their corrected front, rear and underside previews. Monstera has 15 folded blades, natural marginal cuts and real rounded fenestration; the snake plant has 17 curved thick blades with restrained irregular bands; pothos has 54 heart-shaped crown/trailing leaves. The current Blender tessellator's integer indices are resolved before interpolation, while older Vector results remain supported.

Pothos preserves its pot-bottom contact and editable crown. Below-pot foliage arches outside a conservative authored 145 mm radial zone, smoothly returning to the original crown above raw Z 145 mm. Automatic support is restricted to the centered highest tray of `tiered-plant-stand`; cubby centers and ordinary broad tabletops are rejected. The exported conservative clear radius is **174.8246 mm**; exact triangle projection gives **196.2545 mm** minimum foliage radius below contact + 25 mm. The actual upper tray outer radius is **136.4103 mm**, leaving the required 10 mm margin. Lowest foliage sits **548.3459 mm** above the stand's floor datum.

Run `python tools/blender/check_household_pothos.py` for the reusable read-only geometry check. It reads the actual exported GLBs and authored support metadata, centers the pot on the high tray, checks every foliage triangle against the complete stand mesh, and verifies the conservative radius/margin. The accepted export reports **zero intersections**, including the middle tray and every support rod. It uses only the Python standard library and does not require ignored render files, Blender, or a running app.

Python syntax and row JSON parsing passed at authoring handoff. Render acceptance,
exported size/bounds, browser placement, application tests, CI and publication
belong to the parent collection's final acceptance record. Authoring is not a
claim that those checks have already passed.
