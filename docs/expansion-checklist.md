# Requested expansion — September 2026

Public release v16 was approved and published on September 3, 2026 at https://nook-and-nest.fwad101.chatgpt.site.
Online project saves are active with private sign-in-backed snapshots and restore-as-copy history.

## Editor and persistence
- [x] 1 Preserve camera on furniture selection and editing.
- [x] 2 Drag from library without initial centre placement.
- [x] 3 Solid walls by default, explicit transparency control.
- [x] 4 Paint individual wall sections and floor regions. Batch 2 also splits long interior walls into separately paintable tile-length sections.
- [x] 6 Model thumbnails for every catalog piece.
- [x] 7 Per-material colors and custom color selection.
- [x] 8 Smooth camera rotation, panning and zoom.
- [x] 13b Private online multi-project saving, new/open/older saves. Database migration, real hosted sign-in, save/reopen and older-version restore-as-copy verified. A physical second-device check remains an acceptance follow-up.
- [x] 14 Floor actions beside bottom-left floor tabs.
- [x] 15 Dark mode.
- [x] 16 Opt-in light/fuller grass using bounded, non-pickable thin instances. Floors and furnishing footprints are excluded.
- [x] 17 Measured room rectangle inputs in feet/metres, clipped edge tiles, preview/confirm/cancel and one-step undo.
- [x] 23 Five opt-in distant Blender dioramas: city, suburban, rural hills, farm and fantasy medieval. Plain ground remains default.
- [x] 26 Backsplash creation: subway, stacked-tile and slab panels, wall snapping, width/height/elevation, independent tile/grout colors, stone finish choices.

## Original Blender collections
- [x] 5 Three TV sizes, audio speakers/soundbars, varied TV stands and surface placement.
- [x] 9 Outdoor library collection: flowers/planters, hedge/shrub, spruce/maple/sakura, patio seating/tables/parasol, gas/kettle BBQ and fire bowl.
- [x] 10 Five additional cozy rugs: diamond, kilim, jute, arch and broad checker.
- [x] 11 Three standing display shelves and four independent collectibles. Books/small plants support actual shelf snapping; inspector offers fitting shelf levels/cubbies, with undo.
- [x] 12 Stair library: conventional, switchback, L-turn, floating, cantilever, lit. Adjacent-floor connections and reversible upper openings; basic layout warnings, not engineered/code-approved stairs.
- [x] 13a More door types: flush, Shaker, six-panel, French glazed, bifold, pocket. Wall-snapped closed models with real apertures, material choices and part colors; not animated doors/pocket cavities.
- [x] 18 Six cabinet styles plus chimney, under-cabinet and microwave hoods. New base worktops support finish changes and appliance placement.
- [x] 19 Sliding and double-door closets, three independent walk-in modules, wide fluted dresser and tall chest. Closed/static doors, not animated storage.
- [x] 20 Three new bunk beds (twin/full, storage, low) and three bedside tables (cane, floating, drum).
- [x] 21 Large valley painting and three original music/anime-inspired/sports posters, with embedded generated artwork and colorable frames.
- [x] 22 Mirrored chaise sectionals, a U sectional, and foam-style boneless loveseat/chaise.
- [x] 24 Wall-free cobble, concrete, brick and deck modules plus separate stepping stones. Duplicate/resize modules and rest furniture on supported paving.
- [x] 25 Seven independent countertop pieces (toaster, espresso, drip coffee, knife block, microwave, mixer, glass air fryer) plus dome and linear pendants.

