# Mixed vegetation crash regression

The deterministic `mixed-vegetation` fixture in `/qa/performance.html` reproduced a renderer crash on the preceding Beta 2 build. It contains 2,000 independent plants from eight catalog types. This was not a saved placement limit: render-object allocation multiplied each botanical part by many small spatial patches, with near and far meshes for each. Each arriving model also invalidated every species, producing avoidable rebuild spikes.

The fix merges static prototype parts that share a material once, after baking transforms. It preserves geometry, UVs and materials; multi-material parts remain separate. Non-grass plants use 24-metre patches instead of 6-metre patches, retaining spatial culling and independent instance IDs. Model arrivals invalidate only their own species. Grass coverage refreshes only when its grass model arrives. No saved schema, model asset or placement limit changed.

## Acceptance, 2026-09-09

- Windows desktop in-app Chromium, local Vite build: all eight detailed vegetation models loaded, with no failed or pending requests; 2,000 placements remained present.
- Scene contained 2,148 meshes after loading and survived a 60-second continuous camera orbit. This is a crash/reliability check, not a GPU benchmark.
- Switching to small-home and back twice returned to the same 2,148 meshes and 2,000 placements.
- Automated regressions cover bounded cold-load fallback mesh count, unchanged-species reuse, unchanged saved data, retained grass triangle contribution, selection exclusion, and actual thin-instance ray picking after another patch is removed.

This does not establish unlimited vegetation or performance on every device. Continue physical mobile and integrated-GPU testing using the procedure in `performance-scenes.md`. Shared vertex data is retained, but patch instance/index buffers and rendered triangles still have a cost.
