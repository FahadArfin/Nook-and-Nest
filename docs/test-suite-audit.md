# Test suite efficiency audit

Measured on Windows with two Vitest workers against master `f71e711` after the 37-model collection was published. Timing is machine-dependent; it is evidence for this change, not a CI timing assertion.

## Findings and changes

| Area | Baseline | Action |
| --- | ---: | --- |
| Full application suite | 433 passing tests, 92.3 seconds wall time | 432 passing tests across the same 42 files, 48.2 seconds after cleanup |
| Building/editor controls | 25.97 seconds of test execution | Start with a real empty catalog search; placement tests explicitly search for their required real furniture |
| Library controls | 21.23 seconds of test execution | Use a real one-item search for favorites, storage failure, expansion and callback checks; retain full-library rendering and navigation coverage |
| Two broad geometry scans | 0.72 seconds together, including other cozy regressions | Retain these inexpensive fidelity checks |
| Test invocation | A manually maintained list of 42 paths | Discover all `tests/**/*.test.ts` and `.test.tsx` files automatically |
| Local worker count | Only CI and manually supplied flags limited concurrency | Default to two workers, with per-file isolation retained |

The first focused after-run passed all 31 tests in the two UI files. Building controls took 3.79 seconds and library controls 4.90 seconds: 47.20 → 8.69 seconds combined, about 82% less execution time. No catalog data or production components were mocked or reduced. The one removed test duplicated category/type/global-search navigation; its clear-search focus and global-search assertions now live in the icon/dropdown navigation test.

Full-library smoke coverage still verifies the complete browseable card count after clearing an empty search. Pure filtering checks still inspect all catalog definitions. Narrow tests retain favorites persistence, blocked storage, no accidental placement/history changes, pointer versus keyboard placement, and editor undo/redo assertions.

## Checks deliberately retained

Model tests that look similar frequently protect different contracts: dimension envelopes, historical material keys, texture bytes, engine import, moving-node identity, and actual basin depth. Deleting them by name or test count would lose coverage for little measured benefit. The existing model, hosting, security, saving and release checks remain in the release gate.

The standalone Vitest configuration loads React transforms without development proxy plugins. File isolation stays enabled because suites use module mocks, browser globals and shared stores. Increasing worker count or disabling isolation is not used to manufacture a faster result. See [Vitest performance guidance](https://vitest.dev/guide/improving-performance), [test discovery](https://vitest.dev/config/include) and [worker limits](https://vitest.dev/config/maxworkers).

## Running tests

- `npm test`: complete application suite, automatically discovered, at most two workers.
- `npm test -- tests/library.test.tsx`: focused file run with the same configuration.
- `npm run test:watch`: rerun affected tests while editing.
- Release validation still runs application, asset, hosting, library, build and artifact integrity checks as documented in `release-workflow.md`.

For a comparable profile: `npm test -- --reporter=json --outputFile=.generated/test-profile.json`. Compare test-file execution separately from wall time, since import/setup, filesystem caches and concurrent machine activity affect the latter. Do not turn these measurements into flaky timeout assertions.

## Complete after-run and release validation

After integrating the other task's `52eae41` bottom-tools update, the automatically discovered suite passed **432 tests in all 42 files in 48.2 seconds**, compared with the 92.3-second baseline. This is approximately **48% less wall time** on this machine. One redundant navigation case was consolidated; its assertions remain covered. The final run's building-controls and library execution times were 2.79 and 3.78 seconds. Type checking, production build, all 3 asset checks, 10 hosting checks, 5 library checks and release integrity checks passed. The application asset manifest remains unchanged by this test-only feature.

The full runs occurred sequentially in the same isolated checkout with the same two-worker limit. Filesystem caches and the intervening bottom-tools integration can affect exact timings; the focused same-source UI comparison independently confirms the dominant reduction in repeated rendering. No timeouts were raised, tests skipped, coverage modes disabled, or release jobs removed.
