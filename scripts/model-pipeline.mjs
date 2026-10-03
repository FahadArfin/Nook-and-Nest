#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { acceptReview, inspectPipeline, requireReady, resolveRepoPath, validateKhronosGlb } from './lib/model-pipeline-inspect.mjs';

const usage = 'Usage: node scripts/model-pipeline.mjs inspect|ready <assets-source/model-pipeline/name.spec.json>\n       node scripts/model-pipeline.mjs accept-review <spec> --notes <repo-relative-notes.json>';
const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));

try {
  const [command, spec, ...args] = process.argv.slice(2);
  if (!spec || !['inspect','accept-review','ready'].includes(command)) throw new Error(usage);
  if (command === 'accept-review' ? args.length !== 2 || args[0] !== '--notes' : args.length > 0) throw new Error(usage);
  const inspection = inspectPipeline(spec, { root });
  const bytes = readFileSync(resolveRepoPath(root, inspection.geometry.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), inspection.geometry.sha256, 'GLB changed during inspection');
  const formatValidation = await validateKhronosGlb(bytes, { uri: inspection.geometry.path });
  let result = inspection;
  if (command === 'accept-review') {
    const notesPath = resolveRepoPath(root, args[1]);
    assert(statSync(notesPath).size <= 128 * 1024, 'Visual review notes exceed 128 KiB');
    const notes = JSON.parse(readFileSync(notesPath, 'utf8'));
    result = acceptReview(spec, notes, { root, expectedArtifactSetSha256: inspection.artifactSetSha256 });
  } else if (command === 'ready') {
    result = requireReady(spec, { root });
    assert.equal(result.artifactSetSha256, inspection.artifactSetSha256, 'Artifacts changed during format validation');
  }
  console.log(JSON.stringify({ ...result, formatValidation }, null, 2));
} catch (error) {
  console.error(`Model pipeline: ${error.message}`);
  if (error.diagnostics) console.error(JSON.stringify(error.diagnostics, null, 2));
  process.exitCode = 1;
}
