# Beta 2 doorway boundary repair

After drawing the closed doorway span under **Check walls & openings**, choose **Room beyond doorway** and **Adjacent hall or space**, confirm both jambs, and preview the free repair. Teal shows the receiving room/transfer; purple shows the remaining adjacent space. Apply changes both room shapes and the door in one Studio undo step. Normal Studio save, confirmation and 3D creation gates remain.

The client worker filters source ink, closes only the confirmed doorway computationally, and flood-fills inside the selected room pair's existing floor union. Orthogonal cells follow shared measured edges and source wall centers; nearby pointer/ink edges reuse existing coordinates. Connected cells owned by the room can transfer from the hall, preserving concave outlines through existing grouped rectangles. The computational barrier is not serialized as a wall; the rebuilt room boundary hosts a validated door. Existing matching doors keep their identity. Edited walls and other openings are protected.

Refuse leaks around the doorway, disconnected/missing floor, another room's overlap, tiny/excessive fragments, transfers exceeding 55% of the donor, or newly invalid fixtures. A source image with missing floor needs manual area correction before ownership repair. Curved/diagonal boundaries and automatic doorway confirmation are outside this tool. Luna and analysis cache versions are unchanged; no additional API request is made by this repair.

## Validation

- Source-image controlled regression: original 1448x1086 apartment image, reconstructed wrong room ownership, manually confirmed master entrance. Existing independent developer annotations were used only for scoring. Recess coverage 2.02% -> 93.30%; master IoU 73.63% -> 88.33%; hall IoU 58.39% -> 91.39%. Total floor union unchanged. These are one-image assisted-repair results, not a fresh Luna benchmark or general accuracy claim.
- Full Studio browser test: realistic pointer placement; 1.80 m² transfer preview; concave bedroom after apply; ensuite unchanged; one Undo restored exact original room rectangles and removed the door; Redo and the 3D confirmation gate worked.
- Unit/component regressions cover source leaks, wrong door orientation, pointer jitter, preserved floor area and save/reimport, existing doors, authored walls, missing floor, explicit apply/discard, and stale async results.
- Private reference image, test harness and evaluation artifacts stay outside Git and the deployed package.
