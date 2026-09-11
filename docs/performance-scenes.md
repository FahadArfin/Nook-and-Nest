# Repeatable performance scenes

Run the local Vite server and open `/qa/performance.html`. This development-only page uses the real SceneController and disposable plans; it does not save over a user's project or enter the production build. Fixtures have fixed IDs, coordinates, timestamps and camera positions.

| Fixture | Workload |
| --- | --- |
| small-home | Furnished room baseline |
| dense-meadow | 39,970 maximum-density coverage tiles |
| mixed-vegetation | 2,000 independently placed plants across eight catalog types |
| water-edit | Connected depression and non-carving water source; connect/undo hollow controls |

Wait for model requests to finish. Record the device/GPU label, viewport and browser. Use a repeatable manual orbit, capture 60 seconds after the five-second warmup, and export JSON. Reset before each run; compare three runs of each revision at identical settings. Hidden tabs abort capture. Do not change scene or terrain during baseline capture; use a separate water-edit capture for displacement checks.

The report distinguishes animation-frame intervals from the renderer's CPU submission timings. Neither is GPU execution time. Inspect browser performance/memory tools for GPU pressure, long tasks and memory growth; run repeated scene switches and disposal. Use physical iPhone Safari, Android Chrome and integrated-GPU desktop hardware before claiming device coverage. No universal frame-rate guarantee is implied. Keep exported reports outside source unless intentionally adding dated evidence.
