# Painted grass rendering

Painted grass uses six-metre spatial thin-instance batches, grouped by floor and material colours. The existing Blender mesh remains the near model. Distant batches retain a deterministic subset of whole connected blade components; nearby batches cast shadows and all batches receive building shadows. Selected grass is temporarily excluded from its batch and rendered through the regular editable furniture path. Picking maps instance indices back to saved placement IDs. Brush previews use the same batching with picking disabled.

Grass keeps its existing compatible placement records, with a separate 20,000-clump budget in the shared validator; regular furniture remains capped at 2,000. Import and online request limits are consistently bounded at 8 MB. No automatic destructive save migration is needed. This is a separate rendering/budget layer, not a compact procedural-stroke save format.

A CPU-only Babylon NullEngine comparison using the user's 1,923-clump layout measured 3,846 enabled meshes / 5,769 transform nodes before and 42 enabled meshes / zero per-clump transform nodes after. Setup measured 1,008 ms versus 46 ms in that run. This excludes material loading and does not measure GPU FPS. Near-view triangle shading remains proportional to instance count; distant LOD reduces that work. Browser/device frame times require separate measurement and must not be inferred from draw batching or NullEngine timing.

References: [Babylon thin instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances/), [LOD](https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD/), [scene optimization](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/scene/optimize_your_scene.md).

Large online documents use a versioned gzip storage envelope, remaining below a 1.9 MB stored-document cap within [D1 row limits](https://developers.cloudflare.com/d1/platform/limits/). API reads expand it to the unchanged plan schema, and old raw JSON saves remain readable. Decompression is bounded to 8 MB. A 20,000-clump round-trip is tested for private saves and public snapshots.
