# Batch 11 — detailed indoor collection and home joinery

The indoor pass refines 139 existing models in Living, Bedroom, Dining, Kitchen, Bathroom and Lighting, retaining their catalog IDs, dimensional envelopes and existing editable construction. It adds 31 original models, bringing the library to 318 entries.

## Construction and compatibility

The refinement follows each component's local frame: tailored upholstery welts, mattress ticking, bedding stitches, inset panel beads, joinery pins, edge treatments, faucet collars, strainers, control markings, screen bezels, shower fittings and fireplace embers. Original silhouettes and material names remain available. Named Blender components are retained in editable `.blend` sources; the export copy merges static construction by material. Articulated door leaves remain separate meshes.

The complete affected inventory is in `tools/blender/interior_detail_manifest.json` and `src/homeExpansion.json`. Generators are `interior_refinement.py` and `home_collection.py`, registered in `build_quality_models.py`. Seven legacy exports had nominal envelope heights differing from their catalog entries; exports now use the catalog dimensions. Saved item dimensions and IDs are unchanged.

## New variety

- Kitchen: food processor, jug blender, toaster oven, waffle iron, lever citrus press, portable induction hob, wine refrigerator and bean-to-cup machine.
- Lighting: articulated desk light, tripod floor lamp, opal wall globe, adjustable wall reading lamp, linen flush light, double opal pendant and six-light ring chandelier.
- Windows: horizontal glider, tilt-and-turn construction, three-panel clerestory and radial-muntin transom.
- Window coverings: lined blackout and linen curtain pairs, Roman shade, wood Venetian blind, cellular shade and roller blind.
- Doors: braced barn slider, glazed barn slider, two-panel patio glider, three-panel patio slider, single Shaker pocket door and paired pocket doors.

Curtains and blinds use wall-face placement and can cover a window without cutting another opening. New doors expose a saved open-position control; barn track space is distinct from its offset doorway. Pocket leaves retract into the adjacent wall. Changing open position does not invalidate floor/wall geometry. Existing backups, sharing and undo/redo preserve the optional position field.

## Research references

References informed recognizable product types and construction; every mesh is original, with no retailer model or brand artwork copied.

- [KitchenAid countertop appliance families](https://producthelp.kitchenaid.com/Countertop_Appliances): distinguish processor, blender, oven and small-appliance constructions.
- [Lumens floor and table lighting](https://www.lumens.com/floor-and-table-lamps/shop-all/): task-light arms, tripod frames and shade/diffuser forms.
- [Hunter Douglas shade families](https://www.hunterdouglas.com/window-treatments/shades): Roman folds, roller fabric and open cellular construction.
- [Andersen patio door types](https://www.andersenwindows.com/ideas-and-inspiration/blog/ideas/types-of-a-patio-door): fixed and moving panels, gliding rails and wider patio configurations.
- [Andersen window operators](https://helpcenter.andersenwindows.com/aw/articles/Knowledge/What-Are-Casement-and-Awning-Window-Operators): separate operating hardware and glazing/frame construction.
- [Johnson pocket-door frames](https://www.johnsonhardware.com/1500sc-series-soft-close-pocket-door-frame-kits): concealed overhead travel and the pocket beside the clear opening.
- [Johnson sliding hardware](https://johnsonhardware.com/newproducts): visible rail hangers versus concealed pocket hardware.

## Review and budgets

All 170 changed/new models receive fresh Blender renders and contact-sheet review. Review corrections remove detached underside braces, floating socket details and rectangular edge trim on circular tops, and fit lampshade hems to their actual profile. PNG replacement is atomic to avoid OneDrive write contention.

The 170 GLBs total about 69 MB and load on demand. Median triangle count is about 3,400; the largest new model is the lined curtain pair at 31,500 triangles and about 1.7 MB. Static geometry is merged for export, shared between placements, and only sliding leaves retain separate transforms. Automated checks cover nominal world-space bounds, asset/preview/source completeness, native Babylon leaf imports, curtain/window coexistence, barn apertures, saved open position, history and malformed input. Existing placement and WebMCP suites remain release gates.

Release validation: 213 tests passed across 21 files; the final model checks passed after the upholstery render refinement. Type checking, the production build and all four Sites worker tests passed. Release verification found all 318 sources/models/previews, a 2.48 MB main entry (630 kB gzip), the DB binding and protected anonymous project access.
