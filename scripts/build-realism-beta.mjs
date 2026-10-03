// Run only in the separately opened Beta 1 Sites checkout. Keep its existing app
// and its R2 inventory; add the experiment as a separate static entry point.
import assert from 'node:assert/strict';
import { build as bundle } from 'esbuild';
import { build as viteBuild } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const projectId = 'appgprj_6aa3491b56808191b9322b08eb92e7ef';
const hosting = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
assert.equal(hosting.project_id, projectId, 'This build is restricted to Nook & Nest Beta 1.');
const manifest = readFileSync('.generated/library-manifest.json');
const hash = createHash('sha256').update(manifest).digest('hex');
assert.equal(hash, 'f3dd9690ac96a112f0e48f4da695ab2507145102af7567d37b8555cc5f547a79',
  'Beta library changed. Re-open and review the current beta before publishing.');
const receipt = JSON.parse(readFileSync('MODEL_LAB_PROVENANCE.json', 'utf8'));
// This 492-byte source import was externalized in the saved Beta snapshot.
// Restore its exact original Git blob, checked against that snapshot's receipt.
const restoredInput = 'public/textures/toronto/aerial-2022.json';
const preservedSource = JSON.parse(readFileSync('SOURCE_PROVENANCE.json', 'utf8'));
assert.equal(createHash('sha256').update(readFileSync(restoredInput)).digest('hex'),
  preservedSource.external_inputs[restoredInput].sha256, 'Restored Beta source input does not match its original receipt.');
assert.match(receipt.featureCommit, /^[0-9a-f]{40}$/);
assert.equal(receipt.betaSourceCommit, '9b81815930f248b6aa8d7a8ede3bdff124b9dbc5');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), receipt.betaSourceCommit,
  'The Beta checkout must still be the freshly opened source snapshot.');
const trackedChanges = execFileSync('git', ['diff', '--name-only', 'HEAD'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean);
assert(trackedChanges.every(file => file === '.openai/hosting.json'), 'Existing Beta application files changed.');
const additions = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean);
assert(additions.every(file => /^(model-lab\/|src\/experiments\/|public\/experiments\/realism-lab\/)/.test(file)
  || ['MODEL_LAB_PROVENANCE.json', 'vite.model-lab.config.mjs', 'scripts/build-realism-beta.mjs', restoredInput].includes(file)),
  'Unexpected files in the Beta overlay.');

await viteBuild();
execFileSync(process.execPath, ['scripts/prepare-sites-build.mjs'], { stdio: 'inherit' });
// Do not call prepareLibrary: this checkout intentionally contains an R2-backed
// inventory without the historical source GLBs. Regenerating would erase it.
await bundle({
  entryPoints: ['worker/projects.js'], outfile: 'dist/server/index.js', bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022',
  plugins: [{name: 'preserved-beta-library', setup(b) {
    b.onLoad({filter: /[/\\]library-manifest\.js$/}, () => ({
      contents: `export default ${manifest.toString('utf8')}`, loader: 'js',
    }));
  }}],
});
// The existing Beta worker uses these same logical bindings. Source hosting
// metadata is prepared in the hosting checkout only, never in the feature repo.
assert.equal(hosting.d1, 'DB');
assert.equal(hosting.r2, 'LIBRARY');
writeFileSync('dist/.openai/hosting.json', JSON.stringify(hosting, null, 2) + '\n');
cpSync('drizzle', 'dist/.openai/drizzle', {recursive: true});
await viteBuild({configFile: 'vite.model-lab.config.mjs'});
mkdirSync('dist/client/model-lab', {recursive: true});
cpSync('.generated/model-lab-build/model-lab/index.html', 'dist/client/model-lab/index.html');
cpSync('.generated/model-lab-build/assets', 'dist/client/model-lab/assets', {recursive: true});
assert.equal(createHash('sha256').update(readFileSync('.generated/library-manifest.json')).digest('hex'), hash);
for (const id of ['sofa-current','sofa-material','sofa-refined','table-current','table-material','table-refined']) {
  assert(readFileSync(`dist/client/experiments/realism-lab/${id}.glb`).equals(readFileSync(`public/experiments/realism-lab/${id}.glb`)), `${id} changed during build`);
}
console.log(JSON.stringify({projectId, featureCommit: receipt.featureCommit, preservedLibrarySha256: hash, experimentVariants: 6}));
