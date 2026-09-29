# Personal style, atmosphere and planning drawings

Use **Arrangements → Inspiration** for private moodboards, palettes, framed artwork and fabric samples. Applying a palette or personal surface first creates a preview; applying it records one undo step. Uploaded originals stay in browser storage and are included in a portable project backup. Ordinary share links contain a color placeholder rather than the image, source URL or private board.

Use the sun icon for **Scene moods and sunlight**. Preview morning, rain or evening lighting; adjust lamp warmth and brightness; then apply or discard. Sound is silent until enabled and is session-only. Sun studies accept an explicit date, location, UTC offset and north direction. The offset must be set for the chosen date, including daylight saving time. These are geometric illustrations, not measured daylight or energy assessments. Precise inputs and saved study names are removed from public shares; the resolved light direction remains.

Use **Project → Surfaces & elevations** for finish quantities and wall drawings. Coverage, layers, waste and ceiling assumptions are editable and undoable. Unknown coverage stays unknown. Drawings contain model dimensions, revision, assumptions and a printed scale check. Browser print can produce a PDF; SVG and printable HTML are available without a print dialog. Verify real measurements before ordering or construction.

## Rendering and data limits

- Personal surfaces use at most sixteen unique 512-pixel GPU textures and two concurrent preview decodes. The selected piece and current floor are prioritized. Extra or unavailable images show their chosen fallback color; full originals remain backed up.
- Framed art receives private cloned UVs. Catalog source geometry and other copies are unchanged.
- Atmosphere reuses the existing four-light pool. Rain has 96 bounded drops. Hidden tabs and reduced motion stop continuous effects; sound stops when hidden.
- Panels load on demand. Schema validation uses a compact surface-slot index instead of loading the full model-material catalog on startup.
- Layout alternatives and listing camera stops preserve their chosen atmosphere. Alternatives also preserve private moodboards and quantity assumptions.

## Acceptance evidence

Automated coverage checks solar reference directions, explicit time offsets, preview/apply/discard/undo, stale image loads, GPU texture limits, original mesh preservation, private/public serialization, backup references, polygon quantities, opening deductions and scaled drawings. Browser checks used a synthetic 6 m × 5 m room: 30 m² floor and 53.6359 m² of 2.438 m-high wall faces. CSV, SVG and printable HTML downloads were read back. An uploaded asymmetric artwork image remained upright and complete after reload.

Desktop browser behavior has been checked. Physical printer scale, representative phone/integrated-GPU performance and real-world measurement accuracy are not claimed as tested.
