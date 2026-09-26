# Custom room drawing

Custom room is the primary direct tool. Click a sequence of wall corners at any angle; click the first corner or Close outline / Enter to close it. Closed spaces against existing walls and crossing partitions become named rooms immediately. Snap attracts wall endpoints, wall spans and nearby 45/90 degree directions; turning Snap off permits unrestricted placement. Large square resize handles and the rectangular yellow closure preview are removed. Exact dimensions remain in More tools. Navigation still starts in Pan / zoom.

Optional `polygon` vertices extend existing room and partial-cell rectangle records without changing schemaVersion. Rectangle bounds remain a broad-phase index; exact polygon clipping controls occupied floor, review overlaps, area, and 3D geometry. Floor tiles are clipped and triangulated, not rasterized stair steps. Diagonal wall spans, door/window apertures and wall-section removal use their real lengths. Existing orthogonal plans keep their established fast path and wall IDs.

The general drawing path splits segment crossings, removes dangling tails, and walks bounded faces. Nested faces are subtracted before producing regions, preserving holes. Simple outlines are validated before conversion and on project import. Undo, local draft recovery, JSON and reopened studio geometry retain vertices.

Geometry dependencies: [polygon-clipping](https://github.com/mfogel/polygon-clipping), MIT license, for polygon union/intersection/difference; [Earcut](https://github.com/mapbox/earcut), ISC license, for triangulation. No image model or external image upload is used for manual drawing.

Validation includes triangle and concave floor area, shared diagonal walls, nested rooms, automatic partition closure, snapped openings, saved JSON recovery, actual Babylon wall positions/lengths, and floor vertices staying within the room. Browser acceptance covers a five-sided room, conversion to 3D, reopening and splitting with a diagonal partition.
