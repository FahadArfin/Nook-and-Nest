# Google Toronto backdrop

Landscape > Surroundings > Toronto downtown & harbour > City detail > Google Maps enables live Photorealistic 3D Tiles. Standard remains the default and requires no Google requests. View surroundings frames the city; normal zoom brings the editable apartment back into view. Elevation and direction align the city around the apartment.

## Delivery and cost controls

- One renderer/root session per editor lifetime, preserved across floor/furniture edits and backdrop switches. A page reload or explicit new session starts another root request.
- Pause keeps loaded geometry visible and blocks queued requests. Requests already in flight may finish. Hidden tabs and inactive backdrops also suspend new work.
- Camera-driven detail, no sibling prefetch, a downtown distance bound, four simultaneous downloads and a bounded 256 MiB estimated in-memory tile cache.
- Browser HTTP caching follows Google's response expiry. No shared CDN cache, R2 archive, saved tile data, offline export or background prefetch.
- Sessions stop requesting after 170 minutes and require an explicit restart; no automatic paid refresh or retry loop.
- Server-side GOOGLE_TILES_DAILY_LIMIT defaults to 25 new root requests per UTC day across the entire app. D1 atomically enforces the limit and fails closed. Child tile requests do not decrement it. This is an app limit, not a Google billing guarantee or a limit on other apps using the same key.
- GOOGLE_MAPS_API_KEY is a Sites secret. Only the fixed Google 3D Tiles host is proxied; JSON URLs are rewritten to same-origin routes with the key removed. No key is shipped to the browser or source tree.

For local testing, set NOOK_GOOGLE_KEY_FILE to a local secret text file and run Vite. The loopback-only development proxy has its own 10-root/day in-memory guard. Never commit the file.

## Presentation

Google's photographed daytime textures remain daytime imagery when the apartment switches to night mode. Attribution stays visible below the editor. City geometry cannot be selected or used for furniture snapping. The apartment's original editable geometry remains separate from the geographic tiles.

## Validation

Worker tests cover the atomic quota, missing configuration, key redaction, URL confinement, session inheritance, byte-preserving delivery and private/conditional caching. Application tests cover WGS84/ECEF alignment without mirroring, saved-plan compatibility and pause/visibility gates.

Browser testing on the local app rendered downtown Toronto, the CN Tower and harbour; an unsaved room/sofa preview remained visible above the city. Pausing produced zero new Google requests while previewing and zooming. Resuming fetched 24 detail tiles and zero new root sessions. Test furniture was not committed.

## Official references

- https://developers.google.com/maps/documentation/tile/3d-tiles
- https://developers.google.com/maps/documentation/tile/policies
- https://developers.google.com/maps/documentation/tile/usage-and-billing
- https://github.com/NASA-AMMOS/3DTilesRendererJS
