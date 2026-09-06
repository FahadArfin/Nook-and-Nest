# Modular furniture placement

Select a railing, kitchen cabinet, counter or window and choose **Extend**. Drag either end handle or enter a length. **Fit wall** fills the current wall/edge. The checkmark saves the result; cancel keeps the original. A run is one selectable placement, with one undo step. Each run repeats the original Blender geometry in evenly sized sections (at most 32), retaining finishes and material color controls. Sink and corner units remain separate fixtures.

Railings magnetically align to the inside of exposed floor edges, even where the wall has been removed. Base cabinets and counters snap within 350 mm of a wall; adjacent units align their backs and meet end-to-end. Drag upper cabinets onto a visible wall at the desired height. Hidden walls remain excluded from pointer placement.

Hold the right mouse button in the scene with a selected piece or placement preview to rotate it. Horizontal movement gives continuous half-degree control; Shift uses 15-degree steps. Wall openings and mounted fixtures remain wall-aligned. A completed turn creates one undo step; blur/cancel restores the preview angle.

Door searches use the Doors category and do not match outdoor furniture or French-door refrigerators. Other terms match normalized words/prefixes with plural and synonym handling. New floors use pale white walls; saved explicit finishes are unchanged.

The 2400 mm solarium now starts at floor height, fitting the default 2438 mm room. Opening dimensions are editable before confirmation. The original wall cabinet, modern upper cabinets and luxury wall ovens now all participate in the same wall-mounting rules.

## Performance and compatibility

- Pointer movement updates the draft transform directly without writing the plan or rerendering the React catalog each time.
- Draft-only scene updates skip terrain, scenery, architecture and placed furniture.
- Model load completion refreshes only placements using the newly loaded catalog IDs.
- Committing a window aperture keeps existing floor tiles and unrelated furniture nodes. Only wall geometry is rebuilt when apertures change.
- Wall boundary/run calculations cache immutable floor data.
- Preview solids use 92 percent visibility, avoiding costly per-mesh outlines while preserving authored glass transparency.
- Optional `moduleRun` is saved with the existing width, position, rotation and material fields. Original placements without it keep their authored single-model behavior.

Regression coverage exercises real Babylon node identity, wall/window placement, pointer rotation events, extension end geometry, category search, persistence, confirmation, cancellation and undo.
