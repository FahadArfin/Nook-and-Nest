# Large vegetation landscapes (Beta 2)

Use **Land formation > Plants > Large landscape** to paint a seeded field. Individual brush placement and existing meadow saves retain their previous representations. The field supports up to 2,000,000 persistent planting samples across a 400 m by 400 m domain. Samples hidden by architecture, furniture or water still occupy their saved locations and count toward this capacity.

## Representation and editing

`vegetationField.ts` stores per-species counts in four-metre cells, deterministic sample positions and sparse removed-sample exceptions. A two-million mixed field round-trips through the existing plan serializer in less than 500 KB. No two-million-object array is constructed. The optional environment property preserves existing saves without migration.

A completed brush stroke creates one history entry. Live previews process new stroke segments incrementally. Painting at a lower density does not thin existing plants; use Erase plants. Selecting a field sample promotes its stable ID into an ordinary editable furniture placement and masks the generated original. Undo restores the original. Up to 22,000 individual exceptions are supported; brush editing remains available after that threshold.

## Rendering

- `vegetationVisibility.worker.ts` keeps the field and computes camera-region candidates. Stale replies are discarded. Work scales with occupied cells plus the visible budget, rather than all seeds.
- `VegetationFieldRenderer.ts` batches candidates in 16-metre spatial groups. The visible budget adjusts between 6,000 and 18,000 samples according to observed frame intervals. This changes representation, never saved plant counts.
- At most 1,024 nearby grass models or a smaller mixed-plant subset use the existing detailed instanced model renderer. Farther plants use alpha-tested GPU-facing views captured from the original models, cached per species and view direction.
- Captures wait for material readiness and use bilinear sampling without mipmaps. Completed captures are removed from the scene render-target list while retaining their textures. Disposing a field renderer releases workers, batches and capture resources.
- Grass ground coverage updates only changed chunks. Water and building/furniture masks prevent growth through protected footprints.
- Individual picking visits visible batches and samples on pointer-down. It does not ray-test the two million saved plants.

This is a WebGL-compatible implementation, not a WebGPU compute implementation. Four directional views plus an overhead view approximate distant plants; they do not replace the original editable assets. Far plants do not cast individual shadows and their baked illumination is approximate. View-direction and detail transitions can remain noticeable. The visible budget is bounded, but an extreme mixture of many species can still increase draw calls and overdraw. Physical iPhone/Android acceptance remains pending.

## Verification

`tests/vegetation-field.test.ts` covers compact two-million saves, deterministic samples, validation, bounded visibility, editing promotion and undo, capacity and non-destructive overpainting. `qa/performance.html` includes two-million grass and mixed fixtures. Use a five-second warmup followed by a sixty-second orbit, inspect the rendered result and browser errors, and test full-map zoom and scene replacement. Browser RAF intervals are not GPU timings.

The local editor pointer test added 28,672 plants in one stroke; one Undo removed the field and Redo restored it. A scene click promoted one plant into an independently editable placement. Both two-million fixtures completed sustained orbit runs on the development desktop. These observations do not establish performance on every modern device.

## Research sources

The architecture follows the demonstrated separation of persistent populations from bounded visible instances, spatial culling and distant representations:

- [InstancedMesh2](https://github.com/agargaro/instanced-mesh): spatial culling, LOD and large instance populations.
- [Octahedral impostor](https://github.com/agargaro/octahedral-impostor): multi-view impostor reference. This implementation uses simpler directional captures and does not import its code.
- [Unity Grass Instancer](https://github.com/MangoButtermilch/Unity-Grass-Instancer): instancing and culling techniques; not a browser performance guarantee.
- [GodotGrass](https://github.com/2Retr0/GodotGrass): dense procedural grass and distance-dependent detail.

No external repository code or model assets were copied. Original Blender sources, IDs and dimensions remain unchanged.
