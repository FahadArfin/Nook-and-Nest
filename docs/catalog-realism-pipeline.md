# Catalog realism pipeline

This is the **902-item, Beta-only extension** on `codex/catalog-realism-overhaul`. It reads the existing editable catalog sources, applies bounded construction and material recipes, and writes separate candidates. The earlier [detailed sofa pipeline](detailed-model-pipeline.md) remains a historical pilot with its own specification, bakes and evidence; its successful review does not approve this catalog extension.

**Checkpoint, October 3, 2026:** the first discovery pass had produced about 235 receipts, with roughly 667 items still awaiting a first-pass receipt. These are progress counts, not current approvals: helper changes can invalidate earlier receipts. Generation, validation and visual review of all 902 models remain unfinished. Use the live status command below instead of treating this checkpoint as a completion claim.

## Files and responsibilities

| Component | Responsibility |
| --- | --- |
| `scripts/catalog-realism.mjs`, `scripts/lib/catalog-realism-inventory.mjs` | Freeze the actual bundled runtime catalog, including entries hidden from normal browsing, and report pending/processed/reviewed/stale/failed state. |
| `assets-source/catalog-realism/catalog.json` | All 902 IDs and baseline contracts: source, GLB and preview hashes; dimensions; material keys; root and protected glTF metadata; candidate paths. |
| `assets-source/catalog-realism/baseline-inputs/` | Immutable source snapshots underlying the original catalog contract, separate from later application changes. |
| `source.py` | Import one original `.blend` into an owned scene, expose original object/material names, and clean up only identified owned data. |
| `geometry.py`, `forms.py`, `books.py`, `lighting.py`, `special.py` | Select bounded construction refinements from the actual authored parts and measured bounds. |
| `materials.py`, `scans.py` | Build explicit material plans, generate original neutral microstructure, and select coherent licensed scan channels. |
| `build.py`, `glb.py`, `tangents.py` | Save editable sources, export evaluated meshes, reconcile exact material/protected-node contracts, repair export defects, and write hash-bound receipts. |
| `review.py`, `queue.py` | Render actual exported candidates and resume bounded build/render batches through connected Blender MCP. Neither grants approval. |
| `scripts/lib/catalog-realism-validate.mjs`, `scripts/catalog-realism-review.mjs` | Check semantic compatibility and costs, run Khronos validation, and record explicit per-view decisions. |
| `scripts/catalog-realism-contact.py` | Produce contact sheets with source hashes for inspection; uncertain details require the full-size views. |
| `scripts/build-catalog-realism-beta.mjs` | Assemble an offline, provenance-checked package for the existing Beta 1 project after the entire catalog passes review. |

The Python modules above live in [`tools/blender/catalog_realism/`](../tools/blender/catalog_realism/). Original files in `assets-source/blender/` and the production model library remain the baseline. Outputs are:

- Editable candidates: `assets-source/catalog-realism/candidates/{id}.blend`.
- Authoring GLBs: `public/experiments/catalog-realism/models/{id}.glb`.
- Receipts and actionable failures: `assets-source/catalog-realism/receipts/{id}.json` and `failures/{id}.json`.
- Five-view evidence: `assets-source/catalog-realism/renders/{id}/`.
- Queue failure state: `.generated/catalog-realism-queue.json`.

## Preserved contracts

The frozen catalog binds placement IDs, nominal dimensions, origin/orientation, material keys, support definitions and saved-data behavior. Export validation compares the baseline and candidate world-space bounds, allowing at most 1 mm drift per bound coordinate, and requires unchanged root transforms and metadata. Family recipes also check the measured parts they modify; matching an outer box alone does not establish correct seat heights, joints, openings or support contacts. Those remain inspection and browser checks.

Material reconciliation retains canonical keys and independent recoloring. Artwork, displays, labels, transparency, emission and protected material channels cannot be replaced by a generic material-family guess. The narrowly declared scan replacement and surface-adjustment records are validated exceptions, not permission to rewrite arbitrary material graphs. Unclassified roles fail closed.

