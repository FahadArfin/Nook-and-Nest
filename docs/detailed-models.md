# Batch 8: botanical and furnishing detail

This pass replaces 25 existing models and adds six distinct clock/fireplace styles. The catalog has 274 entries. Existing dimensions and placement IDs remain unchanged. All 31 affected assets retain editable Blender files and refreshed rendered previews.

## Modeling

- Spruce and two holiday trees: tapered trunk, primary boughs, secondary shoots and tens of thousands of individually modeled needle faces. No stacked cone canopy. Holiday trees retain a woven basket, light cord, emissive bulbs, baubles and a five-point star.
- Birch, maple, cherry and willow: branching species-specific crowns, folded leaves, birch bark markings, cherry florets and hanging willow switches.
- Earlier and newer garden plants: modeled flower petals/stamens, lavender florets, fern pinnules, shrubs, pots, flower boxes and curved grass blades. The instanced grass asset remains below 200 triangles with two material groups.
- Clocks: arched/turned cases, Roman numerals, minute tracks, bezels, tapered hands and detailed pendulum/weight assemblies where applicable. Added longcase, regulator and chalet clocks.
- Fireplaces: cornices, fluted pilasters, individual firebricks and mortar, curved flames, round logs, grates and andirons. Added limestone arch, Victorian iron and ceramic-tile stove styles.

Higher-detail models have a bounded 120,000-triangle / 12 MB ceiling; unchanged models retain their previous budgets. Source components are grouped into a compact exported mesh with independent material slots. Asset URLs carry a revision query so cached GLBs/thumbnails cannot hide the replacement. Models are still loaded on demand.

## References checked September 5, 2026

References informed construction and botanical structure; no retailer assets, product photographs or meshes were copied.

- [Howard Miller mantel clocks](https://howardmiller.com/collections/all-mantel-clocks) and [Murray mantel clock](https://howardmiller.com/products/murray-mantel-clock-635150): layered cases and dial proportions.
- [Chesneys period fireplace construction](https://chesneys.com/about-us) and [Regency surrounds](https://chesneys.com/category/mantels/period-reproductions/regency): distinct stone, marble and cast-iron architectural families.
- [Portland spruce identification sheet](https://www.portland.gov/sites/default/files/2022/picea-cheatsheet-updated.pdf): conifer shoots and needle-bearing branch structure.

Validation includes render review, exact catalog bounds, GLB import coverage, asset budgets, cache-revision checks and the full app/hosting regression suite. Browser frame-rate performance has not been benchmarked for densely planted projects in this pass.
