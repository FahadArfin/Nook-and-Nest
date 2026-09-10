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

Beta Luna analysis (September 10): use local wall evidence and detail crops with a bounded two-pass Luna pipeline. Keep dimension conflicts visible, preserve source coordinates and editable review, and do not silently invoke Astra. Version analysis caches when the pipeline changes. Keep private test scans and API credentials outside Git. Publish only to Beta 2 while this pipeline is evaluated.

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

Two-million vegetation direction: painted landscape fields use compact deterministic cells and stable per-plant edit IDs. Preserve old individually placed plants. Keep visible geometry bounded, generate visibility in a worker, retain original models nearby and captured model views at distance, and validate saving, undo, painting, selection and sustained camera movement against two-million fixtures. Do not equate logical plant count with simultaneous full-detail rendering or claim untested device performance.

September 9 UX review: keep phone drawing space available with a dismissible Rooms sheet and explicit More actions. Use project units and readable fractional inches without rounding saved geometry on display. Keep plant settings and actions reachable separately from the catalog; explain dense-field versus independent-plant behavior. In plan lists placed objects, not new placement cards. Use named dismissible dialogs, searchable task help, explicit preview/live edit feedback and conspicuous device/online saving. Publish this UX pass only to Beta 2 until the owner verifies it.

Beta controls refinement: Quick layout applies directly with one-step Undo, without a review menu. Keep view and planning actions side by side. Paint and Outdoors share tabbed floating palettes that collapse after choosing a finish, plant or terrain tool; retain the active tool and an explicit reopen control. Camera controls use consistent compact icon buttons. Beta-only publication remains in effect.

Free editor cleanup: do not show an empty-plan starter card over the canvas; use the existing top Floor plan button. Remove the right-side selected-furniture magnifier, retaining zoom +/- and Center home.

Palette refinement: align Paint and Outdoors at one shared canvas-centered position and width. Collapsed palettes retain quick size/strength or density sliders and paint swatches. Settings slides out with concise quality choices and a hover/focus/tap information control; Ghost floor below belongs inside Settings.

Beta refinement: consolidate structural tools under Build with Walls/Floors and Add/Remove; use rounded project-sort toggles and three recent local project previews on the welcome page. Remove the generic example and top More button. Studio reuses branded editor header styling and a fit/zoom rail; its Rooms sidebar uses one sliding icon toggle.

Floor Plan Studio uses a floating bottom dock matching 3D for Select, Add wall and Remove wall; paint and outdoor actions stay in 3D.

Compact palette actions use icon buttons with accessible names and hover labels. All Studio drawing tools share the bottom dock; openings and fixtures expand upward. Studio logo returns home through unsaved-draft protection.

Editor and Studio headers group branding, title, and actions compactly on the left; avoid automatic spacer margins and wrap controls on narrow screens.

Library browsing uses descriptive model tags from category, mounting metadata and explicit model names. Keep Browse and Saved; omit In plan and the collection-sort dropdown. Tags filter without placement or plan mutation.

Studio places Select/Move and Pan only in the bottom drawing dock. File, View and Import belong in the toolbar above the drawing, with their menus anchored below that row.

Floor tabs use an adjacent plus and per-floor options for duplicate, vertical reorder and deletion. Dragging changes physical floor order, not just tab presentation. Preserve Undo and delete confirmation. Browser Back/Forward navigates editor and Studio with unsaved-draft protection.

Floor tabs highlight the full selected tab including compact vertical dots. The menu contains only Clone, Delete and Rename. Drag left/right to reorder physical building levels; retain delete confirmation, last-layer clearing and Undo.

Living welcome menu: use the selected Fireside Evening composition, cream serif title and pill actions over full-bleed cozy artwork. Fireside, Rainy afternoon and Sunday morning each have matched day/night art. Rotate every two local calendar days from first visit; Next pins the chosen scene locally until auto is restored. Appearance and motion controls never mutate projects; pause on hidden/editor surfaces and respect reduced motion.

Wall-analysis research: adapt floor-plan image-processing ideas into the existing editable planner rather than Blender scene generation. Evaluate with Luna on Beta 2; preserve the primary site and keep unproven methods explicitly experimental.

Doorway ownership preference (September 10): rooms may be concave or stepped. A confirmed closed doorway determines which room owns its entry recess. Preview both affected room shapes before applying one undoable correction; preserve existing total floor area and distinguish missing floor from wrong labels. Keep computational door closures separate from physical walls.
