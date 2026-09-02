# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

Furniture must use original editable Blender sources exported to GLB, with the existing Babylon.js procedural assemblies retained only as loading/error fallbacks. Keep a cohesive cozy handcrafted low-poly language: chunky chamfered primary forms, layered secondary construction, restrained decorative detail, visible wood and fabric texture, warm rough shared materials, and subtle variation. Preserve millimetre-accurate dimensions, catalog and placement IDs, saved schema compatibility, picking, dragging, snapping, and undo/redo.

Every catalog piece must read immediately as its named real-world furniture type, with its own silhouette and construction details. Do not use scaled spheres or ellipsoid "blobs" as upholstered furniture, plant clusters, pet beds, or rugs. Prefer thick frames, rounded-rectangular cushions, visible legs and joints, layered panels, warm muted colors, subtle bevels, slight asymmetry, and a few legible decorative details. Sofa-family upholstery should use clean matte color with only restrained surface grain, not coarse basket-weave texture; avoid default loose side cushions and contrasting arm caps. Avoid razor-sharp CAD boxes, photorealism, glossy plastic, extremely thin parts, excessive polygons, and perfect symmetry.

Furniture catalog cards must start a reversible Sims-style draft placement rather than immediately changing the saved plan. Dragging from the library should move a translucent in-room model; after release, keep the draft visible with nearby confirm, cancel, rotate-left, and rotate-right controls. Only confirmation may add the item to the plan and undo history. Keyboard placement must support Enter to confirm, Escape/Delete to cancel, and R to rotate.

After placement confirmation, furniture should be deselected. Clicking any placed furniture must reopen a model-anchored editing toolbar with remove, rotate-left, done, rotate-right, and direct color swatches; keep the detailed inspector synchronized as the secondary precision editor.

Floor tile editing must support drag-to-size rectangular previews for both painting and erasing. Keep changes uncommitted until the user confirms them with a model-anchored cancel/check toolbar, and record each confirmed region as one undo step. The environment outside the apartment should remain a clean plain ground plane without flowers, bushes, rocks, or other vegetation.

Each floor layer must offer cozy saved wall and floor finishes. Wall choices should include restrained paint colors, brick, stone, and wallpaper; floor choices should include wood, laminate, tile, and carpet. Keep texture detail soft and handcrafted rather than photorealistic, and retain finish changes in undo/redo, autosave, export, and share links. Expand the décor catalog with distinctive rugs built from editable Blender sources, not procedural-only browser shapes.

Keep the catalog broad within each furniture type: sofas, beds, desks, and side tables should offer genuinely different recognizable constructions, not scaled copies. Include TV/media furniture and a modular kitchen family with appliances, base and wall cabinets, counters, sinks, and islands. Counter-capable kitchen pieces must save an independently selectable granite, marble, laminate, or concrete worktop finish on each placement.

Wall décor should be placeable at an editable height and include original textured paintings/posters, wall mirrors, a whiteboard, wall shelves, and book clusters. Laundry must support separate washer and dryer pieces plus a joined stacked pair. Interior-room construction should use a clearly named drag-to-draw Inside wall tool, and newly placed inside doors should retain their selected paint or wood finish.
