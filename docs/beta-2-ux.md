# Beta 2 UX implementation

Implements the September 9 UX review in the isolated Beta site. Production and its hosting identity remain unchanged. Keep this PR draft until the owner reviews Beta.

| Review area | Implemented response |
| --- | --- |
| Phone studio | Collapsed Rooms by default; dismissible overlay, explicit edit-dimensions action, viewport-bounded opening picker. |
| First use | Actionable import/draw/measured-room starters, empty 3D guidance, separate furnished example. No premature empty-plan validation alert. |
| Measurements | Project units drive room inputs, labels, furniture dimensions, area, brush lengths and wall heights. Fractional inches are accepted; viewing or switching units preserves imported precision. Advanced position inputs retain explicitly labelled mm. |
| Plants controls | Catalog and controls occupy separate columns; action remains below them. Compact mode selector and mode explanation replace stacked switches. |
| Plant limits | Individual, meadow and two-million field modes explain their different storage/editing models; counts remain visible. |
| Phone header | Save and Undo stay visible; secondary actions are grouped under More. |
| Catalog | Two columns in the narrow library, wrapping names, useful furniture families before railings, normalized type aliases. |
| In plan | Actual placed objects with floor names, Select, Locate and Duplicate. Paged at 50 to avoid a large DOM. |
| Selected toolbar | Trash for removal, explicit locked/moving/rotating state. Existing opt-in movement and camera framing preserved. |
| Inspector | Rotation before dimensions, direct angle and presets, fractional dimensions, advanced coordinates collapsed. |
| Parts | Friendly material labels, uniquely named reset controls, hover/focus bounding boxes for corresponding model parts. No saved material mutation from highlighting. |
| Mobile paint | Minimize palette while keeping active finish/action controls. |
| Commit guidance | Floor previews say confirm; wall brush and terrain explain live edits and Undo. |
| Help | Searchable task guidance covering planning, placement, camera/touch, painting, saving and landscaping. |
| Dialogs | Native named modal wrapper for Help, Share and furnishing review, Escape dismissal and focus restoration. |
| Import transparency | Explains rendered-page/guidance upload and operator API account. Explicit online analysis confirmation plus local-only tracing path. No paid development analysis. |
| Projects | Device plan thumbnails, online preview on request, last edit, sort, rename, and recent-project continuation. Online ownership/revision checks retained. |
| Agent | Dynamic catalog count, explicit browser-agent wording and existing support/permission status; Quick layout clearly separated. |
| Quick layout | Lists added pieces with individual acceptance and retained/removed counts. Existing contents stay intact; apply remains one undo. |
| Outdoors navigation | Terrain, Plants and Surroundings; existing authored scenery previews in chooser. |
| Sunlight | Repaired text; enabling selects Afternoon; dismissal and disabling remain separate. |
| Presentation | Viewpoint strip, current/landscape/portrait/square exports and crop frame. Fixed exports crop the current rendered image; they do not increase source detail. |
| Rendering UX | Device-local Auto/Battery saver/High quality resolution preference and explanation of adaptive distant detail. No device-wide FPS guarantee. |
| Alternatives to drag | Two-click room drawing, measured room creation, numerical resize and room nudge controls. |

## Validation boundaries

Type checking, application regressions, hosting tests, model integrity and production packaging are required. Desktop and phone-sized browser checks cover studio creation, editing space, menus, help and planting. Real iPhone/Android hardware testing remains the owner's follow-up, not a claim inferred from a resized desktop browser. Device previews are simplified plan diagrams, not photorealistic saved renders. Online preview is loaded only when requested.

Original authored models, placement IDs, two-million vegetation representation, water simulation, online ownership rules and production deployment remain intact.
