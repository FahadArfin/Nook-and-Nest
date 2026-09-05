# Batch 9 — garden and patio detail

This pass revises all 16 existing outdoor botanical models and all 11 existing patio furniture / cooking models. Ten new original models bring the complete catalog to 284 pieces: a woven lounge chair, sling recliner, corner sofa, fire table, pizza oven cart, griddle cart, potting bench, fountain grass, blue fescue and coneflower drift. Paving modules and optional distant scenery retain their existing designs.

Botanical construction includes modeled midribs, root flares, barked branching, spruce cones, fuller shrub foliage, basal leaf rosettes, pollen centers and four-petal hydrangea florets. The automatic ground grass retains two materials and bounded thin instances; its individual tuft now has more curved blades. Patio construction includes timber braces and joinery pins, cushion piping, open rope weave, canopy ribs, burner controls, ash collection, true oven openings and supported furniture frames. All are original editable Blender sources, exported with unchanged existing IDs and millimetre dimensions.

## Planting brush

Open **Garden & surroundings → Plant in drifts**, choose a species, radius and spacing, then click **Paint plants**. Drag outside the apartment. Gold rings mark prospective positions. Release and choose **Confirm planting** or press Enter. Cancel the stroke without changing the plan, or press Escape to leave planting. Ctrl/Cmd+Z undoes the entire confirmed stroke. Each plant remains a separately selectable placement.

A stroke creates at most 64 plants and respects the 2,000-item saved-plan limit. Floors, water and existing furniture footprints are excluded. Repeated brush samples use a deterministic jittered lattice to avoid duplicate positions. Confirming a stale preview is rejected. Plant positions rest on sampled terrain, with the renderer's 50 mm floor offset accounted for. Large-area decorative grass remains available through the existing **Ground grass** setting.

## Reusable modeling prompt

> Give these models the same detailed, handcrafted Blender treatment as Nook & Nest's Batch 8 and Batch 9 models. Improve real-world proportions, construction, silhouettes and small details, not just textures or polygon counts. Use species-specific branching, modeled needles and veined leaves, shaped petals and convincing flower centers for plants. Use recognizable joinery, framing, tailored cushions, woven construction and accurate functional details for furniture. Preserve editable Blender sources, existing catalog IDs, millimetre dimensions, placement behavior, independent material colors and saved-project compatibility. Inspect rendered previews and refine weak models before delivery. Keep browser geometry and material budgets practical, run the checks, then publish the validated build and push matching source to GitHub. Work through the selected categories in named batches.

The remaining indoor catalog is a future modeling pass.

## Reference research

The new types were informed by [RHS ornamental grass selection](https://www.rhs.org.uk/plants/types/grasses/ornamental/selection), [RHS prairie planting in drifts](https://www.rhs.org.uk/garden-design/prairie-planting-creation-maintenance), [IKEA outdoor modular seating](https://www.ikea.com/gb/en/cat/modular-outdoor-sofas-21961/), and [Weber griddle construction](https://www.weber.com/US/en/webergriddles.html). No third-party models, textures or branded product replicas were imported.

## Verification

Blender background builds use `--python-exit-code 1`. All 37 changed/new pieces have reviewed rendered thumbnails, editable `.blend` sources and GLBs. Automated checks cover catalog dimensions, geometry budgets, Babylon imports, planting pointer previews, terrain placement, protected footprints, cancellation, stale rejection, undo/redo and save/share roundtrips. The existing production build, Sites worker tests and release artifact verifier remain release gates.
