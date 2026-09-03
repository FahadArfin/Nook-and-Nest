# Batch 4 — Indoor furniture and décor

Implemented locally on September 2, 2026. No public release performed.

## Collection

27 new original Blender pieces; catalog total 189. Each has an editable named-part source, normalized GLB, independent material colors, library family/search coverage, rendered thumbnail, and loading/error fallback.

- Five rugs: diamond lattice, fringed kilim, concentric jute-style, color-block arch and broad checker.
- Three display shelves: tall open bookcase, graduated ladder and nine-cubby unit.
- Four collectibles: original sky traveler figure, guardian robot, sailing ship and generic brick-style roadster.
- Three bunk beds: twin-over-full, under-bed storage and low kids bunk.
- Three bedside tables: cane drawer, floating drawer and round fluted pedestal.
- Four original artworks: wide valley painting, sky-traveler anime-inspired poster, fictional soul singer and unbranded basketball print.
- Five sofas: mirrored left/right chaise, U sectional, low foam-style loveseat and chaise.

## Research and modeling decisions

These sources informed furniture types and construction only. No retailer photos, meshes, branding or proprietary artwork are included.

- [Ligne Roset Togo composition](https://www.ligne-roset.com/us/p/modular-sofas/composition-togo-r-3316): reference for low foam-based lounge construction. Cloudfold is an original simplified folded shell, not a replica.
- [IKEA KALLAX](https://www.ikea.com/us/en/p/kallax-shelf-unit-black-brown-70301542/) and [shelving families](https://www.ikea.com/us/en/cat/bookcases-shelving-units-st002/): chunky framed cubbies and open display shelving; separate usable bays rather than a solid collision box.
- [Pottery Barn Kids twin-over-full bunk](https://www.potterybarnkids.com/products/camp-twin-over-full-bunk-bed/?pkey=dbunk-beds): recognizable wider lower bunk, framed guard rails and ladder. Models are illustrative planning assets, not manufactured/safety-rated bed designs.
- [Ruggable jute-style rugs](https://ruggable.com/collections/re-jute-rugs), [tufted rugs](https://shop.ruggable.com/collections/tufted-all-in-one-rugs), and [checker collection](https://ruggable.com/en-CA/collections/checkered-rugs): varied woven/pile/pattern categories. All patterns are original mesh construction with independent material colors.

## Shelf behavior

Books, small plants, collectibles and the existing surface-placeable accessories can snap onto new shelves. The ray chooses the nearest usable level with sufficient footprint and headroom. Cubby dividers, backs and ladder shelf lips are excluded. The inspector's **Rest on a shelf** menu lists fitting levels and centers/rotates the piece in one undo step. Manual height remains available. Upper shelves can occlude lower levels in a top-down drag; the explicit level picker resolves this.

Shelf surfaces scale with edited dimensions and floor elevation. Their heights were checked directly against Blender geometry. Shelf owners are excluded from false overlap warnings only when the item actually fits a supported plane. Other décor can still trigger overlap warnings. Shelf capacity/weight and wall anchoring are not simulated. Pieces remain independent: moving or removing a shelf does not move/delete its décor.

Existing saved book/plant IDs and heights are unchanged. Newly placed books/plants default to floor height until dragged onto a surface. No saved-document schema change.

## Asset pipeline and artwork provenance

Models: `tools/blender/interior_models.py`, registered through `build_quality_models.py`. Editable sources: `assets-source/blender/<catalog-id>.blend`. Runtime assets: `public/models/furniture/<catalog-id>.glb`. Previews: `public/models/previews/<catalog-id>.png`.

Four original bitmaps were generated with the built-in image-generation tool. Originals are retained under `assets-source/art/`; aspect-preserving 768-pixel-max runtime versions are under `assets-source/art/web/` and embedded in each artwork GLB. A single explicit UV quad maps each full image once, with no tiling or external image dependency. Frames remain separately colorable. Sources were visually inspected before integration. Generated originals were copied, not removed from their original generation location.

### Exact generation prompts

#### valley-panorama

- Original: `assets-source/art/valley-panorama.png`
- Runtime texture: `assets-source/art/web/valley-panorama.png`
- Saved generation original: `C:\Users\fahad\.codex\generated_images\01a05a0a-e572-7302-b52b-85812a9f8804\exec-d3b7ee4e-0361-4b48-b39d-9d93958b235d.png`

Use case: illustration-story. Asset type: original painting texture for a cozy miniature apartment planner. Create a finished wide landscape painting, 3:2 landscape aspect ratio, full bleed artwork only, perfectly straight-on with no frame, no wall, no mockup. Quiet winding river through rolling green hills and golden fields under peach evening clouds. Rich expressive gouache brushwork, warm sage, cream, terracotta, muted blue, gently textured paper, sophisticated calming composition with broad readable forms. No lettering, watermark, signature or logos. Entire image is the painting.

#### starlight-poster

- Original: `assets-source/art/starlight-poster.png`
- Runtime texture: `assets-source/art/web/starlight-poster.png`
- Saved generation original: `C:\Users\fahad\.codex\generated_images\01a05a0a-e572-7302-b52b-85812a9f8804\exec-62117a4b-d92a-4da0-a70e-617e75a0bd10.png`

Use case: illustration-story. Asset type: original anime-inspired wall poster texture for a cozy miniature apartment planner. Portrait 2:3 aspect ratio. Full bleed flat print artwork only, straight-on no frame or surrounding scene. An original young adult sky traveler in a mustard coat and muted teal scarf watches a luminous comet from a hillside railway platform, pastel city in the distance, expressive anime illustration with warm cream and indigo palette. Original character, not any existing franchise. Beautiful legible simple composition. No text, no logos, no signature, no watermark.

#### singer-poster

- Original: `assets-source/art/singer-poster.png`
- Runtime texture: `assets-source/art/web/singer-poster.png`
- Saved generation original: `C:\Users\fahad\.codex\generated_images\01a05a0a-e572-7302-b52b-85812a9f8804\exec-2fdc2005-1bd8-4af7-a4ea-4666d11c3813.png`

Use case: illustration-story. Asset type: original music wall poster texture. Portrait 2:3 aspect ratio. Full bleed flat print only, straight-on, no frame, no mockup. A fictional adult female soul singer with short curly hair in a terracotta suit holding a vintage microphone, expressive singing pose against a large cream spotlight disk and muted sage abstract stage. Sophisticated retro screen print with layered warm ink textures. Original person, no resemblance to any celebrity. No text, no logo, no signature, no watermark.

#### basketball-poster

- Original: `assets-source/art/basketball-poster.png`
- Runtime texture: `assets-source/art/web/basketball-poster.png`
- Saved generation original: `C:\Users\fahad\.codex\generated_images\01a05a0a-e572-7302-b52b-85812a9f8804\exec-4213b600-7f1c-48d2-a1f0-cbcbc5f50ffd.png`

Use case: illustration-story. Asset type: original sports wall poster texture for a cozy apartment game. Portrait 2:3 aspect ratio, full bleed flat print only, straight-on, no frame or mockup. Dynamic anonymous basketball player in a rust and cream jersey leaping toward a hoop, large diagonal movement and muted navy court shapes, cream background, bold artistic vintage sports screen print with restrained texture. No team branding, no celebrity likeness, no jersey numbers, no text, logos or watermark.

## Verification

- Full unit/integration suite, type check, production build and hosting-worker checks: see expansion-checklist.md for final totals.
- Every new GLB checked for advertised width/height/depth, <40,000 triangles and <4 MB; imported through Babylon's real GLB importer with headless rendering and materials skipped. Texture embedding and UV presence checked separately.
- Blender-source check: `tools/blender/verify_interior.py` verifies actual shelf planes and required editable components.
- All 27 thumbnails visually inspected. Corrected buried jute strands, missing sail faces, and wider bunk support legs before final verification.
- Shelf level, rotation, headroom, resizing, floor isolation, cubby containment, overlap exclusions, UI selection, undo/redo and JSON/share compatibility covered.
- No browser interaction or integrated-graphics performance result is claimed. Combined-release browser/hardware checks remain in Batch 6.

