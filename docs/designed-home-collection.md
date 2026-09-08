# Designed home collection — 37 original Blender models

This addition covers all nine requests: four media units, six culturally inspired rugs, five coffee tables, three slim top-freezer refrigerators, two farmhouse sink cabinets, four bathroom sinks, five sunroom pieces, three compact dressers with two separate mirrors, and three rubber entry mats. Existing placement IDs and dimensions are untouched.

## Research and interpretation

Reviewed 7 September 2026. These are original models informed by construction references, not manufacturer CAD or licensed replicas. Names describe their construction rather than claiming brand affiliation. Dimensions in `src/designedHomeExpansion.json` are the definitive model envelopes in millimetres; sink-cabinet and pedestal heights include their taps.

- [Article Torme collection](https://www.article.com/c/collection-torme): rounded timber carcasses, tambour fronts, distinct media/storage proportions. [Article Nera chest](https://www.article.com/product/33238/nera-3-drawer-chest-walnut) informed compact drawer construction. Our media units range from 1400–1800 mm wide; dressers from 600–1000 mm wide and 400–420 mm deep.
- [Article hosting collection](https://www.article.com/c/shop-hosting): travertine/wood tables and media furniture. The models use five distinct constructions: oval stone trestles, a fluted drum, a glass bridge, stone waterfall ends, and an oak storage table.
- [GE GPE12 top-freezer specification](https://products.geappliances.com/appliance/gea-pdf/GPE12FSKSB): 24 × 28.625 × 59.875 inches informed the 610 × 727 × 1521 mm compact steel model. [Liebherr official core-range brochure](https://home.liebherr.com/media/hau/brochures/household-appliances/en-le/pdf/core-range.pdf), a historical reference, lists the CT2931 top mount at 550 × 630 × 1571 mm. It informed the slimmer white model; it is not a claim of current product availability. The cream model has an original soft-corner 600 × 650 × 1700 mm envelope.
- [Kohler Whitehaven farmhouse sink](https://la.kohler.com/en/product-detail/6489?skuid=K-6489-0) and [Cairn sink dimensions](https://resources.kohler.com/webassets/kpna/brochures/KOHLER_CairnNeoroc_KitchenSinks.pdf): apron-front white ceramic construction, a genuine recessed bowl, waste fittings, and a fitted cabinet. Our single and fluted double bowls remain visibly open; countertop rails surround rather than cover them.
- [Duravit D-Neo](https://www.duravit.com/en-gb/products/all-series/d-neo/) and [Duravit washbowls](https://www.duravit.com/en-in/products/sink-area/sinks/countertop-sinks-and-wash-bowls/): compact handwash basins, thin-rim oval vessels and sculpted ceramic silhouettes. Four distinct models provide pedestal, compact wall mount, open brass console and independently placeable vessel options.
- [Sika Design indoor furniture](https://sika-design.com/collections/rattan-and-indoor-furniture/indoor) and [Charlottenborg lounge chair](https://sika-design.com/products/charlottenborg-lounge-chair): bent rattan frames, open woven panels and tailored upholstery. The user’s [Pinterest sunroom reference](https://www.pinterest.com/ideas/cozy-sunroom-furniture/895011094304/) could not be retrieved, so official construction references guided the requested cozy solarium direction.
- [Gorilla Grip entry mat](https://gorillagrip.com/products/entry-doormat) and [Traffic Guard mat](https://gorillagrip.com/products/commercial-doormat): low-profile rubber backing and raised scraper geometry. The original ribbed, diamond and lattice models are 7–8 mm thick, with landscape footprints.

## Original textile artwork

The four-pattern atlas and exact generation provenance are retained in `assets-source/textures/designed-rug-atlas-provenance.md`. Persian, Anatolian kilim, Amazigh and Chinese Art Deco references are stylistic inspirations, not authenticity or artisan-origin claims. No existing rug image was copied. Tatami-style rush ribs and sashiko-style running stitches are individually modeled. All rugs have physical backing and binding; patterned rugs also have knotted fringe.

## Sources, runtime and review

`tools/blender/build_designed_home_collection.py` reconstructs every model. Packed `assets-source/blender/designed-*.blend` files preserve named editable parts. Static exports join parts by material to bound runtime draw calls. `assets-source/designed-home-model-audit.json` records dimensions, triangles, editable part counts and GLB sizes. Original PNG renders remain editable review records; public WebP previews are pixel-identical lossless conversions. The release pipeline applies existing lossless geometry compression and shared texture extraction.

Media tops, dresser tops and coffee tables support independent tabletop placement; circular and oval tops use ellipse containment. Wall units and mirrors have explicit default heights. The vessel basin supports surface placement. Farmhouse worktop materials remain independent of their white ceramic bowls. All additions reuse reversible placement, per-material colors, saving, picking and undo.

## Validation results

All 37 previews were reviewed in three contact sheets, followed by eight corrected previews. Corrections removed coplanar table faces, aligned glass supports, added full-height farmhouse cabinet construction and connected console rails. Browser review confirmed the farmhouse basin, independent worktop selector and undo.

The full application suite passed 432 tests before the final geometry regression was added; the final targeted run passed 25 tests including downward-ray checks proving every exported basin center is below its rim. Type checking, production build, 3 asset tests, 10 hosting tests and 5 library asset tests passed. The collection totals 151,662 triangles, with a maximum of 11,734 per model. Public preview bytes fell from 5,939,784 PNG bytes to 2,713,760 lossless WebP bytes (54.3% smaller). Editable sources and original renders remain retained.
