# Beta 2 Luna floor-plan analysis

Beta 2 uses `gpt-5.6-luna` for both stages. The primary Site is not changed. No automatic premium fallback or failed-call retry is enabled.

The browser retains the original reference and runs deterministic thick horizontal/vertical stroke extraction in a Web Worker at up to 1600 pixels on the longest side. It sends up to 160 original-coordinate wall candidates and four overlapping JPEG crops alongside the original. A candidate is evidence, not a guaranteed wall: thin lines may be omitted and cabinet edges retained.

Luna first inventories spaces, anchors and exact printed measurement text. A second structured call reconstructs room rectangles using that inventory, original, crops and candidates. Both calls share a 240-second deadline; output limits are 4,500 and 10,000 tokens. There is no separate OCR dependency: the first Luna pass reads the text. The server validates input bounds before charging the existing daily quota, does not persist the image, and always selects Luna even for legacy Astra client requests.

Deterministic reconciliation snaps only discrepancies within three pixels of wall centre lines, converts supported printed units exactly, and reports overlapping rectangles, uncovered inventory anchors and inconsistent horizontal/vertical scales. Existing scale review, room correction, history and explicit 3D creation remain in place. This is conservative geometric reconciliation, not a globally optimal metric reconstruction or a learned segmentation model. It does not fill uncertain rooms automatically. Doors, windows and fixtures remain manually placed per the current beta contract.

The pipeline version is part of the cache hash, together with model, image dimensions, image content and guidance. Completed scale-conflicting detections can be reused without another charge. Cancel/error does not overwrite the previous draft or cached result.

## Paid diagnostic results — 10 September 2026

Three uncached two-stage runs of the supplied apartment, without apartment-specific guidance or supplied answer geometry:

| Run | Seconds | Estimated USD including reported cache writes | Bedroom/hall core IoU |
| --- | ---: | ---: | ---: |
| 1 | 45.70 | 0.007612 | 0.7740 |
| 2 | 50.91 | 0.006789 | 0.8587 |
| 3 | 48.87 | 0.006828 | 0.8407 |

Mean core IoU is approximately 0.8245, compared with historical single-pass Luna 0.7175 and Astra 0.9096 in the [existing report](https://vision-floorplan-comparison.fwad101.chatgpt.site/). This is a small development comparison, not evidence of general accuracy or Astra equivalence. The local scorer rasterizes rounded rectangles against the report's approximate interior references; wall-centre convention differs from those references. Laundry type IoU was zero in all three runs: the space was omitted or labelled as a different service/utility area. Bedroom entry recesses and structural enclosures also remain imperfect. All runs reported inconsistent scale rather than silently stretching the plan.

The estimate uses Luna $0.20/M uncached input, $0.02/M cached input, $1.20/M output and a 25% write premium on reported cache-write input tokens. It includes both stages and is not a billing receipt. Observed totals are roughly 0.7 US cents per analysis, not 7 cents. The API may cache repeated prompt prefixes even when the application cache is bypassed.

A fourth run through the actual browser worker and local authenticated endpoint completed in 72.26 seconds with 18 rectangle parts. Its cached repeat took 6 ms and displayed no-charge reuse. The studio loaded the cached result into measurement review without another call, accepted an explicitly selected calibration into an editable draft, and undid the import in one step. This validates the workflow, not correctness of every reconstructed room dimension. The browser run is not included in the three scored/usage-recorded rows above.

`scripts/test-luna-pipeline.mjs` runs 1–3 explicitly invoked paid tests, reading the credential from an external file and retaining only results/usage. `scripts/score-luna-pipeline.py` recomputes this apartment diagnostic and overlays from externally supplied inputs. `qa/luna-pipeline.html` exercises real browser preprocessing, the endpoint and application-cache reuse without modifying a saved project. The QA page is a development entry and is not part of the production entry bundle. Private images, reference geometry and raw results stay outside the repository.

Future work: evaluate unseen plans, build explicit region/door connectivity candidates, improve ambiguous utility classification and test targeted repair. Generated-image cleanup is not enabled.
