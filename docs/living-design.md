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
