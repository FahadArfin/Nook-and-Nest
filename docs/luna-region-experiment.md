# Numbered region and targeted crop experiment

Status: **not promoted to Beta**. This branch adds an offline diagnostic implementation, not a replacement for the deployed Luna pipeline. The live application files and cache version remain unchanged.

On 10 September 2026, twelve fresh two-pass `gpt-5.6-luna` analyses tested four variants against the supplied apartment. Each variant used three repeats, medium reasoning and the existing output limits. Input images, raw model outputs and credentials remain outside Git.

| Variant | Mean bedroom/hall IoU | Range | Mean seconds | Estimated USD/run |
|---|---:|---:|---:|---:|
| Current pipeline | 0.7914 | 0.7550–0.8434 | 49.70 | 0.007922 |
| Add numbered regions | 0.7247 | 0.7109–0.7429 | 52.32 | 0.009016 |
| Replace quadrants with targeted crops | 0.7175 | 0.7041–0.7252 | 53.37 | 0.007483 |
| Both changes | 0.7391 | 0.6555–0.8582 | 48.77 | 0.008053 |

Total estimated API cost: $0.097422. These estimates use reported input/output/cache usage and the same price assumptions as the initial diagnostic. They are not billing receipts. Concurrent variants share API conditions and may benefit from prompt caching, so timing and cost are observations rather than controlled performance comparisons.

The score is the existing mean Bedroom/Hall intersection-over-union, with Hall clipped below y=755, against the report's approximate source-pixel references. It is not whole-plan accuracy or physical dimension accuracy. Laundry type overlap was zero in eleven runs; one combined run reached 0.7522. The new baseline differs from the earlier three-run 0.8245 mean, illustrating sampling variation. No statistical significance or general accuracy is claimed. Unseen-plan evaluation was deferred because this candidate failed the development-plan comparison.

## Implementation

`prepare-region-experiment.py` thresholds dark pixels, suppresses thin annotation lines with morphological opening, and proposes short collinear gap closures supported by an existing long wall. It excludes exterior connected components and very small areas, finds interior anchors, approximates polygons, and renders a numbered overlay. Coordinates map back to the original image. Nine candidate regions and four detail crops were produced in approximately 124 ms on this machine.

Initial directional closing alone produced no enclosed rooms. That pre-inference mask failure was corrected to allow short perpendicular wall jambs as closure support. The algorithm was then frozen before the twelve paid comparisons. It has no access to reference-answer geometry, room labels or apartment-specific coordinates.

The experiment runner bundles and calls the unchanged production pipeline. For region variants it adds the overlay and polygon evidence to both stage inputs, explicitly describing the evidence as uncertain. For crop variants it replaces the four quadrant crops with crops of small/irregular detected regions. The original image remains authoritative in every call. No additional model calls, premium fallback, cache bypass retries or generated-image edits are used.

Visual inspection identified missed thin exterior/window boundaries and false hallway subdivisions. The output scores are consistent with misleading region suggestions, although they do not isolate causation. Crop selection also reduces broad spatial coverage. Four synthetic tests check doorway separation, exterior exclusion, thin-grid rejection and interior anchors in an L-shaped region; these tests do not establish real-plan reliability.

## Reproduction

Requires the existing Node/esbuild dependencies plus Python with OpenCV, NumPy and Pillow (tested with OpenCV 5.0.0). All output paths must be outside the repository; never commit the input JSON, image, raw output or API key.

1. Prepare an external input JSON using the same shape as `test-luna-pipeline.mjs`: original image data URL/dimensions, RGBA file/pixel dimensions and four baseline crops.
2. Run `python scripts/prepare-region-experiment.py INPUT_JSON EXTERNAL_OUTPUT`.
3. Run `python scripts/test-region-preprocessing.py` for the nonpaid checks.
4. Explicitly invoke paid calls with `node scripts/test-region-experiment.mjs PREPARED_INPUT_JSON KEY_FILE EXTERNAL_VARIANT_OUTPUT baseline 3`, repeating with `regions`, `crops` and `combined`.
5. Score each directory using `score-luna-pipeline.py` with the external report/reference image. Its reference geometry is used only after inference.
6. Run `python scripts/report-region-experiment.py EXTERNAL_OUTPUT` to aggregate the four scored variant subdirectories.

Next experiment: preserve the broad views, add a bounded number of context crops from uncertain inventory anchors, and reject region hypotheses that rely on unsupported doorway closures. The present evidence does not justify enabling automatic numbered-region preprocessing in Beta.
