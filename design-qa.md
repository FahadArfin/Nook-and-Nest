# Nook & Nest Handcrafted Furniture Design QA

## Evidence

- Source visual truth: `qa/source-furniture.png` (521x353), `qa/source-room.png` (711x514), and `qa/source-wide.png` (924x420).
- Baseline implementation: `qa/implementation-1440x900.png` (1440x900), showing the earlier generic shape system.
- Revised implementation: `qa/furniture-redesign-1280x720.png` at a 1280x720 CSS-pixel viewport and DPR 1.
- Focused furniture region: `qa/furniture-redesign-focus.png` (697x599).
- Full comparison evidence: `qa/furniture-redesign-comparison.png` (1600x1600).
- State: development-only five-piece furniture study containing the bookshelf, dining table, dining chair, dresser, and bed at their catalog dimensions.
- Normalization: sources are art-direction references rather than a UI mock. The combined comparison preserves each reference's aspect ratio and evaluates silhouette, form hierarchy, material response, warmth, handcrafted character, and diorama readability rather than pixel-identical layout.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3 accepted: the procedural furniture deliberately uses simpler surface treatment and fewer micro-details than the cinematic references. This protects browser performance and keeps the assets editable from canonical millimetre dimensions.
- P3 accepted: the dining tabletop uses restrained inset plank lines instead of a texture map. The lighting catches its chamfered perimeter, while the apron and tapered legs carry the secondary silhouette.

## Required Fidelity Surfaces

- Fonts and typography: unchanged from the verified application. Fraunces and Nunito remain readable and visually compatible with the miniature-diorama direction; the source images contain no UI typography to reproduce.
- Spacing and layout rhythm: the existing editor shell is unchanged. The representative assets remain legible at the normal isometric camera distance without crowding their editable footprints.
- Colors and visual tokens: furniture now uses one centralized warm palette with honey and light woods, darker structural wood, muted painted variants, oatmeal cream, terracotta, green, blue, burgundy, and mustard. Materials are non-metallic, high-roughness, and softly responsive rather than glossy.
- Image and asset quality: every revised object is still an original Babylon.js procedural assembly. No reference furniture, textures, models, or proprietary shaders were copied or imported. Visible hard-edged boxes were replaced with low-poly chamfered geometry where form readability benefits.
- Copy and content: no application copy changed. Catalog names, dimensions, descriptions, and saved catalog IDs remain intact.

## Form and Style Review

- Primary forms: each representative piece has a clear dimension-constrained silhouette: framed shelf, apron table, slatted chair, capped drawer chest, and layered bed.
- Secondary forms: posts, recessed backing, shelves, plinths, drawer faces, door trim, handles, aprons, rails, cushions, headboard panel, blanket, and supports produce readable depth.
- Decorative forms: varied books, shelf pottery and plant, table plank lines, drawer hardware, pillows, and blanket folds add personality without clutter.
- Handcrafted variation: book sizes and lean, cushion offsets, and pillow rotations derive deterministically from the stable furniture placement ID. Re-rendering or reloading the same project does not change the result.
- Dimensional integrity: generation consumes the existing width, depth, and height values directly. Caps, bevels, and trims remain within the defined bounding dimensions, with only negligible soft-form tolerance.

## Comparison History

1. Baseline P1: `qa/implementation-1440x900.png` showed generic type-level assemblies dominated by raw boxes and ellipsoids. Fix: introduced a centralized `FurnitureFactory`, low-poly chamfered-box geometry, tapered legs, shared material families, and dedicated builders for the five representative items, then extended the design system across all catalog shapes.
2. First redesign P2: the initial browser pass had overly dark woods and strong cast shadows that obscured drawer and bed layering. Fix: warmed the wood palette, added restrained material ambient response, softened shadow darkness, and rechecked the same five-piece scene. Post-fix evidence: `qa/furniture-redesign-focus.png` and `qa/furniture-redesign-comparison.png`.
3. First redesign P2: the dining table and storage pieces still lacked enough secondary information at the normal camera distance. Fix: added aprons, inset plank lines, top caps, plinths, projected drawer faces, oversized handles, recessed doors, shelf backing, books, pottery, and blanket folds. Post-fix evidence: `qa/furniture-redesign-focus.png`.

## Functional Verification

- Browser placement and dimension edit passed; an added Story shelf rendered immediately and accepted a 900mm to 950mm width edit.
- Direct canvas dragging passed; the selected shelf moved from X 1700mm to X 1100mm.
- Undo recovery passed; the temporary dimension, drag, and placement edits were reversed and the saved room returned to its original four pieces.
- Picking, selection outline, rotation controls, catalog mapping, collision warnings, and autosave use their existing data and event paths; their schemas were not changed.
- A 150-piece stress scene rendered 2,551 meshes at a reported 120 FPS in the verification browser with no console errors.
- Existing serialization and share round-trip coverage passed, plus new tests confirmed stable variation and unchanged catalog/placement identifiers.

final result: passed