Authored animation channels, skins, moving/shared-node hierarchy, pivots and metadata are compared with the baseline. Protected subtrees are restored from the original GLB. Aquarium originals—including fish, plants, textures and motion—remain unchanged; only declared opaque exterior casework additions are allowed, inside the original envelope and outside the protected tank interior, with a separate small geometry budget.

`source.py` assigns an ownership token to its imported scene and registered export scenes. It records exact dependency identities before export joins can orphan meshes. Cleanup snapshots scene membership once, preserves work if an owned object is linked into another scene or prior user data enters an owned scene, and reclaims only owned orphan dependencies. No global scene reset or orphan purge is part of the pipeline. Tokens are excluded from saved/exported candidates.

## Construction and materials

Recipes refine recognizable source constructions; they are not a universal furniture generator. Current implementations include:

- Fitted seat/back/pillow covers, restrained bedding folds, and conformed seams/welts; selected hard-part edge refinement, shelf supports and mounting blocks in `geometry.py`.
- Editable turned ceramic forms and individually curved, veined houseplant leaves in `forms.py`.
- Separate covers, bound spines and recessed paper for the exact `bookshelf`, `books-upright` and `books-stacked` source recipes in `books.py`.
- A hollow 1.5 mm linen shade and internal support construction for the original table lamp in `lighting.py`.
- Explicit picture-frame profiles, selected sofa/armchair supports, closet/table details and protected aquarium casework in `special.py`.

Recipes retain named editable parts and modifiers where applicable. Unsupported topology or an unsubstantiated change must be investigated rather than counted as an improvement. A new receipt or a surface map alone does not prove that every part of an item meets the intended visual standard.

There are two distinct material paths:

1. **Original neutral microstructure.** `materials.py` assigns exact semantic keys to bounded profiles and generates lossless original normal/ORM detail where appropriate. Some normal maps are reused byte-for-byte from the existing licensed texture library. `material-plan.json` and `material-provenance.json` record the role, map bytes, source and license. Generated maps are project-original work, not scans; repeats and strengths are authored calibrations unless provider-derived measurements are explicitly documented. This path does not replace base-color artwork.
2. **Matched licensed scans.** `scans.py` binds the existing CC0 provenance in `realism-materials.json`, `realism-scans.json` and `realism-texture-provenance.json`. Selected ordinary wood/fabric keys receive a coherent base-color, normal and ORM set of the declared family, physical repeat, direction and strength. It preserves base RGBA and roughness/metallic factors and excludes protected optical, artwork, emission and motion materials. The scan plan is a specific exception for those recorded replacements; its existing full-quality source images remain hash-bound.

`RealismUV` expresses part-local metres with object scale included. Longitudinal wood/bark/metal direction follows the part's measured long axis; repeat dimensions control texture scale instead of stretching every image once over each object. Existing UV0 and other layers remain available to original artwork and normal maps. Export copies preserve evaluated triangle corners, UV layers and custom normals. Only collapsed `RealismUV` triangle charts are projected again from their own geometric plane; healthy charts and UV0 remain untouched. Receipts identify export-only repairs and their affected parts/triangles. Tangent checks use the actual normal-map UV basis.

## Freeze, build and resume

Run Node/Python commands from the feature worktree. These commands prepare or inspect local data; authoring/rendering commands execute **inside the connected Blender MCP Python tool**, not an unattended second Blender process.

```powershell
node scripts/catalog-realism.mjs inventory
node scripts/catalog-realism.mjs status --json
```

`inventory` refuses to overwrite a frozen baseline that differs from the current contracts. Material plans are prepared with the following commands when intentionally changing the recipe inputs; do not regenerate them during an active batch:

```powershell
python tools/blender/catalog_realism/materials.py --plan --library
python tools/blender/catalog_realism/scans.py --write
```

Through Blender MCP, inspect the current scene and then submit one bounded call at a time:

