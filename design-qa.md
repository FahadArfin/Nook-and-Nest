# Nook & Nest Design QA

## Evidence

- Source references: `qa/source-wide.png` (924x420), `qa/source-furniture.png` (521x353), and `qa/source-room.png` (711x514).
- Implementation capture: `qa/implementation-1440x900.png` at a 1440x900 CSS-pixel viewport and DPR 1.
- Full comparison: `qa/design-qa-comparison.png` (1800x1645).
- Capture state: a furnished two-floor sample project in the default cozy isometric view, with the furniture catalog and project summary visible.
- Normalization: none. The sources are art-direction references rather than a UI mock, so the comparison evaluates mood, materials, composition, camera, and overall visual character rather than pixel-identical layout.
- Focused-region evidence was not needed: the full-size implementation capture keeps the central diorama and furniture silhouettes large enough to inspect without scaling ambiguity.

## Required Surface Review

- Typography: Fraunces gives the product name and headings a gentle storybook character; Nunito keeps measurements, tools, and inspector controls highly readable. The source images contain no interface typography to reproduce.
- Spacing and density: the desktop shell uses balanced 292px side panels around the canvas. Tool groups, catalog cards, and inspector rows remain distinct without crowding or clipping at 1440x900.
- Color and contrast: cream panels, sage controls, terracotta accents, and muted walnut text support the requested warm handcrafted palette. Active states, focus rings, warnings, and labels remain distinguishable without relying on color alone.
- Imagery and 3D assets: all furniture and architecture are original procedural Babylon.js assemblies. The generated Nook & Nest app icon is original. No source artwork, models, shaders, or branding are copied.
- Copy: labels consistently use plain renter-oriented language, measured dimensions, and no-failure phrasing.
- Icons: Phosphor icons are used consistently at standard sizes; interactive icon buttons have labels or accessible names.

## Functional and Visual Checks

- Onboarding, apartment creation, furniture placement, selection, dragging, rotation, duplication, color variants, dimension editing, floor switching, tile painting, top view, dollhouse view, undo/redo, import/export, sharing, help, autosave/reload, and the narrow-screen gate were exercised in the browser.
- A share URL was opened in a fresh browser context and reproduced the document as an editable local copy.
- The fresh-browser verification pass reported no console errors.
- Automated verification passed: TypeScript check, 7 domain tests, production build, and 4 Sites worker tests.

## Comparison History

1. The first browser capture showed only the loading shell because the scene effect ran before the canvas existed. The scene lifecycle was corrected and rechecked.
2. The initial camera framed the apartment too loosely and the lighting washed out the materials. Auto-framing, exposure, ambient light, sunlight, and camera-facing wall cutaway were tuned against the references.
3. Early furniture read as overly boxy. Rounded procedural details and softer silhouettes were added to the reusable furniture assemblies.
4. The 1024px layout compressed the editor below a useful working width. A polished read-only desktop-width gate now appears below 1100px.
5. Painting and erase targeting were rechecked after adding the invisible edit grid; exposed tiles can be added outside the starting footprint and walls no longer intercept erase actions.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3 accepted for this vertical slice: procedural furniture and surface variation are intentionally less detailed than the cinematic source renders. The warm palette, softened geometry, meadow framing, lighting, and calm diorama composition establish the requested direction without copying proprietary assets.

final result: passed
