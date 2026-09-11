# Beta 1 editor experience

The September 2026 polish pass covers seven parts of the Design in 3D workflow.

1. **Starting a space.** An empty plain-ground scene gets one bounded, non-pickable grid mesh when grid labels are enabled. A dismissible hint opens Build with Floors/Add selected. Existing architecture, terrain and planted landscapes suppress the guide.
2. **Placing and editing.** Placement remains an unsaved preview until confirmation. One dismissible keyboard tip explains Enter/Escape/R. Move and Rotate have explicit selected states; their controls share sizing and focus treatment.
3. **Finding pieces.** Room collections cross catalog categories, including appropriate lighting. Browse, Saved and Recent remain separate views. Recent contains the last 12 confirmed pieces; filter chips can be removed individually. Tags are deduplicated and thumbnails use a consistent frame.
4. **Phone layout.** Save and Undo stay in the header. Secondary actions use a labeled native-dialog sheet with focus restoration. All view and floor-plan buttons fit without horizontal scrolling. Existing desktop navigation remains available.
5. **Frequently used controls.** Settings offers optional pins for brush controls, recent finishes and grid labels. Brackets change the active outdoor brush size, except while typing or using a dialog. Finish selection only starts a brush; it does not paint by itself.
6. **Recovery.** A committed edit can show a specific, temporary Undo notice. Its action is valid only while the announced plan is still current. Save errors expose Retry and Backup directly. Failed model loads keep existing procedural fallbacks and offer Retry; callbacks belong to their renderer and are removed when it closes.
7. **Consistency.** Context controls, focus rings, popovers and mobile actions use shared spacing and rounded surfaces. Reduced-motion preferences suppress their entrance animation.

## State and ownership

`editorPreferences.ts` stores bounded browser preferences in `nook-editor-preferences-v1`. Preferences never enter the plan schema, shared links, cloud saves or undo history. Malformed/unavailable storage falls back to usable session state. `EditorFeedback` observes commits rather than adding history entries. Model recovery does not change scene geometry or saved placements.

Beta 1 is the release destination. Beta 2 remains the floor-plan automation research site.

## Verification

- Full application suite: 530 passing tests across 61 files.
- Type check, production build, 10 hosting checks and 3 lossless model-integrity checks passed.
- Browser checks: floor preview/confirm, furniture preview/cancel/confirm, recent browsing, persisted pins/finishes, phone action sheet, Help navigation, Escape/focus restoration, light/dark layout and reduced motion.
- A blocked model request produced the visible fallback/retry state; unblocking and retrying loaded the detailed model.
- Desktop and phone viewport checks are browser emulation, not a claim of testing every physical device.
