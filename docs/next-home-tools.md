# Photo privacy, service points and home comparison

Implemented October 3, 2026 as NN-33, NN-35 and NN-36. These complete the first increments of the five [next opportunities](feature-opportunities.md); they do not change the original 32-feature roadmap's pilot or external acceptance statuses. The external feature guide records the final deployment receipt separately.

## NN-33 — Review photos before sharing

In **Listing Studio → Photos & slides**, select a photo and choose **Review photo privacy**. Draw opaque black rectangles, or use the keyboard-accessible mask coordinates. Crop and rotate in quarter turns, preview the flattened image, then confirm that you inspected it. Saving creates a separate reviewed copy. Explicitly select **Use this reviewed copy** to enable its output.

The editor processes the saved local preview (at most 1,600 pixels per side), not the full original upload. Up to 80 masks are supported and output is bounded to 3 MiB. It makes a fresh opaque JPEG raster, stripping source metadata. Crop and rotation keep masks in source-pixel coordinates. Review is manual; it does not detect every face, address or private detail automatically.

Presentation packs omit source and paired-original images for privacy-reviewed slides. Client-review previews, selected provider inputs and optional still-render references use the chosen derivative. Unselected or stale copies block output. Duplicated raw sources cannot silently bypass a reviewed copy in a pack. Already published or submitted media is not recalled by editing a local copy; existing publication and provider recovery controls still apply.

Private listing backups intentionally retain originals and editable mask recipes. Do not distribute these backups as public presentation packs. Ordinary project backups and listing backups remain separate.

Source: [Matterport's Blur Tool](https://matterport.com/matterport-academy/intro-to-editing-tools/use-the-blur-tool) demonstrates privacy editing before sharing. Nook & Nest uses opaque masks rather than a blur effect.

## NN-35 — Map measured service points

Open **Project → Planning → Site notes → Service points**. Select a floor and wall, then enter an outlet, switch, data connection or vent. Each record includes a label, wall face, distance from endpoint A along A → B, and centre height above that floor, in millimetres. The map shows a draft until **Save measured marker**. A separate explicit name, date and checkbox record a self-reported on-site check.

Wall, opening, floor outline and elevation changes invalidate affected verification. Retained markers remain at their measured location and show **RECHECK** rather than moving silently. Missing-floor records can be relinked. Painting does not invalidate geometry checks. Replacing a measurement clears verification; ordinary Undo and design snapshots retain earlier document states. Saves and removals use existing one-step history.

**Floor plan studio → Layers & visibility → Service points** enables an optional layer, off initially. The existing floor-plan SVG export follows visible layers. Site notes also exports the saved visible map as SVG and a measured CSV for the selected floor; neither includes the unsaved draft. Wall-elevation exports are unchanged.

The optional service-point array is bounded to 200 records and stays with private plan saves, backups and snapshots. Public plan projections strip it with other private site notes. It is a planning record, not circuit design, concealed-wire detection, airflow analysis or code validation.

Source: [RoomSketcher's electrical-plan guidance](https://help.roomsketcher.com/hc/en-us/articles/12794506158493-How-Do-I-Create-an-Electrical-Plan-in-RoomSketcher) describes located symbols and annotations. Our data/vent records extend that planning pattern.

## NN-36 — Compare homes with your furniture

Add measured belongings in **Arrangements → My furniture**, then open **Project → Planning → Compare homes**. Choose 2–3 distinct private local projects or explicitly selected online projects and 1–40 owned items. Capture a frozen measurement snapshot. Review the starting floor, position and orientation for each property, along with property measurements and any assumptions. Initial staging is disclosed and begins unverified.

Every home uses the same furniture dimensions, passage preference and chair allowance. The result compares overlaps, floor-edge crossings, gaps below preference and supported chair allowances. Missing or changed measurements, unsupported catalog obstacles, omitted checks and unreviewed positions remain visible unknowns. Existing furnishings remain obstacles. No result ranks a best home or guarantees a connected walking path, delivery access or real-world fit.

**Create editable copies** saves all comparison copies and their workspace references in one IndexedDB transaction. It never overwrites a source or switches the active project. A failed write rolls back the whole batch. Open a copy to arrange it in 3D, then return and refresh. Removed or resized items are flagged against the frozen measurements; changed copies require fresh review.

One bounded comparison workspace (256 KiB) is retained privately on this device. A new comparison replaces that workspace while its created projects remain. The workspace itself is not part of project backups or public shares. Copies are ordinary private projects and can be backed up or saved online explicitly. Stale workspace revisions and collaboration sessions prevent conflicting writes.

Source: [RoomSketcher's relocation planning](https://www.roomsketcher.com/relocation-services/) supports visualizing belongings in a new space. Comparing multiple properties with one frozen furniture set is our implementation, not a claimed competitor feature.

## Validation

Focused tests cover privacy geometry and output consumers, service record validation and stale geometry, private projections, drawing export visibility, exact furniture dimensions, source preservation and atomic storage rollback. `tests/photo-privacy-pixels.browser.ts` exercises the real browser codec: four rotations, crop/mask pixel checks, original metadata retained and derivative metadata removed. The release workflow runs the full application, asset and hosting checks before publishing the exact successful master artifact.

Browser acceptance uses synthetic photos and local sample homes; it does not publish a client review or submit paid generation. Authenticated cloud/provider behavior is covered by contract tests and remains subject to the site's existing configuration.
