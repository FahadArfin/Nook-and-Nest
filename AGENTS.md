# Nook & Nest working guide

Start with [repository map](docs/repository-map.md). Read the applicable contracts before edits:
- [Workflow and release](docs/contracts/workflow.md): mandatory isolated worktree, PR, Validate and exact artifact publication.
- [Editor and persistence](docs/contracts/editor.md): interaction, geometry, saved plans, agent tools and UI requirements.
- [Model authoring](docs/contracts/models.md): editable originals, dimensions, IDs, material keys and accepted fidelity.
- [Landscape](docs/contracts/landscape.md): bounded rendering, brush history, water and meadow coverage.

## Mandatory workflow

Create a unique `codex/` worktree from freshly fetched `origin/master`. Never switch, stash, reset, clean or commit another task's directory. Fetch and integrate master before a PR; never direct-push or force-push master. Require Validate before production merges, then publish the exact successful master artifact according to docs/release-workflow.md. Verify the live deployment.

**Beta 2 exception:** Beta carries a separate Site identity. Keep its PR draft, publish only the successful feature-branch artifact to the owner-private Beta 2 Site, and never merge its hosting identity into production. Do not downgrade a newer deployment.

Run the local preview yourself. Keep secrets out of logs and artifacts. Keep changes focused. Run type checks, regression tests, production build and hosting tests before publication. Do not claim physical-device performance from compilation or a desktop-only check.

## Latest-wins interaction rules

These resolve superseded instructions retained in the contracts:
- Selecting furniture does not enable movement. Movement is explicitly toggled and defaults off; selection/recoloring must preserve zoom. The anchored toolbar has confirm, rotation, movement and cancel controls. Colors belong in the inspector, not the anchored toolbar.
- One Paint button opens Walls/Floor choices. Bottom workbenches float as wide rounded rectangles above the dock, with smooth transitions and reduced-motion support. Land formation opens Terrain/Plants/Landscape choices. Remove duplicated tool tabs and unused right panels.
- Add wall is a compact per-wall full/half-height chooser. Erase offers wall/floor choices. Keep measured dimensions and wall connections exact.
- Continuous landscape strokes update live and commit one undo step on release. New River strokes add water without digging; legacy carved rivers remain compatible. Water evolves in bounded runtime state.
- Dense meadow uses saved coverage plus stable natural world-space scatter and bounded camera-local detail. Existing individual plants retain independent editing and original close-up models.
- Wall visibility has near-hidden, all-hidden and all-visible modes. Hidden walls cannot pick, snap or cast shadows; near-wall transitions respect reduced motion and preserve camera framing.
- Autosave must clearly distinguish device storage from explicit private online saves. Preserve offline use, backups, undo and saved-schema compatibility.

## Ownership and navigation

`SceneController` coordinates shared scene state; CameraControls, PlacementController, FloorPaintController and LandscapeController own their interaction responsibilities. Keep rendering animation out of saved state.

Use docs/asset-pipeline.md before editing generated files. Use docs/performance-scenes.md for reproducible performance validation. Preserve aquarium fidelity exactly and keep original Blender sources, IDs, dimensions and material keys.

Record new durable prototype preferences here or in the relevant contract. The full pre-consolidation guide is preserved verbatim in docs/history/AGENTS-before-maintenance.md (baseline 78a82e7). Historical conflicts do not override the explicit latest-wins rules above. No user requirements were discarded.
