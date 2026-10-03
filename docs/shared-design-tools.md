# Shared design tools and professional pilots

This release covers NN-08, NN-11, NN-18, NN-23, NN-26, NN-27, NN-28, NN-29B and NN-32 from the September 29 roadmap. The progress tracker distinguishes implemented functionality from external acceptance and operator configuration.

## Where the tools live

- Furniture arrangements: **Help me arrange** proposes local, measured catalog recipes. Review, revise, apply or discard; one Undo restores the previous room. Protected geometry and existing pieces remain unchanged. Missing prices remain explicit; no paid model call occurs.
- Listing Studio: **Client review** creates a tour from viewpoints, captions and explicitly selected image derivatives. Preview locally, then publish a fixed revision through the existing signed-in account. Comments and approvals belong to that revision. Owners can rotate, revoke or delete links.
- Listing Studio: **Render images** maintains a durable job queue, portable requests/results and an optional user-configured local rendering adapter. Compare an output against its source before adding it as a render or concept image. This does not install a model or start a local GPU service.
- Your projects: discover starter ideas, share a reviewed remixable arrangement, manage private media backup and open professional pilots. A remix always becomes an independent saved project with source credit.
- Design together: the shared layout has separate ownership and history. Ordinary private autosave, project identity changes and private-only tools are disabled while attached. Leave restores the saved private project; continuing privately creates a new identity before disconnecting.
- Staging inventory: a fictional read-only sample illustrates stock and packing workflows. Enrolled workspaces can manage units, reservations, condition, dispatch and returns; a visual proxy in a plan never reserves physical stock.

## Publication and private-data boundaries

Public review/remix routes render before the normal editor, local project loading and WebMCP registration. A public link is a bearer capability, not an identity check on its visitor. Links contain random fragment secrets; servers retain hashes, bound inputs and enforce expiry/revocation. Visitors supply self-reported names; an approval is feedback on the fixed design, not a legal signature.

Only allowlisted layout data enters public snapshots. Private notes, addresses, budgets, references, original photos and account details are excluded. Client-review images require explicit selection and a publication preview. Uploaded personal artwork uses its catalog appearance in public geometry snapshots. No messages or invitations are sent automatically.

The existing dispatcher supplies account identity. Browser request fields do not grant ownership, roles or access. The additive migrations 0005-0009 are packaged with the normal server. Keep inventory transaction triggers in 0007 when generating future migrations.

## Pilot boundaries and operator settings

These controls are intentional operating boundaries from the roadmap, not claims of production acceptance:

| Feature | Available implementation | Remaining prerequisite |
| --- | --- | --- |
| Live collaboration | Two-editor protocol, presence, roles, conflict review, offline queue and recovery; integrated editor bridge | `COLLABORATION_PRODUCTION_ENABLED` stays false until review demand and production pilot acceptance; tests instantiate the real handler with the pilot enabled |
| Curated community gallery | Explicit submission, curator decisions, reporting, permissions, removal and attributed copying; local starter ideas work immediately | Configure a real moderation owner through `IDEAS_CURATOR_IDS`; no curator is invented or automatically enrolled |
| Staging inventory | Real server transactions, unit/date reservations, stock condition and packing/return history; read-only sample | `STAGING_PILOT_ENABLED=true` plus explicit `STAGING_PILOT_OWNER_IDS`, after a staging-business pilot |
| Private online media | Resumable hashed uploads, complete-snapshot switching, deletion, verified download and new-project restore | `ONLINE_MEDIA_STORAGE=d1-bounded-v1`; storage choice and operating quota need approval before activation |
| Final renders | Portable queue and `nook-still-render/1` local adapter with explicit output review | User-provided compatible renderer; no external model account or local GPU setup is configured |

Private online-media pilot quotas are 20 MiB per project, 50 MiB per account and 200 MiB total logical storage, including partial reservations and previous snapshots. A failed upload cannot replace the complete head. Existing complete data is not silently deleted to fit a replacement. Portable local backups remain available. These quotas do not estimate provider backup overhead or erase provider operational backups.

## Validation

Meaningful checks cover cross-account rejection, fixed-revision publication, public field allowlists, ownership, stale writes, malformed payloads, actual SQLite migrations, concurrent last-unit reservations, queue recovery and idempotency. Browser checks cover local tools and transitions separately from backend tests. No synthetic test is evidence of physical-phone AR acceptance, representative recognition accuracy, a configured rendering model or adoption by an actual staging business.

The existing fixed-scale AR and measured-capture acceptance limits are recorded in `living-design.md`. All releases use the validated master artifact and verify the live entry plus every published catalog asset.


## NN-28: saved ideas on this device

My projects → Ideas → Saved ideas holds up to 24 validated room packages (8 MiB total) in a separate IndexedDB store. Saving is explicit and requires the snapshot's copy permission. Previewing, searching and filtering never change a project. Removal has a one-action Undo; export a selected package for a portable backup. The shelf is not currently part of a project's combined backup.

New community saves check the live revision and permission. An already permitted, saved snapshot can be previewed, copied or exported offline without fetching its source again; attribution and the saved revision remain unchanged. Copies already saved cannot be recalled by later source withdrawal. Imported credits remain self-reported. The read-only 3D viewer is still loaded only on request.

The storage transaction enforces count and byte limits across concurrent tabs. Same-source/revision duplicates are idempotent; conflicting content is not silently overwritten. Failed/quota writes do not report success. Damaged records block writing; when their safe identity is recoverable the user can explicitly remove only the damaged saved copy. No automatic shelf wipe is performed for broader corruption.

This advances the local gallery pilot. Configured community moderation and representative device/load acceptance remain outstanding. The separate [next opportunities](feature-opportunities.md) are proposals, not delivered features.
