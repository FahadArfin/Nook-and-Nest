# Blender realism lab

Research and experiment date: 2 October 2026, America/New_York. The machine-readable measurement record uses UTC. This work is isolated on `codex/blender-realism-lab` and is **Beta 1 only**: do not merge it to master or publish it to production without a later explicit instruction. No production catalog entry, placement ID, model, or saved-project schema was changed.

**Beta-only review destination:** [Nook & Nest Beta 1 model lab](https://nook-and-nest-beta-1.fwad101.chatgpt.site/model-lab/index.html). Deployment status and exact source/archive evidence are recorded on the associated feature PR; this source document is not deployment evidence.

## Question and experimental design

Can reference-assisted Blender authoring improve furniture construction and material realism while preserving the existing dimensions, editable sources, material keys, and practical browser costs?

Two catalog pieces were selected: `slat-day-sofa` and `designed-coffee-storage`. Each has three isolated variants. The sofa separates the existing export, a same-geometry fabric control, and a newly authored reference-assisted model. The table separates the existing export, material-only changes, and added construction detail. The table did **not** use a generated image reference.

The sofa-authoring agent was dispatched with **`gpt-6-astra`, reasoning effort `high`**. The built-in image-generation tool produced the sofa reference sheet, but its resolved backend model was not exposed. This experiment therefore does not claim a verified GPT Image 2.5 Flare or Sunburst run. No image-to-mesh model was executed. This is a workflow study on two examples, not an Astra-versus-other-model benchmark, a blinded preference test, or proof of catalog-wide improvement.

## Primary-source research

| Source | Useful evidence | Boundary |
| --- | --- | --- |
| [OpenAI: Architectural visualization with Astra](https://developers.openai.com/blog/architectural-visualization-with-astra), September 4, 2026 | A direct Astra case study using editable Blender `bpy` geometry, render inspection, furniture construction details, and a later Unreal transfer. It includes untextured geometry inspection and source/export material review. | A documented visualization project, not a controlled furniture-accuracy benchmark. The described tools include background Blender scripts and computer use; it does not establish a special Astra-specific MCP advantage. |
| [OpenAI: Introducing ChatGPT Images 2.5](https://openai.com/index/introducing-chatgpt-images-2-5/) and [official image-prompting guide](https://developers.openai.com/api/docs/guides/image-prompting) | Reference-led editing, preserving subject identity and proportions, narrow revisions, and testing demanding image workflows before optimizing latency. | These support testing image assistance; they do not identify the backend used by this session's tool or guarantee consistent geometry across generated views. |
| [OpenAI: Image generation limitations](https://developers.openai.com/api/docs/guides/image-generation) | Documents remaining visual-consistency and precise-composition limitations. | Generated views guide design. Catalog measurements and mesh inspection establish dimensions. |
| [MCP for Blender creator repository](https://github.com/ahujasid/mcp-for-blender) | Demonstrates scene inspection, object/material control and Python execution through MCP. | A control interface, not evidence that adding MCP alone improves modeling quality. The installed Blender connection was retained. |
| [From Idea to Co-Creation: Planner–Actor–Critic framework](https://arxiv.org/html/2601.05016v1), January 2026 | A concrete decomposition, scene-inspection and screenshot-critique workflow; its appendix uses GPT-4.1. | Small-scale research, not Astra evidence. Authors report missed feedback, quality plateaus/degradation and overreliance on primitives. More iterations do not automatically improve a model. |
| [BlenderLLM creator repository](https://github.com/FreedomIntelligence/BlenderLLM) | Research into specialized Blender script generation and self-improvement with public artifacts. | A different trained model and evaluation setup; no transferable Astra accuracy score is claimed. |
| [Hunyuan3D creator repository](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) and [multi-view example](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/examples/shape_gen_multiview.py) | A genuine alternative image-to-mesh pipeline, separating shape generation from texturing and accepting named views. | Researched only. Its appearance metrics do not establish furniture dimensions, semantic editability or compatibility with this catalog. |
| [Babylon HDR environment guidance](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/materials/using/HDREnvironment.md) | Linear HDR cubemaps, diffuse harmonics and specular prefiltering for PBR inspection. | Renderer lighting and color management still differ from Blender Cycles. |

The resulting recommendation is an inference from this research and the local experiment: keep a measured, editable Blender model as the source of truth; use images to clarify construction and silhouette; validate the exported representation independently.

## Actual exported measurements

The following values are from [`results.json`](../public/experiments/realism-lab/results.json), recorded at `2026-10-03T03:13:57.734Z`, after removing authoring-only metadata from the experimental GLBs. It also records full GLB SHA-256 values, measured bounds, material keys, vertex-set hashes and hashes of actual triangle positions. Editable Blender sources retain their authoring data. Rerun the verifier after any regeneration; that file is authoritative for the current artifacts.

| Variant | W × D × H, mm | Triangles | GLB bytes | Primitives | Embedded images |
| --- | --- | ---: | ---: | ---: | ---: |
| `sofa-current` | 2000 × 850 × 780 | 6,188 | 3,604,928 | 4 | 6 |
| `sofa-material` | 2000 × 850 × 780 | 6,188 | 3,604,772 | 4 | 6 |
| `sofa-refined` | 2000 × 850 × 780 | 22,564 | 3,921,256 | 4 | 6 |
| `table-current` | 1000 × 550 × 400 | 1,244 | 72,116 | 4 | 0 |
| `table-material` | 1000 × 550 × 400 | 1,244 | 2,303,916 | 4 | 6 |
| `table-refined` | 1000 × 550 × 400 | 3,340 | 2,436,824 | 4 | 6 |

These are uncompressed experimental source GLBs, not final production download sizes or memory measurements. Four exported primitives do not imply four draw calls for a whole frame: shadows and other passes add work.

- Sofa refinement adds 16,376 triangles, approximately 3.65 times the baseline total, while GLB bytes increase about 8.8%. Its shared texture payload accounts for much of the file size.
- Table texture work adds 2,231,800 bytes without adding triangles. Construction refinement then adds 2,096 triangles and 132,908 bytes, about 5.8% beyond the material-only export. Here the maps dominate download growth.
- Sofa current/material exports have an **identical entire binary chunk**, not merely equal triangle counts. Both material controls retain their baseline vertex set, triangle count and actual triangle-position hash. These controls isolate material changes more meaningfully than comparing unrelated attractive renders.

The verifier reads binary position buffers and applies node transforms rather than trusting declared accessor bounds. It checks the envelope and origin within 0.15 mm, finite coordinates/normals, expected keys, embedded texture references, existing editable sources, fewer than 40,000 triangles, fewer than 8,000,000 bytes, and at most eight primitives per study asset. These checks do not prove all joints, UVs, collisions or visible details are correct.

## Findings and construction changes

**The export-material mismatch is the clearest actionable result.** The current sofa's exported `KHR_materials_sheen` contains white `[1, 1, 1]` sheen despite a low intended Blender sheen weight. The installed exporter uses the tint directly when weight is nonzero; its corresponding importer restores weight 1. This can produce a broad pale sheen over green upholstery. The integration review observed a chalk-white exported baseline where the authored source was green.

The `sofa-material` control removes that sheen extension while retaining the binary chunk, maps, geometry and other material properties. Its editable source uses Sheen Weight 0. This isolates the suspected cause; it is not a claim that all cloth should have zero sheen. The viewer does not silently clamp sheen for other variants. Read the [export audit](realism-lab-export-audit.md) for the inspected code path, the 35-sofa inventory, and its limits. Matching JSON values across 35 sofas are a risk signal, not 35 individually reproduced visual defects.

The refined sofa has individually editable oak frame parts, bearing ledges and seat slats, a raked rear support structure, three crowned seat cushions, a continuous shaped back, and small tone-on-tone welts. The reference is interpretive: measurements come from the catalog. A late contact correction places the cushion underside on the authored slat top instead of retaining a visible 6 mm gap; the correction was verified in the regenerated export and review views.

The table study adds measured oak/walnut maps and board-oriented grain before introducing construction detail. Its texture-free baseline is not automatically defective; the study asks whether that finish reads convincingly at the application's close inspection distance. Preserve deliberate flat finishes elsewhere rather than treating the catalog audit as authorization for a blanket replacement.

**A good source render is insufficient.** The review script reimports each GLB into Blender for front, rear, detail and clay views. The standalone page loads the same GLB in Babylon. The first browser lighting review exposed a flat, dark model against an overly bright ground, leading to a neutral studio IBL pass. The lab now has shared environment lighting and a matte floor, with the application's original day-light parameters available as a separate comparison. Cycles and Babylon renders are complementary evidence, not expected pixel-identical outputs.

## Sources, materials and review surface

- Editable models: [`assets-source/experiments/realism-lab/`](../assets-source/experiments/realism-lab/), containing all six `.blend` files; the refined sofa retains 64 authored parts at the recorded snapshot.
- Visual input: [`image-prompt.txt`](../assets-source/experiments/realism-lab/image-prompt.txt) and [`sofa-reference.png`](../assets-source/experiments/realism-lab/sofa-reference.png). The request calls for the same sofa in four views, but consistency is reviewed rather than assumed.
- Exports and machine-readable results: [`public/experiments/realism-lab/`](../public/experiments/realism-lab/). Review renders are in the editable-source `renders/` subdirectory.
- Existing licensed PBR material mapping: [`realism-materials.json`](../assets-source/realism-materials.json), with source provenance in [`realism-texture-provenance.json`](../assets-source/realism-texture-provenance.json). Full-quality mapped textures were retained.
- Neutral environment: [Studio Small 09](https://polyhaven.com/a/studio_small_09), Sergej Majboroda / Poly Haven, [CC0](https://polyhaven.com/license). The unchanged 1K HDR is 1,615,248 bytes; its provider MD5 was verified. The [local receipt](../public/experiments/realism-lab/studio-neutral.provenance.json) records SHA-256, source URL and runtime treatment.

Sofa keys remain `wood-honey-textured`, `upholstery-textured`, `tailored-tone-on-tone-stitch`, and `joinery-aged-brass`. Table keys remain `walnut`, `honey-oak`, `champagne-brass`, and `matte-rubber`.

The lab applies the catalog moss color `#405e42` equally to all sofa variants, converting sRGB to linear color and applying the existing 0.72 stitch factor. Recoloring changes factors while preserving texture maps. The table retains exported colors until the user selects a tint. Clay and wireframe views inspect the actual model, not image overlays.

Only the selected GLB loads. Variant changes dispose the previous container; decoding is serialized, pixel ratio is capped at 1.5, and rendering pauses when idle, hidden or offscreen. The environment is a shared, prefiltered 256-pixel cubemap and is disposed at teardown. The page reports actual loaded bounds, mesh parts, triangle count, download bytes, and fetch/decode time. The latter depends on device, network and cache and is explicitly not an FPS benchmark. No plan, local storage or account data is read or mutated.

## Reproduction

Use the task's isolated worktree and the connected Blender MCP session. Inspect the current scene before running a builder. Baselines are the frozen catalog snapshots in the experiment directories; do not refresh them midway through a comparison.

Execute builder calls through Blender's Python tool, with `repo` set to the isolated worktree:

```python
from pathlib import Path
import runpy

repo = Path(r"C:\Users\fahad\.codex\worktrees\blender-realism-lab\furnishing")
sofa = runpy.run_path(str(repo / "tools/blender/realism_lab_sofa.py"))
sofa["build"]()
control = runpy.run_path(str(repo / "tools/blender/realism_lab_material_control.py"))
control["build"]()
table = runpy.run_path(str(repo / "tools/blender/realism_lab_table.py"))
for variant in ("current", "material", "refined"):
    table["build"](variant)
```

Builders use experiment-owned scenes and separate source writes; they do not overwrite the production catalog. For exported visual review, load `tools/blender/realism_lab_review.py` through `runpy`, call `setup("sofa-refined")`, then call `render(view)` separately for `front`, `rear`, `detail`, and `clay`. Repeat for each variant, keeping the same review rig. Inspect outputs; a render command completing does not itself establish visual acceptance.

Review cleanup tracks runtime object identities instead of trusting copied ownership tags, preserves user-added or externally linked objects, and removes only orphan resources created by the helper. It leaves global GPU preferences unchanged. A live Blender sentinel check preserved both unrelated test objects, including copied ownership tags, after cleanup.

From the worktree, run:

```powershell
node scripts/verify-realism-lab.mjs
npx.cmd tsc --noEmit --pretty false
npx.cmd vite build --config vite.model-lab.config.mjs
```

The verifier refreshes `results.json`. The standalone build uses `publicDir:false`: it does not copy the whole catalog. Integrate `.generated/model-lab-build/model-lab/index.html` at `/model-lab/index.html`, its `assets/` at `/model-lab/assets/`, and the experimental public assets at `/experiments/realism-lab/`. Preserve the existing same-origin meshopt decoder at `/vendor/meshopt-decoder-1.2.0.js`.

For the separately opened Beta 1 Sites source checkout, [`scripts/build-realism-beta.mjs`](../scripts/build-realism-beta.mjs) builds the existing Beta app and adds this static lab route. It requires the exact Beta 1 project identity, the reviewed Beta source commit `9b81815930f248b6aa8d7a8ede3bdff124b9dbc5`, a feature-commit receipt, and the existing library manifest SHA-256 `f3dd9690ac96a112f0e48f4da695ab2507145102af7567d37b8555cc5f547a79`. The checkout's `HEAD` must still match that Beta snapshot; existing tracked changes are limited to the hosting metadata, and additions must match the lab overlay allowlist. It preserves the existing R2-backed library inventory, verifies that manifest again after building, and requires all six packaged GLBs to match their experimental inputs byte for byte. It deliberately avoids regenerating the inventory from this checkout's incomplete historical source assets. The production-project rejection guard was exercised before any build began. This is a Beta-source preservation mechanism, not a production catalog or storage migration.

## Validation status

- All six final exports passed binary-bound, origin, material-key, texture and mesh-budget checks. The material controls also passed triangle-position hash comparisons; the sofa control's binary chunk is unchanged.
- The final GLBs were reimported for 24 front, rear, detail and clay renders in approximately 38 seconds; all 24 final images were visually reviewed. That duration is a local batch-render observation, not a browser or model-performance benchmark.
- Local type checking, 26 Sites tests, three targeted material tests and the standalone lab build passed.
- The mobile canvas-resume fix was retested successfully at a 390-pixel browser viewport, the generated reference loaded at 1254 × 1254 pixels, and the inspected browser session reported no errors or warnings. This is not a physical-device performance test.

For each publication candidate, validate the assembled Beta artifact and its interactions, verify the live page and asset bytes after deployment, and record the exact source and archive evidence on the feature PR. No production release or master merge is part of this experiment.

## Recommended next pass and remaining limits

1. Resolve export/source material parity on representative fabric families before commissioning large geometry batches. Keep original, material-only and geometry variants separate.
2. Give the authoring agent measured dimensions, named construction requirements, canonical material keys, and a polygon/byte budget. Use reference images to resolve appearance, never to silently replace measurements.
3. Render from multiple sides with both materials and clay. Correct demonstrated contact, shape or shading issues incrementally; keep a prior version when a critique makes the result worse.
4. Reimport and inspect the exported GLB in Blender and Babylon, including color variants and close-up use. Retain full editable sources and provenance.
5. Only after visual approval, measure compression and texture-sharing opportunities on the exact deployment artifact and perform representative device checks. Preserve aquarium fidelity. Keep library-storage changes outside this modeling experiment.

The current work provides two measured studies and a review tool. It does not finish the broader model overhaul, certify manufacturing/structural accuracy, establish mobile performance, validate every catalog asset, prove all generated views agree, or authorize promotion to production. Local checks, final binary acceptance and the 24-image review have passed. Feature-branch release validation and live Beta 1 publication require their own evidence on the associated PR.
