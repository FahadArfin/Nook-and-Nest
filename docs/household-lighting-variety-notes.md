# Household lighting and plant variety

HOME-107–114 adds eight original construction families through
`household_lighting_variety.py` and `householdLightingVarietyExpansion.json`.
Call `create(catalog_id, M)` from the parent collection's active owned scene.
The function only authors named parts in millimetres. Saving editable sources,
normalizing catalog dimensions, export, rendering and application acceptance
remain the parent harness's responsibilities.

The picture light uses an open, thick half-cylinder brass hood with rolled lips,
recessed optic, twin swept arms, wall plate and pivots. The bollard has a separate
plinth, fasteners, weather cap and opal diffuser. The hall guide light has a
recessed optic and captive plate screws. All light effects are emissive materials;
the models allocate no extra shadow-casting lights or sensor simulation.

Shutters have deep outer framing, separate panel stiles/cross rails, elliptical
louver cross sections, visible hinges and tilt rods. Register them as wall-mounted
window-treatment overlays (`decor`, not `window`) so they create no second opening.
Their partly tilted pose is fixed. Suggested starting mount heights are 1900 mm
for the picture light and 200 mm for the guide light, with ordinary manual editing.

The bollard belongs to Outdoor and must use the existing ground/paving support,
not apartment-floor elevation. Nothing is automatically added to a saved room.

Plant construction is species-specific: ZZ has paired thick oval leaflets along
seven curved rachises; fiddle-leaf fig has a woody branching trunk and broad
wavy violin-shaped leaves; moth orchid has thick basal strap leaves, two arching
spikes, eight individually constructed flowers with three narrow sepals, two broad
petals, curled lips and raised centers; peace lily has lance leaves and three
cupped white spathes surrounding raised textured spadices. Modeled thickness and
folded surfaces replace alpha cards or sphere clusters. Mesh grids and segment
counts are bounded; plant material palette is shared with the prior collection.

The orchid is a separately placeable surface item and all its foliage remains
above the pot bottom. The other three plants are floor pieces. Their catalog
envelopes are original composition targets, not measurements of a unique living
plant. Reference photographs were not embedded. The original sources remain
editable down to each leaf, stalk, petal, pot, frame member and fixture part.

Official source evidence, exact recovered reference dimensions and chosen design
targets are separated in `assets-source/household-lighting-variety-references.json`.
For the Calla reference the Signify sheet contains an inconsistent 10.4 mm width
entry alongside a 104 x 252 mm cover statement; that conflicting value is not used.
The guide light reference's automatic sensor behavior is not claimed by the model.

Python syntax, JSON parsing and expansion-ID collision checks passed at handoff.
Render review, final mesh budgets, browser placement and release are not yet
asserted by this authoring note; use the parent collection acceptance record.

The corrected `potted-fiddle-leaf-fig` is accepted after front, rear and underside render review, including the full-size hero preview. It now has 26 broad folded violin leaves on seven uneven rising shoots, a continuous tapering trunk, connected short petioles and a fuller crown. Its 950 × 900 × 2000 mm catalog envelope and independent material/placement contract are preserved. This supersedes the original fig's sparse 16-leaf source description; final application and release gates remain with the parent collection.
