# Lossless model optimization — September 5, 2026

All 21 deployed models above 1 MB were compressed. Sizes below use decimal MB and exclude shared textures from individual model sizes. Original editable Blender files and standalone source GLBs remain unchanged.

Expanded build: **172.42 → 149.16 MB**, saving **23.27 MB** including the local decoder.

| Model | Before MB | After MB | Saved |
|---|---:|---:|---:|
| weeping-willow | 9.49 | 5.62 | 40.8% |
| birch-tree | 7.57 | 4.81 | 36.4% |
| spruce-tree | 7.50 | 5.37 | 28.4% |
| fern-clump | 6.70 | 4.13 | 38.4% |
| maple-tree | 4.21 | 2.86 | 32.2% |
| sakura-tree | 3.72 | 2.22 | 40.3% |
| hydrangea-border | 2.67 | 1.51 | 43.5% |
| reef-aquarium | 2.07 | 1.22 | 40.8% |
| flowering-shrub | 1.82 | 1.21 | 33.6% |
| curtain-blackout-pair | 1.70 | 0.96 | 43.6% |
| planted-aquarium | 1.64 | 1.01 | 38.2% |
| raised-flowerbed | 1.53 | 0.77 | 49.5% |
| desktop-aquarium | 1.41 | 0.88 | 37.7% |
| curtain-linen-pair | 1.28 | 0.74 | 42.5% |
| brick-patio | 1.21 | 0.80 | 33.8% |
| garden-hedge | 1.20 | 0.83 | 30.7% |
| woven-patio-chair | 1.16 | 0.58 | 49.5% |
| wildflower-patch | 1.10 | 0.70 | 35.9% |
| jute-rug | 1.07 | 0.51 | 52.7% |
| ring-chandelier | 1.05 | 0.43 | 58.9% |
| cuckoo-clock | 1.03 | 0.66 | 35.3% |

Meshoptimizer EXT_meshopt_compression encodes geometry without quantization, simplification, filters or index reordering. Every decoded buffer is checked for exact byte equality during the build and tests. Nodes, dimensions, materials, UVs, normals, textures, fish, tails, bubbles and animation metadata are preserved. Babylon imports of all three aquariums and the largest tree also compare decoded mesh data against the originals. The decoder is hosted locally with its MIT license.

This saves storage and download bytes; it does not reduce triangle counts or GPU memory. Some models remain above 1 MB to preserve their detail. Preview images retain the previous lossless WebP optimization. R2 remains deferred.

Reference: [meshoptimizer encoder documentation](https://github.com/zeux/meshoptimizer/blob/master/js/README.md).
