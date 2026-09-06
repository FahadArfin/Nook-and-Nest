# Luxury balcony collection · September 2026

Seven original 1200 mm wide, 1100 mm tall railing modules extend Outdoor → Balcony railings and the wall replacement chooser. The three original rails retain their IDs, dimensions, material keys and binary assets. New pieces use the existing independent placement, draft confirmation, rotation, per-material colors, saves and undo system. They are visual planning models, not engineered guardrail specifications.

## Research and interpretation

- [Q-railing installer systems](https://q-railing.com/en-us/installer/) and [Easy Glass Prime base channel](https://shop.bus.q-railing.com/base-channel-easy-glass-prime-top-mount-mod-8410-a-168410?variants=168410-025-00-18): use a real base shoe, separate glazing, gaskets and end covers for Crystal.
- [Feeney designer collection](https://feeneyinc.com/designer/) and [DesignRail options](https://literature.feeneyinc.com/view/385706860/53/): distinct metal infills, warm wood rail options and assembled posts inform Atelier, Riviera and Horizon. Horizon includes individual cables and swaged terminals.
- [British Spirals & Castings balconies](https://www.britishsc.co.uk/balconies-railings/juliet-balconies/): traditional wrought/cast iron construction informs Bellecour's original scrolls, binding collars and rosettes. Eclipse uses an original repeated bronze fan motif.
- [Haddonstone balustrades](https://www.haddonstone.com/en-us/balustrading-and-parapet-screening/balustrades/): separate turned balusters, piers, plinth and molded coping inform Palazzo.

These are construction references only. No manufacturer CAD, meshes, photographs or branded designs are redistributed. All seven models are authored with the repository's Blender primitives and original geometry. The warm wood texture is the existing original handpainted honey oak asset.

## Reproduction and performance

Run Blender in background with `tools/blender/luxury_balcony.py`. Optional IDs follow `--`. Render those IDs with `tools/blender/render_catalog.py`. Editable named component meshes remain in `assets-source/blender/`; exported copies join static geometry by material. Constant-section curves avoid botanical taper artifacts in cables and metal scrolls. Existing lossless build compression preserves geometry and full texture quality; PNG source renders produce pixel-identical WebP previews.

`tests/luxury-balcony.test.ts` checks exact exported envelopes and floor alignment, geometry/draw budgets, asset and material completeness, original compatibility, library filtering, measured wall replacement, independent saved colors, undo/redo and actual Babylon loading. Final renders are reviewed individually and as a contact sheet before release.

## Reviewed asset budgets

| Model | Triangles | Material draws | Source GLB bytes | Lossless preview bytes |
| --- | ---: | ---: | ---: | ---: |
| balcony-rail-crystal | 3356 | 3 | 111816 | 96540 |
| balcony-rail-bronze | 11456 | 2 | 366292 | 74532 |
| balcony-rail-teak | 13392 | 4 | 719444 | 118192 |
| balcony-rail-cable | 6440 | 4 | 515752 | 75892 |
| balcony-rail-deco | 9712 | 3 | 306432 | 75460 |
| balcony-rail-scroll | 16700 | 3 | 494224 | 73602 |
| balcony-rail-limestone | 5888 | 1 | 151028 | 89142 |
