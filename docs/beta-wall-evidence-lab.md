# Beta 2 wall evidence study — September 10, 2026

Beta 2 now has File → Analysis lab in the floor-plan studio. Its free local preview compares the uploaded reference with filtered dark strokes. Selecting Wall evidence adds that image to the next explicitly requested Luna analysis. Standard remains the recommended default: the mask did not produce a consistent improvement. Method-specific caches prevent accidentally reusing the other method's result.

The existing renderer is Babylon.js. The new evidence feeds the existing recognition → editable 2D review → explicit confirmation → 3D conversion flow; no Blender runtime or rendering-engine migration is involved. Original images and broad crops remain available to Luna. Preview does not call an API or change the plan. Fresh recognition still uses the site's API account, with two Luna calls and no premium-model fallback.

## What was learned from FloorplanToBlender3d

Inspected [FloorplanToBlender3d](https://github.com/grebtsew/FloorplanToBlender3d) at commit `2da4c9532e9866b025c67aee17f87ff7e0b8db98`, particularly `FloorplanToBlenderLib/detect.py`, `image.py` and `const.py`.

Its wall filter combines Otsu thresholding, morphological opening/dilation and a distance transform. Its room routine connects detected corners to close openings; its door routine groups template-matched features. These are useful ways of decomposing the problem, but automatic closure can also invent boundaries. Its actual filter was evaluated externally as a diagnostic image, not incorporated into the application. Upstream GPL-3.0 code and its checkout remain outside this repository. The application mask is an original implementation of standard thresholding, opening and connected-component filtering, without copied upstream code.

`src/wallSupport.ts` composites transparency on white, computes an Otsu threshold, removes narrow strokes with a scale-aware opening, and retains substantial components. It is bounded to 2.56 million pixels and runs in the existing worker. It does not close doorways, infer labels, or establish dimensions. Thin partitions/windows can disappear and cabinet edges can survive, so both pipeline stages describe it as uncertain auxiliary evidence.

## Repeated paid diagnostic results

Each row has three independent analyses. All use the same original image, crops, baseline wall candidates, Luna configuration and two-stage budget. Inputs exclude reference answers. A structured-doorway experiment asks the inventory stage to identify hinges, closed-door spans and swing ownership, then gives that evidence to the geometry stage without adding another call. It is retained only in the diagnostic runner.

For the supplied apartment, the metric is the mean of bedroom-union and hall intersection-over-union against the existing report's reference; the hall is clipped below y=755 to match the earlier evaluation. It is not overall floor-plan accuracy, dimension accuracy, or an Astra comparison.

| Apartment method | Mean IoU | Run range | Mean time |
| --- | ---: | ---: | ---: |
| Standard | 73.45% | 72.07–75.25% | 51.3 s |
| Actual upstream wall-filter image | 78.17% | 73.17–87.44% | 50.6 s |
| Independent supported-stroke mask | 71.74% | 67.34–74.65% | 60.9 s |
| Structured doorway inventory | 78.76% | 72.84–86.72% | 56.9 s |
| Doorway inventory plus supported mask | 70.77% | 66.36–76.29% | 60.3 s |

Two existing synthetic layouts were also evaluated, three runs per method. Their different metric averages room-kind union IoU across all reference kinds. Cross-hall scored 97.41% and courtyard 98.42% with both Standard and the supported mask. These controlled diagrams do not substitute for unseen real scans. Total: 27 analyses across three images. Raw inputs/results remain outside the repository in the local wall-evidence-lab artifact directory.

The apartment results have substantial run-to-run variance. The upstream mask and doorway inventory are candidates for further testing, not demonstrated general gains. The supported mask sometimes worsens room ownership. Laundry identification remains unresolved. Do not report the best single run as an accuracy improvement or replace the default based on this sample.

## Reproduction and next experiments

`prepare-wall-study.py` accepts an input file, a separately acquired upstream checkout and an output directory. `prepare-study-fixtures.py` extracts image-only inputs from the existing report. `test-wall-study.mjs` accepts input, a private key-file path, output directory, method and 1–3 runs; this command spends API usage. Methods: baseline, upstream, supported, topology, topology-mask. `score-wall-study.py` receives the reference report only after inference. It reports token-rate cost estimates, not invoices; rates must be rechecked before future billing claims.

Next useful work is a larger unseen real-plan set with separately scored room ownership, wall geometry, openings and dimensions. Doorway evidence deserves more investigation than stronger erosion. Keep OCR/dimension anchors on the original, avoid generative redrawing that may alter geometry, and evaluate deterministic boundary constraints before adding another model call.

Validation: 514 application tests, production build and ten hosting tests passed locally. Browser checks exercised the no-API preview, an explicit paid wall-mode analysis, editable dimension review and actual Babylon 3D conversion. These verify integration, not geometric correctness.
