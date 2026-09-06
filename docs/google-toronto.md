# Google Toronto backdrop

Landscape > Surroundings > Toronto downtown & harbour > City detail > Google Maps enables live Photorealistic 3D Tiles. Standard remains the default and requires no Google requests. View surroundings frames the city; normal zoom brings the editable apartment back into view. Elevation and direction align the city around the apartment.

## Delivery and cost controls

- One renderer/root session per editor lifetime, preserved across floor/furniture edits and backdrop switches. A page reload or explicit new session starts another root request.
- Pause keeps loaded geometry visible and blocks queued requests. Requests already in flight may finish. Hidden tabs and inactive backdrops also suspend new work.
- Camera-driven detail with a 3.5 km downtown distance bound and four simultaneous downloads. Normal renderer ancestors provide coarse fallback while visible detail loads; no bulk city download or offline archive.
- Browser HTTP caching follows Google's response expiry. No shared CDN cache, R2 archive, saved tile data, offline export or background prefetch.
- Sessions stop requesting after 170 minutes and require an explicit restart; no automatic paid refresh or retry loop.
- Server-side GOOGLE_TILES_DAILY_LIMIT defaults to 25 new root requests per UTC day across the entire app. D1 atomically enforces the limit and fails closed. Child tile requests do not decrement it. This is an app limit, not a Google billing guarantee or a limit on other apps using the same key.
- GOOGLE_MAPS_API_KEY is a Sites secret. Only the fixed Google 3D Tiles host is proxied; JSON URLs are rewritten to same-origin routes with the key removed. No key is shipped to the browser or source tree.

For local testing, set NOOK_GOOGLE_KEY_FILE to a local secret text file and run Vite. The loopback-only development proxy has its own 10-root/day in-memory guard. Never commit the file.

## Presentation

Google's photographed daytime textures remain daytime imagery when the apartment switches to night mode. Attribution stays visible below the editor. City geometry cannot be selected or used for furniture snapping. The apartment's original editable geometry remains separate from the geographic tiles.

## Nearby detail and retention

The Google controls offer Lighter (16 px, 256 MiB), Balanced (8 px, 512 MiB), Smooth rotation (8 px, 1024 MiB), and Sharper nearby (4 px, 1024 MiB). Balanced is the default; devices reporting 4 GiB RAM or less start with Lighter. Smooth rotation spends extra memory on retaining visited views rather than increasing geometry detail. These are decoded tile memory estimates, not total browser or GPU memory guarantees. An in-flight tile can briefly exceed the target. No settings can guarantee maximum source detail for every possible view at once.

Full requested detail applies within 600 m of the apartment origin. The permitted screen-space error increases smoothly to four times that target at 2.4 km. Distances use tile bounding volumes so intersecting parent tiles remain traversable. The old cache started shedding unused content above 96 MiB/180 tiles; each new profile retains approximately 85% of its maximum budget before eviction begins. Viewed neighbourhoods therefore remain available longer, subject to memory pressure.

Quality changes update the existing renderer without rebuilding the apartment, changing camera framing, unpausing a paused session, or requesting another root session. Quality and diagnostics are runtime-only, never stored in the apartment/share schema. Connection & memory reports estimated retained data, tile counts, fetches, root sessions and observed frame rate. A first view or a view evicted under memory pressure still needs streaming. Google HTTP expiry, attribution, pause/visibility gates and session limits remain unchanged.

## Validation

### September 6 quality experiment

Exploratory tests used the local app and actual Google streaming in the in-app browser at 1280 × 720. The apartment elevation was 180 m and the View surroundings camera preset was used. No Google tile content was archived. These observations describe this viewport and machine, not a universal performance benchmark.

| Setting | Detail target near home | Observed retained detail | Visible tiles at initial view |
| --- | --- | --- | --- |
| Lighter | 16 px | 222 MiB | 82 |
| Balanced | 8 px | 428 MiB | 188 |
| Sharper nearby | 4 px | approximately 1025 MiB | 520 |

The first comparison switched quality in one session at the same camera framing. It was exploratory, with previously loaded content available, so request totals and frame rates are not presented as controlled cold-start benchmarks.

A separate repeatable sweep used 15-degree increments of Scenery direction with observations at 0, 90, 180, 270 and 360 degrees. Both Balanced and Smooth rotation started at 454 completed fetches after the initial view. Balanced ended its first sweep at 948 fetches; Smooth rotation ended at 803. Repeating the sweep with Smooth rotation ended at 834: 31 additional fetches compared with 349 for its first sweep (about 91% fewer). Retained detail reached 721 MiB. The root-session counter remained at one. This tests view reuse around the apartment origin; actual mouse orbit and right-drag pan were also visually checked separately. New intermediate views still required some detail, so this is not a claim of zero-download or permanently fixed-resolution viewing.

While paused, changing quality and orbiting produced zero new Google network requests in an untruncated browser event capture. Resuming kept the same root session. An unsaved 6 × 4.8 m apartment preview remained separate from the city while zooming down from the overview; it was discarded after inspection. The browser reported no console errors. Streaming was paused at the end of the test.

Worker tests cover the atomic quota, missing configuration, key redaction, URL confinement, session inheritance, byte-preserving delivery and private/conditional caching. Application tests cover WGS84/ECEF alignment without mirroring, saved-plan compatibility and pause/visibility gates.

Browser testing on the local app rendered downtown Toronto, the CN Tower and harbour; an unsaved room/sofa preview remained visible above the city. Pausing produced zero new Google requests while previewing and zooming. Resuming fetched 24 detail tiles and zero new root sessions. Test furniture was not committed.

## Official references

- https://developers.google.com/maps/documentation/tile/3d-tiles
- https://developers.google.com/maps/documentation/tile/policies
- https://developers.google.com/maps/documentation/tile/usage-and-billing
- https://github.com/NASA-AMMOS/3DTilesRendererJS
