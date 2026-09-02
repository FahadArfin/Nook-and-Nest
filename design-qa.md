# Design QA — Reselect Furniture Toolbar

**Source visual truth**

- `C:\Users\fahad\AppData\Local\Temp\codex-clipboard-be85a23d-c23b-4cbf-b91d-7f3b2c4b6b00.png`
- Source dimensions: 176 × 59 px at its supplied density.
- Target anatomy: compact cream floating bar with terracotta X, rotate-left, green checkmark, and rotate-right buttons.

**Rendered implementation**

- Local route: `http://127.0.0.1:5173/?showcase=detail&item=sofa&flow=reselect2`
- Full screenshot: `C:\Users\fahad\OneDrive\Documents\ChatGPT\furnishing\selected-toolbar-implementation.png`
- Focused toolbar crop: `C:\Users\fahad\OneDrive\Documents\ChatGPT\furnishing\selected-toolbar-focus.png`
- Combined comparison: `C:\Users\fahad\OneDrive\Documents\ChatGPT\furnishing\selected-toolbar-comparison.png`
- Browser viewport and full screenshot: 1280 × 720 CSS px at density 1; 1280 × 720 implementation pixels.
- Focused implementation crop: 211 × 154 px, including a 20 px context margin around the 171 × 114 toolbar.
- Comparison canvas: 452 × 215 px. The 176 × 59 source and 211 × 154 implementation crop are both shown at native pixel size; no density scaling was applied.
- State: a newly placed Little loveseat was confirmed, left deselected, then clicked again to reopen its model-anchored editing toolbar.

## Full-view comparison evidence

The full implementation capture shows the selected loveseat outlined in green, the control cluster anchored above it, and the precision inspector open at the right. The overlay stays within the room viewport and does not collide with the global view controls or bottom tool dock.

## Focused region comparison evidence

The combined comparison shows that the primary control row matches the supplied reference's order, density, rounded cream container, muted terracotta cancel/remove action, pale rotation actions, and green confirmation action. The implementation adds a separated two-row color grid beneath the reference-matched row so the new color requirement is directly available without replacing or weakening the supplied control anatomy.

## Required fidelity surfaces

- Fonts and typography: the toolbar remains icon-only like the source. Accessible names and native tooltips carry the action text without introducing visual labels or wrapping.
- Spacing and layout rhythm: 36 px primary targets, 5 px gaps, 5 px container inset, and a 15 px radius reproduce the source's compact rhythm. The color grid is separated by a light divider and uses consistent 24 px targets.
- Colors and visual tokens: cream, terracotta, pale sage-gray, and green preserve both the source semantics and Nook & Nest's existing tokens. Selected color receives a dark-green focus ring and white check.
- Image quality and asset fidelity: the selected object remains the actual GLB furniture model. The controls use the project's Phosphor icon set; no placeholder, CSS drawing, emoji, or handcrafted SVG was introduced.
- Copy and content: concise accessible labels cover remove, both rotation directions, done, and all named color variants.
- Accessibility and behavior: the toolbar is a semantic toolbar; the swatches are a labeled group; controls have visible focus, labels, titles, and color-independent selected checkmarks.

## Findings

- No actionable P0, P1, or P2 differences remain. The added color grid is an intentional extension required by the user rather than drift from the reference.

## Comparison history

- Pass 1: the supplied reference and focused implementation crop were placed in the same comparison image. The reference-matched primary row is visually faithful and the added swatches are clearly subordinate, so no P0/P1/P2 visual fix was required.

## Primary interactions tested

- Confirming a newly placed item closes the placement UI and leaves the object deselected.
- Clicking an existing object opens the anchored edit toolbar and synchronized inspector.
- Rotate-right changes the inspector value from 165 degrees to 180 degrees.
- Choosing clay updates the model and the inspector's active color.
- Done closes the edit toolbar without removing the item.
- Reclicking the same object reopens the toolbar.
- X removes the object, updates the piece count, and leaves Undo enabled.
- Furniture remains selectable through camera-facing faded walls.
- Browser console errors and warnings checked: none.

## Implementation checklist

- [x] Reopen controls by clicking placed furniture.
- [x] Rotate left and right from the floating toolbar.
- [x] Change any of the eight furniture colors from the floating toolbar.
- [x] Remove furniture with the X action.
- [x] Close the toolbar with the green checkmark.
- [x] Keep the detailed inspector synchronized.
- [x] Preserve undo, keyboard shortcuts, and saved-plan behavior.

## Follow-up polish

- No P3 follow-up is required for this interaction.

final result: passed
