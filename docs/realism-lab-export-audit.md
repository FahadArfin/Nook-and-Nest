# Realism lab: exported material audit

Audit date: 2 October 2026. Scope: the 35 IDs in `src/sofaRealismIds.json` and a JSON-only inventory of the 908 GLBs in `public/models/furniture/` on `codex/blender-realism-lab`. Experiment exports under `public/experiments/realism-lab/` are excluded. This is research for a future model and export-pipeline pass; it does not change production models, catalog data or a deployed site.

## Sofa sheen: verified exported values

All **35 of 35** listed sofas contain at least one material with `KHR_materials_sheen.sheenColorFactor` exactly `[1, 1, 1]`. There are **40 such material entries** in total. Each has `sheenRoughnessFactor` approximately `0.7` (`0.699999988079071` in the files), and none has a `sheenColorTexture`. All 35 GLBs have image entries; this finding is not evidence that their base-color, normal or roughness maps are absent.

| Existing sofa ID | Material keys with the white sheen factor |
|---|---|
| `sofa` | `upholstery-textured` |
| `loveseat` | `upholstery-textured` |
| `modular-sectional` | `upholstery-textured` |
| `sleeper-sofa` | `upholstery-textured`, `linen-textured` |
| `low-modular-sofa` | `upholstery-textured` |
| `corner-pit-sofa` | `upholstery-textured` |
| `everyday-sectional-track-left` | `soft-grey-chenille` |
| `everyday-sectional-track-right` | `soft-grey-chenille` |
| `midcentury-sofa` | `upholstery-textured` |
| `slat-day-sofa` | `upholstery-textured` |
| `library-reading-loveseat` | `linen` |
| `everyday-sectional-soft-left` | `linen` |
| `everyday-sectional-soft-right` | `linen` |
| `designed-sunroom-loveseat` | `natural-linen`, `sage-upholstery` |
| `designed-sunroom-chaise` | `natural-linen` |
| `left-chaise-sectional` | `upholstery-textured` |
| `right-chaise-sectional` | `upholstery-textured` |
| `u-sectional` | `upholstery-textured` |
| `track-sofa` | `upholstery-textured` |
| `modular-play-sofa` | `upholstery-textured` |
| `upholstered-pet-sofa` | `upholstery-textured` |
| `everyday-sectional-tailored-left` | `bluecloth` |
| `everyday-sectional-tailored-right` | `bluecloth` |
| `chair-sleeper` | `household-slate-fabric`, `entry-slate-upholstery`, `entry-sage-upholstery` |
| `chair-sleeper-open` | `entry-slate-upholstery`, `entry-sage-upholstery` |
| `boneless-loveseat` | `upholstery-textured` |
| `boneless-chaise` | `upholstery-textured` |
| `chester-sofa` | `upholstery-textured` |
| `curve-sofa` | `upholstery-textured` |
| `channel-sofa` | `upholstery-textured` |
| `metal-frame-sofa` | `upholstery-textured` |
| `library-reading-chaise` | `bluecloth` |
| `patio-loveseat` | `upholstery-textured` |
| `patio-chaise` | `upholstery-textured` |
| `patio-corner-sofa` | `upholstery-textured` |

## Source and exporter comparison

The authored material path in `tools/blender/enrich_sofas.py:190–192` sets Principled BSDF **Sheen Weight to 0.04 for ordinary fabric or 0.13 for velvet**, then sets Sheen Roughness to 0.7. That function does not assign Sheen Tint; it retains the source material's value.

The installed Blender 5.2 exporter was inspected at:

`C:/Program Files/Blender Foundation/Blender 5.2/5.2/scripts/addons_core/io_scene_gltf2/blender/exp/material/extensions/sheen.py`

Its `export_sheen` function reads Sheen Weight, skips the extension when the unlinked weight equals zero, and otherwise reads the unlinked Sheen Tint RGB directly into `sheenColorFactor`. That path does **not multiply the tint by a nonzero Sheen Weight**. The installed importer at `blender/imp/pbrMetallicRoughness.py:425–441` sets Sheen Weight to 1 and imports the extension color into Sheen Tint. The observed `[1, 1, 1]` values therefore do not encode the author's intended 0.04/0.13 weight in that RGB factor.