## Verification
- [x] First batch: 88 unit/integration checks, TypeScript, build, 4 static Worker checks. Repeat after further expansion.
- [x] Media batch: inspected model previews, fixed compact speaker cap intersection, tested exported envelopes and polygon budgets. Repeat for subsequent collections.
- [x] Local SQLite authorization/isolation, version retention and save conflict tests. Hosted anonymous requests reject private access; real signed-in save/reopen and history recovery also verified. Separate real-user account isolation was not browser-tested.
- [x] Batch 2: 108 unit/integration checks, TypeScript, production build, 4 static Worker checks. Headless Babylon GLB import checks stair orientation; editable Blender sources have 16 even risers ending at the specified rise.
- [x] All 12 building models have original editable Blender sources, dimension-checked GLBs and inspected thumbnails. Loading/error fallbacks added.
- [x] Batch 3: 120 unit/integration checks, TypeScript, production build, 4 hosting checks; 28 original Blender sources, normalized GLBs, material-color metadata and inspected thumbnails. No browser interaction testing claimed.
- [x] Batch 4: 134 unit/integration checks, TypeScript, production build, 4 hosting checks; 27 original Blender sources, inspected previews, dimension/size/triangle-checked GLBs, actual Babylon import checks and source-geometry shelf-plane checks. No browser/hardware testing claimed.
- [x] Batch 5: 148 unit/integration checks, type check, production build and 4 hosting checks. 27 original catalog models and five background assets, inspected previews, normalized GLBs, real importer and thin-instance wiring checks. Added 0.25 m close zoom, distance-aware panning, zoom buttons and explicit focus-selected control.
- [ ] Interactive browser/hardware performance verification of the combined expansion before production acceptance.
- [x] Batch 6 download pass: focused Babylon imports and glTF 2-only loading reduce the main bundle from roughly 5.9 MB / 1.3 MB gzip to roughly 2.34 MB / 596 kB gzip. Explicit picking, shadows, outlines and thin-instance registrations are retained. Release verification enforces a 3 MB / 800 kB gzip entry budget and checks all 216 model/source/preview sets.
- [x] Batch 6 browser regression: separate approved QA project; keyboard draft/rotate/confirm, click-to-reselect, close focus/zoom/recolor, 150-piece loading, two floors and local reload. No console warnings/errors observed. The automation browser reports about 1.2 FPS despite sampled CPU render times around 9 ms; this is not accepted as a reliable integrated-GPU performance result.
- [x] Batch 6 approved publication: v16, source commit `6012fc827abe7dfe3371fd8382dbca7c8ae4b01f`, deployment `appgdep_6a992b455800819191bd368177e6e6f4`. All 148 tests, type check, production build and 4 hosting checks passed. DB migration applied; public assets and unauthenticated API security smoke-tested.
- [x] Hosted online QA: the approved 150-piece/two-floor test project was saved twice. Canonical geometry/placement data matched the fixture exactly. Version 1 opened as a separate local copy while version 2 remained online. No application console errors observed; the sign-in provider emitted a non-application telemetry-size warning.

## Current checkpoint

Batches 1–6 are published in v16, including outdoors/settings, close detail zoom and private online snapshots. The catalog contains 216 original Blender pieces: the existing 111, 11 media, 12 doors/stairs, 28 kitchen/storage, 27 indoor furniture/décor and 27 outdoor additions. Every card has a rendered preview. Five additional background dioramas are scenery-only assets. Ordinary integrated-GPU performance and physical second-device acceptance remain unverified; the low automation-browser frame rate is not a performance pass.

Open **Garden & surroundings** in the room panel for optional backgrounds, grass and the Outdoor library shortcut. Drag on the lowest floor to place outside at ground level. Use wall-free patio/path modules rather than architectural floor painting for outdoor paving. The camera can now orbit down to 0.25 m instead of 4 m; zoom buttons and **Focus selected furniture** are on the view toolbar. Selection/recoloring still preserves zoom. See outdoor-research.md for details and boundaries.

New pieces are in their existing Living, Bedroom, Storage and Decor categories, grouped into the appropriate library types. Select a book, small plant or collectible and use **Rest on a shelf** for a fitting level or cubby, or drag directly onto a usable shelf. The dropdown centers and rotates the piece in one undo step; each decoration remains independent of its supporting shelf. See interior-research.md for model types, sources, exact original artwork prompts and checks.

Use **Add kitchen backsplash** in the room-finishes panel to browse the three backsplash styles. They use the regular draft/confirm workflow and can be resized/painted in the inspector. Tile proportions scale when a panel is resized; duplicate panels to preserve the nominal tile size. The slab uses the granite/marble/laminate/concrete picker. Cabinets and hoods snap against walls without opening them; small appliances snap onto supported counters. Pendants offer a height-from-floor field. Closet modules are independent pieces for custom runs and walk-in arrangements. See kitchen-research.md for original-model references, checks and limitations.

Use **Exact room size** in the right-hand room panel, enter feet/inches or metres, select **Place measured room**, click a starting corner in the scene and confirm with the nearby checkmark. The entered size describes the floor footprint, not clear space between inner wall faces. Boundary tiles are trimmed instead of rounding the room to the grid. Changing display units no longer changes the grid or rescales existing buildings.

Doors and stairs are catalog categories and use the existing drag/draft/confirm placement. A stair connects to the next floor by default when available; the inspector can disconnect it or choose the adjacent floor. Openings are derived from placements, so moving/deleting/disconnecting restores underlying floor tiles without destructive edits. L stairs reserve only the L-shaped area. Stair widths/depths and rise are adjustable; rail heights currently scale with rise. No guarantees of building-code compliance, complete headroom simulation or structural safety.

Online saves are explicit snapshots, while local edits autosave. Protected static handoff source files are unchanged; see private-project-saves.md for the required staging of the DB-enabled generated manifest before release.

## Remaining acceptance checks

No further feature batch is scheduled in this expansion. Remaining checks are smooth interaction on ordinary integrated graphics and opening the signed-in library from a physical second device. The approved, clearly named Batch 6 QA project and its recovery copy are retained; existing apartment data was not overwritten.
