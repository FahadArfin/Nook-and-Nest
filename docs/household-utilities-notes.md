# Household utilities authoring handoff

HOME-044–057 have 15 original utility/safety models in `household_utilities.py`: 14 household families plus the separately placeable AC window adaptor. `create(catalog_id, M)` adds millimetre-scale editable parts into the caller's current scene; it does not clear, save, join, export, render, mutate shared integration files or publish. Front is negative Y; Z is up. Root pipeline owns exact envelope normalization, editable `.blend` preservation, export, material registration, previews and final rendered acceptance.

Reference sources were checked on 29 September 2026. Detailed links and dimension distinctions are recorded in `assets-source/household-utilities-references.json`. Every proposed ID was checked against existing expansion JSON names; fans, fireplaces, outdoor mini-split condenser, existing doorbell, network rack and countertop equipment are different constructions. Existing IDs are retained untouched. No manufacturer artwork, logos, CAD, textures or certification marks are embedded.

## Integration

Catalog rows use existing categories and shapes. Utility details go under Decor or Storage; appliances go under Living/Storage. The new type labels are Home utilities, Utility details and Safety details. All share current independent material and draft placement flows. None requires an architecture aperture. The models are layout objects with static controls, not operating electrical, HVAC or safety equipment.

| ID | Mount | Suggested bottom height, mm | Notes |
| --- | --- | ---: | --- |
| utility-storage-water-heater | floor | 0 | All fittings inside declared envelope; no pipe connections |
| duplex-electrical-outlet-plate | wall | 250 | Faceplate only; never cut wall |
| utility-panel-radiator | wall | 150 | Rear brackets touch host, thermostat on right |
| utility-portable-ac | floor | 0 | Fixed hose included in 580 mm total depth |
| utility-ac-window-adaptor | surface | user chooses | Independent static prop, no window fitting or automatic hose link |
| utility-air-purifier | floor | 0 | Static display/ring; no extra light object |
| utility-dehumidifier | floor | 0 | Fixed expanded tank pose, full height 650 mm |
| utility-electrical-panel | wall | 700 | Closed cover; internal switches remain editable source parts |
| safety-smoke-co-alarm | ceiling | ceiling minus 45 | Base at high Z, test face points down; default must follow ceiling rather than generic 1500 mm |
| utility-humidifier | surface | support top | Independent reservoir/base controls, no mist animation |
| utility-return-grille | wall | 100 | Exterior frame dimensions, not nominal duct dimensions |
| wall-switch-dimmer-plate | wall | 1050 | Original static paddle/slider arrangement |
| utility-thermostat | wall | 1400 | Original static display, not desktop temperature/time |
| safety-fire-extinguisher | wall | 450 | Bracket against wall, fixed hose/handles |
| utility-indoor-mini-split | wall | 2050 | Editable height, positive-Y mounting rail against wall |

Suggested heights are modeling defaults only. The end user retains editable heights, and no clearance or regulatory claim is implied.

## Construction and review focus

- Water heater: inspect the domed shoulders, separate access covers, top caps and low drain. The front service label is generic original geometry.
- Outlet: sockets are genuinely cut through separate faces into dark contact cavities. Avoid swapping contact dimensions when scaling.
- Radiator: front channels, rear folded convectors and top bars must read through genuine gaps. Original wider thermostat allowance is part of the width.
- Portable AC: corrugated hose is one open annular mesh folded upward behind the body; it does not penetrate an arbitrary window. The adaptor is a separate open-collar plate. Neither item claims a live connection.
- Purifier: lower intake is an actual cage, with a recessed filter cylinder and modeled radial exhaust. There is no photographic grille texture.
- Dehumidifier: bucket has independent bottom/walls and open interior around the upper machine; front water-level detail and rear drain stay editable.
- Panel: closed door hides the optional internal breaker toggles; internal parts are preserved in `.blend`. No opener behavior is introduced.
- Alarm: review **underside**, because the detailed control face points down in ceiling placement. Default front render alone misses its primary details.
- Humidifier: translucent tank has modeled wall thickness and an internal visible water block. There is no external image dependency.
- Grille: angled louvers have physically open slots over the dark plenum. Host wall is not cut.
- Switch/thermostat: static original labels and independently colored case, screen and controls.
- Extinguisher: inspect bracket, retaining straps, ring/pin, gauge and hose from rear/side. Red finish is a sensible recognizability default.
- Mini-split: separate top inlet bars, recessed bottom outlet, fixed louver and vanes; no combined outdoor condenser geometry.

The module deliberately creates no scene lights or animation. Geometry uses bounded ribs/louvers rather than dense micro-perforation. Intended budget is under 15,000 triangles per model, subject to root's measured GLB report. Python syntax and 15-row JSON structure passed local checks. **Blender execution, actual triangle counts, rendered multi-angle approval, browser validation and release remain root-owned acceptance steps; this handoff does not claim them complete.**

Initial front/rear/underside renders for all15 utility models were subsequently inspected. Corrected the shared grille helper so a rear-facing grille places its dark plenum behind its open slats; portable AC and dehumidifier need fresh renders for that source correction. The ceiling alarm's actual underside shows the modeled intake, TEST face and lens, while a top view only shows the mounting base; use the underside as its catalog preview. No other concrete construction blocker was found in this inspection. Corrected render/browser/release acceptance remains parent-owned.

Corrected front/rear/underside renders of the portable AC, dehumidifier and ceiling alarm were reviewed in `utility-final-review.jpg`. The rear slats now remain visible and the alarm catalog image shows its downward-facing intake and controls. No further visual repair is requested for these three. Browser and release acceptance remain pending.
