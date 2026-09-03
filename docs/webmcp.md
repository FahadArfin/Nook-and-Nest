# Nook & Nest — WebMCP

## What it enables

Humans and browser agents decorate the same live 3D apartment. An agent reads measured floors, searches the 216-piece original Blender catalog, chooses colors and construction styles, and stages an entire arrangement. The user reviews that unsaved scene and applies or discards it. For creative delegation, **Agent → Let my agent apply designs** enables direct application for the current project in this tab. Each applied proposal is one ordinary undo step. Changing project or reloading revokes direct application; **Pause agent tools** rejects all tool calls and clears the pending proposal.

No OpenAI API key, paid inference dependency, MCP server, browser extension, remote execution endpoint or private-library access is added. The intelligence comes from the agent using the browser. Unsupported browsers keep the manual editor and show a compatibility explanation.

## Research, September 3, 2026

- [OpenAI challenge](https://openai.com/webmcp-challenge/): existing apps may add WebMCP; ChatGPT's in-app browser supports testing; deadline September 3 at 1 p.m. Pacific. Entry requires a working URL, repository, description and demo video.
- [Devpost requirements](https://webmcp.devpost.com/): judging includes usefulness, originality, execution and thoughtful human-agent interaction. Publication is not challenge submission.
- [September 2 WebMCP draft](https://webmachinelearning.github.io/webmcp/): imperative `document.modelContext.registerTool`, JSON Schema, native annotations and AbortSignal registration lifetime. This remains an experimental community proposal, not a finalized W3C standard. The current document API is used, not a fabricated global bridge or the older navigator-only API.

## Native tool contract

| Tool | Purpose |
| --- | --- |
| `nook_get_apartment` | Current project/floor, geometry, placements, support surfaces, warnings, revision and proposal status. No account or project-library enumeration. |
| `nook_search_catalog` | Search/paginate original pieces, mounting types, default dimensions, material slot IDs, variants and finish palettes. |
| `nook_stage_design` | Validate and show 1–100 ordered edits as an unsaved preview. Never writes the saved plan. |
| `nook_apply_design` | Apply exact proposal ID as one undo step; returns awaiting-user-review until direct edits are enabled. |
| `nook_discard_design` | Discard the exact unsaved proposal. |
| `nook_history` | Undo/redo one shared history step with revision guard and direct-edit permission. |
| `nook_set_view` | Switch floor/view and select a piece without changing furniture. View mode uses normal editor history. |

Stage operations: place/update/remove furniture; add a precisely measured floor region; paint/erase tiles; add/remove orthogonal interior walls; apply whole-floor, tile-region or wall finishes; change opt-in surroundings. Windows, doors, stairs and kitchen wall fittings reuse existing snap/fit validation. Other wall decor accepts precise coordinates and mount height, matching its manual editor behavior. Agents do not add/delete floor layers or switch saved projects; users retain those controls.

World transforms and dimensions use millimetres; X/Z denote furniture centers, elevation is bottom above floor, and rotation uses degrees (+90 turns local +Z toward +X). Tile cells and `add_room.origin` are grid indices. `wallsMm` is the convenient measured-wall representation; original `floor.walls` follows the saved schema's grid-coordinate convention. `cellRects` and `rectanglesMm` use mm. New dimensions are integer mm; existing fractional imperial grid measurements are preserved.

New pieces may have a temporary `key` that later operations reference through `id`, `ids`, or `supportId`. Example: add a desk with key `work`, then a laptop with `supportId: "work"` and coordinates on its top. The support checks the whole footprint. `shelfId` chooses a real usable shelf/cubby and centers the decoration there. Returned normalized transforms are authoritative. Moving a support never silently moves independently placed decor.

## Safety and persistence

- A page-local monotonic revision invalidates proposals after any human plan edit, undo/redo or project switch. Commit additionally compares the exact base plan reference and project ID.
- Strict runtime validation duplicates the advertised schema checks: unknown fields, nonfinite/out-of-range numbers, invalid IDs, unsupported colors, prototype keys and oversized batches fail before mutation.
- Batch construction uses an isolated plan clone. The same `commitDesign` action handles human and agent confirmation through the existing snapshot history. Existing UI actions and save schema remain compatible.
- Local autosave sees only the committed plan; previews never trigger it. Standard JSON backup, sharing and private online snapshots continue to work after applying a proposal. Tools themselves never save online or create public links.
- No arbitrary fetch/eval/URLs, authentication changes, credentials or other private saved-project enumeration are exposed. User-supplied labels are React text, and tools returning them mark untrusted content.
- Registration uses the real document-scoped API, handles unsupported/failed registration, and unregisters via AbortSignal on unmount. Runtime state is refreshed per call, not captured from an old React render.
- Bounds/height, rotated-footprint overlap and stair checks are layout guidance. They are not physical collision, doorway-access, circulation, structural or building-code guarantees. Rugs and valid shelf nesting do not produce false furniture-overlap warnings. Notes are capped at 100.

## Demonstration

Open the website in a WebMCP-capable browser. Use a new/local test project, open **Agent**, and ask:

> Furnish this apartment as a cozy creative studio. Choose a sofa, rug and media area, add a practical workspace with a laptop on the desk, and put a small collectible on a display shelf. Use warm wood, cream and clay. Show me the design before saving it.

Review **Apply design / Discard**, then demonstrate **Let my agent apply designs** for a color revision, and Undo for the entire arrangement. An agent should read state again after every committed edit. This integration does not enter or submit the challenge on the user's behalf.

## Verification

22 dedicated integration tests cover schema/registration/cleanup, unsupported browser and failure paths, read-only inspection/search, preview isolation from persistence, human review, direct apply, duplicate retries, same-millisecond stale protection, pause/project revocation, atomic invalid batches, materials, supports, measured rooms/walls/finishes, serialization, local reload, undo/redo and accessible controls.

September 3 release checks: all 170 tests, TypeScript, production build and four Sites tests passed. Release asset validation finds all 216 source/model/preview sets and the existing private DB binding. Main entry is 2,369,648 bytes / 606,255 gzip bytes. The verifier now reads the actual index.html entry instead of confusing older retained immutable bundles with the current bundle.

Real native WebMCP browser calls discovered all seven tools and exercised valid and intentional error paths for each (invalid floor, catalog limit, stale revision, missing proposal, invalid history and view). A 13-operation studio proposal created ten pieces, including a TV on a stand, laptop on a desk and figurine on the second shelf. Read-back confirmed zero saved pieces before human approval; approval added all ten in one history step. Native undo restored zero; redo restored all placements exactly. Direct-agent application changed sofa color; view switching worked; reload retained all ten pieces and the color while resetting permission to review-first. The final reload reports no overlap warnings for correctly nested shelf decor. Production publication is separately approved by the user; no challenge entry was submitted.
