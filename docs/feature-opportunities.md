# Next opportunities

Five additions proposed on October 2, 2026. **NN-34 is implemented as a measured delivery worksheet; NN-37 has an implemented manual/link-based first increment. NN-33, NN-35 and NN-36 remain planned.** See [Delivery check and Home manual](delivery-and-home-manual.md) for implemented behavior and limits. They are separate from the original 32 features recorded in [roadmap-progress.json](roadmap-progress.json), the September 29 source tracker. The current feature guide reports 25 released features, seven implemented pilots and nine external acceptance/setup items; these recommendations do not change those totals or update the source tracker's release status. P1 means first to explore; P2 means a useful follow-on, not a delivery commitment.

The linked primary sources inform each opportunity. The proposed targets below are distinct from identical competitor capabilities. The NN-34 and NN-37 status notes describe the implemented scope; remaining opportunities are proposals.

## P1 · NN-33 · Review photos before sharing

**Value:** Hide personal details before a property photo enters a client pack or shared tour.

**First implementation:** Manual opaque masks and a flattened, reviewed image derivative. Preserve the private original and require an explicit choice of derivative for export or sharing.

**Acceptance and limits:** Check masks after crop/rotation, remove embedded metadata, and verify thumbnails and exports use the approved derivative. Manual review remains necessary; no automatic privacy guarantee or original-image replacement.

**Distinct scope:** Extends NN-08 review sharing and NN-31 photo-day preparation with pixel-level privacy editing; existing permission/publication controls stay in place.

**Source:** [Matterport: Use the Blur Tool](https://matterport.com/matterport-academy/intro-to-editing-tools/use-the-blur-tool) demonstrates privacy editing before sharing a digital twin.

## P1 · NN-34 · Check the delivery route

**Status:** Implemented bounded worksheet. Fixed-orientation measurements, unknowns, source changes and manual checks for stairs/turns are retained; this is not a physical carrying simulation.

**Value:** A piece may fit its room but fail at a doorway, stair landing or lift.

**First implementation:** Separate packaged and assembled dimensions, a short measured access route, and visible bottlenecks or missing measurements.

**Acceptance and limits:** Test dimensional comparisons and orientation assumptions. Unknown packaging or unsupported turns remain “needs checking.” Do not guarantee that movers can carry an item through or infer dimensions from a product name.

**Distinct scope:** Extends NN-03 owned-item measurements and NN-04 in-room clearance to transport access and packaging; does not duplicate staging reservations.

**Sources:** [Article: Measure for Delivery](https://www.article.com/measure-for-delivery) and [Room & Board: Measuring for Furniture Delivery](https://www.roomandboard.com/customer-service/measuring-for-delivery) describe access measurements beyond the final room.

## P2 · NN-35 · Map the room’s service points

**Value:** Plan near power/data, retain switch access and avoid covering vents.

**First implementation:** A toggleable 2D overlay of structured outlet, switch, data and vent markers with measured wall position, height, labels and user verification. Include the selected layer in drawing exports.

**Acceptance and limits:** Preserve anchors through Undo and floor edits; flag invalidated measurements. No circuit sizing, hidden-wire detection, ventilation calculation or code-compliance claim.

**Distinct scope:** Turns NN-30 observations into reusable typed markers and extends NN-20 drawings; general notes and furniture remain separate.

**Source:** [RoomSketcher: Create an Electrical Plan](https://help.roomsketcher.com/hc/en-us/articles/12794506158493-How-Do-I-Create-an-Electrical-Plan-in-RoomSketcher) documents located symbols and annotations. Data/vent overlays are our proposed extension.

## P2 · NN-36 · Compare homes with your furniture

**Value:** Compare two or three candidate homes using the same measured belongings and personal priorities.

**First implementation:** Explicitly select 2–3 private plans and an owned-furniture snapshot. Compare equivalent fit/clearance summaries and create separate editable copies for each property.

**Acceptance and limits:** Keep furniture dimensions consistent and source projects untouched. Show missing measurements and user-entered assumptions. No listing scraping or automatic “best home” verdict.

**Distinct scope:** NN-01 compares layouts within a design and NN-03 records belongings. This adds deliberate comparison across candidate properties.

**Source:** [RoomSketcher: Relocation Services](https://www.roomsketcher.com/relocation-services/) supports relocation planning. The cross-property comparison using one owned set is **our proposal**, not a claimed competitor feature.

## P2 · NN-37 · Keep the home’s manuals together

**Status:** Implemented first increment: private records, product/manual links, warranty and maintenance dates, service history and selected printable handover. File attachments, room anchors and automatic reminders remain future work. Backups retain links and records, not externally hosted documents.

**Value:** Find the correct manual, warranty and maintenance history alongside an installed item after move-in.

**First implementation:** A private register linked to rooms or owned items, selected manuals, warranty dates and a simple maintenance checklist. Begin with manual entry and local storage.

**Acceptance and limits:** Bound attachment storage, preserve document links in explicit backups, and expose missing files. Exclude documents from public sharing by default. Automatic claims handling, provider uploads and maintenance reminders require separate scope and explicit choice.

**Distinct scope:** Builds on NN-09 selections, NN-29 backup and NN-30 site notes; adds post-move ownership and upkeep records instead of another shopping list.

**Source:** [HomeZada: Home Builder Warranty Software](https://www.homezada.com/professionals/builders) combines manuals, warranties and maintenance in a digital home handover.

The released device-local **Saved ideas** shelf is an advancement of NN-28, not one of these five new recommendations. Its implementation and release evidence belong to the existing pilot tracker; public-gallery operating gates remain separate.
