# Living home design QA

Status: passed for welcome feature, 2026-09-10.

Reference: selected Fireside Evening mockup #3, compared together with the 1487x1058 implementation screenshot. Preserved full-room background, left serif brand and rounded entry actions, upper-right projects/appearance controls and bottom recent-project tray. House outline uses the existing Phosphor icon family; real device projects replace mock project data.

Evidence: E:/Codex-reviews/living-home-desktop.png and E:/Codex-reviews/living-home-mobile.png (390x844). Mobile uses a translucent contrast panel, readable actions and a vertical recent-project list. No horizontal clipping observed.

Interaction checks: all three scenes and day/night artwork; Next pins across reload; automatic rotation can be restored; paused motion survives reload; Create floor plan and Open 3D editor work and return home. Reduced-motion stylesheet disables ambient animation. Background loading crossfades only after image load. Artwork 190-343 KB each; only selected artwork requested.

Validation: TypeScript, production build, 14 focused tests and 10 Sites worker tests passed. Existing editor emits a duplicate Storage catalog key warning; outside welcome scope. No welcome runtime errors observed. Ambient motion is subtle whole-scene drift and fireside light, not simulated object animation.
