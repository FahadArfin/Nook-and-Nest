# Sofa realism study: shape, fabric and oak

The user rated the original sofa **2/10** and the first detailed-pipeline sofa
**4/10**. The requested improvement covers overall realism: shape, fabric and
wood. This experiment remains on a feature branch and Beta 1. An 8/10 result
is the user's acceptance target, not a score established by polygon counts or
automated checks.

## What the previous exported model revealed

The earlier detailed model had many editable parts but retained almost the
same broad cushion silhouette in the browser. Its browser cushions were
copied before the dense sculpt, with extra fold detail carried by a normal
bake. The broad, uniform cushion faces and nearly invisible textile still
read as molded foam or rubber in the rated close-up.

A direct calculation from the exported `sofa-pipeline.glb` found 4.97179 m² of
upholstery surface and 0.58112 occupied UV area in the 2048² bake atlas. The
effective density is approximately 700 texels/metre (1.43 mm per texel).
The original 1024 texture tiled at 0.271 m provides 3,779 texels/metre
(0.265 mm per texel). Baking all cushions into that atlas lost **5.4 times
the linear textile detail**, or approximately 29 times the image samples.
The calculation uses actual positions, indices and UVs; the exported nodes
had no additional scale. Increasing the master mesh alone cannot recover
that lost texture resolution.

The previous oak UV helper also treated a full square scan as 0.34 × 1.83 m.
Poly Haven's measured metadata identifies the material as 1.83 × 1.83 m.
This study uses the measured aspect ratio and keeps wood grain along each
board rather than stretching one image over the assembled frame.

## Revised construction and material path

`tools/blender/sofa_realism_study.py` authors the visible cushion crown,
compression and directional folds in both the editable master and the
browser geometry. Panel boxing, separate sewn welts, the timber frame and
joinery remain legible construction. Changes must survive a clay render;
surface textures cannot substitute for the shape.

`tools/blender/sofa_realism_materials.py` provides
`create_materials(repository_root)`, returning the four existing canonical
material keys. The builder's `UVMap` coordinates are metres. Mapping nodes
convert them to physical tile repeats; **do not also call `scale_uv()`**.
Wood UV axes are transverse/longitudinal; cloth axes follow panel across/length.
Every image is connected through a standard glTF-compatible image graph.

The fabric uses Poly Haven's photographed poly-wool herringbone at its native
0.270079 × 0.275700 m repeat. Its pattern is kept at physical scale, with
restrained yarn contrast rather than enlarged basket weave. A neutral
reflectance derivative retains photographed luminance variation while the
existing moss color remains an independent material factor. Thread and welt
material uses the same cloth source with a slightly darker matte factor.

Oak uses the existing licensed photographic maps at 1.83 × 1.83 m, a warmer
medium finish, and restrained normal strength. Derived ORM maps retain AO,
map cloth roughness to 0.80–0.96 and oak to 0.64–0.86, and set metallic to zero for both oak and
cloth. Albedo images are sRGB; normal and ORM images are non-color data.
Normals use OpenGL/+Y tangent space. The helper creates the official complete
Blender glTF settings group for AO, preserving safe export/reimport.

The helper writes only new `rebuilt-*` derivatives and retains the downloaded
inputs. `source_manifest(root)` records source hashes and provenance;
`material_map_receipts(root, materials)` records the exact exported image files.
The standard rough material graph omits sheen while the earlier exporter
white-sheen mismatch remains outside this experiment's scope.

The first native-tile render still appeared rubbery. Inspection found only
7/255 standard deviation in the neutral cloth image and median roughness
approximately 0.63 for cloth and 0.55 for oak. The next material trial
strengthens photographed yarn variation while preserving scale and the same
moss factor, raises cloth normal strength from 0.28 to 0.70, and uses a
0.25 Specular IOR Level through the standard glTF specular extension. Oak
image contrast is reduced to 80% of the original deviation around its mean;
this leaves grain visible without letting broad cathedral shapes dominate.
These values are an artistic calibration to the target renderer, not measured
BRDF values. They still require exported-image and browser review.

## Sources and measured material provenance

