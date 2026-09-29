# Complete sofa material and tailoring audit

Research date: 29 September 2026. Scope: all 35 current sofa, sectional, loveseat and chaise models, including the two convertible single-chair sleeper states. Ordinary chairs and beds are excluded. IDs, catalogue millimetres, placement behaviour and existing material colour keys remain unchanged.

## Why the current sofas read as sterile

All 35 existing front previews were reviewed together, then compared with their GLB contents and editable construction scripts. Before this pass, thirty-two GLBs had no embedded texture image at all. The three existing patio models had a wood image, but no complete separate textile colour/normal/roughness treatment. Names such as `upholstery-textured` therefore do not demonstrate an exported textile. Existing geometry already contains useful separate cushion panels, legs, rails, welts and selected tuft/channel details; those parts are retained.

The modern source builders also applied the upholstery palette to wooden frames. This produces the near-white Studio frame and sage Juniper frame seen in the old previews. The pass restores naturally coloured wood defaults with measurable grain orientation while keeping the saved material keys and explicit colour overrides.

## Research and decisions

- [ashley-altari](https://www.ashleyfurniture.com/p/altari_sofa/8721338-Master.html): Track arms, plump attached backs and separate seats, chenille-feel polyester, dark exposed feet. Interpret the differentiated cushions and fine marled textile without copying the branded design.
- [article-sven](https://www.article.com/c/collection-sven): Midcentury tufting and piping, solid wood feet and corner-blocked construction. Use leg grain, authentic seam sizes and tensioned upholstery.
- [westelm-haven](https://www.westelm.com/products/4676147/): Low deep profile and hand-finished upholstery with chenille, velvet and canvas options. Vary fibre response without applying a coarse uniform weave.
- [crate-lounge](https://www.crateandbarrel.com/lounge-deep-83-sofa/s493543): Slim track arms, deep low seats and substantial separate seat/back cushions over a hardwood frame. Preserve crisp panel boundaries and soft matte fabric.
- [ikea-kivik](https://www.ikea.com/us/en/p/kivik-sofa-cover-tibbleby-beige-gray-70526914/): Tibbleby is a discreet herringbone polyester with slight lustre and removable covers. Fine twill direction and tone-on-tone tailoring suit everyday modular sectionals.
- [kvadrat-hallingdal](https://www.kvadrat.dk/en/products/upholstery/1000-hallingdal-65): Wool/viscose yarn dyed before spinning provides layered colour and textile depth. Reproduce the general fine yarn/melange principle with original or licensed maps, not photographed proprietary swatches.
- [sunbrella-outdoor](https://www.sunbrella.com/sunbrella-fabric-difference): Solution-dyed outdoor fabrics retain color through the fibre. Outdoor cushions should read as taut woven canvas, with bound edges and restrained normal variation.
- [roomboard-wood](https://www.roomandboard.com/blog/2024/05/our-approach-to-wood-sourcing/): Oak, ash, maple and walnut are used as solid wood and quality veneer. Grain belongs along rails/legs; different pieces need shifted grain phases and fine pores.

Retail photography is studied for construction and material response, not copied into the app. The shared realism texture manifest now records CC0 materials from Poly Haven and ambientCG: fine linen, chenille, twill, corduroy, velvet and outdoor canvas, plus separate oak, walnut and teak wood scans. Source files and generated neutral fabric/PBR derivatives have SHA-verified provenance in `assets-source/realism-texture-provenance.json`. These are original planning models inspired by construction principles, not claims of branded replicas.

## Complete per-ID redo checklist

Each entry receives the listed textile, metre-scaled UVs, separate roughness and fine normal response, and surface-conforming 4 mm stitch dashes where an actual cushion panel supports them. Wood grain follows each individual rail/leg, with shifted grain origin between boards. Metal remains metal. Existing welts, tuft buttons, cane/open frames and left/right arrangements are retained.

| Existing ID | Dimensions, W × D × H mm | Existing construction retained | Textile pass | Acceptance |
|---|---|---|---|---|
| `sofa` | 2100 × 900 × 850 | Deep and softly rounded | chenille | Front/rear/underside/close-up + binary export accepted; browser pending |
| `loveseat` | 1450 × 850 × 820 | A snug two-seater | chenille | Front/rear/underside/close-up + binary export accepted; browser pending |
| `modular-sectional` | 2850 × 1900 × 820 | A flexible L-shaped modular sofa | chenille | Front/rear/underside/close-up + binary export accepted; browser pending |
| `sleeper-sofa` | 1980 × 920 × 840 | A compact sofa with a pull-out bed | chenille | Front/rear/underside/close-up + binary export accepted; browser pending |
| `low-modular-sofa` | 2800 × 1050 × 720 | Original detailed cloudline modular sofa with modeled construction and independently editable finishes | chenille | Front/rear/underside/close-up + binary export accepted; browser pending |
| `corner-pit-sofa` | 3000 × 2100 × 760 | Original detailed cinema pit sectional with modeled construction and independently editable finishes | chenille | Front/rear/underside/close-up + binary export accepted; browser pending |
| `everyday-sectional-track-left` | 2800 × 2200 × 930 | Ashley-inspired everyday construction; chaise on the left when viewed from the front. Original planning model. | chenille | Front/rear/underside/close-up + binary export accepted; browser pending |
| `everyday-sectional-track-right` | 2800 × 2200 × 930 | Ashley-inspired everyday construction; chaise on the right when viewed from the front. Original planning model. | chenille | Front/rear/underside/close-up + binary export accepted; browser pending |
| `midcentury-sofa` | 2050 × 860 × 830 | Tailored cushions and splayed wood legs | linen | Front/rear/underside/close-up + binary export accepted; browser pending |
| `slat-day-sofa` | 2000 × 850 × 780 | Exposed slatted sides and three matte cushions | linen | Front/rear/underside/close-up + binary export accepted; browser pending |
| `library-reading-loveseat` | 1450 × 860 × 850 | Compact two-seat reading couch with walnut frame, tailored cushions and layered joinery | linen | Front/rear/underside/close-up + binary export accepted; browser pending |
| `everyday-sectional-soft-left` | 2900 × 2250 × 960 | Ashley-inspired everyday construction; chaise on the left when viewed from the front. Original planning model. | linen | Front/rear/underside/close-up + binary export accepted; browser pending |
| `everyday-sectional-soft-right` | 2900 × 2250 × 960 | Ashley-inspired everyday construction; chaise on the right when viewed from the front. Original planning model. | linen | Front/rear/underside/close-up + binary export accepted; browser pending |
| `designed-sunroom-loveseat` | 1420 × 780 × 820 | Bent cane frame, individually woven strands, bound joints and tailored cushion construction | linen | Front/rear/underside/close-up + binary export accepted; browser pending |
| `designed-sunroom-chaise` | 800 × 1700 × 800 | Bent cane frame, individually woven strands, bound joints and tailored cushion construction | linen | Front/rear/underside/close-up + binary export accepted; browser pending |
| `left-chaise-sectional` | 2850 × 1850 × 850 | Tailored three-seat sofa with a long left chaise and connected upholstered arms | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `right-chaise-sectional` | 2850 × 1850 × 850 | Mirrored right-chaise layout with broad cushions and low wood feet | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `u-sectional` | 3600 × 2200 × 850 | Generous U-shaped conversation sofa with two deep chaise ends | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `boneless-loveseat` | 1900 × 1050 × 780 | Low foam-style sofa with a folded cushioned shell and subtle channel seams | fine corduroy | Front/rear/underside/close-up + binary export accepted; browser pending |
| `boneless-chaise` | 1150 × 1750 × 780 | Deep foam-style lounge with a sloped back, quilted seat and no visible legs | fine corduroy | Front/rear/underside/close-up + binary export accepted; browser pending |
| `track-sofa` | 2300 × 950 × 820 | Original detailed linear track-arm sofa with modeled construction and independently editable finishes | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `modular-play-sofa` | 1500 × 750 × 580 | Original detailed modular foam play sofa with modeled construction and independently editable finishes | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `upholstered-pet-sofa` | 900 × 650 × 350 | Original detailed tailored pet sofa with modeled construction and independently editable finishes | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `everyday-sectional-tailored-left` | 2650 × 1750 × 900 | Ashley-inspired everyday construction; chaise on the left when viewed from the front. Original planning model. | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `everyday-sectional-tailored-right` | 2650 × 1750 × 900 | Ashley-inspired everyday construction; chaise on the right when viewed from the front. Original planning model. | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `chair-sleeper` | 1060 × 900 × 820 | Closed fixed pose with low arms, layered folding mattress and front pull webbing | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `chair-sleeper-open` | 1060 × 2150 × 820 | Single-bed fixed pose with three mattress sections, telescoping guides and support legs | twill | Front/rear/underside/close-up + binary export accepted; browser pending |
| `chester-sofa` | 2200 × 940 × 850 | Rolled arms, button tufting and turned feet | velvet | Front/rear/underside/close-up + binary export accepted; browser pending |
| `curve-sofa` | 2600 × 1100 × 800 | Original detailed arc curved sofa with modeled construction and independently editable finishes | velvet | Front/rear/underside/close-up + binary export accepted; browser pending |
| `channel-sofa` | 2400 × 1000 × 760 | Original detailed como channel sofa with modeled construction and independently editable finishes | velvet | Front/rear/underside/close-up + binary export accepted; browser pending |
| `metal-frame-sofa` | 2200 × 900 × 790 | Original detailed bauhaus metal-frame sofa with modeled construction and independently editable finishes | velvet | Front/rear/underside/close-up + binary export accepted; browser pending |
| `library-reading-chaise` | 880 × 1700 × 850 | Deep tailored chaise with supportive angled back, one arm, piping and exposed oak legs | velvet | Front/rear/underside/close-up + binary export accepted; browser pending |
| `patio-loveseat` | 1600 × 800 × 850 | Open wood frame with fitted matte cushions | canvas | Front/rear/underside/close-up + binary export accepted; browser pending |
| `patio-chaise` | 720 × 1950 × 850 | Long slatted lounger with a raised back and cushion | canvas | Front/rear/underside/close-up + binary export accepted; browser pending |
| `patio-corner-sofa` | 2200 × 1650 × 860 | Timber L-shaped lounge with a cushioned return and fitted back pads | canvas | Front/rear/underside/close-up + binary export accepted; browser pending |

## Editable implementation and review gates

`tools/blender/enrich_sofas.py` appends each original editable Blender source into its own tagged scene. It makes source-local material copies, assigns original/licensed PBR maps, supplies physical UV scales and adds small ray-conforming stitches. It preserves the original part geometry and the exact overall millimetre envelope. The tracked `.blend` retains separate parts and packed textures; the browser GLB combines static parts. Hash-verified originals from a pinned Git revision prevent repeated authoring calls from accumulating stitches, including on a fresh checkout.

Before the first build in any checkout, run `python tools/blender/sofa_realism_baseline.py`. It extracts only the original 35 source blobs at commit `8745059e6a80184f52b1d830f5af97be6b03fa58` into `.generated/sofa-realism-originals/`, verifies each original byte length and SHA-256 from `assets-source/sofa-realism-references.json`, and leaves tracked enriched sources untouched. The commit must already exist locally; for a shallow checkout, fetch that exact commit first. No automatic network access or current-working-source fallback is used.

`python tools/blender/sofa_realism_baseline.py --check` validates the ignored originals without writing. Missing or changed originals stop Blender authoring before it can append a model. After preserving any deliberate backup edits elsewhere, `--repair` explicitly restores invalid ignored backups from the pinned commit. All originals are preflighted before extraction; redirected backup paths are rejected. The tracked editable models remain independently editable outputs, while the pinned sources are the repeatable starting point for this particular enrichment pass.

An isolated fresh-baseline validation extracted all 35 originals, verified zero rewrites on a repeat invocation, rejected missing/corrupt originals and an incorrect pinned hash, and repaired one explicitly corrupted ignored backup. All 35 tracked enriched source hashes remained unchanged. The current originals also pass the read-only `--check` command.

Blender 5.2 glTF exporter source was checked directly: the modern RGBA Multiply node preserves a texture multiplied by an editable base-colour factor; the legacy MixRGB node does not provide that factor path. Packed ORM image Green and Blue channels are wired to roughness and metallic together, avoiding unnecessary PNG repacking. Default sofa colour hexes are interpreted in sRGB then converted to linear for Blender/glTF.

The script requires exact prior exported material names; it stops on unknown or missing keys. New source material suffixes are mapped only to an observed baseline key. Every export receives a before/after geometry/material receipt in `assets-source/sofa-realism-audit.json`.

Required acceptance: review front, rear, underside and close-up renders of every ID; verify all material keys, exact envelope and ground contact; verify real exported normal/roughness textures; inspect normal-size browser rendering and recolouring without losing textile detail; check measured mesh/texture cost and production release tests. A successful script or export alone is not visual acceptance.

## Completed asset acceptance

All 35 original editable models have been rebuilt, exported and visually reviewed from the front, rear, underside and at close range. The review includes material grain, cushion separation, piping, joinery and base contact. Final corrections made Chester tuft buttons matte camel rather than white metal-like studs, matched pale piping to the upholstery, and changed the three patio defaults to moss, terracotta and slate. Play/pet sofas use moss/camel; the reading and everyday sectionals retain richer family-specific blue, taupe and charcoal defaults. Independent saved colour keys remain available, including the legacy Chester `warm-brass` key.

The binary verifier decodes real exported POSITION buffers and transforms instead of trusting recipe values or accessor bounds. All 35 pass with original material keys, embedded colour/normal/roughness maps, exported UVs, less than 0.1 mm envelope/base/origin error and bounded mesh cost. Run `python tools/blender/sofa_realism_verify.py` to repeat this read-only asset check.

| Final measurement | Result |
|---|---:|
| Accepted Blender sources / GLBs / front previews | 35 / 35 / 35 |
| Textile families | 6 |
| Triangles per model | 2,568–16,936 |
| Triangles across all 35 models | 299,512 |
| Embedded GLB size per model | 0.91–4.70 MB |
| GLB bytes across all 35 models | 103,782,168 |
| Lossless WebP preview bytes | 9,563,562 |
| Source PNG preview bytes | 22,319,969 |
| Preview byte reduction, with exact decoded RGBA equality | 57.2% |

Models with both textile and multiple wood treatments carry full-quality separate maps. The sofa verifier allows up to 6 MB per model; actual maximum is 4.70 MB. JPEG ORM channel sharing avoids exporter-generated multi-megabyte PNG repacks, while all preview compression is lossless. This is an intentional material-quality addition to previously mostly texture-free models, not a claim that model download size decreased.

Tracked per-ID acceptance and source hashes are in `assets-source/sofa-realism-audit.json`. Local review evidence is under `.generated/sofa-review/`: seven four-view contact sheets plus `review-final-fixes-a.jpg`, `review-final-fixes-b.jpg` and the final binary/preview receipt `final-verification.json`. The final fix sheets supersede corresponding rows in earlier contact sheets. All 35 catalog WebPs decode exactly to their reviewed final PNG pixels.

## Shared runtime and browser acceptance

The integrating task reviewed `slat-day-sofa` in the application as the representative browser check for the shared sofa material path. Changing its upholstery to terracotta preserved the textile detail, coordinated the seams with the upholstery and left the natural timber grain and colour intact. This is a normal application rendering and recolouring check of that named example, not an individual browser review of all 35 sofas. The per-ID table and reference receipts continue to distinguish the completed four-view Blender review from individual browser acceptance.

Independent code review confirms that sofa tint conversion and coordinated seam/button recolouring are scoped to the enriched sofa IDs, with explicit saved material colours applied last. Natural wood is not selected by the upholstery tint path. The shared floor/wall PBR maps use physical repeat dimensions, colour-space-correct inputs and normal-map handedness derived from the scene. The integrating task's focused material tests cover both scene handedness settings; its browser checks confirmed the floor/wall repeats, distinct moss/rose/charcoal carpet swatches and the 12-piece outdoor fixture in day and night lighting. Those adjacent checks exercise the shared material integration, not every new model's placement or visual acceptance.

Review fixtures are development-only. Review identified that the Home action could save an unsaved showcase; the exit guard now excludes the specific showcase plan ID while permitting subsequent real projects to save. A focused regression checks preservation of the previous saved project and active project, absence of the review fixture in local storage, and normal saving after a new real plan is created.

Status: research, editable sources, all 35 model exports, all four rendered views, binary compatibility checks and lossless previews are complete. The shared browser recolouring path has been accepted on `slat-day-sofa`; individual browser reviews of all 35 are not claimed. Full integration/release validation and deployment remain with the integrating task. No deployment is claimed by this audit.
