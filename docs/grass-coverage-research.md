# Full-map grass research

The supplied share b435cd4ad5fa4c4cb62cdfa89d24124e contains exactly 22,000 grass-clump placements and 77 other items. It reaches src/vegetation.ts's 22,000-vegetation cap. This is an application storage/editing cap, not a universal browser maximum. Current rendering already batches by species/material/6-metre patch and uses a lighter distant grass mesh. Increasing the cap alone would enlarge serialized plans, history, selection data and geometry load.

Recommended next architecture: a separate, opt-in paintable ground-cover layer, stored as compact density masks/patches rather than independent furniture records. Preserve all existing editable plants. Generate deterministic grass instances only in relevant patches near the camera, retain distant coverage with simpler geometry/ground shading, use bounded caches and density budgets, and cull offscreen patches. Keep local edits/undo and save/share masks, not millions of blades. Preserve floors and foundations and sample the live terrain. This requires new coverage persistence and editing semantics; it is not implemented by merely raising the current placement limit.

Primary references:
- https://github.com/Nitash-Biswas/grass-shader-glsl — browser GLSL instancing, per-patch LOD and transition morphing; closest renderer reference, but Three.js rather than Babylon. Its 400,000-blade count is not a furnished-scene FPS guarantee.
- https://github.com/MangoButtermilch/Unity-Grass-Instancer — chunking, frustum/occlusion culling and infinite-grass approaches; useful architecture, Unity code is not browser-ready.
- https://gpuopen.com/learn/mesh_shaders/mesh_shaders-procedural_grass_rendering/ — procedural blades and patch detail management. Native mesh shaders are not a drop-in WebGL capability; adapt principles to Babylon instancing.

Do not call this unlimited vegetation: control the visible workload as painted area grows. Benchmark frame times, memory, brush latency and reload/undo costs on desktop and phones before claiming full-map performance. No source code was copied from these repositories and no dependency was added.
