# Architectural material and upholstery research

The material upgrade addresses the user's September 29 feedback: plain, sterile sofas and game-like floors/walls. It uses photographic or carefully measured CC0 material maps with separate color, OpenGL tangent normals and surface roughness. Manufacturer imagery informs construction and finish selection; it is not embedded in the app.

## References and implemented direction

| Reference | Design evidence | Implementation |
| --- | --- | --- |
| [Floor & Decor tile catalog](https://www.flooranddecor.com/tile?shopThisStore=116) | Large porcelain, stone, marble, textured and matte finishes | Retain existing slab format IDs and dimensions while introducing scanned mineral variation and appropriate gloss |
| [Floor & Decor Vetta concrete-look porcelain](https://www.flooranddecor.com/porcelain-tile?prefn1=familyGroup&prefv1=Vetta+Luxe%3A+Concrete+look) | Quiet mineral clouding rather than strong cartoon outlines | Concrete and plaster surfaces with low-amplitude normals and restrained sheen |
| [Farrow & Ball finish guide at B&Q](https://www.diy.com/brands/farrow-ball-paint/farrow-ball-finishes) | Different sheen for wall paint and durable finishes | Smooth editable paint color with very fine normal detail, without baked dirt or large mottles |
| [Poly Haven wood floor](https://polyhaven.com/a/wood_floor) | Grain, plank seams, natural tonal variation; published 1.7 m repeat | Meter-scaled floors continuous across architecture grid cells |
| [Poly Haven rough linen](https://polyhaven.com/a/rough_linen), [velour](https://polyhaven.com/a/velour_velvet), [corduroy](https://polyhaven.com/a/ribbed_corduroy) | Different woven and napped textile structures | Tintable calibrated color plus actual normals/roughness, preserving textile scale |
| [ambientCG fabric](https://ambientcg.com/a/Fabric030), [canvas](https://ambientcg.com/a/Fabric036), [fine weave](https://ambientcg.com/a/Fabric082A) | Subtle heather, woven canvas and fine upholstery structures | Shared chenille, outdoor canvas and twill families with restrained surface relief |
| [ambientCG marble](https://ambientcg.com/a/Marble012), [travertine](https://ambientcg.com/a/Travertine009), [onyx](https://ambientcg.com/a/Onyx015) | Actual mineral veins, bands and pores | Existing marble/stone choices gain scanned detail; new wall treatments extend the selection |

The accompanying `assets-source/realism-texture-provenance.json` and `realism-stone-provenance.json` contain exact official download URLs, authorship where supplied, CC0 licensing, file sizes and SHA-256 receipts for 31 source material sets. Downloaded files are hash-checked before calibration. `tools/prepare_realism_textures.py` records prepared outputs and creates neutral textile/paint factors without inventing new manufacturer artwork. The complete prepared 1K maps are retained and packed into editable Blender originals as needed.

[Reviewed source-map contact sheet](realism-source-contact.jpg). The prepared map directory currently contains 63,534,537 bytes. Derived maps include neutral carpet/paint, a pale desaturated bleached floor and export-safe honed-stone roughness. Honed outdoor stone has a minimum roughness of approximately 0.62; the ceramic grill retains solid red pigment with a 0.4 minimum rather than borrowing a stone vein image.

## Implemented coverage

The [runtime finish mapping](../src/realismFinishes.ts) upgrades existing finish IDs without renaming saved selections and introduces **six floor choices and eight wall choices**. These supplement the existing catalog; they are not a replacement catalog with new IDs for old finishes.

| Surface | New finish IDs | Variety |
| --- | --- | --- |
| Floor | `realism-garage-rubber`, `realism-troweled-concrete`, `realism-weathered-pavers`, `realism-aged-deck`, `realism-cream-honed-stone`, `realism-fine-terrazzo` | Charcoal utility tiles, warm concrete, worn exterior paving, weathered timber, cream stone and aggregate terrazzo |
| Wall | `realism-limewash`, `realism-grey-plaster`, `realism-raw-plaster`, `realism-microcement`, `realism-travertine-wall`, `realism-onyx-wall`, `realism-white-ceramic`, `realism-exposed-brick` | Mineral limewash, grey and unfinished plaster, concrete, travertine, pale onyx, square ceramic and exposed brick |

Existing floors receive measured wood/laminate repeats, varied carpet pile and mineral surfaces. Chevron and patterned carpet retain their distinct motifs; simple carpet families multiply their individual colors into a neutral pile map. Existing paint keeps its editable color with very restrained normal detail. Decorative tile and wallpaper retain their images while gaining subtle material response. The [shared browser material helper](../src/scene/surfaceMaterials.ts) reads color separately from linear normal/roughness data and does not generate textures every frame.

The accompanying [35-sofa rebuild](sofa-realism-audit.md) uses six textile families—linen, chenille, twill, corduroy, velvet and outdoor canvas—with oak, walnut and teak where the original construction has wood. All 35 asset exports and four-view render reviews are complete, including richer default colors and fine modeled seams; ordinary chairs and beds are outside that specific redo. The [garage](garage-collection-research.md) and [outdoor](outdoor-collection-research.md) builders apply the shared maps to appropriate individual parts. The [outdoor acceptance record](../assets-source/outdoor-living-review.json) covers all 48 completed outdoor exports, including local-axis timber grain, matte stone and the solid-pigment ceramic grill.

## Visual and compatibility rules

- Preserve all saved finish IDs. Existing large-format slab dimensions remain unchanged. Wood flooring uses measured world-space repeats rather than restarting its image on each editor grid tile.
- Keep custom paint colors smooth and exact. Normal/roughness maps contain linear data; only base-color images use sRGB. PBR color factors are converted to linear space.
- Wood grain follows each board's long axis; oak, walnut and teak retain natural color. Fabrics receive fine microstructure and measured stitching, not coarse burlap.
- Floors now include garage rubber, troweled concrete, aged exterior boards, weathered paving, honed cream stone and aggregate terrazzo. Walls add limewash, mineral plaster, microcement, travertine, onyx, white ceramic and exposed brick.
- Preserve familiar decorative tile and wallpaper motifs. Fine surface detail improves their material response without silently changing the motif selected in an old saved home.
- New public textures are mipmapped and anisotropic-filtered; no per-frame texture generation or dense displacement geometry is used. GLB loading remains bounded and lazy. Full original model detail is retained; CI's existing shared-image/mesh pipeline prepares production assets.
- OpenGL normals use Babylon's handedness conversion for the room surface path, matching imported GLB materials. Floor cards, the selected finish, compact controls and pinned recent finishes multiply the same color into neutral albedo maps, so moss, rose and charcoal carpet remain visibly different in the chooser.

`?showcase=realism` opens a development-only unsaved material room. `finish` and `wall` select real catalog finish IDs for daylight/night review. Visual acceptance and final production byte counts are recorded after all builds complete; this research document alone does not prove release readiness.

Normal maps add apparent pores, grain and mortar relief without displacing room geometry. Surface images do not create independently modeled planks or bricks, physical carpet fibers, transparent onyx slabs or installation clearances. Material changes retain the room's geometry and saved finish identifiers. No new outdoor ground treatment is applied automatically to existing homes.

The licensed source preparation and runtime implementation are complete on the feature branch. Final integrated browser acceptance, project checks and the exact-artifact Sites release remain the integrating workflow's responsibility. This material upgrade is not part of the already published Sites versions 116 or 117 and is not claimed as live here.
