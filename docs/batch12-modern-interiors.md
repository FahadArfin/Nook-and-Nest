# Batch 12: modern interiors

The collection revisits 102 existing entries (101 rebuilt or refined, nesting tables retired from browsing) and adds 112 independently placeable models. Existing catalog IDs, dimensions, saved colors and saved-plan schema remain compatible. The retired nesting-table asset stays available for existing plans. Aquarium and vegetation assets are unchanged.

## Design references

All geometry is authored in `tools/blender/modern_models.py` and retained as named editable objects in `assets-source/blender/`. Manufacturer references guide proportions and construction; these are stylized planning models, not manufacturer CAD assets. No manufacturer meshes or product photography are redistributed.

- [BoConcept coffee tables](https://www.boconcept.com/en-us/shop/tables/coffee-tables/) and [ceramic dining tables](https://www.boconcept.com/en-ca/shop/tables/dining-tables/ceramic/): shaped slabs, pedestal bases, glass and metal construction.
- [BoConcept beds](https://www.boconcept.com/en-us/shop/beds/): upholstered headboards, storage platforms and contemporary neutral finishes. The floating bed is an original recessed-plinth design.
- [Herman Miller office chairs](https://www.hermanmiller.com/products/seating/office-chairs/) and [Eames Executive](https://www.hermanmiller.com/products/seating/office-chairs/eames-executive-chairs/): suspended mesh, articulated back support, cast-metal bases and leather padding. The catalog explicitly labels the Aeron and Embody models as studies.
- [Babyletto Swell](https://babyletto.com/collections/soothing-sage/products/swell-4-in-1-convertible-crib-with-toddler-bed-conversion-kit): white, light sage, cove blue and pale yellow references. The new nursery palette is white, sage, blue and lavender; it is a design choice, not a claim about developmental effects.
- [IKEA kitchen cabinets](https://www.ikea.com/us/en/cat/kitchen-cabinets-700292/): modular bases, drawers, pantry and upper cabinets with white and colored fronts, real carcass panels and inset hardware.
- [PETLIBRO fountains](https://petlibro.com/pages/fountain), [feeder and fountain product guides](https://uk.petlibro.com/pages/petlibro-user-manual-instruction), and [Litter-Robot 4](https://www.litter-robot.com/litter-robot-4.html): sealed hoppers, stainless bowls, removable filter trays and an open-front rotating-drum silhouette. Pet models are original designs rather than exact replicas.

## Sonos scope and measurements

Includes the current home-audio product forms listed by Sonos, plus architectural speakers and installed-audio components. Sets, color duplicates, spare cables and replacement parts are not separate catalog furniture. Components and surround speakers remain individually placeable. These models do not play audio or simulate system connectivity.

[Arc Ultra](https://www.sonos.com/en-us/shop/arc-ultra), [Beam Ultra](https://www.sonos.com/en-us/shop/beam-ultra), [Beam](https://www.sonos.com/en-us/shop/beam), [Ray](https://www.sonos.com/en-us/shop/ray), [Era 100](https://www.sonos.com/en-us/shop/era-100), [Era 100 SL](https://www.sonos.com/en-us/shop/era-100-sl), [Era 300](https://www.sonos.com/en-us/shop/era-300), [Five](https://www.sonos.com/en-us/shop/five), [Move 2](https://www.sonos.com/en-us/shop/move-2), [Roam 2](https://www.sonos.com/en-us/shop/roam-2), [Play](https://www.sonos.com/en-us/shop/sonos-play), [Sub 4](https://www.sonos.com/en-us/shop/sub-4), [Sub Mini](https://www.sonos.com/en-us/shop/sub-mini), [Amp](https://www.sonos.com/en-us/shop/amp), [Port](https://www.sonos.com/en-us/shop/port), [Ace](https://www.sonos.com/en-us/shop/sonos-ace), [Ace Ultra](https://www.sonos.com/en-us/shop/sonos-ace-ultra), [Era 100 Pro](https://www.sonos.com/en-us/shop/era-100-pro), [Amp Multi](https://www.sonos.com/en-us/shop/amp-multi), [in-wall](https://www.sonos.com/en-us/shop/wall-speaker-pair), [6- and 8-inch in-ceiling](https://www.sonos.com/en-us/shop/ceiling-speaker-pair), and [outdoor](https://www.sonos.com/en-us/shop/outdoor-speaker-pair).

Dimensions use the published single-unit envelope, converted to width/depth/height. Ceiling units use diameter for width and depth. Beam Ultra and Ace Ultra were listed for preorder at the September 6, 2026 reference check. Architectural models are layout aids and do not cut building cavities.

## Collectibles and art

Three original landscape anime illustrations share one full-quality atlas with separate UV regions. The atlas is retained under `assets-source/art/`. Brick-built vehicles and ships are original assemblies with studs, wheels, lamps, deck rails and rigging. Ellen, March 7th and Raiden are newly modeled stylized fan figurines, not extracted game assets; the catalog labels them as fan figurines. No official affiliation is implied.

## Reproduction and verification

`prepare_modern_catalog.py` builds the catalog manifest from the frozen pre-batch inventory and the explicit new model definitions. `build_quality_models.py` invokes the modern builders and fits the authored envelope to the catalog dimensions. `render_catalog.py` renders previews from the retained Blender files; preview compression is pixel-identical. Production packaging retains the existing shared-texture extraction and lossless mesh compression.

The modern-collection tests cover existing IDs/dimensions, authored additions, retirement compatibility, modern placement defaults, TV support and bounded fountain animation. All existing application and hosting checks remain release gates. Review sheets and size results are recorded with the batch assets after visual review.

## Category coverage

| Library type | Existing entries reviewed | Added |
| --- | ---: | ---: |
| Baby & kids | 4 | 8 |
| Beds | 11 | 6 |
| Cabinets & storage | 5 | 3 |
| Chairs & stools | 10 | 14 |
| Closet modules | 5 | 0 |
| Coffee tables | 6 | 5 |
| Collectibles | 4 | 9 |
| Counters & islands | 3 | 4 |
| Desks | 8 | 4 |
| Dressers & chests | 2 | 0 |
| Kitchen cabinets | 6 | 6 |
| Pet furniture | 3 | 6 |
| Plants & pets | 1 | 0 |
| Shelves & books | 1 | 0 |
| Side tables | 9 | 5 |
| Sofas | 12 | 6 |
| Speakers & audio | 5 | 23 |
| TV & media | 4 | 3 |
| Tables | 3 | 7 |
| Wall art & boards | 0 | 3 |

The precise support chooser includes the new open media/storage bays. The double sink supports independent worktop finishes without treating its recessed basins as an unobstructed decoration surface. Source recipes retain specialist legacy constructions where appropriate, including spindle/day beds, mecha and folding furniture, with the modern palette applied.

Port uses the horizontal 41 x 138 x 138 mm envelope from the [Sonos user guide](https://www.sonos.com/en-us/guides/port), correcting the shop page’s swapped height/depth labels. Beam, Ray and Move 2 use their currently published millimetre dimensions.

## Rendered review and asset budget

All 213 changed previews were inspected across the 14 retained contact sheets. Follow-up renders corrected detached chair feet, upholstered shell seams, sectional back alignment, canopy headboard proportions, the bassinet and book display, obscured sink basins, floating speaker grille marks and ship hull details. The final contact sheets are in `assets-source/reviews/batch12/`.

The largest changed model has 23,412 triangles. The 101 revisited raw GLBs total 16,207,888 bytes versus 50,619,276 bytes before this batch (34,411,388 bytes saved). The complete changed set, including 112 additions, totals 42,863,756 raw GLB bytes. These are source-export measurements before production shared-texture and lossless mesh compression, not per-session download costs. Models remain loaded on demand.
## Final local validation

After integrating the current master floor-plan/balcony work: type checking passed, 321 application tests passed, all 3 asset-integrity/compression tests passed, all 4 Sites-worker tests passed, and the production build and release archive verification passed. The combined catalog has 443 entries (442 browseable), with an expanded production build of 179,105,188 bytes. The client entry is 2,733,562 bytes (693,313 bytes gzipped). Deployment uses the successful master CI artifact, not this local packaging check.

The expanded library caches filtering/grouping, groups models in one pass, and avoids rerendering its cards for unrelated room edits. Stable callbacks still read the latest committed floor. The room-toolbar regression test scopes canvas actions to the canvas instead of scanning all catalog cards; its assertions and five-second limit remain intact.
