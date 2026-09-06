# Detailed appliance collection

This pass refines the 39 existing kitchen/countertop appliances inventoried in `tools/blender/appliance_inventory.json`, including the kitchen-filed laundry machines, without changing their catalog records. Fourteen independent countertop appliances are added in `src/applianceExpansion.json`.

## Research and construction references

Reviewed September 6, 2026. These are original Nook & Nest models informed by product construction, not manufacturer CAD or exact product replicas. Dimensions are the catalog's nominal placement envelopes.

- [Serious Eats countertop appliance guide](https://www.seriouseats.com/favorite-countertop-appliances) informed category coverage.
- [Smeg small appliances](https://www.smeg.com/small-appliances) informed coordinated enamel housings and softened silhouettes.
- [KitchenAid Design Series](https://www.kitchenaid.com/countertop-appliances/stand-mixers/design-series) informed mixer proportions, attachment hubs and contrasting finishes.
- [Breville Oracle Jet](https://www.breville.com/en-us/product/bes985) informed espresso controls, steam hardware and drip-tray construction. The Atelier is an original professional dual-boiler-style design, not an Oracle Jet replica.
- [Jura Z10](https://us.jura.com/en/homeproducts/machines/z10-aluminium-black-nab-15702) informed automatic coffee-machine detailing.
- [Fellow Stagg EKG](https://fellowproducts.com/products/stagg-ekg-electric-pour-over-kettle) informed the fine-pour spout, open handle and temperature-control base.
- [Vitamix Ascent X5](https://www.vitamix.com/us/en_us/products/ascent-x5) informed jug, lid, handle and motor-base construction.
- [Breville Joule oven](https://www.breville.com/en-ca/product/bov950) informed layered door construction, racks and control-column organization.
- [Breville Paradice manual](https://assets.breville.com/BFP838/BFP838_USCM_IB_A23_FA_Online.pdf) informed nested processor pushers, bowl locking and blade detail.
- [Breville Smart Scoop manual](https://www.breville.com/content/dam/breville/ca/en/assets/miscellaneous/instruction-manual/ice-cream/BCI600-instruction-manual.pdf) informed the compressor enclosure, churn lid and mixing paddle.
- [Aarke Carbonator Pro](https://aarke.us/products/carbonator-pro-matte-black) informed the metal tower, bottle platform and nozzle arrangement.

## Authored detail and compatibility

Added machined control grips, dial graduations, modeled displays, gaskets, louvers, service hardware, hollow bowls, vessel markings, feed chutes, whisk wires, grates and cast waffle grids as appropriate. Original material IDs and their saved-color defaults are retained. New finishes remain independently editable. No existing placement IDs, dimensions or mount types change.

Every source retains individually named editable components in `assets-source/blender`. `tools/blender/appliance_detail.py` rebuilds the existing refinements from the fixed pre-pass Git revision to avoid accumulating duplicate detail on reruns; a full Git history is needed for that rebuild. New models build directly from their definitions. GLB export joins components by material for browser use. Previews are rendered from those sources with `render_catalog.py`, then losslessly compressed to WebP.

All 53 previews were inspected, followed by corrections to the grinder silhouette, pouring spout, hidden controls, burner placement and waffle grids. The 53 source GLBs total approximately 26.5 MB; the most complex is the 36-inch gas range at 40,148 triangles. Production applies the existing lossless mesh codec to all 53 appliances, including those below the usual 1 MB threshold. This saves an additional 5.9 MB and leaves the collection at 13.8 MB; decoded geometry and material metadata are tested byte-for-byte, including Babylon imports. Shared texture extraction is unchanged. No texture-resolution reductions were introduced.

Regression coverage checks all 39 existing catalog and material contracts, all 53 exact bounds and ground origins, asset budgets, Babylon GLB loading, and independent countertop placement/save round trips for all 14 additions. Source GLBs are limited to 60,000 triangles and 8 MB in this collection.
