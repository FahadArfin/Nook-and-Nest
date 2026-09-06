# Luxury studio collection

Branch: codex/luxury-studio-collection. All work remains isolated. Research started September 6, 2026.

All 22 requests below are implemented and visually reviewed. This batch contains 69 new entries and 11 replacements, with editable Blender sources, exact catalog bounds, rendered previews and preserved existing material keys. Product studies reproduce researched envelopes and recognizable construction; they are not manufacturer CAD or part-for-part LEGO instructions.

## Request tracking

1. Modern/luxury/floating/garage shelves: researched; 8 new models completed.

2. Ceiling/chandelier/kitchen/recessed lighting: researched; 12 completed.

3. Manga rows: 3 original editions completed; preserve Storybook row.

4. Luxury/digital/Rolex/Steins;Gate clocks: 5 completed; live local-time display.

5. Desk mats: 6 completed, original anime/gaming art.

6. Fractal Terra: researched, 153 W × 343 D × 218 H mm.

7. High-end amp/DAC: Naim Atom and Chord DAVE studies.

8. Record player: Technics SL-1200GR2.

9. Edifier desktop speaker: independently placeable S3000MKII.

10. HIFIMAN headphones and Manta stand: combined display model.

11. P2S printer and AMS 2 Pro: separate editable placements; researched chamber and four-spool unit.

12. Ubiquiti gateway/switch and 10-inch rack: photo reference, 3 models.

13. DJI Mini 5 Pro: researched official 380 W × 304 D × 91 H mm unfolded; multi-angle references retained privately.

14. Ubiquiti cameras/doorbell and Ring: 4 studies.

15. Monitors: straight/left/right, independent, original screens.

16. Backsplashes: 4 new tile constructions.

17. Bathroom sink/vanity refinements: completed; retain IDs, dimensions and color keys.

18. Existing toilets refinement and 2 new Japanese bidet variants: completed.

19. Robot cleaner: Dreame-style robot and dock.

20. Broom, vacuum, mop and floor washer: 4 models.

21. Simplehuman slim and dual recycler: 2 studies.

22. Three Technic display models: MCL39 (250×610×130), Ford GT (180×390×90), Perseverance (230×320×230).

All dimensions in millimetres. Generic and study envelopes are layout approximations unless explicitly verified from a manufacturer spec. No manufacturer meshes or third-party artwork are redistributed.


## Validation and release

All 375 application tests pass across the full run and focused reruns after updating catalog-count expectations and the explicit 85,000-triangle allowance for the three detailed Technic models. The 18 asset, hosting and library tests pass; TypeScript checking and the production build pass. All 80 models load under the bounded mesh budget. The clock was visually checked while advancing in local desktop time.

The complete build is 290,969,905 bytes; the publishable slim build is 20,043,324 bytes and the incremental bridge is 55,979,291 bytes. Shared image extraction reduces model bytes from 357,738,296 to 196,533,396 plus 17,720,493 shared image bytes. The full bridge is retained only as a recovery backup, above the unchanged 250 MiB hosting guard.

PR validation, master artifact publication and public asset verification are the remaining release gates.
