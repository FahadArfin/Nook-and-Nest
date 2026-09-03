# Batch 3 — kitchen and storage

Researched September 2, 2026. All 28 pieces are original Blender models, not downloaded retailer assets or branded replicas. Manufacturer references were used to distinguish construction types, not as texture/model reuse permission.

## References

- [IKEA AXSTAD glass-front cabinet](https://www.ikea.com/us/en/p/axstad-glass-door-matte-blue-40468393/): framed glazing and visible shelves.
- [IKEA PAX corner wardrobe](https://www.ikea.com/us/en/p/pax-corner-wardrobe-white-s09560737/) and [PAX wardrobe system](https://www.ikea.com/us/en/cat/pax-system-19086/): separately configurable frames, shelves, rails, drawers and sliding/hinged fronts. Our corner bay is an original open L-shaped module, not an IKEA-dimensioned part.
- [Broan-NuTone range hoods](https://broan-nutone.com/en-us/range-hoods): distinct chimney, under-cabinet and wall-mounted construction. No airflow, electrical or installation suitability is represented.
- [KitchenAid stand-mixer buying guide](https://www.kitchenaid.com/content/kitchenaid/en_us/countertop-appliances/stand-mixer-buying-guide.html): the tilt-head/pedestal/bowl arrangement informed the original Sunday baking mixer. No logos or branded parts.
- [Daltile backsplashes](https://www.daltile.com/backsplash) and [wall-tile selection](https://www.daltile.com/how-to/how-to-choose-the-right-tile/wall-tile): subway, stacked tiles and continuous stone slabs informed three separately placeable panel styles.

## Delivered collection (28)

- Six kitchen cabinets: handleless push-front base, Shaker drawer base, decorative arched base, tall pantry, glazed wall cabinet and open wall cubbies.
- Three hoods: chimney, under-cabinet and over-range microwave.
- Seven storage pieces: sliding closet, paneled double-door closet, hanging module, shelf module, open corner module, fluted wide dresser and five-drawer chest.
- Seven independent countertop pieces: toaster, espresso machine, drip coffee maker, knife block, microwave, stand mixer and glass-bowl air fryer.
- Two hanging lights: open dome pendant and suspended linear pendant.
- Three backsplashes: staggered subway, vertical stacked tile and continuous slab.

Every catalog item includes an editable named-component `.blend`, dimension-normalized GLB and rendered preview. Primary forms are chamfered and matte; wood uses the existing original shared texture. Bowls/carafes and pendant shades use real hollow profiles. Color channels separate bodies, fronts, hardware, glazing, worktops, tiles and grout as applicable. The three new base units and the slab backsplash use the existing granite, marble, laminate and concrete finish picker.

## Placement and compatibility

Wall cabinets, hoods and panels use wall-aligned placement with a small offset from the solid wall face, editable height and a facing flip. They do not cut architectural openings. Placement rejects panels that cover existing doors/windows. They remain independent pieces: later changes to architecture should be checked in the inspector.

Appliances snap to continuous supported worktops and tables; the new bases exclude the projecting handle/front margin from their safe support region. Existing manual elevation controls remain available. Pendants initialize beneath the active floor's ceiling, with editable drop/height. Closet modules can be independently duplicated, resized and rotated to make runs, corners and walk-ins; there is no automatic closet-design wizard or operable door simulation.

Backsplash width/height scale the authored tile pattern. Duplicate panels for a longer run with unchanged tile proportions. Panels are not destructively merged with walls. IDs, V1 schema, existing furniture, undo/redo, local saving, JSON and share-link round trips remain compatible.

Tests cover all 28 exported envelopes and polygon budgets, material metadata, placement against perpendicular walls, facing flips, opening protection, counter containment and elevation, ceiling limits, independent module edits and exact save/share restoration. UI tests cover the backsplash shortcut, draft confirmation, grout colors, material switching and pendant-height editing. Preview inspection caught and corrected coplanar surfaces on the pantry, toaster and espresso machine. Interactive browser/hardware review remains in the final release batch.
