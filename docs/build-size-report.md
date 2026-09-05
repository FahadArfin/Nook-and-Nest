# Nook & Nest build size report

Sizes are decimal MB. The hosting archive limit is 268.44 MB (256 MiB). Editable Blender files and original PNG renders are source files, excluded from the deployed build.

| Build | Before | After | Saved |
|---|---:|---:|---:|
| Expanded deployment | 221.60 MB | 172.42 MB | 49.17 MB |
| Model GLBs | 136.08 MB | 117.51 MB | 18.57 MB |
| Shared model textures | 11.56 MB | 11.56 MB | 0.00 MB |
| Catalog previews | 56.78 MB | 26.17 MB | 30.61 MB |

## Largest models before this optimization

Includes furniture and optional environment assets; shared textures are counted separately.

| Model | Before | After |
|---|---:|---:|
| christmas-slim-tree | 10.04 MB | 0.76 MB |
| christmas-tree | 10.03 MB | 0.75 MB |
| weeping-willow | 9.49 MB | 9.49 MB |
| birch-tree | 7.57 MB | 7.57 MB |
| spruce-tree | 7.50 MB | 7.50 MB |
| fern-clump | 6.70 MB | 6.70 MB |
| maple-tree | 4.21 MB | 4.21 MB |
| sakura-tree | 3.72 MB | 3.72 MB |
| hydrangea-border | 2.67 MB | 2.67 MB |
| reef-aquarium | 2.07 MB | 2.07 MB |
| flowering-shrub | 1.82 MB | 1.82 MB |
| curtain-blackout-pair | 1.70 MB | 1.70 MB |
| planted-aquarium | 1.64 MB | 1.64 MB |
| raised-flowerbed | 1.53 MB | 1.53 MB |
| desktop-aquarium | 1.41 MB | 1.41 MB |
| curtain-linen-pair | 1.28 MB | 1.28 MB |
| brick-patio | 1.21 MB | 1.21 MB |
| garden-hedge | 1.20 MB | 1.20 MB |
| woven-patio-chair | 1.16 MB | 1.16 MB |
| wildflower-patch | 1.10 MB | 1.10 MB |
| jute-rug | 1.07 MB | 1.07 MB |
| ring-chandelier | 1.05 MB | 1.05 MB |
| cuckoo-clock | 1.03 MB | 1.03 MB |
| wall-clock | 0.97 MB | 0.97 MB |
| tiled-corner-stove | 0.88 MB | 0.88 MB |

## Largest individual build files after optimization

| File | Size |
|---|---:|
| client/models/furniture/weeping-willow.glb | 9.49 MB |
| client/models/furniture/birch-tree.glb | 7.57 MB |
| client/models/furniture/spruce-tree.glb | 7.50 MB |
| client/models/furniture/fern-clump.glb | 6.70 MB |
| client/assets/index-D6KnaCBA.js | 5.43 MB |
| client/assets/index-DJ7AFjMn.js | 5.42 MB |
| client/models/furniture/maple-tree.glb | 4.21 MB |
| client/models/furniture/sakura-tree.glb | 3.72 MB |
| client/models/furniture/shared-textures/9a8e8d873169eee228cae474377b80d717266345e72d24d576a41e44bee20f16.png | 2.89 MB |
| client/models/furniture/shared-textures/85fdde6298cdf1c78e960cde21744084ad77397d6a767511f8606032d10dd94a.png | 2.70 MB |
| client/models/furniture/hydrangea-border.glb | 2.67 MB |
| client/assets/index-Bwiu4zVb.js | 2.48 MB |
| client/assets/nook-nest-icon.png | 2.19 MB |
| client/models/furniture/reef-aquarium.glb | 2.07 MB |
| client/models/furniture/flowering-shrub.glb | 1.82 MB |
| client/models/furniture/curtain-blackout-pair.glb | 1.70 MB |
| client/models/furniture/planted-aquarium.glb | 1.64 MB |
| client/models/furniture/raised-flowerbed.glb | 1.53 MB |
| client/models/furniture/desktop-aquarium.glb | 1.41 MB |
| client/models/furniture/curtain-linen-pair.glb | 1.28 MB |
| client/models/furniture/brick-patio.glb | 1.21 MB |
| client/models/furniture/garden-hedge.glb | 1.20 MB |
| client/models/furniture/woven-patio-chair.glb | 1.16 MB |
| client/models/furniture/wildflower-patch.glb | 1.10 MB |
| client/models/furniture/jute-rug.glb | 1.07 MB |

Christmas trees now reuse a single authored bough across 104 placements per tree, collapsed into one thin-instanced branch mesh in the browser. Red, blue and yellow bulbs use a six-second shader pulse. Original model textures are unchanged. Preview WebP conversion verifies exact decoded RGBA equality against every retained original PNG. R2 remains unconfigured.
