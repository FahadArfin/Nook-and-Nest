# Creative planning — first roadmap release

This release implements a focused subset of the September 29 feature roadmap.

| Roadmap item | Delivered | Follow-up scope |
| --- | --- | --- |
| NN-01 Layout alternatives | Project → Layout ideas: named immutable snapshots, change summaries, rename/delete, explicit apply and one-step undo; retain orbit/zoom on apply | Visual side-by-side comparison and per-idea reference-file versions |
| NN-02 Reusable arrangements | Furniture library → Arrangements: explicit piece selection, private local kits, position/rotation preview, Apply/Discard, one undo for placement | Persistent groups, group dragging, locks and group/ungroup tools |
| NN-06 Room starters | Reading nook, breakfast for two, creative desk corner; existing original models remain independent after placement | More room recipes and selective recipe membership |
| NN-29 Portable project | Milestone A: one local package with plan, listing media/originals/details/viewpoints and available saved floor references; new-copy restore | Milestone B: optional private online media snapshots |

## Use and storage

Layout ideas store confirmed architecture, furniture, finishes and outdoors. Camera settings, project identity and units stay with the working project. Ideas never update silently. Applying clears saved floor-plan drafts because they may reference different geometry. Undo restores the complete prior plan and active floor. Unfinished placement/paint/garden previews must be finished or discarded before opening the ideas controls. Private JSON and cloud saves retain ideas; both public short links and URL shares omit ideas and unfinished studio drafts. Reference files remain associated with project/floor IDs and are not independently versioned per idea.

There are up to six ideas, 750 KB per snapshot and 2 MB combined, within the existing 8 MB plan limit. The panel compares one rendered working scene rather than keeping multiple Babylon scenes alive.

Kits contain only explicitly checked pieces from one floor. Relative transforms, dimensions, colors, finishes and elevations are retained. Shelf/table decorations must be checked separately. This first slice excludes doors/windows/stairs, wall/ceiling mounts and terrain-anchored objects. There are up to 40 private device-local kits with 40 pieces each. Kits are a device library, not part of a project backup; placed copies are ordinary project furniture. Fit warnings are approximate footprint checks, not physical/code validation. Existing Quick layout behavior is unchanged.

Complete backups use a versioned `.nook-backup.json` envelope. Original plan-only and listing-only files still use their existing imports. Restore validates before writing, allocates a new project and media IDs, and publishes the new plan last. Handled storage failures clean up staged records; independent IndexedDB databases cannot guarantee crash-atomic cleanup, so a browser crash can leave unreachable temporary media. Existing records and the active pointer are not overwritten by the restore operation. Missing, omitted or preview-only references are reported. Temporary recovery journals, video jobs, service credentials and global preferences are excluded. No new online storage or model provider is configured.

## Verification

Focused tests cover malformed/oversized snapshots, privacy filtering on client and server, immutable alternatives, confirmation cancellation, atomic floor/history changes, stale previews, exact kit transforms/materials, kit storage, backup round trips, ownership checks, quota cleanup and identity collisions. Browser review uses a disposable local project, including a real captured listing render, a downloaded package restored through the UI, arrangement undo/redo and layout comparisons. Local browser testing does not establish performance on every mobile GPU.
