# Toronto aerial roof imagery

Toronto's 2022 8 cm orthophoto service is exported as one bounded 4096 x 4096 JPEG (about 5 MB compressed, 85 MB GPU memory with mipmaps). The delivered overview resolution is about 1.5-2 metres per texel, not the source's native 8 cm. Roofs and bounded ground surfaces share it. Other scenery, apartment geometry, picking and saved plans remain unchanged. This is aerial texture projection, not photogrammetry. Photographic shadows remain baked in, tall roofs can lean in the source photography, and 2022 imagery can disagree with 2025 building surfaces.

Source: https://open.toronto.ca/dataset/web-map-services/
Licence: https://open.toronto.ca/open-data-licence/
Attribution: Contains information licensed under the Open Government Licence – Toronto.

Reproduce: request the service URL in public/textures/toronto/aerial-2022.json with /export?bbox=-79.425,43.625,-79.35,43.675&bboxSR=4326&imageSR=4326&size=4096,4096&format=jpg&f=pjson. Download the returned href to aerial-2022.jpg and retain the actual returned extent in the metadata JSON. The server adjusts the extent for aspect ratio, so never assume the requested bbox is the image extent.

The full-resolution conversion is retained locally at assets-source/geodata/backdrop-city-full.blend; the tracked assets-source/blender/backdrop-city.blend contains the editable browser geometry. The renderer derives planar roof UV coordinates from the original mesh positions using exactly the geographic projection in prepare-toronto-scenery.py. A single aerial texture is shared across roof and ground materials, mipmapped, non-repeating and owned by the cached city asset. Image-load failure retains the original roof colors. No per-frame geometry updates or per-building HTTP requests.

## City 3D surfaces
The 2025 City Context Massing multipatch database replaces the older extruded building surfaces in this bounded backdrop. OSM roads, parks and water remain. The database filename says WGS84 but each layer's actual CRS is EPSG:3857; conversion uses layer metadata. Source heights are retained above the same -80 m ground datum. Missing geometry is not invented. A clear area protects the editable home. Original Overture extracts remain downloadable for historical reproducibility.

Reproduce with `python scripts/prepare-toronto-massing.py` after extracting the 2025 multipatch ZIP from the City's 3D Massing dataset into assets-source/geodata. Then pack indexed chunks using `python scripts/pack-toronto-massing.py` (requires ijson and numpy). Run Blender with `--background --python tools/blender/build_toronto_massing.py`. Then run Blender with `--background --python tools/blender/save_toronto_browser_source.py` to generate the bounded browser GLB and matching editable Blender file. The normal production build applies lossless mesh compression. Source downloads and all conversion scripts are retained for reproduction. Roof geographic UVs are present in the Blender source; runtime applies the separately attributed JPEG. Windows are illustrative and not measured from photography.

## Facades, ground and lake
The same aerial image covers land, streets and parks inside its returned geographic extent, fading to the previous ground outside that extent. Roof and ground UVs share the exact projection. Water remains above the image only where the existing lake surface is visible, with analytic ripple normals, Fresnel-like sky color and specular highlights. No water vertex displacement changes the shoreline. Day/night updates are uniforms, and reduced-motion stops ripple time. These are illustrative wave effects, not a hydrodynamic simulation or real-time reflections.

Original generated glass curtain-wall and brick/window facade textures are retained in assets-source/toronto and shipped under public/textures/toronto. Glass is used for the taller City objects; lower-rise objects get a mixture of brick, neutral glass and limestone. Materials are inspired by the broad Toronto palette rather than verified building-by-building photographic facades. Research references: https://www.adamson-associates.com/project/bay-adelaide-east/ and https://wilkinsoneyre.com/projects/cibc-square-toronto . No third-party building photographs were copied into the app.

Generation briefs: flat orthographic seamless eight-by-eight blue-grey glass curtain wall with thin aluminum mullions; separate four-by-four muted Toronto brick facade with dark window frames and interior blinds, uniform diffuse lighting, no signage or perspective. Retain the original PNG sources. The glass repeat is 32 by 26.4 metres for eight floors; masonry/window spacing uses local facade planes.


Final delivered geometry: 612,402 triangles; raw GLB 43,877,904 bytes; production lossless-compressed GLB 24,343,432 bytes. Full City extraction: 17,537 source objects and 17,470,679 source triangles. Full-resolution intermediates stay outside the web release. The browser conversion simplifies geometry; it does not preserve every source detail. Roof UVs are recomputed from final vertex positions to avoid simplification-induced texture drift.