```python
from pathlib import Path
import runpy

repo = Path(r"C:\Users\fahad\.codex\worktrees\catalog-realism-overhaul\furnishing")
queue = runpy.run_path(str(repo / "tools/blender/catalog_realism/queue.py"))
result = queue["run"](str(repo), stage="build", seconds=35, limit=10)
print(result)
```

Reload `queue.py` for each call. `stage` accepts `build` or `render`; `seconds` is 1–45 and `limit` is 1–20. The time budget is checked between items: one heavy model or its five renders can exceed it. Do not wrap calls in an unbounded background loop. Inspect returned failures and current Blender state before resuming after an interruption.

For targeted work, pass `ids=["table-lamp"]`; use `retry=True` only when deliberately retrying an unchanged failed input. The queue skips matching current candidates, remembers failed dependency signatures, and retries failures when their bound inputs change. A run-local hash cache rechecks file identity, size and timestamps; independent build/render hash checks remain uncached. `remaining` is scoped to that invocation's selected work and skipped failures, not a reviewed-model total.

Every build checks the loaded `build.py` source hash before starting, so an edit between batch items cannot give old executable code a new recipe hash. Helpers, plans, baseline files and used maps are bound as inputs and rechecked before output replacement. A receipt commits the candidate source/GLB pair; incomplete files without a matching receipt do not resume as processed work. Editing a shared helper invalidates its dependent candidates, even if they were built successfully earlier. Preserve Git attributes: frozen snapshots retain exact bytes, while execution inputs use explicit LF endings so Windows and Linux checkouts agree.

Build and render inputs are separate. A stale authoring dependency requires rebuilding. Changed render/color configuration can require rerendering an otherwise current build. No automatic resume operation creates a visual approval.

## Validate and inspect all five views

After building an item, record its independent format check:

```powershell
node scripts/catalog-realism-review.mjs record-format table-lamp
```

This also checks candidate compatibility and costs. Budgets are baseline-relative and capped for triangles, primitives, GLB bytes, texture bytes and pixels; requested per-item budgets can only tighten those limits. Semantic comparison rejects unchanged exports, and Khronos errors stop acceptance. Warnings and measured costs remain review evidence. These gates do not establish beauty, source editability or acceptable performance in a furnished room.

Use the MCP queue for five-view rendering:

```python
queue = runpy.run_path(str(repo / "tools/blender/catalog_realism/queue.py"))
print(queue["run"](str(repo), stage="render", seconds=35, limit=1,
                   ids=["table-lamp"]))
```

The queue calls `review.render_model` at 640 × 480 and 24 samples. For a closer diagnostic, call `render_model` directly with an explicit larger resolution/sample count. It imports the actual exported GLB into an owned review scene, mirrors the catalog color rules (including bedding trim), and produces `front`, `rear`, `detail`, `underside` and `clay` views. Current output is lossless WebP. Receipt evidence binds the GLB/source, input hashes, render configuration, application color inputs and each image. Rerendering clears prior approval.

```powershell
node scripts/catalog-realism-review.mjs inspect table-lamp --json
python scripts/catalog-realism-contact.py table-lamp --name table-lamp-review
```

Inspect every view of every changed item. The front/rear views establish silhouette and assembly; detail exposes UV scale, seams and surface defects; underside checks contact/support construction; clay separates geometry from material effects. Contact sheets are an index, not a replacement for opening ambiguous full-resolution images. Inspect representative saved `.blend` files for actual editability and test the Babylon candidates with recolors, application lighting, close zoom, placement/support surfaces and motion/reduced motion.

Record decisions only after that inspection:

```powershell
node scripts/catalog-realism-review.mjs record path/to/explicit-decisions.json
node scripts/catalog-realism.mjs status --json
```

The decision file is `{ "version": 1, "decisions": [...] }`. Each entry needs `catalogId`, `reviewer`, `decision` (`approved` or `changes-requested`), the current `artifactSetSha256` from `inspect`, and exactly five `views`. Each view holds its current image `sha256` and a distinct, concrete `note` of 12–2000 characters. Record observed limitations in the relevant notes. The command rechecks images, contracts, Khronos validation and unchanged receipt bytes before committing. Generated stock notes or inferred approval from a completed render are not review evidence.

