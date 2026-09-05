# GitHub checks and Sites publishing

Work on a `codex/` feature branch in an isolated worktree when other edits are in progress. Push the branch and open a pull request to `master`. The **Validate** check runs type checking, application tests, model integrity tests, the production build, hosting tests, release size checks and archive verification. Fix failures before merging. Do not bypass required checks.

After merge, the same workflow validates the actual master commit and uploads **sites-release-FULL_SHA**, retained for seven days. The artifact contains `sites-release.tar.gz` and `release.json`. PR runs validate packaging but are not production release candidates. A manual run on master can recreate an expired artifact. No Sites credentials are stored in GitHub.

## Final agent handoff

1. Wait for the successful **push to master** run. Verify its commit still matches the intended master release. Download that run's named artifact with `gh run download RUN_ID -n sites-release-FULL_SHA -D OUTPUT_DIRECTORY`.
2. Verify the receipt SHA, project ID, archive SHA-256, required files, and expanded size. Use the archive unchanged; do not rebuild or mix in local changes. The CI packager preserves the generated hosting manifest and database migrations.
3. In a checkout of that exact commit, use the Sites hosting workflow to obtain a short-lived source credential and push that commit to the existing Sites source branch. Read `git rev-parse --verify HEAD` after the successful push.
4. Save a Sites version using that SHA and the downloaded archive, then publish to the existing authorized public audience. Poll until success and verify the live entry/assets match the downloaded build.
5. Report the live URL and PR. A successful GitHub workflow means **ready to publish**, not **published**. If master has advanced, use the newer successfully validated release instead of silently rolling back the site.

The user has authorized this routine public release flow. No additional conversational approval is needed. Sites publishing remains an authenticated agent step until a supported external CI deployment API is available. Keep the GitHub workflow deterministic; it does not need an AI agent to run tests. Original Blender modeling and visual review remain part of feature work.
