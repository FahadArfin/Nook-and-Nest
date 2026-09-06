# Skyline GT-R brick display model

Original, simplified brick-style R34 display model based on the user-provided photograph and [LEGO Technic 42210](https://www.lego.com/en-us/product/2-fast-2-furious-nissan-skyline-gt-r-r34-car-42210). This is not an official LEGO asset or a verified physical building plan.

- `skyline-gtr-brick.blend`: editable component source with materials and modifiers.
- `skyline-gtr-brick.glb`: exported display model; 460 mesh parts, 74,336 triangles, 2,736,992 bytes.
- `skyline-front.png`, `skyline-rear.png`, `skyline-side.png`: reviewed Blender renders.
- `asset-audit.json`: successful fresh Blender GLB reimport report. Dimensions are measured after reimport into Blender: length X, width Y, height Z (approximately 450 x 199 x 125 mm).

Rebuild from the repository root with Blender 5.2:

```powershell
blender --background --python tools/blender/build_skyline_brick.py
blender --background --python tools/blender/audit_skyline_brick.py
```

The model is stored as a source asset only. It has not been registered in the furniture catalog or published to the app. The original component hierarchy is retained; runtime batching and placement integration can be performed separately.