## Beta-only packaging

The application overlay is opt-in through a 64-character revision in `VITE_CATALOG_REALISM_VERSION`. For a publishable Beta build, obtain it from `catalogCacheRevision(catalog.catalogSha256, featureCommit)` in the packager: SHA-256 of the catalog hash, a newline, and the exact feature commit. This changes cache URLs when model refinements retain the same catalog contracts. Development routes use `/experiments/catalog-realism/`; the Beta build uses canonical model/preview routes with `?catalog_realism=<derived revision>`. Backdrops remain outside this catalog overlay. The default application keeps its existing routing when the opt-in is absent. Final app provenance binds `src/catalogRealism.ts`, `src/catalogRealismBeds.json`, `src/modelAssetPath.ts` and `src/scene/FurnitureModelLibrary.ts` so the compiled cache/color behavior matches the reviewed sources.

The Vite build excludes only `public/experiments/catalog-realism/` from its public-file copy. Development still serves the candidates directly. All other public assets remain available; the reviewed compressed catalog is assembled separately into the Beta library.

[`build-catalog-realism-beta.mjs`](../scripts/build-catalog-realism-beta.mjs) is an offline assembler. Its header documents the release-plan schema. Both `staging` and `final` require **all 902 current, explicitly approved items**, current Khronos evidence, a reviewed optimized asset manifest, and verified active Beta library assets. There is no partial/pilot/skip-review release mode.

1. Produce and inspect optimized candidates using the existing shared-texture and geometry-compression pipeline. The packager reproduces their bytes from the approved authoring GLBs. Each preview must be the exact approved full-resolution lossless front WebP, not its old catalog thumbnail.
2. Supply immutable prebuilt app inventories and provenance, including exact source commits and successful `Validate` evidence, the existing Beta hosting/library handler inputs, and the reviewed asset-set hashes.
3. Run a `staging` plan to preserve the existing Beta app while mapping candidates under `/experiments/catalog-realism/<feature commit>/...`. The result includes a feature-prefixed library upload tree and manifests.
4. A `final` plan additionally requires verified candidate R2 bytes and the feature app's compiled catalog revision/cache overlay. It maps the approved assets to canonical library routes, preserves the existing model-lab route, and disables library-upload endpoints in the final worker.

```powershell
node scripts/build-catalog-realism-beta.mjs path/to/reviewed-beta-plan.json
```

Each run requires a fresh `.generated/catalog-realism-beta/NAME` output directory. It writes the plan, library manifests, artifact inventory, archive and release receipt, rechecking inputs before completion. The archive must remain below 250 MiB both expanded and compressed; individual library objects are capped at 32 MiB. The large library uses the existing Beta R2 binding, not embedded duplicate site assets. Packaging performs no upload, Git mutation, source rebuild or production deployment. Any later Beta handoff must verify the exact artifact and live bytes separately; this guide records no deployment success and authorizes no master merge.

## Remaining work and checks

The discovery pass still needs to identify and fix unsupported source variants, finish the full catalog build, regenerate candidates invalidated by recipe changes, and run current semantic/Khronos checks. All required five-view inspections, explicit decisions and browser interaction/performance checks must be complete before catalog readiness. Representative native checks and passing unit tests cover the infrastructure; they do not supply per-model acceptance or a numeric quality score for all 902 items.

Focused regression commands are:

```powershell
python -m unittest discover -s tests -p 'test_catalog_realism*.py'
node --test tests/catalog-realism-inventory.test.mjs tests/catalog-realism-validate.test.mjs tests/catalog-realism-review.test.mjs tests/catalog-realism-beta.test.mjs tests/catalog-realism-opt-in.test.mjs
```

Before a Beta handoff, also run the project type check, application tests, asset tests, production build and hosting tests specified in the [implementation plan](superpowers/plans/2026-10-03-catalog-realism-overhaul.md). Record current results and measured model/room costs; do not carry forward the historical sofa pilot's validation counts as evidence for this extension.
