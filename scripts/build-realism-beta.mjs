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
// These build/test JSON inputs were externalized in the saved Beta snapshot.
// Restore exact original Git blobs, checked against that snapshot's receipt.
const restoredInputs = ['public/textures/toronto/aerial-2022.json', 'assets-source/studio-model-audit.json'];
const preservedSource = JSON.parse(readFileSync('SOURCE_PROVENANCE.json', 'utf8'));
for (const file of restoredInputs) assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),
  preservedSource.external_inputs[file].sha256, 'Restored Beta source input does not match its original receipt.');
assert.match(receipt.featureCommit, /^[0-9a-f]{40}$/);
assert.equal(receipt.betaSourceCommit, 'b8a472dfff65453495d4b3c9fbb19383a3694aac');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), receipt.betaSourceCommit,
  'The Beta checkout must still be the freshly opened source snapshot.');
const trackedChanges = execFileSync('git', ['diff', '--name-only', 'HEAD'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean);
const isExperimentPath = file => /^(model-lab\/|public\/experiments\/realism-lab\/)/.test(file)
  || ['src/experiments/realism-lab.ts', 'src/experiments/realism-lab.css', 'MODEL_LAB_PROVENANCE.json',
    'vite.model-lab.config.mjs', 'scripts/build-realism-beta.mjs'].includes(file);
assert(trackedChanges.every(file => file === '.openai/hosting.json' || isExperimentPath(file)), 'Existing Beta application files changed.');
const additions = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean);
assert(additions.every(file => isExperimentPath(file) || restoredInputs.includes(file)),
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
for (const id of ['sofa-sectional-current','sofa-sectional-rebuilt','sofa-current','sofa-material','sofa-refined','sofa-pipeline','sofa-rebuilt','table-current','table-material','table-refined']) {
  assert(readFileSync(`dist/client/experiments/realism-lab/${id}.glb`).equals(readFileSync(`public/experiments/realism-lab/${id}.glb`)), `${id} changed during build`);
}
const pipeline = JSON.parse(readFileSync('public/experiments/realism-lab/pipeline.json', 'utf8'));
assert.equal(pipeline.variant.id, 'sofa-pipeline');
assert.equal(pipeline.reviewedViews, 5, 'The detailed model needs all five reviewed export views.');
assert.equal(pipeline.variant.sha256, createHash('sha256').update(readFileSync('public/experiments/realism-lab/sofa-pipeline.glb')).digest('hex'), 'Reviewed pipeline output is stale.');
const rebuilt = JSON.parse(readFileSync('public/experiments/realism-lab/rebuilt.json', 'utf8'));
assert.equal(rebuilt.variant.id, 'sofa-rebuilt');
assert.equal(rebuilt.reviewedViews, 5, 'The realism revision needs all five reviewed export views.');
assert.equal(rebuilt.variant.sha256, createHash('sha256').update(readFileSync('public/experiments/realism-lab/sofa-rebuilt.glb')).digest('hex'), 'Reviewed realism revision is stale.');
const sectional = JSON.parse(readFileSync('public/experiments/realism-lab/sectional.json', 'utf8'));
assert.equal(sectional.variant.id, 'sofa-sectional-rebuilt');
assert.equal(sectional.reviewedViews, 5);
assert.equal(sectional.variant.sha256, createHash('sha256').update(readFileSync('public/experiments/realism-lab/sofa-sectional-rebuilt.glb')).digest('hex'), 'Reviewed sectional is stale.');
assert.equal(sectional.baseline.sha256, createHash('sha256').update(readFileSync('public/experiments/realism-lab/sofa-sectional-current.glb')).digest('hex'), 'Sectional baseline changed.');
console.log(JSON.stringify({projectId, featureCommit: receipt.featureCommit, preservedLibrarySha256: hash, experimentVariants: 10}));
