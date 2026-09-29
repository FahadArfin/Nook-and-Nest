# Project delivery and design history

Open Project for Design, Planning and Present. The tools load on demand.

- **Design → Renovation & milestones:** capture immutable Existing/Proposed stages, inspect classifications and restore explicitly. Manual milestones are opt-in; a saved orbit viewpoint produces a labelled HD/Full-HD JPEG sequence ZIP. Preview reuses the editor scene and restores its camera and working layout, without adding undo entries. A preview moves controls aside so the room stays visible.
- **Arrangements → Build a set:** compose reviewed straight closet or kitchen-base modules at authored dimensions; compare available width, customize materials and preview before one-step apply. Groups/locks are optional. Corner joints, fillers and manufacturing/installation validation are outside this set builder.
- **Planning → Site notes:** attach private notes/photos and dated self-reported measurement evidence. Geometry changes stale prior evidence; mismatches are visible, never silently applied. Area classification distinguishes unclassified/included/excluded/outdoor regions and makes no certified-area claim.
- **Planning → Install checklist:** capture selected placed pieces, tasks, assignees and dates against a specific project revision. Packing/delivery start unknown. Layout changes require review; quantities count physical placements rather than purchase packs. CSV and printable HTML include entered names/notes; photo bytes travel only in a complete private backup.
- **Present:** choose content, branding and private-image inclusions explicitly, inspect the exact export preview, then download printable HTML/CSV/manifest in a ZIP or use browser Print/Save PDF. Stale previews cannot be exported. Listing data is read without taking over its editor's revision tracking.

Private checklists, site records, presentation settings and history are excluded from ordinary public plan links. Backups collect media and immutable floor references across current layouts, alternatives and history; absent assets are reported. A copied/restored project rebinds project-owned checklist metadata while leaving its source unchanged. All project commits use stale-state guards and undo.

## Validation

Browser checks on a synthetic 6×5m plan confirmed a two-module uncommitted preview, one-step apply/undo, independent IDs, an empty-room history preview without losing the working furniture, two labelled 1280×720 JPEG exports, a 50mm measurement discrepancy and checklist task editing. No physical printer or business field survey is claimed. Private identity, public sanitization, historical reference backup and readonly-listing stale-writer behavior have integrated regression coverage. Related schema/UI tests and TypeScript run before release; the release workflow also validates the full application, Sites worker, asset integrity and unchanged size guards.

The welcome menu now defers the planning runtime and saved-project read until an editing route needs them. This reduced the merged 902-model initial entry from 722,320 bytes (over budget) to 244,293 bytes / 76,500 gzip, without raising the 700 KB / 220 KB guards. Shared/deep links, browser navigation, new blank projects, explicit project opening and appearance transfer have regression coverage.
