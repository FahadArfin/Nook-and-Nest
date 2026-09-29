# Household fixture variety HOME-085–092 and HOME-106

Ten models cover nine research families, including a genuinely open cabinet host for the independent microwave drawer. Geometry lives in `tools/blender/household_fixture_variety.py`; rows and reference evidence use matching household Fixture Variety names. The Python module has been syntax-checked. Root owns official Blender MCP execution, editable saves, export measurement, visual acceptance, integration and release; these remain pending at this handoff.

Every object is original millimetre geometry, with separate named construction parts. Manufacturer sources supply construction context only. Real published dimensions and the original model targets are explicitly distinguished in the reference JSON. No product photographs, logos or purchased geometry are embedded.

## Integration requirements

- **Articulated pot filler:** wall mount with no aperture. Negative Blender Y faces the room; escutcheon is at the back. It is a static, partly extended sideways pose with two joint collars and independent shutoffs. Choose a sensible above-counter height, approximately 1200 mm bottom as layout default, and keep manual wall height available. Do not imply working water or articulated UI.
- **Island hood:** `ceiling` mount, full 900 × 600 mm canopy footprint. The catalog height includes the vertical chimney and top fixing plate, with canopy and filters at the lowest end. Suspend the **top plate** from the chosen ceiling/anchor height; never floor-mount or invert the model. This is an island hood with finished construction on all four sides.
- **Upright freezer:** floor appliance in closed-door pose, including separate editable insulated sides, door gasket, wire shelves, hinges, controls and utility handle. No animated door is implied.
- **Microwave drawer:** independent surface appliance at 600 × 600 × 410 mm. It is not baked into a counter. The separate `kitchen-microwave-drawer-cabinet` is 650 × 700 × 900 mm, with an open upper bay and stone worktop. Its bay floor is raw Z 443 mm, clear height 420 mm, and usable 605 × 610 mm before normalized transformation. The deliberately deeper catalog envelope preserves more than 600 mm bay depth after the projecting handle is included in whole-model bounds. The driver emits exact transformed shelf metadata. Verify `fitsShelf` with the real new appliance before accepting this integration.
- **Host worktop:** raw top plane Z 900 mm, 610 × 610 conservative usable region. Only the true worktop should be counter-capable; the internal bay remains a shelf. Stone uses material ID `surface-stone`. Connect the existing independent worktop-finish control if its mapping requires an explicit ID.
- **Standalone bidet:** true hollow oval ceramic shell, molded pedestal, raised control deck, independent spray head, drain and overflow. No toilet lid, tank or seat. Floor placement only. The pedestal stops below the basin's inner floor, so it does not fill the cavity.
- **Walk-in tub:** actual deep cavity and integral seated platform. The catalog pose has a separate sealed closed door panel with gasket, latch, grab bar and handshower. The deep interior is not a painted dark rectangle. It is a planning model, with no automatic plumbing or accessibility validation.
- **Heated towel rail:** wall mount, no aperture, lower standoff/connector and grouped round rungs. Suggested initial bottom height 650 mm; leave editable. Towels remain independent accessories; none are forced into the model.
- **Garment steamer:** floor appliance with real wheels, telescoping hanger pole, translucent removable tank, bounded corrugated hose and handheld head. Source contains no steam effects or cloth simulation.
- **Tankless heater:** wall mount, no aperture; top collars are hollow, bottom service unions and short valves remain within the measured envelope. Suggested bottom height 1100 mm for a utility-wall layout. Do not create gas, water, flue or electrical connections or claim installation compliance.

Only the host cabinet exports support surfaces in this module; no usable tabletop is invented on sloping hood metal, appliance handles, bidet rims or the bathtub seat. Existing fixture IDs and saved placements are untouched.

## Reference review

Official Delta, Zephyr, GE, Sharp, Kohler and Amba pages were opened. The Kohler walk-in features PDF was also opened. Direct Rowenta and Rinnai links returned errors; official indexed product/manual sources were used and that limitation is recorded. New source code contains no dependent remote textures. The new ID search found no exact collision with existing expansion catalogs.

## Rendered construction review

All 10 models are accepted after front, rear and underside review. Bidet and bathtub cavities remain open; the island hood is finished on all sides and below; the microwave host bay is empty; wall fixtures have connected mounts. The steamer was rebuilt and rechecked in `entry-repair-steamer`: its hose reads separately from the mast and its reinforcement ribs follow the actual hose. The normalized microwave bay is 605.0 × 629.8 mm with 420.0 mm vertical clearance, admitting the independent 600 × 600 × 410 mm appliance. No catalog envelope changed. Application tests and publication remain separate release gates.