This is a concrete source/export material-parity risk. During the integrating lab session, `slat-day-sofa` was reported to appear chalk-white when reviewing the exported asset despite its green authored Blender baseline. This document independently verifies that asset's white sheen factor and the corresponding exporter path; it does not independently repeat that visual experiment or claim a completed browser review of the other 34 sofas. A white sheen factor is a valid material setting in isolation. Lighting, view angle, shader implementation and material overrides affect its visible result, so the 35 matching files must not be described as 35 individually confirmed rendering bugs.

The previous four-view acceptance in `docs/sofa-realism-audit.md` concerns rendered editable sources. Its browser acceptance is explicitly scoped to one representative sofa. Source-render approval, presence of texture maps and preserved material keys do not by themselves establish visual parity of every exported GLB.

## Whole-catalog image inventory

The inventory reads only each GLB's header and first JSON chunk. The initial scan parsed all 908 files without an error; a repeated warm scan took about **0.18 seconds**. The cold first scan took about 3.35 seconds. These are local audit timings, not a rendering or download benchmark.

| JSON-level inventory | Models inspected | Models with no `images` entries |
|---|---:|---:|
| All furniture-directory GLBs | 908 | 699 |
| At least one wood or fabric material-name match | 486 | 309 |
| At least one wood material-name match | 387 | 250 |
| At least one fabric material-name match | 191 | 103 |
| Sofa realism IDs | 35 | 0 |

Wood substrings: `wood`, `walnut`, `oak`, `maple`, `rattan`, `cane`, `timber`, `teak`. Fabric substrings: `upholster`, `fabric`, `linen`, `cloth`, `chenille`, `canvas`. Matching is case-insensitive. Models can match both families, so the rows are not additive. The inventory counts model files, not unique materials or reviewed catalog categories.

These are prioritization counts, not defect counts. A retained `wood-honey-textured` key can now describe a flat modern lacquer surface; `maple` can identify foliage; small or deliberately untextured pieces can be correct. Material names alone do not establish intended surface type. Conversely, a model with one image may still have untextured wood or fabric on other materials. The scan does not inspect pixel content, decode texture payloads, assess UV quality, validate procedural source nodes or render all models. Images supplied later by application code also fall outside this GLB-only inventory.

The lab's representative `designed-coffee-storage` is a concrete candidate: its 1,244-triangle original GLB has no images and uses `walnut`, `matte-rubber`, `honey-oak` and `champagne-brass`. Its reviewed catalog preview has flat timber color. The separate lab variants isolate unchanged geometry plus measured timber maps from subsequent construction refinement; no catalog-wide material rewrite follows from this count.

## Proposed checks before a future overhaul

1. Record the authoring material's intended sheen weight/tint, roughness, transmission, metallic factor and texture bindings, then compare them with the actual exported JSON. Use explicit expected values per material family; do not globally reject white sheen or texture-free materials.
2. For representative linen and velvet pieces, compare the editable source, a fresh GLB round-trip import, and the actual Babylon rendering with fixed camera, lighting and exposure. Verify recoloring retains fabric detail and does not recolor timber. Approve an export-safe sheen representation only after these comparisons; do not patch every asset solely from the JSON count.
3. Keep material-only and geometry variants separate. Hash actual positions/topology to prove the material-only trial leaves geometry unchanged. Measure the exported vertex buffers and node transforms for the advertised envelope, origin and ground contact rather than trusting metadata or accessor bounds alone.
4. Inspect named construction parts at front, rear, underside and close range. Confirm board grain direction, end-face treatment, texture scale, subtle roughness/normal response, cushion seams and mechanically plausible joints. Preserve original IDs, material keys and independent saved color controls.
5. Generate catalog previews from the approved exported representation, or add an explicit source-versus-export parity gate when previews continue to render source Blender scenes. A visually good source thumbnail must not substitute for inspection of the shipped representation.
6. Inventory material roles before selecting the next batch. Review the 309 name-matched, image-free candidates by category and actual intended finish; skip deliberate flat lacquer, metal, foliage and other false positives. Preserve existing full-quality maps and editable sources, and measure final triangles, texture dimensions and download bytes.

No source models were rebuilt for this audit, no production asset was patched, and no Git or hosting mutation was performed by the audit step.
