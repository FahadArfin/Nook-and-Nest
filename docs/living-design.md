# Living designs and measured previews

This batch implements NN-16, NN-17, NN-22, the bounded NN-24 phone-viewer pilot, and NN-25's measured recognition review and local benchmark workflow.

## Using the tools

- Furniture library → Arrangements → Try interactions: loaded fireplaces, aquariums, holiday trees, fountains, rotating globes and supported sliding doors expose authored controls. Closing restores transient states. No new animation loop, placement mutation or history step is created. Off-screen motion and reduced-motion preferences retain their existing bounds.
- Arrangements → Creative prompts: four deterministic original briefs open new measured projects after saving the previous project. Every required catalog piece exists. Hints are optional; progress is private and public visual sharing excludes the brief. Storage failures, aborted launches and edits during saving cannot silently replace the working design.
- Arrangements → Seasonal colors: preview and apply a regional cosmetic palette on reviewed maple, fern, hydrangea, lavender and tulip materials. One Undo restores the previous look; species, transforms and IDs stay unchanged. Dense field vegetation and unreviewed species retain original colors. Material and placement budgets remain bounded; selected plants update when crossing the region boundary.
- Selected furniture → View this piece in my room: twenty audited public catalog models can produce a self-contained measured piece link and QR. The separate page never initializes the editor or private project store. Runtime dimensions must match before AR is enabled. Private belongings/art are rejected, and unsupported textured tints/finishes are explicitly omitted. Desktop 3D remains available when native AR is not supported.
- Floor plan Studio: a recognition result opens a measured correction queue. Review original/edited geometry against the local reference, verify a real span, decide each proposal and complete the checklist. The reviewed result is another unconfirmed drawing; only Studio confirmation replaces the floor, with one Undo. Reference bytes, page, rotation, pipeline, geometry and scale changes invalidate stale evidence. Local backups preserve bounded evidence with reference hashes.

## Verification and practical limits

Local browser checks exercised separate-project creation, authored fireplace off, mixed vegetation loading, seasonal preview/apply/Undo with identical furniture records, and the actual standalone model-viewer. The sofa's runtime checked bounds were 2,100 × 900 × 850 mm. A discovered vegetation crash was fixed by batching identical materials separately when vertex-channel layouts differ; geometry and UVs remain intact.

Automated checks cover saved-schema compatibility, exact source identity and backup verification, stale capture rejection, proposal-only edits, final confirmation/Undo, material restoration, mixed vertex layouts, launch/storage races, bounded links, private-data exclusion and actual GLB bounds.

Native camera/AR placement on physical iOS and Android devices is not verified by a desktop browser. The feature is labeled experimental; tracking accuracy must not substitute for physical measurements. Recognition benchmark tools require independently measured, consented examples. Synthetic tests prove behavior, not model accuracy or time savings. No representative accuracy dataset, native LiDAR scan, paid model call or local GPU setup is claimed.

Public client review and renderer handoffs use separate allowlists. Adding future visual fields must deliberately preserve privacy rather than spreading entire project records.

## NN-25 timing and outcome acceptance

Studio → Import → Online recognition → Local benchmark timing offers a session-only opt-in. It records a bounded device-local attempt before recognition starts, after the reference is rendered and its source identity established. File opening is excluded. Recognition can use the existing cache; this measures the recognition workflow, not provider latency or API reliability. Analysis, required scale correction and review are included in a completed run. Review elapsed time includes idle time.

After the exact attempt produces an editable proposal, the existing completed-review benchmark panel offers a separately recorded manual-tracing duration. Both runs must start with the same reference ready and end at a verified editable layout. A saved case includes its attempt identity; one timed attempt contributes at most one measured case. Source/page/rotation/pipeline changes, changed drawing evidence and explicit review restarts invalidate the live timing association. Reopening saved or recovered Studio drafts does not recover timing or the opt-in. Independently saved benchmark cases retain their already-recorded timing evidence outside plans, backups, cloud saves and public shares.

The optional attempt report counts proposal, failed, cancelled and unfinished/unknown outcomes separately. Its failure denominator is **proposal + failed**, never cancelled or unfinished/unknown. A proposal is not proof of correct geometry or completed review. File-opening failures precede the timed protocol and are excluded. Closing an active Studio run cancels that run; abrupt page/process loss leaves its pending outcome unknown. Failed outcome persistence also leaves unknown evidence, without a synthetic duration or successful completion. Attempt storage errors before analysis prevent that timed call. The log stops at 100 attempts instead of silently evicting its denominator; export and explicit deletion start a new collection. Use one Studio tab for a measured collection; cross-tab concurrent local-log writes are not an aggregate study guarantee.

Pilot acceptance remains outstanding:

- Recruit permissioned, representative image/PDF references with independently measured dimensions and geometry. Do not use detected measurements as reference truth.
- Compare matched recognition and manual-tracing runs under the stated start/finish protocol. Record median time to a verified editable plan and paired time saved, with case counts and missing timings exposed.
- Report geometry/dimension errors alongside workflow failure, cancellation and unfinished counts. Do not substitute the error rate among completed reviews for the recognition-attempt failure rate.
- Document source readability, layout complexity, cache behavior, interruptions and sample-selection limits. A small synthetic or voluntary collection cannot establish representative accuracy or time savings.

Mocked integration checks cover opt-out, timed comparison, failures, explicit cancellation with late responses, required scale correction, restored drafts, stale reviews and unchanged floor/history before final confirmation. No paid recognition or representative dataset evaluation is claimed.
