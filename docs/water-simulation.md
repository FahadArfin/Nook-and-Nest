# Terrain water: choice and limits

For Nook & Nest, use a bounded terrain height-field solver with persistent depth, momentum-bearing edge fluxes, donor limiting and fixed steps. Water sources supply depth gradually up to their target level. Terrain edits retain depth (volume) and change surface head, so lowering attracts neighboring water and raising displaces it. Solid foundation cells prevent inflow. Boundaries are sealed. This is a visual shallow-water approximation, not a full Navier-Stokes/SPH/FLIP solver or flood-risk model. It does not implement breaking waves, airborne splashes, floating-object buoyancy or overhangs.

## Repositories researched

- [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation): responsive GPU 2D velocity/pressure/dye demonstration. Useful shader techniques, but not a terrain free-surface or water-volume model. Adapting a dye canvas would not solve filling hollows.
- [jeantimex/fluid](https://github.com/jeantimex/fluid): WebGPU SPH and PIC/FLIP physics with particle, screen-space and volumetric renderers. Best of this list for an eventual 3D splash/particle experiment. The README's tens-of-thousands-at-60-FPS statement is an author claim, not a benchmark for this furnished Babylon scene or all phones. Requires WebGPU and integration of terrain boundaries and rendering.
- [bienehito/fluid-dynamics](https://github.com/bienehito/fluid-dynamics): WebGL2 2D incompressible-flow library. Its documented restrictions include no internal walls and circular-only solids, making it unsuitable as a direct terrain-basin solver.
- [amandaghassaei/gpu-io](https://github.com/amandaghassaei/gpu-io): flexible GPU computation infrastructure with WebGL2 and WebGL1 fallback. Best reusable foundation from this list for a future GPU height-field implementation, but it does not supply this terrain solver. Its documented shared-context integration targets Three.js; Babylon would require explicit state management.

The [virtual-pipe shallow-water research by Mei, Decaudin and Hu](https://evasion.imag.fr/Publications/2007/MDH07/) is a closer algorithmic fit than dye or 3D particle demos. This implementation uses an original small typed-array solver, keeping the existing Babylon renderer and avoiding another WebGL/WebGPU context. No external repository code or dependency was imported.

## Runtime budget and persistence

The grid has 161 by 161 samples (25,921 cells), with one east and south flux per sample. Simulation runs at 30 Hz with at most three catch-up steps, while water shading renders at display rate. Typed buffers and mesh topology are reused. Decorative ripple time freezes for reduced-motion users; functional filling continues. No simulation runs without river strokes. Sources and sculpt strokes remain saved/undoable; transient depth and currents replay on reopening. Switching projects or changing foundation geometry starts a fresh simulation. Grid expansion transfers existing volume. Foundations remain protected.

Tests cover gradual source filling, dry disconnected basins, terrain-induced inflow/outflow, conservation without sources, still water, long-step bounding and blocked foundations. GPU/device FPS is not implied by CPU step timings.

Local solver-only benchmark: 25,921 cells, 30 warm-up steps followed by 300 measured steps averaged 0.87 ms per step on the development machine (Node). This excludes mesh uploads and GPU rendering and is not a browser FPS guarantee.
