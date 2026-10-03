# Catalog realism pipeline

This is the **902-item, Beta-only extension** on `codex/catalog-realism-overhaul`. It reads the existing editable catalog sources, applies bounded construction and material recipes, and writes separate candidates. The earlier [detailed sofa pipeline](detailed-model-pipeline.md) remains a historical pilot with its own specification, bakes and evidence; its successful review does not approve this catalog extension.

**Catalog completion, October 3, 2026:** all 902 models have current five-view approvals, editable packed Blender sources, and validated GLBs. The early piping-contact, timber-roughness and legacy texture-coordinate defects were corrected and their affected views re-reviewed. Beta 1 now serves the exact validated feature build `35ae301a91ad22f6a26ace7853f94853f0ad5927`; production and master remain unchanged. The release evidence below distinguishes model approval, browser compatibility, and hosted delivery verification. Future recipe changes still invalidate dependent candidates.

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
| `scripts/prepare-catalog-realism-assets.mjs` | Prepare compressed delivery models, shared full-quality images and exact approved front previews from the committed, fully reviewed catalog; writes a pending delivery manifest without granting approval. |
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

1. **Neutral surface detail.** `materials.py` assigns exact semantic keys to bounded profiles and generates lossless original normal/ORM detail where appropriate. Wood, fabric and canvas normals are reused byte-for-byte from the licensed texture library, with full-resolution roughness from the matching scan family packed into lossless ORM. A point transform calibrates its roughness range without resizing, rotating or introducing a periodic crosshatch; white AO and metal channels preserve those original multipliers. `material-plan.json` and `material-provenance.json` record map bytes, source inputs, derivation and license. Other generated maps are project-original work, not scans; repeats and strengths are authored calibrations unless provider-derived measurements are explicitly documented. This path does not replace base-color artwork.
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

