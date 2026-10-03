# Delivery check and Home manual

These optional tools live in the 3D editor under **Project → Planning**. They add private planning records to the existing project rather than changing furniture or architecture. Each saved change uses the existing project Undo, local autosave and explicit online-save workflow.

## Delivery check (NN-34)

Record a measured access route and the assembled item or shipping box to carry along it. Use clear openings after accounting for handles, trim and other obstructions. Model dimensions are a starting reference, never invented packaging dimensions.

Straight doorway/corridor comparisons report the remaining width and height for the selected orientation. A lift checks both its opening and its interior in that same orientation. Zero clearance, unknown measurements, a changed linked model, stairs and corners remain visible concerns. Clearing recorded dimensions is not a guarantee of maneuvering, carrying capacity or safe handling. Check these details with the supplier or mover.

The worksheet accepts manually measured items even when no model exists. A linked model can be removed without losing the transport record. Printing produces an explicit summary of the recorded route, item dimensions and unresolved checks.

Sources informing this scope: [Room & Board's measuring guide](https://www.roomandboard.com/customer-service/measuring-for-delivery) and [IKEA's delivery preparation guidance](https://www.ikea.com/jp/en/customer-service/services/delivery/). These sources support checking more than the final room; Nook & Nest's checks are its own bounded implementation.

## Home manual (NN-37, first increment)

Keep manually entered product/manual links, purchase and warranty dates, maintenance tasks, next-due dates and dated service history. Optionally link a record to existing furniture. Deleted links preserve the record and show that its model is missing. Blank dates remain unknown. Due-date filters use the user's local calendar day.

Maintenance completion records what was done and when. A new due date is entered explicitly; this version does not infer a schedule or send notifications. Search and filters help find records; a handover contains only the records deliberately selected for export.

This first increment stores text and links. It does not upload warranty files, fetch remote manuals or copy their contents into a backup. A portable project includes the saved links and records; access to a linked external document still depends on that document being available. Uploaded attachments and scheduled reminders remain later work.

The research reference is [HomeZada's home handover features](https://www.homezada.com/professionals/builders), which include warranty/manual records and maintenance. Nook & Nest begins with a private manual register rather than an automated provider service.

## Persistence and privacy

- Old projects have neither field until the user saves a record.
- `deliveryPlanning` and `homeManual` are bounded, validated optional fields in `PlanDocumentV1`. No schema version change is required.
- Layout alternatives and design milestones retain independent copies. Undo, private copies, JSON and portable backups preserve the records.
- Public links, public room packages and browser-agent responses omit these private records. Explicit delivery worksheets and selected handovers are separate exports.
- Invalid imported records and stale forms are rejected before mutation. Missing referenced furniture is retained as a warning, not silently deleted.

The original 32-feature tracker remains separate. NN-34 and this NN-37 increment advance two of the five new opportunities; NN-33, NN-35 and NN-36 remain planned.
