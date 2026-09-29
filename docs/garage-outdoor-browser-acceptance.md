# Garage, outdoor and material acceptance

The September 29, 2026 extension is reviewed in separate, unsaved development scenes. These observations cover the application's shared loading, material and placement paths; individual construction acceptance is recorded in the garage, outdoor and sofa render audits. They do not substitute for the required production checks or deployment receipt.

## Browser observations

- The outdoor scene loads twelve independent pieces: a furnished pergola, a lantern on its measured conversation table, an outdoor cooking area, planting, and a pool with separate ladder and lounger. The pool accessories remain on ground outside the patio. Day and night UI controls remain readable.
- Keyboard selection of the new lantern starts a reversible draft without changing the twelve-piece count. Confirmation creates the thirteenth piece; one undo restores twelve.
- The lantern's **Rest on a shelf** chooser places it on the preparation cabinet at 900 mm. A single undo returns it to its original table at 420 mm. Only the lantern moves.
- The garage scene loads twelve pieces, including the modeled leaf, frame and hardware of the glazed garage door, its original overhead-track envelope, the hutch, drawer base, tall cabinet, independent drill and charger, sink, cord reel, tire rack, folding bench, service cart and compressor.
- The glazed door leaves a visible wall opening. Hiding all walls hides the door; showing all walls restores the door and aperture. Solid-wall utility fixtures stay independently visible according to the existing wall-decor behavior.
- The drill offers the actual clear workbench, lower shelf, upper hutch, cabinet, folding bench and cart tray surfaces. Choosing the upper cart tray places it at 857 mm with its support offset; undo returns it to the workbench. The separate charger remains at 900 mm throughout.
- A staged per-material workbench edit using the canonical `garage-slate-powdercoat` key visibly changes the frame and pegboard to green while retaining the natural worktop and metal hardware. The proposal commits as one reviewable edit in the unsaved fixture.
- Representative `slat-day-sofa` recoloring changes upholstery and coordinated seams together, retains wood grain and does not reset zoom. This is shared runtime acceptance, not a claim that every sofa was individually inspected in the browser; all 35 have separate four-view Blender acceptance.
- Honey oak, large marble slabs, garage rubber, white ceramic and mineral plaster were reviewed at room scale. World-space repeats retain consistent scale across floor cells. Moss, rose, charcoal and oatmeal carpet cards retain visibly different tint colors, including the current/quick finish controls.
- No asset-loading errors were observed in these browser scenes. Two earlier Babylon empty-position warnings were present in the session log; they are not represented as a clean all-warning log.

The preview exit guard has a focused regression: leaving a showcase does not save its fixture or change the previous active local project. Starting and saving a real project afterward still works normally.

## Evidence and limits

Browser screenshots are retained with the release evidence under `E:/Codex-releases/garage-outdoor-realism/review/`, including `garage-door-browser.png`, `garage-recolor-browser.png`, `outdoor-browser.png`, `sofa-recolor-browser.png`, `rubber-ceramic-browser.png` and `carpet-swatches-browser.png`.

The [household report](household-collection.md), [garage research](garage-collection-research.md), [outdoor research](outdoor-collection-research.md), [sofa audit](sofa-realism-audit.md) and [material research](realism-material-research.md) distinguish fixed authored equipment from functional architecture and list source/licensing evidence. Tools, pool equipment, awnings, pergola blades and recliners do not simulate mechanical operation. Surface normals provide light response without adding displacement geometry.

Final integrated tests, production costs and publishing evidence are recorded separately after the complete export and current-master integration pass.
