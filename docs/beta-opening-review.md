# Beta 2 opening review

The optional **Check walls & openings** panel in Floor Plan Studio adds targeted corrections after reference import and scale review. Standard two-pass Luna recognition remains unchanged.

## Behavior

- Free source enclosure check: bounded Otsu/opening/component wall support in a worker, followed by a four-connected exterior flood. It reports sampled room centers connected to the image edge and up to 60 collinear gap hypotheses. This checks source ink only; doors, open entrances, thin lines and missing ink can all leak. It does not certify enclosure or modify the floor.
- Select a possible gap, or draw an axis-aligned doorway span directly over the source. Preview the original and rotations around either jamb. Original coordinates are retained; no generated image redraw is used.
- Inspect close-up sends only the bounded original-image crop and up to five span choices to one gpt-5.6-luna request. The model must choose a supplied ID or none, distinguish door/window/open/wall/uncertain, and explain confidence. It cannot return replacement coordinates. Limit: 2,200 output tokens, 90 seconds, store false.
- The existing same-origin/authentication checks and atomic per-owner/site daily quotas cover close-up requests. They count toward the same ten-per-owner daily limit. Identical image/crop/choice payloads are hashed and reused in a bounded session-only cache. Cancel and reference/draft changes discard pending responses.
- Apply remains explicit even at high confidence. Openings require a valid supporting wall within 120 mm and pass the existing opening/overlap checks. Invalid geometry is rejected before commit. Each correction uses Studio's existing undo history, local draft persistence and final 3D confirmation.
- Join spaces reuses the existing join operation, removing the shared divider and affected openings. The UI discloses that effect. A label split divides rectangular room parts without constructing a wall, rejects an existing collinear physical wall, and preserves the floor and other walls through save/reimport.

## Validation, September 10

Automated coverage includes a one-pixel exterior leak; offset versus collinear gaps; bounded alternative orientations; malformed requests and invented result IDs; identity, origin and both quotas; supported/unsupported/duplicate openings; window/open entrance application; label-only split persistence; explicit Apply; and cancellation/stale-response rejection.

Real browser experiment used the owner's supplied apartment scan and its existing cached Luna room analysis. The 9-foot solarium dimension was visually checked in the existing scale-review step. Two fresh close-up requests:

1. Horizontal solarium doorway: Luna selected the original span, door/high confidence.
2. Deliberately vertical span along that door's open leaf: Luna selected the horizontal rotation about the lower jamb, door/high confidence. Its note distinguished the leaf and arc from the closed opening.

Explicit doorway Apply, Undo, Redo, a label split, rejoining the split, and final conversion into the rendered Babylon.js apartment were verified in the browser. No original model-default or full-plan accuracy improvement is claimed from these two checks on one doorway. The source algorithm found only three collinear gap hypotheses on this plan; many corner/T-junction doors still require drawing a span. Dimensions remain subject to the existing scale-conflict review, not a new joint constraint solver. Broader real-plan evaluation remains necessary.

## Release

Owner-private Beta 2 only, isolated feature branch codex/beta-opening-review, draft PR. Preserve the production Site and its source identity. Publish the exact successful feature workflow artifact; verify entry assets and the unchanged library manifest against its complete R2 receipt.
