# Modular furniture placement

Select a railing, kitchen cabinet, counter or window and choose the **Extend** icon in its floating toolbar. Drag either end handle or enter a length. **Fit wall** fills the current wall/edge. The checkmark saves the result; cancel keeps the original. A run is one selectable placement, with one undo step. Each run repeats the original Blender geometry in evenly sized sections (at most 32), retaining finishes and material color controls. Sink and corner units remain separate fixtures.

Railings magnetically align to the inside of exposed floor edges, even where the wall has been removed. Base cabinets and counters snap within 350 mm of a wall; adjacent units align their backs and meet end-to-end. Drag upper cabinets onto a visible wall at the desired height. Hidden walls remain excluded from pointer placement.

Use the single Rotate toggle in the floating toolbar to enable rotation. A gold ground ring marks the active mode; drag in the scene to rotate. Turn it off to restore normal camera gestures. Horizontal movement gives continuous half-degree control; Shift uses 15-degree steps. Wall openings and mounted fixtures remain wall-aligned. A completed turn creates one undo step; blur/cancel restores the preview angle.

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

Selecting a new piece gently focuses it over 850 ms (instant with reduced motion). Automatic focus uses a nearby section of long runs, adapts to the viewport aspect ratio, and never zooms outward. Manual camera input cancels the focus transition; wheel zoom remains attached during furniture dragging. Focus selected furniture also works on unconfirmed drafts.
