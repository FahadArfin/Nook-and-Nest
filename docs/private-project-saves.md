# Private project saves

Batch 6 release staging is automated by `scripts/stage-sites-release.mjs`. Run it
after the production build, then pass the returned temporary project folder to
the standard Sites package helper. `scripts/verify-release.mjs` checks the generated
Worker, DB declaration, asset completeness and compressed client budget.

Implemented: ChatGPT-dispatch identity, owner-scoped project list/read/version APIs, explicit online snapshots, local multi-project autosave, restore-as-copy, and atomic stale-write protection. No public database IDs, credentials, or app-owned OAuth configuration are needed.

Online saves are explicit, not continuous synchronization. Local edits remain available without signing in. The project dialog labels this distinction. Online history retains the latest 20 snapshots per project; limits are 100 projects per person and 1 MB per document. Previously opened builds remain in device storage: signing out is not a device-data purge, and a shared computer should be treated accordingly.

## Release requirement

The original static hosting files remain intact as instructed. `build-project-server.mjs` extends the generated Worker and generated manifest with logical D1 binding `DB`, and copies the Drizzle migration metadata. No database has been provisioned or migrated on the public site yet.

The standard Sites packager overwrites the generated manifest with the source manifest. For the private-save release, stage `dist/` and its generated `.openai/hosting.json` as a temporary project, then run the standard Sites package helper against that staging project. Do not package directly from the original static root or the `DB` binding will be lost. Preserve the original project ID; include all `dist/.openai/drizzle/` files. Check the archived manifest has `d1: "DB"` before saving/publishing a version.

Publishing must still verify real sign-in, private data isolation, migration application, a save/reload, and cross-device access. Local tests exercise actual SQLite with the same generated migration and prepared statements, not just mocked authorization responses. They do not prove the hosted sign-in flow.

## Security and recovery

- Only dispatcher `oai-authenticated-user-id` establishes ownership. No owner comes from the URL or document.
- Writes require same-origin JSON requests; private API responses bypass service-worker caching.
- Every save compares the caller's known revision to the latest revision atomically. A stale client receives a conflict with a save-as-copy recovery path.
- Loading an older version creates a new project ID, leaving the original untouched.
- Opening a newer online snapshot over a differing local snapshot preserves a local recovery copy.
- Malformed or oversized files are rejected before replacing the editor's plan.
- Authenticated cloud saving remains unavailable in the local Vite-only preview. It shows the local library and an explanatory message; it does not impersonate a signed-in visitor.
