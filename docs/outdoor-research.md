# Batch 5 — Garden, surroundings and detail zoom

Implemented locally September 3, 2026; no expansion has been published.

## Delivered

27 original editable Blender catalog models (216 total catalog entries): lavender, daisies, tulip pot, raised bed, balcony flower box, hedge, flowering bush, spruce, maple, sakura, grass tuft; slatted patio chair, Adirondack-style chair, loveseat, chaise, bench, bistro/dining tables, parasol, gas/kettle barbecues and fire bowl; cobble, concrete, basket-weave brick, timber-deck modules and stepping stones.

Five additional non-catalog Blender surroundings: city, suburban, rural hills, farm and fantasy medieval. Open **Garden & surroundings** in the room panel to select a background or grass density. All absent settings mean plain ground and grass off, so old builds do not acquire scenery. Settings use the existing history, autosave, JSON, sharing and private-save document flow.

Outdoor items remain normal independent catalog placements with material-color controls, rendered previews, draft/confirm/cancel/rotate, duplication and undo. On the lowest floor, dragging any floor-standing item outside rests it on the ground. A fully fitting item can rest on a paving module. Modules do not generate walls; resize/duplicate them to lay out a patio or walkway. Paving textures/proportions scale when resized. Stepping stones remain independent slabs with real gaps and are not treated as a continuous support plane. Upper-floor furniture does not automatically fall to the garden.

The meadow extends around the build, with non-pickable background geometry moved beyond its bounds. Scenery buildings are decorative distant dioramas, not editable houses or accurate geographic scenes. Grass uses the original 18-triangle Blender tuft with hardware thin instances: at most 600/light or 1,800/fuller. It avoids architectural footprints and furnishing footprints with a margin; it stays static and does not cast individual shadows. It is regenerated only when its geometry/settings change, not on selection or recoloring. This is a bounded implementation, not a hardware performance certification.

Close decorating: minimum orbit radius reduced from 4 m to 0.25 m, near clipping 5 mm, gentler close-range panning, zoom buttons and an explicit **Focus selected furniture** control. Selecting/recoloring still preserves camera framing. Focus and zoom are navigation actions, not document edits; saved project schema remains version 1.

## Primary research references

- [IKEA NÄMMARÖ outdoor combinations](https://www.ikea.com/us/en/files/pdf/6d/a2/6da2b97f/nammaro_feb_2024.pdf): recognizable slatted timber patio furniture, dining and lounge types. Original simplified models; no retailer assets used.
- [Belgard cobble paving](https://www.belgard.com/product/belgian-cobble/) and [permeable patio paver families](https://www.belgard.com/products/patios-paths/permeable-patio-pavers/): varied cobble/concrete paving categories. These visual layout pieces make no drainage, installation or load-bearing claims.
- [RHS lavender guide](https://www.rhs.org.uk/plants/lavender/growing-guide), [hedge selection](https://www.rhs.org.uk/plants/types/hedges/choosing), and [sensory garden plants](https://schoolgardening.rhs.org.uk/resources/info-sheet/plants-for-a-sensory-garden.aspx): lavender spikes, leafy hedges, conifers, maple foliage and spring cherry blossom as distinct silhouettes. No botanical growth simulation.

## Asset and verification notes

Authored geometry is in `tools/blender/outdoor_models.py`, registered through the existing Blender exporter. Individual named component sources are saved in `assets-source/blender/`; GLBs and previews are in `public/models/furniture/` and `public/models/previews/`. No image-generation or downloaded third-party artwork is needed for this geometry-based batch.

All catalog GLBs have checked real dimensions, <60,000 triangles and <5 MB per model; the grass tuft is deliberately only 3.4 KB. Tests import all 32 new GLBs through Babylon with materials skipped in the headless environment, validate support heights/footprints and import guards, check deterministic bounded grass and its non-pickable thin-instance wiring, and exercise scenery/zoom UI callbacks. Every catalog preview was visually inspected; tree density, the planter taper, canopy thickness, fire-bowl bottom and barbecue wheel attachments were corrected during review. Separate previews inspect the five background compositions.

No browser-interaction or integrated-graphics performance claim is made here. Combined-release browser/hardware testing, hosted sign-in activation and public deployment remain Batch 6. Barbecues and fire bowls are decorative planning models, not operating appliances or safety-clearance guidance.
