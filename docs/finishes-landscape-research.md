# Finishes and Toronto landscape expansion

## Delivered design
38 new floor finishes and 16 new wall finishes; generic popular paint families and a hue/saturation wheel with brightness and hex entry. Marble-look slabs repeat at 60 x 120 cm or 90 x 90 cm in world space; painted sections retain regional scope. Original generated texture atlases remain in assets-source/finishes and can be regenerated/split with scripts/prepare-finish-textures.py. No retailer photographs copied.

Asset generation briefs: (1) 4x4 original material atlas: porcelain, marble checkerboard, sage hex, blue encaustic, subway, clay herringbone, travertine, terrazzo; oat loop, charcoal cut, rose plush, cream berber, moss loop, navy rib, taupe chevron and ivory diamond carpets. (2) 4x4 atlas: natural oak, walnut, parquet, cherry, limestone, brick, beadboard, slate, botanical/pinstripe/art-deco wallpaper, plaster, zellige and small mosaics. (3) 2x2 large marble atlas: warm golden-veined white, silver-veined white, warm taupe and dark noir. Soft tactile original materials, face-on tileable samples, no text or perspective.

## Sources and design research
- Artistic Tile kitchen floors: https://www.artistictile.com/collections/kitchen-floor-tile — large-format marble appearance and narrow joints.
- Benjamin Moore popular colors: https://www.benjaminmoore.com/en-us/paint-colors/most-popular — neutral paint families; presets are generic approximations, not brand formulas.
- Daltile patterns: https://www.daltile.com/home/how-to/floor-patterns/wall-and-backsplash-tile-patterns
- Shaw carpet construction: https://costco.shawfloors.com/flooring/how-to/carpet-how-to-s/how-it-s-made/types-of-carpet-construction
- Toronto waterfront context: https://www.destinationtoronto.com/neighbourhoods/waterfront-and-toronto-islands/

## Real geographic scenery
Overture 2026-08-19.0 buildings and building parts in bbox [-79.425,43.625,-79.35,43.675]; OSM street/park ways and Lake Ontario multipolygon relation 1206310. Footprints use a local metre projection with origin [-79.3825,43.6400]. The model contains roughly 19,600 building footprints plus 6,000 parts; exact counts and fallback-height policy are in public/data/toronto/manifest.json. Geometry is illustrative massing, not photogrammetry. Facade colors, night window patterns and missing heights are estimated. Source extracts and geographic derivatives are ODbL; in-app credits link to downloadable source data and reconstruction scripts. The Blender file is retained.

Reproduce: install overturemaps and shapely; download building and building_part with --bbox=-79.425,43.625,-79.35,43.675 -r 2026-08-19.0 -f geojson into assets-source/geodata; run fetch-toronto-osm.py, fetch-toronto-lake.py, prepare-toronto-scenery.py; run Blender with tools/blender/build_toronto_scenery.py. Downloaded gzip sources in public/data/toronto can instead be decompressed into assets-source/geodata without network access. Model coordinates stay in metres. Geographic backdrop is non-pickable and does not change the apartment.

## Photogrammetry investigation
No verified freely redistributable citywide photo-textured Toronto mesh was found in the reviewed sources. Official City 3D Massing is an open geometry improvement candidate: https://open.toronto.ca/dataset/3d-massing/ . Toronto-3D is research roadway LiDAR with CC BY-NC 4.0, not an unrestricted textured skyline: https://github.com/WeikaiTan/Toronto-3D . Google Photorealistic 3D Tiles is a separate licensed streaming route, not a bundled open asset: https://developers.google.com/maps/documentation/tile/overview and https://developers.google.com/maps/documentation/tile/policies . No Google imagery was downloaded or reused.

## Verification
331 tests pass with two workers, including custom paint save/share/undo, actual model planting drafts, wall height/floor compatibility, terrain foundation continuity, geographic source manifest and day/night emission without plan mutation. Production build, Sites worker checks and lossless model compression round-trip checks pass. Browser checks: marble repeats, paint wheel layout, live plant models and anchored check/X with one-step undo, Toronto shoreline/day/night and no console errors. City asset compresses from about 64 MB to 21 MB; full release remains below the hosting size cap. Other scenery remains original stylized modeled landscapes, not surveyed locations.
