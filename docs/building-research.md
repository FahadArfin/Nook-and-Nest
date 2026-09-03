# Batch 2 — original doors and stairs

Researched September 2, 2026. Retail/manufacturer references informed generic construction and style vocabulary only. No third-party models, textures, artwork or product branding were copied. Our pieces are original miniature-style Blender models, not replicas or construction specifications.

## Reference families

- [JELD-WEN interior space-saving doors](https://bringithome.jeld-wen.com/interior-doors-space-saver-edition/) and [folding doors](https://bringithome.jeld-wen.com/distinguish-any-home-with-the-right-folding-door/) informed distinct flush pocket pulls and narrow bifold leaves.
- [JELD-WEN internal doors](https://www.jeld-wen.co.uk/products/internal-doors) and [interior door design](https://bringithome.jeld-wen.com/explore-one-of-the-biggest-design-opportunities-in-any-home/) informed flush, Shaker, traditional panel and glazed French-door families.
- [Viewrail floating stairs](https://www.viewrail.com/floating-stairs/), [mono-stringer stairs](https://www.viewrail.com/floating-stairs/mono/) and [FLIGHT buyer guide](https://www.viewrail.com/floating-stairs/flight-buyers-guide/) informed open treads, visible central steel support, return flights and restrained under-tread lighting.

## Delivered collection

Six doors: flush, two-panel Shaker, six-panel, glazed French pair, bifold, pocket. Each uses thick separate frames, inset construction and usable handles/pulls. The frame, door surface, trim and hardware are separate editable/material-color components. Door placement cuts the wall at floor level and follows the existing snap/rotate/confirm flow. These are closed presentation models, with no door swing animation or pocket cavity simulation.

Six stairs: traditional closed-riser, switchback, L-turn, central-stringer floating, wall-supported cantilever and warm LED cantilever. Each has 16 evenly spaced risers, 2800 mm nominal rise, an accurate catalog envelope, editable construction components and a web GLB. Connected stairs scale their top tread to the next floor elevation; handrail height scales with rise in this version. The L-turn model leaves its unused corner clear. Cantilever/open models deliberately do not claim safety-ready guards or structural support design.

## Verification and limitations

`tools/blender/verify_building.py` checks each editable source's tread count and heights, separately from overall model-envelope checks. Headless Babylon imports verify that exported stair exit orientation agrees with the floor-opening and landing calculations. Unit/UI tests cover room measurements, trimmed cells, save/share compatibility, door cutouts, wall-section finishes, reversible drafts, stair connection settings and undo/redo.

Landing, width, steepness, rise and low-ceiling messages are conservative layout hints. They do not replace architectural measurements, detailed headroom analysis, engineering or local building-code review. Entered room dimensions measure the floor footprint; they are not inner-face wall clearances.
