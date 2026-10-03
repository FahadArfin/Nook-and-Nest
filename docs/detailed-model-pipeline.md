# Detailed Blender model pipeline

This workflow creates richer, editable furniture and a separately validated browser model. It is an experimental **Beta 1 only** pipeline on `codex/detailed-model-pipeline`; it does not replace production catalog models, change placement IDs or saved plans, or authorize a master merge. Keep library-storage changes outside this work. Publication evidence belongs on the feature PR, including the exact source and deployed artifact.

Only the **sofa recipe** is implemented. Its specification is [`sofa.spec.json`](../assets-source/model-pipeline/sofa.spec.json); see [the earlier study](blender-realism-lab.md) and [material-export audit](realism-lab-export-audit.md). Other families need authored recipe code and validation. Implemented stages are not evidence of successful bakes or visual acceptance.

## 1. Establish measurements and construction

Start each asset with its catalog ID, canonical material keys, real envelope, origin, orientation and licensed reference provenance. Record critical dimensions separately: seat height, rail thickness, opening size, support clearance and contact locations. A correct outer bounding box can still contain implausible construction. For this sofa, preserve **2000 × 850 × 780 mm**, the four existing material keys and its placement anchor.

Distinguish supplied measurements, calibrated photographic estimates and authored assumptions. Image measurements need scale and geometric constraints; retain their uncertainty. [Single View Metrology](https://www.robots.ox.ac.uk/~vgg/publications/2000/Criminisi00a/).

Generated front, side, rear and underside views can clarify appearance, but reconcile contradictions before modeling. They are not independent measurements. Reconstruction research reports inconsistent views, occluded-region artifacts and thin-shell difficulties, without establishing millimetre accuracy. [TripoSG](https://arxiv.org/html/2502.06608v1).

Decide detail in three passes:

1. **Primary:** recognizable silhouette, proportions, openings and mass distribution.
2. **Secondary:** actual assemblies—rails, panels, cushions, joints, supports, hems and hardware.
3. **Tertiary:** small wrinkles, grain, stitching impressions, pores and restrained wear.

Do not compensate for wrong proportions with surface noise. Keep silhouette, occlusion and functional gaps as geometry; bake detail only when it survives the intended views. Normal mapping cannot reproduce every off-axis geometric effect, as the [Khronos normal-tangent example](https://github.com/KhronosGroupArchives/glTF-Sample-Models/blob/main/2.0/NormalTangentTest/README.md) demonstrates.

## 2. Choose a material-family recipe

These are authoring priorities, not implemented automatic generators for every family.

| Family | Model first | Refine and bake | Reject during review |
| --- | --- | --- | --- |
| Soft goods | Connected upholstery, cushion crown, compressed bearing surfaces, seam placement and coherent back/arm transitions | Gentle tension folds, small welts where visible, fine physically scaled fabric normal and roughness | Floating cushions, ellipsoid blobs, coarse oversized weave, random creases, glossy plastic or a pale sheen masking the selected color |
| Wood | Board thickness, frame load paths, joints, edge rounding and end faces | Grain along each board, distinct end grain, restrained roughness variation and shallow tooling marks | Grain crossing unrelated boards, paper-thin rails, unsupported joints, dirt painted into every corner |
| Hard surfaces | Panel thickness, reveals, recesses, fastener seats and believable assembly gaps | Small edge breaks, brushed direction and subtle finish variation | Razor edges, decorative bolts without mounting logic, painted metal treated as exposed metal everywhere |
| Ceramic | True inner basin/cavity, wall thickness, rim, foot and drain where appropriate | Smooth curvature, subtle glaze variation and restrained microdetail | Solid-filled bowls, collapsed rims, wobble masquerading as handmade detail, excessive clearcoat |

Keep independent catalog tint keys. A material may be richly textured while still recoloring predictably; avoid baking the selected upholstery tint irreversibly into the texture. Avoid generic all-over wear unless references support it.

## 3. Keep master, target and bake data separate

Keep the dense editable master, named parts and maps separate from the browser target. Deliberately preserve curves, rear construction and underside contacts at close zoom; arbitrary decimation is insufficient.

The first recipe reads `assets-source/experiments/realism-lab/sofa-refined.blend` as its input and writes a separate `sofa-pipeline.blend`, `sofa-pipeline.glb`, build receipt and bake directory. Never overwrite the input or run unrelated collection builders. Current recipe limits are 80,000 target triangles, 12 MiB and eight primitives; these are project gates, not universal quality or performance thresholds.

Export groups the sofa into four meshes by canonical material. Cloth tangents use `BakeAtlas`; other groups use `UVMap`. Joining wood and cloth into one mesh would mix their normal-map bases. Export triangles preserve the bake mesh's exact loop triangles, corner normals and UVs instead of choosing new diagonals after baking.

Pair high and low parts to prevent cross-projection. This recipe temporarily translates matching pairs 5 m apart and restores them after baking. Blender supports controlled ray distances and cages; custom cages require target topology and face order. Targets need UVs and an active image node. [Blender baking manual](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html). Adobe's [matching by name](https://experienceleague.adobe.com/en/docs/substance-3d/bakers/features/matching-by-name) documents the isolation principle, not an equivalent Blender switch.

Record texture coverage in real units, grain/weave direction and intended texel density. Inspect a measured checker on broad faces and edges. Use non-overlapping UV space for unique baked detail and padding sufficient for the actual mip levels. Inspect seams at close and distant views; a clean full-resolution bake can still bleed when reduced. Keep lossless master maps. These practices follow the [Khronos real-time asset guidelines](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines/RealtimeAssetCreationGuidelines.md).

## 4. Bake portable materials

Bake normal, neutral base color, roughness and AO separately. Keep selected color as a material factor. Bake base color without direct or indirect illumination; never bake a room's floor shadow into a movable asset. AO should describe appropriate local cavities and contact, with special care around parts that might move.

For glTF, normal maps are tangent-space with +Y, connected through a Normal Map node. Normal, roughness, metallic and AO images are non-color data; base color uses sRGB. AO uses R, roughness G and metallic B when packed. AO modulates indirect light, not direct light. Check the actual texture bindings, channels, UV set and factors in the export. [Blender glTF documentation](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html), [glTF specification](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc).

Reimport the GLB, inspect its material JSON and compare it in Babylon: Blender graphs and sheen settings can differ after export. A swatch fixture with known roughness, normal strength and sheen is a useful regression experiment.

## 5. Run the implemented stages

Use the isolated worktree and connected Blender Python tool. Inspect the current scene first. The core API is in [`detail_pipeline/core.py`](../tools/blender/detail_pipeline/core.py); do not run it against another task's files.

```python
from pathlib import Path
import sys

repo = Path(r"C:\Users\fahad\.codex\worktrees\detailed-model-pipeline\furnishing")
sys.path.insert(0, str(repo / "tools" / "blender"))
from detail_pipeline import core

stage = core.prepare(str(repo / "assets-source/model-pipeline/sofa.spec.json"))
session_id = stage["sessionId"]
core.bake(session_id, "normal")
core.bake(session_id, "baseColor")
core.bake(session_id, "roughness")
core.bake(session_id, "ao")
receipt = core.finish(session_id)
```

`prepare` returns the session and scene names; `bake` returns a map receipt; `finish` writes the source, GLB and build receipt. `core.run(spec_path)` performs the sequence. The recipe uses four 2048 × 2048 passes, temporarily neutralizes fabric tint for the color bake, then restores it and applies the moss material factor.

Sessions advance **prepared → baked → finalized**. Each pass runs once; all four are required before `finish`. Finalized sessions reject further baking or repeated export. Bake/export failures invalidate the session; restart with `prepare` after correction.

`prepare` binds hashes of the specification, input `.blend`, builders and material inputs. Before each bake/export, those hashes and a fingerprint of live geometry, UVs, shape keys, modifiers, shaders and image pixels must still match. Save intended edits in the input/recipe and prepare again; do not change a running session or reuse old maps.

After finishing, use [`model_pipeline_review.py`](../tools/blender/model_pipeline_review.py) to reimport the actual GLB:

```python
import runpy
review = runpy.run_path(str(repo / "tools/blender/model_pipeline_review.py"))
review["setup"](str(repo / "assets-source/model-pipeline/sofa.spec.json"))
# Execute each render separately through the connected Blender tool.
review["render"]("front")
review["render"]("rear")
review["render"]("detail")
review["render"]("underside")
review["render"]("clay")
review["record"]()
```

`setup` binds the current export/specification/receipt and imported model. `render` rejects changed geometry, UVs or scene contents. `record` requires all five unchanged PNGs and attaches their hashes to the build receipt; it grants no visual approval.

From the worktree, use [`scripts/model-pipeline.mjs`](../scripts/model-pipeline.mjs):

```powershell
node scripts/model-pipeline.mjs inspect assets-source/model-pipeline/sofa.spec.json
node scripts/model-pipeline.mjs accept-review assets-source/model-pipeline/sofa.spec.json --notes assets-source/model-pipeline/sofa-review-notes.json
node scripts/model-pipeline.mjs ready assets-source/model-pipeline/sofa.spec.json
```

Create the notes file only after review: include `reviewer`, `decision: "approved"`, `views` with nonempty observations for `front`, `rear`, `underside`, `clay` and `detail`, plus a `limitations` string array. The build receipt must also contain all five rendered views. `accept-review` writes `sofa.review.json`, binding the specification, receipt and complete artifact set to hashes.

All three commands run Khronos format validation and reject errors; `formatValidation` records warnings and diagnostics. `inspect` can report review as `missing`, `stale` or `approved`; `ready` rejects missing, stale or failed review. Acceptance is a human/agent attestation, not automatic aesthetic judgment.

## 6. Review the exported candidate

Inspect front, rear, close detail, underside and clay views from the exported GLB, then the actual browser model. Check primary shape before material detail. Test canonical recolors, neutral studio and application lighting, close zoom, movement and visibility resume. Inspect individual normal, roughness and AO channels when diagnosing a mismatch; the [Khronos sample renderer](https://github.com/KhronosGroup/glTF-Sample-Renderer/blob/main/API.md) documents these diagnostic views.

Structural validation checks format and buffers, not beauty or construction. [glTF Validator](https://github.com/KhronosGroup/glTF-Validator) success is not a visual pass. A `.blend` signature/hash does not prove editability: inspect its master, parts and maps in Blender. Aggregate surface scores can also hide local defects; check contacts and thin parts explicitly. [Density-aware Chamfer Distance](https://arxiv.org/abs/2111.12702).

Record the exact reviewed artifacts, reviewer and observations. Changed geometry, maps or source must invalidate old acceptance. Keep failures actionable: identify the view, part and defect, correct that issue, regenerate, then review the new candidate. A ready asset is eligible for the scoped Beta experiment; it is not automatically catalog-approved or published. Actual measured costs, bake outcomes and acceptance evidence belong in generated receipts and the feature PR, not invented defaults in this manual.

## Sofa pilot evidence — October 3, 2026

The saved source was reopened in a separate Blender process: its master has 179 named parts, four shape-key objects and 12 editable curves. The measured master contains 270,156 triangles; the exported target contains 36,204 triangles across four meshes/primitives, at 2000 × 850 × 780 mm. Four real 2048-pixel Cycles passes produce neutral color, normal, roughness and AO maps; the browser uses packed ORM. The GLB is 11,159,704 bytes (10.64 MiB). Khronos validation reports zero errors and zero warnings; five informational unused-attribute notices remain.

All five GLB-reimported renders were inspected, followed by the actual Babylon viewer with moss, ochre and blue upholstery, both lighting modes, normals, clay, wireframe and underside controls. The fine stitches are subtle at room distance. This is one sofa recipe; distinct wood end-grain maps and low-end mobile room-scale benchmarking remain future work. See the hash-bound [build](../assets-source/model-pipeline/sofa-build.json) and [review](../assets-source/model-pipeline/sofa.review.json) receipts for exact evidence.

Negative Blender probes confirmed that changed specification bytes, live UV edits, finalized-session reuse and intervening review scenes stop the operation. Automated results: 1,158 application tests, seven pipeline tests, 26 hosting tests, TypeScript checking and the production build passed. These checks complement the visual review; they do not certify every possible material graph or every future recipe.
