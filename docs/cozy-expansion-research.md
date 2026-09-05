# Batch 6 and 7 research and implementation

Research checked September 5, 2026. These are references for furniture types and construction, not sources of meshes or licensed product replicas.

- [IKEA product families](https://www.ikea.com/us/en/cat/products-products/): compact seating, pantry shelves, children's furniture and pet products informed distinct practical categories.
- [West Elm room accessories](https://www.westelm.com/shop/accessories-pillows/room-decor-accessories/): ceramic bowls, candleholders, trays and small decorative objects informed the tabletop collection.
- [Kohler Veil collection](https://www.kohler.com/en/products/kohler-collections/veil-bathroom-collection): vessel basins and open glass showers informed original fixture construction.
- [Heat & Glo linear fireplaces](https://www.heatnglo.com/fireplaces/linear): wide recessed fireboxes informed the linear console alongside cottage mantel and stove silhouettes.
- [Balsam Hill pre-lit trees](https://www.balsamhill.com/c/pre-lit-artificial-christmas-trees): dense branch tiers, ornaments and distributed warm lights informed the holiday pieces.

52 original additions are defined in `src/cozyExpansion.json`. Each has an editable Blender source, GLB, rendered thumbnail and independent material slots. Existing catalog IDs and saved schema remain intact. Pantry shelves have measured usable support planes. TVs now have an explicit fitting-top chooser, including the original easel TV.

Two original anime illustrations were generated with the built-in image-generation tool and embedded into editable framed models. Source images: `assets-source/textures/anime-sky-original.png` and `anime-moon-original.png`. Prompt briefs: (1) expressive sky courier in red jacket overlooking a floating town in pastel clouds, original hand-painted anime world; (2) botanical traveler and fantastical fox beside a moonlit garden pond, original indigo/lavender anime world. Neither uses franchise artwork. The full prompt text is in the task's image-generation calls.

Terrain is a bounded decorative height field, not hydraulic simulation. Hill and hollow strokes deform the outside ground; river strokes cut a channel with animated ripples. Floors are protected, grass follows terrain and avoids water, and new outdoor placements sample the same height field. Existing furniture does not automatically relocate when terrain beneath it changes: reposition it to resnap. Plain ground and grass-off remain the defaults.

Performance work: retain floor/wall meshes on furniture movement/selection/material edits; reuse unchanged furniture nodes and controller materials; batch GLB readiness refreshes and defer them during active drags. Grass remains instanced. Terrain uses one bounded ground mesh and one water mesh. No claim is made that all possible optimization work is exhausted.
