# Floor-plan construction and furnishing refinement

## Interaction changes

Imports show a spinner, indeterminate activity bar, real elapsed time, and cancellation. They distinguish opening the file from analyzing its rooms. Conversion keeps an explicit confirm action and displays warnings or blocking problems without a mandatory checkbox or the former explanatory text block.

New projects start with near walls hidden. Existing explicit visibility and legacy transparency remain compatible. The right inspector offers searchable Floor and Walls finish cards, material-family filters, selected-section painting, and a separate explicit whole-floor action. Painting a section uses distinct Babylon materials per finish; the previous renderer reused one material and replaced every tile's texture.

Walls & balcony rails supports a drawn removal span or measured start/length on a selected continuous wall. A removed span can stay open or receive independent glass, concrete or hybrid railing modules. Only intersecting wall geometry is removed; the floor footprint remains intact. Cuts, openings, Studio metadata, undo and JSON saves are synchronized. Drawing a wall across a cut restores that span.

Door and window drafts expose their width before confirmation. Narrow closet doors can fit a 650 mm host wall. Tall solarium glazing permits a 25 mm sill and small ceiling clearance.

## Furnishing approach and limits

Room categories choose roles from the existing library. Bedrooms receive a bed, nightstand and dresser; living spaces receive seating, media furniture and a television, plus a coffee table; kitchens receive a refrigerator, sink and range before additional cabinetry and appliances. Bathrooms and laundry receive their respective fixtures. Named sunrooms use a rocking chair and breakfast furniture. Existing matching essentials are preserved.

For each room, up to eight bounded placement/order alternatives are evaluated. The most complete valid arrangement is retained. Candidate footprints must remain inside the room's actual union of rectangles and the floor. Wall intersections, other furniture, door clearance and service-front clearance are checked. A sofa candidate must leave space for a facing media bench; the TV rests on its bench. These are deterministic furniture-layout heuristics, not an interior-design optimizer. Irregular or small rooms may still omit pieces; the preview lists those omissions and remains editable. Automatic furnishing neither redraws rooms nor adds door openings.

## Research informing the changes

- [RoomSketcher: painting and decorating walls](https://help.roomsketcher.com/hc/en-us/articles/360000344649-How-Can-I-Paint-and-Decorate-Walls): select the target surface and browse/search material choices. This informed separate target, scope and finish controls.
- [IKEA: kitchen workflow](https://www.ikea.com.tw/en/rooms/kitchen/how-to/kitchen-layout-ideas-for-the-best-workflow): organize storage, preparation and cooking roles. This informed essential-first kitchen selection and usable front space.
- [IKEA kitchen planning guide](https://www.ikea.com/th/th/files/pdf/fb/fa/fbfabb30/th22-your_new_ikea_kitchen.pdf): appliance placement and working-space relationships informed clearance checks.
- [Andersen: floor-to-ceiling windows](https://www.andersenwindows.com/ideas-and-inspiration/blog/tips/floor-to-ceiling-windows) and [sunroom windows](https://www.andersenwindows.com/ideas-and-inspiration/blog/tips/how-to-pick-out-windows-for-a-sunroom): tall glazing and slim framing informed the original solarium model.
- [CRL glass railing systems](https://www.crlaurence.com/productsubcategory/E01_HR): base shoes, cap rails and glazing informed the three original railing variants.
- [Sunroom design project](https://www.houzz.com/magazine/texas-sunroom-gets-a-modern-cottage-makeover-stsetivw-vs~104588766): seating and breakfast use informed the sunroom furniture selection.

## Validation

- 312 application tests passed, including new exact-63-tile material isolation, narrow closet aperture, floor-to-ceiling glazing, room-specific furnishing, wall-cut/railing undo, and Studio/JSON round-trip tests.
- Browser checks exercised dragging and confirming exactly 63 floor tiles, measured two-metre glass railing replacement, import activity/cancellation and compact conversion review. No page errors were recorded.
- The supplied apartment's cached analysis was used for local furnishing trials without an additional paid scan. The refined layout included a sofa facing its television and kitchen/bath/laundry essentials. Space-constrained omissions were retained as warnings.
- Thirteen original editable Blender models and lossless WebP previews were generated and visually reviewed. Every catalog model retained its physical envelope; existing IDs and models were preserved.
- Production build, hosting tests, shared-asset/compression tests and release integrity verification passed.
