# Design QA — Furniture Draft Placement

**Source visual truth**

- `C:\Users\fahad\AppData\Local\Temp\codex-clipboard-bb48eae1-d2f1-41ca-9f98-2328d4598c94.png` — 376 × 285 px Sims placement footprint reference.
- `C:\Users\fahad\AppData\Local\Temp\codex-clipboard-4817a90d-5a7d-4288-8d24-1858f8e79f62.png` — 131 × 111 px Sims floating-control reference.

**Rendered implementation**

- Local route: `http://127.0.0.1:5173/?showcase=detail&item=sofa&qa=placement`
- Screenshot: `C:\Users\fahad\OneDrive\Documents\ChatGPT\furnishing\placement-implementation.png`
- Combined comparison: `C:\Users\fahad\OneDrive\Documents\ChatGPT\furnishing\placement-comparison.png`
- Browser viewport and implementation pixels: 1280 × 720 CSS px at density 1; screenshot 1280 × 720 px.
- Comparison canvas: 1700 × 800 px. Source images were shown at native size, except the 131 × 111 control close-up was enlarged to 262 × 222 for legibility. The implementation remained at its 1280 × 720 native capture size.
- State: a Cloud sofa was dragged from the catalog to a new room position and remained uncommitted with the translucent preview and four placement controls visible.

## Full-view comparison evidence

The combined comparison shows the same essential hierarchy as the references: furniture stays visibly attached to the room while being positioned, a bright green footprint communicates its active draft status, and a compact light control bar floats immediately above the model. The implementation intentionally preserves Nook & Nest's warm cream, sage, rounded-corner design system instead of copying The Sims' styling.

## Focused region comparison evidence

The enlarged Sims control reference and the implementation control bar are readable together in `placement-comparison.png`. Both use icon-only rotation and confirmation actions in a floating light panel. Nook & Nest adds a clearly differentiated terracotta cancel action and provides both rotation directions, matching the requested checkmark, X, and rotation options. The Phosphor icons are optically aligned, consistently weighted, and have 36 px targets.

## Required fidelity surfaces

- Fonts and typography: existing Fraunces/Nunito hierarchy is unchanged; the new control is icon-only and relies on accessible names/tooltips rather than cramped labels.
- Spacing and layout rhythm: the 5 px control gap, 5 px inset, 36 px targets, 15 px radius, and model-relative positioning keep the overlay compact without touching the model or global tool dock.
- Colors and tokens: cream panel, sage confirmation, terracotta cancellation, and green footprint map to the existing Nook & Nest palette while retaining the semantic contrast visible in the reference.
- Image quality and asset fidelity: the live GLB furniture remains the actual preview asset at translucent visibility; it is not replaced by a placeholder, CSS drawing, or proxy silhouette.
- Copy and content: the toolbar's accessible label includes the furniture name; each action has a concise label and tooltip.
- Icons: all four controls use the project's Phosphor icon family and remain recognizable at the captured scale.
- Accessibility and behavior: drag, click/keyboard start, R rotation, Enter confirmation, Escape/Delete cancellation, visible focus, semantic toolbar labels, and undo after confirmation were tested.

## Findings

- No actionable P0, P1, or P2 differences remain. The references are cropped game screenshots rather than a full Nook & Nest screen, so their overall page typography and layout are not direct fidelity targets.

## Comparison history

- Pass 1: no P0/P1/P2 visual finding. The combined view confirmed that the active footprint, translucent real model, nearby control cluster, confirmation emphasis, and compact density communicate the same placement state as the references. No visual fixes were required after this pass.

## Implementation checklist

- [x] Drag from the catalog moves the preview into the room.
- [x] Draft does not increment the saved furniture count.
- [x] Confirm, cancel, rotate-left, and rotate-right controls remain visible after release.
- [x] Confirmation is a single undoable plan edit.
- [x] Keyboard start, focus transfer, rotation, confirmation, and cancellation work.
- [x] Browser console contains no errors or warnings for the tested flow.

## Follow-up polish

- P3: a future collision state could tint the green footprint amber or red when placement is invalid, while keeping the current soft-warning philosophy.

final result: passed
