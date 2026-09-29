# Focused tests, complete release checks

Test execution does not send every assertion to an assistant. Repeated full runs, broad code reads and verbose failure dumps consume more time and context than a small assertion. Keep coverage where failure can lose work, alter geometry, expose private data or create duplicate generation jobs.

- During development: `npm test -- tests/feature.test.ts` for the affected suites, or `npm run test:related -- src/changed.ts` for Vitest's static import-based selection. Related selection is a convenience, not a release gate; dynamic imports and runtime relationships may need explicit suites.
- `npm test` still runs the full isolated application suite. The wrapper preserves its exit code and prints a compact result plus up to eight short failure excerpts. Complete text and JSON diagnostics are in `.generated/test-logs/` (ignored by Git). CI retains these logs for failed runs for seven days.
- Use one representative fixture for UI behavior and one canonical whole-catalog integrity pass. Keep original IDs, dimensions, source models, previews and actual Babylon-loading tests.
- At a stable release boundary run the full application suite, types, model/hosting tests and production build once. Repeat a gate only when new changes or a relevant failure justify it. PR Validate and the successful master release run remain mandatory.
- Browser checks prove real interactions and visual behavior; component tests do not prove model/GPU performance.

## September 28 cleanup

Consolidated catalog uniqueness and asset existence checks, smaller Library fixtures, repeated toolbar and save-retry setup, and recognition access gates. Replaced cadence/count assertions with observable behavior and export script allowlists. Strengthened recognition quotas with real SQLite boundaries. Local-server tests use deterministic fixtures: they never install a model or generate paid media.

No percentage reduction in AI tokens or runtime is claimed. Test count may increase when a combined matrix adds meaningful cases; deleting protection to chase a smaller count is not the objective.
