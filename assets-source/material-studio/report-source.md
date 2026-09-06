# Nook & Nest material studio research
Audience: Nook & Nest users planning interior finishes. Research date: 2026-09-06.
Scope: wall-paint workflow, named screen colors, contemporary flooring and original app textures. North American reference products; visual planning rather than installation specifications.

## Direct answer and implementation
Keep the painting destination visible above the scrollable library. A persistent brush handles multiple walls without returning to the panel; explicit batch actions cover all walls, interior partitions and outer boundaries on the current floor. Keep named paint collections independent of the physical application scope. Preserve old saved finishes and undo behavior.

Provide 27 current manufacturer RGB paint studies in six named families, 32 new flooring finishes from 16 original source surfaces, and eight wall slabs. Large tiles use 60 × 120, 80 × 160 and 90 × 90 cm repeats. Floors retain rectangular section painting and whole-floor confirmation.

## Evidence and design synthesis
- [Sherwin-Williams Top 50](https://www.sherwin-williams.com/en-us/color/color-collections/top-50-colors) favors whites, neutrals, greens, blues and dark accents, and provides distinct exterior inspiration. Individual current color pages supply RGB via JSON-LD. Our 27-color study includes complementary colors; it is not the entire Top 50. Every swatch's direct provenance URL is in src/paintCollection.json. Screen appearance varies with lighting and display; physical samples remain necessary for purchasing.
- [Blackburn's Interiors, February 20 2026](https://blackburnsinteriors.com/flooring-tips/hardwood-flooring-trends/) describes light white oak/ash/maple, wider planks, warm mid-tones and matte parquet. This is a retailer's qualitative regional trend discussion, not quantified national market research. We use it as visual inspiration for eight distinct wood surfaces.
- [Cotto d'Este bathroom trends](https://www.cottodeste.us/journal/top-9-tile-trends-2026-modern-bathroom) promotes large formats, mineral looks, marble veining, travertine and matte floor finishes. This manufacturer perspective supports our rectangular marble and mineral collection. It does not establish universal popularity or physical suitability of a simulated finish.
- [Crossville, April 9 2026](https://www.crossville.com/product-design-trends/coverings-2026-top-10-tile-trends/) highlights quartzite, jade greens, matte stone, terrazzo and understated mineral surfaces. Our slate, quartzite, travertine, limestone and terrazzo are original visual interpretations, not downloaded manufacturer maps or exact product replicas.

## Evidence gaps and reconciliation
Current color-page RGB supersedes older manufacturer PDF values when they differ; Smoky Blue is one example. Geometry categories describe partition versus boundary walls, not separately paintable sides of the same wall. The current app paints both faces of a wall plate. Manufacturer marketing supports visual direction, not claims of durability, safety or nationwide sales ranking. No photos were reused as app textures.

## Discovery and stop decision
Read all four user references; followed stone/marble and hardwood manufacturer links; delegated current color-page retrieval and spot-checked the collection and Alabaster in the parent research. Evidence supports the requested visual families and interface decisions; additional trend articles would repeat the same categories. update_plan tool was unavailable, so the plan was tracked in this research source: discovery complete, synthesis complete, implementation and local automated verification complete; publication follows the repository release checks.

## Asset provenance
Built-in image generation produced assets-source/material-studio/flooring-atlas.png. The exact prompt requested a 4 × 4 overhead albedo atlas with eight wood/parquet and eight mineral surfaces, no labels, perspective or shadows. scripts/prepare-material-studio.py deterministically segments it, adds one-pixel grout edges to tile variants and writes lossless WebP assets. Original atlas retained. Total added production textures: 2,764,766 bytes. Runtime meshes unchanged; textures load only when used. Source image was visually inspected across all sixteen cells. Material previews are visual studies, with repeated texture patterns rather than photogrammetric PBR scans.
