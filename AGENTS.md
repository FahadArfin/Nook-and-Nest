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

## Beta separation (user correction, September 10)
General app UX, menu, furniture and landscape work belongs on beta1. Beta 2 and its Site are reserved for floor-plan automation research. Never publish general UI changes to Beta 2. Resolve the beta1 Site identity separately before publishing. The welcome recent-project panel must be compact and vertical, with up to three stacked projects rather than a full-width strip.

Welcome menu: Recents belongs below Open 3D editor, revealing up to three large rounded-square project buttons on hover, with click and keyboard access. Remove arrows from Create floor plan and Open 3D editor. Publish general UX only to Beta 1.

Latest welcome direction: remove Recents entirely. Put My projects directly below Open 3D editor using the same rounded button style, without a duplicate header action. First two actions have no arrows.

Welcome background name and Auto/Pinned text are hidden from the main menu; retain background preferences behind a compact icon.

Approved welcome labels: Draw a floor plan, Design in 3D, My projects.

Welcome polish: offset the main group down/inward on wide desktops, lighter typography, feathered contrast behind the menu, gentle hover/press/focus feedback. Use bounded scene-local fireplace light, window rain and daylight/lamp variation rather than whole-image panning; pause when hidden and respect reduced motion. Beta 1 only.

Scene motion refinement: animate fireplace flames and candle wicks, slow glass rain, sleeping-cat breathing, cup steam and gentle curtain billow inside their authored image regions. Keep the room and UI stationary; bound animation resolution and frame rate, stop while hidden or paused, and retain static art for reduced motion. General UX remains Beta 1 only.

Motion masks must follow object interiors rather than rectangular bounds: keep pillows, plants, shelves and fireplace masonry still. Prefer the photographed fire texture over drawn flame tongues. Include sleeping-dog breathing and restrained coffee/candle wisps in Fireside.

Beta 1 floor-plan studio UX: keep a compact readable header in both themes, a collapsible Rooms drawer with an internal close control on mobile, drawing tools in the bottom dock, and a clear local tracing versus online recognition choice in Import. Show the target floor and replacement consequences before applying a drawing to 3D.

Beta 1 3D editor UX: keep optional library filters collapsible, compact readable model cards, selected-view semantics and visible focus. On phones preserve the project title, scroll secondary header actions, keep floor tabs in one row and make paint scope/search/material choices reachable in one scrolling palette. Do not restore an empty-canvas starter card.

Beta 1 editor polish (September 11, 2026): keep the empty canvas unobstructed with a subtle optional ground guide and a dismissible Build hint. Preserve preview/confirm placement and explicit Move/Rotate modes. Offer room collections, recent confirmed pieces and highlighted filter selections without changing plan history. On phones, use a labeled action sheet instead of horizontal header overflow. Keep optional pinned controls and recent finishes browser-local, separate from saved plans. Recovery notices must describe real failures and Undo must target the exact announced edit. Preserve reduced motion, existing model detail and the separate Beta 2 research site.

Furniture library cleanup (September 11, 2026): use a single Furniture library heading, without Find your next piece. Do not show tag rows beneath model cards or duplicate active-filter chips. Keep the selected options highlighted inside Filters, with Clear all beside the Filters button. Preserve names, dimensions, favorites, search and reversible placement.

Production promotion (September 11, 2026): the user approved merging the reviewed Beta 1 experience into master and publishing it to the original Nook & Nest Site. This promotion retains the production hosting identity and release-only master pipeline, omits temporary Beta storage bootstrapping, and removes Beta branding. The separate Beta 1 and Beta 2 Sites retain their own identities; newer Beta 2 automation research remains isolated.
