# Sectional realism pilot

This Beta-only experiment rebuilds `everyday-sectional-track-left` as a second
model through the detailed pipeline. The original GLB remains byte-identical
under `sofa-sectional-current.glb`; the new study is separate from the catalog.
Neither model has a user quality rating yet.

## Research and design

The fixed catalog envelope is 2800 × 2200 × 930 mm. Material keys remain
`soft-grey-chenille`, `seam`, and `walnut`. The original broad L footprint is
retained. This is an original measured adaptation, not a product replica.

- [Ashley Abinger](https://www.ashleyfurniture.com/p/abinger_2-piece_sectional_with_chaise/APK-83905-R2.html)
  informs padded track arms, separate foam/fiber seat cushions, attached backs,
  platform support and low tapered feet. Its manufacturer dimensions are larger
  than the catalog envelope; they are construction references, not our output dimensions.
- [Ashley manufacturer sheet](https://www.ashleydirect.com/Graphics/CatalogSheets/83904-66-17(SD).pdf)
  describes a two-piece construction, hardwood/engineered frame and fiber-wrapped foam.
- [Article Timber](https://www.article.com/product/22563/timber-93-left-sectional-rain-cloud-gray)
  provides a secondary reference for plump loose cushions and seat/back proportions.
- [IKEA KIVIK](https://www.ikea.com/us/en/p/kivik-sofa-with-chaise-tibbleby-beige-gray-s79440586/)
  distinguishes the firmer seat support from softer fiber-filled backs. The study
  uses a platform, not a claim to reproduce KIVIK's pocket-spring suspension.

Reference product photography is not included as a texture. No generated image
was needed for this study. An image can guide design, but it cannot establish
dimensions or prove that the unseen side is plausible.

## Pipeline used

1. **Freeze compatibility and a fair baseline.** Copy the current export unchanged;
   fix dimensions, floor-centered origin and existing material identifiers.
2. **Construct in Blender.** Build the two upholstered modules, shaped seat and
   back cushions, tailored edges, track arms, frame and feet as separate editable
   parts. A denser master keeps shaping controls; the browser mesh carries the
   visible cushion crown, compression and seams as actual geometry.
3. **Separate shape from surface.** Use native tiled color, normal and packed
   roughness/AO/metal maps. Do not flatten all the fine fabric into one whole-sofa
   texture atlas. Set UVs in metres, with mapping nodes supplying the repeat.
4. **Export what the browser can reproduce.** Join only like-material parts;
   retain tangents, UVs, material keys and actual PBR images. Save both editable
   Blender scenes. Bake affine transforms into copied export vertices.
5. **Review the export.** Reimport the actual GLB and render front, detail, rear,
   underside and clay. Compare the live Babylon model under equal lighting,
   camera envelope and upholstery tint. Revise anything visibly wrong.
6. **Validate and publish to Beta.** Check binary geometry dimensions, file and
   mesh budgets, texture bytes, source hashes and Khronos glTF validity. Review
   is an explicit attestation bound to the exact outputs. Pass targeted tests,
   build, hosting tests and the PR's Validate check before Beta publication.

## Materials and honest limits

[ambientCG Fabric030](https://ambientcg.com/a/Fabric030) is CC0 and described by
its provider as an **approximation**, not a photographic scan. It is used as a
woven textile with an artist-calibrated 0.28 m repeat. The existing saved material
key says chenille; it does not establish the fiber composition of this texture.
[Poly Haven Walnut Veneer 02](https://polyhaven.com/a/walnut_veneer_02) is CC0,
with a provider-documented one-metre tile. Color and ORM derivatives are retained
under new `sectional-*` names, with originals and hashes preserved.

The baseline has `KHR_materials_sheen.sheenColorFactor = [1,1,1]`, which visibly
washes out the nominal grey tint. The new material omits that white sheen and
uses high, spatially varied roughness. Both comparison variants receive the same
blue-grey color factor; original material behavior is otherwise preserved.

This is a static furnishing model, not a soft-body simulation. Yarn fibers are
surface maps, not individual geometry. The browser result and user rating decide
whether the experiment improves realism; more triangles or passing tests alone
cannot establish an 8/10 result.

## Reproduce

From the official Blender bridge, run `build(root)` from
`tools/blender/sectional_realism_export.py`. Then use
`tools/blender/model_pipeline_review.py` with
`assets-source/model-pipeline/sofa-sectional-rebuilt.spec.json` to set up,
render all five views, and record their hashes. Inspect the actual images before
accepting the review through `scripts/model-pipeline.mjs`.

The feature branch and draft PR stay unmerged. Beta publishing overlays only the
model lab onto the opened Beta source, retaining its application and R2 inventory.
