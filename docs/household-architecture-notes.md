# Household architecture: HOME-135–138

The four original construction families are authored in
`tools/blender/household_architecture.py`, through `create(catalog_id, M)` in the
parent driver's owned scene. Millimetre sources retain named parts. The module
does not clear scenes, export, save or render. Catalog rows are separate in
`src/householdArchitectureExpansion.json`. Official research and original design
targets are separated in `assets-source/household-architecture-references.json`.
No external mesh or product photograph is embedded.

## Real host behavior

The roof skylight is 900 × 1200 × 260 mm with an open insulated curb, interior
reveal, separate gaskets, folded weather flashing and glazing. It requires the
explicit saved `environment.flatRoof` setting and the highest occupied floor.
The roof follows that floor's actual polygon boundary, excludes identified outdoor
parts and is a 100 mm slab with a real 748 × 1048 mm cut through it. Roof picking
intersects the roof plane; full curb support and overlapping openings are checked.
The roof does not exist for legacy/default plans. Its material stays invisible in
ordinary dollhouse/cutaway use, becomes translucent during skylight editing and
opaque inside the flat walkthrough. The existing sun ceiling mask receives the
same cut. Moving/removing a skylight or toggling the roof invalidates architecture;
ordinary furniture edits keep their established incremental scene update path.
Ceiling-height edits refit the source's mounting plane in the same undo step.
Only the highest occupied floor is a supported roof host; this is not a sloped
roof generator or an automatic roof on every floor.

The secondary storm/screen door links to a single `door-flush`, `door-shaker`,
`door-six-panel` or `door-slim` placement via saved `hostDoorId`. It adapts to that
host's frame dimensions and supports an opposite-facing flip. Its frame, glass,
fine lower screen, hinges, lever and hydraulic closer are modeled separately.
It creates no aperture. Host movement/resize follows in the same history step;
host deletion removes the dependent leaf in that same step. Duplicating a floor
remaps child links to the copied entry door. Linked doors use the host's wall
visibility and a zero floor offset; they remain independent selectable pieces.
Sliding, folding, French pairs and other storm doors are excluded as hosts.
The screen pose and its closer are static, not animated operating hardware.

The sectional garage door has a 2850 × 2700 × 2400 mm complete envelope. Its actual
leaf/opening is 2700 × 2130 mm; the extra space contains jambs, rollers, a torsion
shaft, drums, springs and curved overhead return tracks. Four upper windows pass
through the top panel. Source Y runs from −91 to 2609 mm, so the normalized wall
anchor is at local planning Z +1259 mm; rotating the door rotates that offset.
Snapping, wall cuts, overlap checks and hidden-wall association use the leaf
anchor rather than the centered track envelope. Placement checks full overhead
height, room footprint and tall inside-wall intersections; a reversed installation must be flipped so tracks
extend into the room. Source metadata records the wall anchor and leaf aperture
for the parent's normalized export audit. The pose is fixed closed. No lifting
motion, motor behavior, spring-force simulation or installation compliance is
claimed.

The spiral has 16 individually built wedge treads, central sleeves and brackets,
balusters, a continuous helical timber rail, widened final tread sector and an
upper collar with a guard gap. At the nominal 2800 mm rise its full guard height
is 3700 mm. Existing `toFloorId`/`stairRiseMm` state fits it to the next floor. The
shaft is a genuine 64-sided circular opening 1960 mm in diameter; corner floor
outside that circle remains present. Separate lower and upper landing support
checks use the stair exits. Width, riser and headroom warnings are layout checks,
not code approval. The current flat walkthrough cannot climb stairs: it blocks
this new stair footprint and the upper shaft explicitly. Existing straight and
turning stair behavior is retained. Floor cells are not destructively erased.

## Integration and acceptance

`householdArchitectureGeometry.ts` is catalog-safe math and ID predicates with
type-only imports. It prevents the catalog/home-collection/domain import cycle.
`householdArchitecture.ts` handles hosts and polygon geometry. `HouseholdRoof.ts`
builds one bounded roof mesh and disposes its unique material with that mesh.
SceneController has narrow roof presentation, host anchor and base-height hooks.
Store commits synchronize dependent architecture before saving one history step.

Focused tests cover true roof mesh ray holes, opt-in/default behavior, roof edge
and overlap rejection, saved transforms, ceiling edits, garage aperture anchors,
secondary-leaf single cuts, opposite flips, host follow/delete, held-turn undo,
floor-copy link remapping, import guards, circular floor connectivity and flat
walk collision. Pointer regression verifies visible-host reattachment, persistence
through preview movement, and rejection of hidden walls or unsupported hover.
Architecture, household placement and walkthrough tests pass (27 tests);
TypeScript checks pass. Existing building asset
coverage includes the three new door/stair entries and excludes the secondary
leaf from aperture expectations.

The parent's serialized Blender execution saved editable sources and GLBs. The
corrected front/rear/underside contact sheet covers all four models. Actual source
bounds now exactly match the skylight's 900 × 1200 × 260 mm, garage's 2850 × 2700 ×
2400 mm and spiral's 2200 × 2200 × 3700 mm catalog envelopes. Garage spring sampling
was bounded without removing the continuous helix: the garage has 23,764 triangles,
the spiral 14,116, the skylight 2,532, and the screen door 2,824. The existing 35,000
triangle building budget remains unchanged. Actual imported-GLB ray tests verify
the skylight reveal, garage leaf offset, spiral upper landing and shaft clearance;
these plus existing building tests pass (15 tests). The screen-door source depth
is 150.657 mm and uses the established export normalization to 165 mm; its width
and height are exact before normalization.

Browser acceptance, production checks and release remain the parent collection's
serialized acceptance steps. Render review and automated tests do not replace
the parent's live placement and deployment checks.