| Material | Origin and authors | Measured repeat |
| --- | --- | --- |
| [Poly Wool Herringbone](https://polyhaven.com/a/poly_wool_herringbone) | colormass photography; Rico Cilliers processing; CC0 | 270.078855 × 275.700003 mm |
| [Oak Veneer 01](https://polyhaven.com/a/oak_veneer_01) | Jenelle van Heerden; CC0 | 1830.000043 × 1830.000043 mm |
| [Rough Linen](https://polyhaven.com/a/rough_linen), prior comparison only | colormass photography; Rico Cilliers processing; CC0 | 270.708139 × 271.299988 mm |

Poly Haven's [license](https://polyhaven.com/license) permits reuse and
redistribution of the assets. Its [technical standards](https://docs.polyhaven.com/en/technical-standards/textures)
describe photographic capture, calibrated physical dimensions and unlit
albedo. Exact dimensions were verified through the official
[wool metadata](https://api.polyhaven.com/info/poly_wool_herringbone) and
[oak metadata](https://api.polyhaven.com/info/oak_veneer_01); API dimensions
are in [millimetres](https://github.com/Poly-Haven/Public-API/blob/master/swagger.yml).

New source files, downloaded from the official
[file manifest](https://api.polyhaven.com/files/poly_wool_herringbone):

| Local file in `public/textures/realism/` | Source download | SHA-256 |
| --- | --- | --- |
| `rebuilt-wool-albedo.jpg` | [1K diffuse](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/poly_wool_herringbone/poly_wool_herringbone_diff_1k.jpg) | `fd889a46f617efd331e522e36b8ad2548e16e1cb018c001872f17537d7666af5` |
| `rebuilt-wool-normal.png` | [1K OpenGL normal](https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/poly_wool_herringbone/poly_wool_herringbone_nor_gl_1k.png) | `f2e3d60088b7416425b6e81c3285507d5c3d9d630e7a28016012a1befd1c04b1` |
| `rebuilt-wool-arm.png` | [1K AO/roughness/metal](https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/poly_wool_herringbone/poly_wool_herringbone_arm_1k.png) | `921fcbb8116778e2c727b36a390f0b3c67602d645978fae028d12ec13cecc4be` |

The retained source wool images are 1024 × 1045 pixels, matching the scan's
physical aspect ratio. Export derivatives are resampled to 1024 × 1024 by
Blender while the Mapping node retains the exact measured repeat on each
axis. This small resampling makes the portable image dimensions consistent
without stretching the textile on the model. The original ARM blue channel is not used as a literal cloth
metal fraction; the derived material is explicitly dielectric.

Further implementation references:

- [Blender glTF material and normal export](https://docs.blender.org/manual/id/5.0/addons/import_export/scene_gltf2.html): portable image graphs, non-color tangent normals and packed ORM.
- [Khronos real-time asset guidelines](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines/RealtimeAssetCreationGuidelines.md): geometry, materials and target-engine validation.
- [Khronos sheen extension](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen): a future controlled fabric-reflectance test, not evidence that the current export has this feature.
- [Babylon PBR material reference](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/materials/using/masterPBR.md): target-runtime material behavior.

## Review and limits

Review matched full-model, close-up, rear, underside and clay views of the
actual GLB, followed by the browser model. Inspect matching moss color,
grain direction, cushion support contact, texture scale, seam attachment,
normals and practical mesh/file costs. Keep the previous rated exports for
a direct comparison. Recoloring, real dimensions and existing canonical
material keys remain required.

This study does **not** yet author a matching ring-and-pore end-grain patch.
Timber end caps have cross-sectional UVs and several slat ends are concealed,
but the veneer texture is not described as true end grain. No copied
manufacturer model, scan reconstruction, blanket catalog upgrade or 8/10
acceptance is claimed. These are candidates for visual review and the next
user rating.

## Delivered pilot and verification

The new `sofa-rebuilt` study preserves the 2000 × 850 × 780 mm envelope,
floor-centred origin and four canonical color/material keys. The browser
export contains 65,344 triangles in four primitives; the editable source
retains 69 separate construction parts, six cushion shape-key sets and
twelve editable seam curves. Its 92,992-triangle master and browser scene
are saved together with packed maps. Reopening the saved Blender library
confirmed those editable elements and all six material images.

Five actual exported GLB views are retained in
`assets-source/experiments/realism-lab/renders/sofa-rebuilt-*.png`.
The previous rated study remains byte-for-byte unchanged. The model lab
defaults to the new revision and retains the previous 4/10 selection,
shared camera and color controls, clay, wireframe, normal-map toggle,
rear/underside views and the application's unchanged day-light profile.
The shared neutral studio key now lights the visible front of all models,
with slightly stronger fill; it is not a per-variant lighting advantage.

The native-map pipeline has a distinct `surface.method: tiled-pbr` contract.
It requires actual base-color, normal and ORM files, exact embedded-image
hashes, bounded geometry, real measured extents and a fresh five-view review.
Existing baked studies keep their original requirements. No bake is claimed
for the retained photographed detail in this revision.