Source-specific corrections live in `tools/blender/catalog_realism/refinements/<catalog-id>.py`, exposing `apply(root, scene, item, material_keys, object_names)`. An optional adjacent `<catalog-id>.json` contains `{"version":1,"dependencies":["shared_helper.py"]}` for bounded shared helpers. The queue and independent validator bind the entrypoint, dependency manifest and declared files; adding, removing or editing them invalidates only their consuming models. Global construction or material changes still require rebuilding the affected full pipeline. Refined geometry is checked against the same dimensions, material keys, protected channels and cost limits. A correction cannot inherit approval from its previous renders.

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
node scripts/prepare-catalog-realism-assets.mjs .generated/catalog-realism-assets/NAME FEATURE_COMMIT
node scripts/build-catalog-realism-beta.mjs path/to/reviewed-beta-plan.json
```

Each run requires a fresh `.generated/catalog-realism-beta/NAME` output directory. It writes the plan, library manifests, artifact inventory, archive and release receipt, rechecking inputs before completion. The archive must remain below 250 MiB both expanded and compressed; individual library objects are capped at 32 MiB. The large library uses the existing Beta R2 binding, not embedded duplicate site assets. Packaging performs no upload, Git mutation, source rebuild or production deployment. Any later Beta handoff must verify the exact artifact and live bytes separately; this guide records no deployment success and authorizes no master merge.

### Exact feature artifact and source handoff

The existing `Validate` job and master release retention keep their production behavior. A same-repository PR from `codex/catalog-realism-overhaul` additionally runs **Exact feature Beta artifact**, only after `Validate` succeeds. `Validate` tests GitHub's PR merge commit; the dependent job checks out the exact PR **head** SHA and builds with the derived `VITE_CATALOG_REALISM_VERSION`. Its `catalog-realism-feature-<head SHA>` artifact contains `app/`, `inventory.json`, `provenance.json`, and `sites-source.tar.gz`. The provenance records `validation.validated_sha` (PR merge SHA), `validation.source_sha` (feature HEAD), PR number, workflow run/attempt, compiled revision, source bindings, and the source archive hash. These two SHAs must not be substituted for each other. Verify the actual successful GitHub jobs/run and download that run's artifact; manually writing a success string is not CI evidence.

This app artifact may be produced while visual review continues. Delivery preparation and both Beta packaging modes still require all 902 current approvals and Khronos results. Commit all reviewed source/model/receipt changes before delivery preparation, then retain the exact feature SHA and a clean worktree. Packaging checks the selected branch, HEAD and clean state both before and after its work. Keep prepared manifests, extracted CI artifacts, deployment plans and evidence under ignored `.generated/` paths. Any subsequent source commit changes the derived cache revision and requires a new successful feature artifact and newly prepared delivery manifest.

After downloading the immutable feature artifact, both staging and final plans use:

```json
{
  "featureApp": {
    "root": ".generated/catalog-realism-ci/FEATURE_SHA/app",
    "inventory": {"path": ".generated/catalog-realism-ci/FEATURE_SHA/inventory.json", "sha256": "SHA256_OF_INVENTORY_FILE"},
    "provenance": {"path": ".generated/catalog-realism-ci/FEATURE_SHA/provenance.json", "sha256": "SHA256_OF_PROVENANCE_FILE"}
  },
  "featureSource": {"path": ".generated/catalog-realism-ci/FEATURE_SHA/sites-source.tar.gz", "sha256": "SOURCE_ARCHIVE_SHA256_FROM_CI_PROVENANCE"}
}
```

The Beta packager now emits `sites-source.tar.gz` and compatible `release.json.archives` entries alongside `sites-catalog-realism-beta.tar.gz`. The source archive retains exact feature source and external asset hashes, changes only the explicitly supplied `.openai/hosting.json` to the verified Beta binding, and adds `BETA_RELEASE_PROVENANCE.json`. That record binds the mode, feature SHA, deployment archive, inventories and library manifests. Staging and final snapshots therefore differ even when they use the same feature source.

Use the guarded helper to prepare a small forward hosting commit after verifying the current **Beta** hosting branch head. It writes Git objects and a new `codex/sites-beta-<mode>-<snapshot>` ref through a temporary index; it does not switch branches, change working files, push or deploy:

```powershell
python scripts/catalog-realism-source.py prepare .generated/catalog-realism-beta/STAGING --parent CURRENT_BETA_HOSTING_HEAD --output .generated/catalog-realism-beta/staging-source.json
# Root publishes the exact staging archive through the existing Beta project,
# waits for terminal success, uploads and verifies its prefixed candidate assets.
node scripts/catalog-realism-upload.mjs .generated/catalog-realism-beta/STAGING .generated/catalog-realism-beta/STAGING/library
# Bind STAGING/r2-verification.json in the final plan, then assemble FINAL.
node scripts/build-catalog-realism-beta.mjs .generated/catalog-realism-beta-plans/final.json
python scripts/catalog-realism-source.py prepare .generated/catalog-realism-beta/FINAL --parent VERIFIED_STAGING_HOSTING_HEAD --output .generated/catalog-realism-beta/final-source.json
```

The scoped uploader accepts only the staging release directory and its staged asset root; its destination is fixed to Beta 1. Supply `NOOK_LIBRARY_UPLOAD_TOKEN` and, for the existing private Beta access, `NOOK_SITES_AUTH_TOKEN` through the established environment secret handoff. It validates all local paths, hashes and the release-bound manifest before transfer, uses at most six concurrent transfers, resumes existing content-addressed objects with HEAD, and PUTs only hashes from the allowlist. Every staged alias must then return the exact expected bytes from R2. It rechecks the manifest, release, uploader source and all local assets before writing `r2-verification.json`; incomplete transfers produce no success receipt and can resume using the same command. A completed receipt is retained without overwriting it. Never place credentials in a plan, command argument, receipt or source archive. Keep the existing Beta access/bindings unchanged. Each source snapshot must use the freshly verified hosting parent, and the deployment must consume the matching exact archive. No master merge or production publish is part of this flow.

### Final canonical live verification

`library-manifest.json` deliberately retains the **staged upload** paths in both modes. It is suitable for staged R2 upload evidence, not final canonical verification. The packager also retains the original canonical `candidate-manifest.json`, `active-library-manifest.json`, and actual `worker-library-manifest.json`, all hash-bound in `release.json`.

After final Beta deployment reaches terminal success, use the read-only verifier with the prepared optimized candidate tree and the exact prior Beta library asset tree:

```powershell
node scripts/catalog-realism-live.mjs .generated/catalog-realism-beta/FINAL .generated/catalog-realism-assets/NAME/library EXACT_PRIOR_BETA_LIBRARY_ROOT .generated/catalog-realism-beta/final-live-verification.json
```

It verifies every final worker asset at its canonical URL, including shared GLB textures and preserved unrelated assets; all candidate `/api/previews/<id>.webp` aliases; every deployed client file against the artifact inventory; and the disabled upload endpoint. Library and non-HTML files must return exact byte counts/hashes, and library assets must report R2 delivery. For HTML, the verifier reads the exact hash-bound `dist/client` artifact file and permits only the captured 938-byte Cloudflare JSD script immediately before its original closing body tag, or exactly at EOF when the source omits that tag, as recorded for the unchanged Toronto attribution page. Only the script's constrained ray ID and encoded decimal timestamp may vary; every other response byte must equal the original artifact. The receipt records original/response/insertion hashes and the exact verifier source SHA256; a verifier source change before or during a run fails the check. Unknown transformations fail closed rather than being stripped or ignored.

If the existing Beta access setting requires owner authentication, supply `NOOK_SITES_AUTH_TOKEN` through the process environment using the established secret handoff. It is sent only in `OAI-Sites-Authorization` to the fixed Beta origin and is never written to evidence or logs; do not put it in arguments, plans or source files. Only bound artifact HTML may follow one same-origin canonical redirect: `index.html` to its directory, or a `.html` filename to its exact extensionless path. The verification query is retained; changed queries, fragments, credentials, other paths/origins and additional hops are rejected. Library asset requests do not opt into this behavior. The verifier rechecks local bindings before writing an immutable success receipt. This evidence complements terminal deployment status and actual browser checks for placement, recoloring, surfaces, motion and performance; it does not grant model approval.

## Catalog completion and repeatable checks

### Bounded catalog windows and individual corrections

For long runs, select a fixed slice of the frozen catalog and pass it with the
`ids=` keyword. A 72-item rendering window or a 140-item build window avoids
rehashing every earlier candidate on each bounded MCP call. Continue that window
until its `remaining` count is zero, inspect its `results` for errors, then move
to the next slice. A final whole-catalog status remains mandatory. Never pass the
ID list positionally: the preceding positional argument is `retry`.

```python
catalog = json.loads((repo / "assets-source/catalog-realism/catalog.json").read_text())
ids = [item["id"] for item in catalog["items"][216:288]]
queue["run"](str(repo), stage="render", seconds=35, limit=20, ids=ids)
```

Keep reviewed global helpers frozen. A visual rejection gets an exact per-ID
entrypoint and a separately bound dependency manifest, so repairing one piece
does not invalidate unrelated approved assets. Source checks must cover the
affected component names, geometry counts, metric bounds and canonical catalog
material keys. Numeric suffixes on Blender materials are not automatically the
catalog keys; use the frozen canonical mapping rather than assuming equivalence.

The compact-furniture corrections use measured original source geometry and
construction references from [Kohler's adjustable P-trap](https://www.kohler.com/en/products/bathroom-accessories/shop-bathroom-accessories/adjustable-p-trap-with-long-tubing-outlet-1-1-4-x-1-1-4-9018?skuId=9018-CP),
[Hunter Douglas drapery](https://www.hunterdouglas.com/stories/buyers-guides/drapery),
and [Bugaboo's canopy construction](https://www.bugaboo.com/us-en/accessories/sun-canopies/bugaboo-bee-breezy-sun-canopy-MI003072.html?pid=MI003072).
These inform swept bends, attached curtain headers and fabric over canopy ribs;
the candidates remain original catalog models, not exact branded replicas.
The pipeline checks closed manufactured shells, connected supports, restrained
cloth sag and practical mesh costs before rendering. Those checks do not replace
inspection of the exported GLB or establish plumbing, load or product safety.

The October 3 catalog pass completed all 902 current builds and five-view approvals. An independent whole-catalog readiness check confirmed 902 reviewed items, no orphan receipts and zero Khronos errors or warnings. The six scenery backdrops are outside this furniture catalog. Browse displays 901 pieces because its existing filter hides the legacy `nesting-tables` entry; that model is included in the reviewed 902.

Current authoring exports total 7,875,830 triangles, 4,277 primitives and 1,688,864,156 bytes before shared-image extraction and lossless delivery compression. These are catalog totals, not a requirement to load the entire catalog into a room. Every item retains its original identity, dimensions and material/placement contracts. Improvements vary by construction; protected artwork, screens, aquarium interiors and animation channels remain preserved. Approval is a visual/compatibility decision, not a claim that every object achieves a particular user rating.

Native Blender MCP checks inspected twelve representative packed editable sources and saved/reopened edited copies of a sofa and vessel sink while preserving the originals. Browser checks on an isolated local test project covered recoloring, independent material colors, rotation without camera reset, undo/redo, reload persistence, an exact 750 mm tabletop and 740 mm shelf placement, reversible placement cancellation, aquarium/globe motion and reduced motion. A 14-piece mixed room measured a 4.74 ms mean and 5.9 ms 95th-percentile frame interval over 120 frames on the test machine; this does not establish performance on other hardware. No browser console errors were observed. Local checks passed: 1,237 application tests, 248 catalog Python tests, type checking, asset tests, asset references, model readiness, hosting tests and the Beta-opt-in build.

These records establish authoring and local readiness. Publication additionally requires the clean exact feature commit, successful PR `Validate` and exact-feature artifact, explicit compressed-delivery review, Beta asset verification and terminal Sites deployment success. Those release results belong in their immutable release receipts; they must not be inferred from this authoring report.

Focused regression commands are:

```powershell
python -m unittest discover -s tests -p 'test_catalog_realism*.py'
node --test tests/catalog-realism-inventory.test.mjs tests/catalog-realism-validate.test.mjs tests/catalog-realism-review.test.mjs tests/catalog-realism-beta.test.mjs tests/catalog-realism-opt-in.test.mjs
```

Before a Beta handoff, also run the project type check, application tests, asset tests, production build and hosting tests specified in the [implementation plan](superpowers/plans/2026-10-03-catalog-realism-overhaul.md). Record current results and measured model/room costs; do not carry forward the historical sofa pilot's validation counts as evidence for this extension.
