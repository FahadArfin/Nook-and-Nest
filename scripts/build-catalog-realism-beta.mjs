/**
 * Offline, Beta-1-only packager. No upload, Git mutation, source rebuild or
 * production hosting changes. Invoke: node scripts/build-catalog-realism-beta.mjs PLAN.json
 *
 * Plan v1: {scope:'beta-only', mode:'staging'|'final', projectId, featureCommit,
 * betaSourceCommit, catalog:{path,sha256}, activeManifest:{path,sha256},
 * activeR2Verification:{path,sha256}, reviewedManifest:{path,sha256}, assetRoot,
 * betaHosting:{path,sha256}, libraryHandler:{path,sha256},
 * betaApp:{root,inventory:{path,sha256},provenance:{path,sha256}},
 * featureApp:{root,inventory:{path,sha256},provenance:{path,sha256}},
 * featureSource:{path,sha256},
 * candidateR2Verification?:{path,sha256}, output:'.generated/catalog-realism-beta/NAME'}.
 * Paths are relative to the feature root, or absolute read-only input paths.
 * App inventories are {files:{'client/index.html':{sha256,size},...}}; their
 * provenance binds inventorySha256, commit_sha, successful Validate run_id.
 * Final provenance also binds catalogRevision and the verified cache URL overlay.
 * Reviewed asset manifest: {version:1,scope:'beta-only',featureCommit,catalogSha256,
 * assets:{'/models/furniture/ID.glb':{sha256,size,type},...},
 * models:[{id,inputGlbSha256,artifactSetSha256,glb,preview,previewSource:{path,sha256}}],
 * review:{decision:'approved',reviewer,assetSetSha256}}. assetSetSha256 is canonical
 * JSON SHA256 of the entire manifest excluding review. Optimization is reproduced
 * from the reviewed authoring bytes; optimized geometry and images must match.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync,lstatSync,existsSync,createWriteStream,createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createGzip} from 'node:zlib';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {build as bundle} from 'esbuild';
import {canonicalJson} from './lib/catalog-realism-inventory.mjs';
import {requireCatalogReady,reviewImageDimensions} from './lib/catalog-realism-validate.mjs';
import {resolveRepoPath} from './lib/model-pipeline-inspect.mjs';
import {shareImages,shouldCompressModel} from './optimize-model-assets.mjs';
import {compressGeometry} from './compress-model-geometry.mjs';

export const BETA_PROJECT='appgprj_6aa3491b56808191b9322b08eb92e7ef';
export const BETA_ORIGIN='https://nook-and-nest-beta-1.fwad101.chatgpt.site';
export const SITES_LIMIT=250*1024*1024;
const HASH=/^[a-f0-9]{64}$/,COMMIT=/^[a-f0-9]{40}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const jsonBytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const validPath=name=>typeof name==='string'&&/^\/[a-zA-Z0-9_./-]+$/.test(name)&&!name.split('/').some(p=>p==='..'||p==='.')&&!name.includes('//');
const candidatePath=name=>/^\/models\/furniture\/[a-z0-9-]+\.glb$/.test(name)||/^\/models\/previews\/[a-z0-9-]+\.webp$/.test(name)||/^\/models\/furniture\/shared-textures\/[a-f0-9]{64}\.(?:png|jpg)$/.test(name);
const stagePrefix=commit=>`/experiments/catalog-realism/${commit}`;
const boundPath=(root,name)=>path.isAbsolute(name)?path.resolve(name):resolveRepoPath(root,name);
function readBound(root,record,label) {
  assert(record&&HASH.test(record.sha256),`${label}: missing SHA256`);const file=boundPath(root,record.path),stat=lstatSync(file);
  assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<1024*1024*1024,`${label}: invalid input file`);const bytes=readFileSync(file);
  assert.equal(sha(bytes),record.sha256,`${label}: stale hash`);return bytes;
}
function walkFiles(root,directory='') {
  const result=[];for(const entry of readdirSync(path.join(root,directory),{withFileTypes:true})) {
    const relative=directory?`${directory}/${entry.name}`:entry.name;assert(!entry.isSymbolicLink(),'Artifact symlinks are forbidden');
    if(entry.isDirectory())result.push(...walkFiles(root,relative));else {assert(entry.isFile(),'Artifact contains a non-file');resolveRepoPath(root,relative);result.push(relative);}
  }return result.sort();
}
export function verifyArtifactInventory(root,inventory) {
  assert(inventory?.files&&typeof inventory.files==='object','Artifact inventory missing');const names=walkFiles(root);
  assert.deepEqual(names,Object.keys(inventory.files).sort(),'Artifact inventory contains missing or unexpected files');
  for(const name of names){const record=inventory.files[name],file=resolveRepoPath(root,name),bytes=readFileSync(file);assert(HASH.test(record.sha256)&&Number.isSafeInteger(record.size)&&bytes.length===record.size,`Artifact size differs: ${name}`);assert.equal(sha(bytes),record.sha256,`Artifact hash differs: ${name}`);}
  return names;
}
function validateAssetManifest(manifest,candidate=false) {
  assert(manifest?.assets&&typeof manifest.assets==='object','Library assets missing');
  for(const [name,asset] of Object.entries(manifest.assets)) {
    assert(validPath(name)&&(!candidate||candidatePath(name)),`Invalid ${candidate?'candidate ':''}asset path: ${name}`);
    assert(HASH.test(asset.sha256)&&Number.isSafeInteger(asset.size)&&asset.size>0&&asset.size<=32*1024*1024,'Library object size must be 1 byte to 32 MiB with SHA256');
    assert(typeof asset.type==='string'&&/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(asset.type),'Invalid library content type');
    if(candidate){const expected=name.endsWith('.glb')?'model/gltf-binary':name.endsWith('.webp')?'image/webp':name.endsWith('.jpg')?'image/jpeg':'image/png';assert.equal(asset.type,expected,'Candidate content type differs');}
  }
}
export function assembleBetaManifest(mode,active,candidate,commit) {
  assert(['staging','final'].includes(mode)&&COMMIT.test(commit),'Invalid Beta mode or feature commit');validateAssetManifest(active);validateAssetManifest(candidate,true);
  const assets=structuredClone(active.assets);
  for(const [name,record] of Object.entries(candidate.assets)) {
    const target=mode==='staging'?stagePrefix(commit)+name:name;
    if(mode==='staging'&&assets[target])assert.deepEqual(assets[target],record,'Staged feature path collision');assets[target]=structuredClone(record);
  }
  return {...active,assets};
}
export function verifyR2Receipt(receipt,manifestBytes) {
  const manifest=JSON.parse(manifestBytes);validateAssetManifest(manifest);
  assert.equal(receipt.origin,BETA_ORIGIN,'R2 verification must belong to Beta 1');
  assert.equal(receipt.manifest_sha256,sha(manifestBytes),'R2 verification manifest hash differs');
  assert.equal(receipt.completed,Object.keys(manifest.assets).length,'R2 verification is incomplete');
  assert.equal(receipt.bytes,Object.values(manifest.assets).reduce((n,a)=>n+a.size,0),'R2 verified byte total differs');
  assert(typeof receipt.verified_at==='string'&&Number.isFinite(Date.parse(receipt.verified_at)),'R2 verification timestamp missing');
}
export function validateReleaseIdentity(plan,catalog) {
  assert(plan.version===1&&plan.scope==='beta-only'&&plan.projectId===BETA_PROJECT,'Packaging is restricted to Beta 1');
  assert(['staging','final'].includes(plan.mode)&&COMMIT.test(plan.featureCommit)&&COMMIT.test(plan.betaSourceCommit),'Invalid Beta release identity');
  assert(catalog.expectedCount===902&&catalog.items?.length===902,'All 902 reviewed catalog models are required');
}
export function catalogCacheRevision(catalogSha256,commit) {
  assert(HASH.test(catalogSha256)&&COMMIT.test(commit),'Invalid catalog cache identity');
  return sha(`${catalogSha256}\n${commit}`);
}
export function validateFeatureCheckout(checkout,commit) {
  assert.equal(checkout.head,commit,'Selected feature HEAD differs');
  assert.equal(checkout.branch,'codex/catalog-realism-overhaul','Catalog feature branch required');
  assert.equal(checkout.status,'','Feature checkout must be clean');
}
export function assertCleanFeatureHead(root,commit) {
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  validateFeatureCheckout({head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),status:git('status','--porcelain')},commit);
}
export function validateAppProvenance(provenance,commit,catalogSha256,final=false) {
  assert.equal(provenance.commit_sha,commit,'App artifact source commit differs');
  assert(provenance.validation?.check==='Validate'&&provenance.validation.conclusion==='success','App artifact requires successful Validate evidence');
  const revision=final?catalogCacheRevision(catalogSha256,commit):null;
  if(final)assert.equal(provenance.catalogRevision,revision,'Final app catalog cache revision is missing or stale');
  assert(typeof provenance.validation.run_id==='string'&&provenance.validation.run_id.length>0,'App Validate run ID missing');
  assert(HASH.test(provenance.inventorySha256),'App inventory SHA256 missing');
  if(final)assert(provenance.cacheOverlay?.decision==='validated'&&provenance.cacheOverlay.query===`catalog_realism=${revision}`,'Final model URL cache overlay validation missing');
  if(final){
    const check=provenance.validation;
    assert(check.event==='pull_request'&&check.repository==='FahadArfin/Nook-and-Nest'&&check.head_ref==='codex/catalog-realism-overhaul'&&check.source_sha===commit&&COMMIT.test(check.validated_sha)&&Number.isSafeInteger(check.pr_number)&&check.pr_number>0,'Final app must distinguish feature HEAD from successful PR merge Validate evidence');
    assert(HASH.test(provenance.sourceArchive?.sha256)&&provenance.sourceArchive.path==='sites-source.tar.gz','Exact feature source archive binding missing');
  }
}
export function verifyFinalAppSourceInputs(root,inputs) {
  assert(Array.isArray(inputs),'Final app cache/color source input bindings missing');
  for(const name of ['src/catalogRealism.ts','src/catalogRealismBeds.json','src/modelAssetPath.ts','src/scene/FurnitureModelLibrary.ts']){const record=inputs.find(input=>input.path===name);readBound(root,record,'Final app cache/color source '+name);}
}
function appInput(root,spec,commit,catalogSha256,final=false) {
  assert(spec&&typeof spec.root==='string','Prebuilt app artifact required');const directory=boundPath(root,spec.root),inventoryBytes=readBound(root,spec.inventory,'App inventory'),inventory=JSON.parse(inventoryBytes),provenance=JSON.parse(readBound(root,spec.provenance,'App provenance'));
  validateAppProvenance(provenance,commit,catalogSha256,final);assert.equal(provenance.inventorySha256,sha(inventoryBytes),'App provenance inventory differs');const files=verifyArtifactInventory(directory,inventory);
  for(const name of ['client/index.html','server/index.js','.openai/hosting.json'])assert(files.includes(name),'Incomplete app artifact: '+name);
  assert(files.some(name=>name.startsWith('.openai/drizzle/')&&name.endsWith('.sql')),'Database migrations missing');
  if(final){const scripts=files.filter(name=>name.startsWith('client/')&&name.endsWith('.js')).map(name=>readFileSync(resolveRepoPath(directory,name),'utf8'));
    // Minifiers keep the revision in a constant and the query in a template.
    const revision=catalogCacheRevision(catalogSha256,commit);
    assert(scripts.some(text=>text.includes(revision))&&scripts.some(text=>text.includes('?catalog_realism=')),'Final app compiled cache marker or revision missing');
    verifyFinalAppSourceInputs(root,provenance.cacheOverlay.sourceInputs);
  }
  return {directory,inventory,files,provenance};
}

export function reviewedAssetSetSha256(manifest){return sha(canonicalJson(Object.fromEntries(Object.entries(manifest).filter(([key])=>key!=='review'))));}
export function verifyPreviewSource(root,row,record,receipt) {
  const front=receipt.renders.find(render=>render.view==='front');
  assert(front&&row.previewSource?.path===front.path&&row.previewSource.sha256===front.sha256,'Catalog preview must be the currently approved front render');
  const bytes=readBound(root,row.previewSource,'Catalog preview render source'),dimensions=reviewImageDimensions(bytes);
  assert(dimensions.mimeType==='image/webp'&&dimensions.lossless&&dimensions.width>=640&&dimensions.height>=480,'Catalog preview source must be a full-resolution lossless WebP front render');
  assert(record.sha256===sha(bytes)&&record.size===bytes.length,'Catalog preview must preserve exact approved front WebP bytes');
}
async function verifyReviewedAssets(root,plan,catalog,ready,manifest) {
  assert(manifest.version===1&&manifest.scope==='beta-only'&&manifest.featureCommit===plan.featureCommit&&manifest.catalogSha256===catalog.catalogSha256,'Reviewed candidate manifest identity differs');validateAssetManifest(manifest,true);
  assert(manifest.review?.decision==='approved'&&typeof manifest.review.reviewer==='string'&&manifest.review.reviewer.trim().length>=3&&manifest.review.assetSetSha256===reviewedAssetSetSha256(manifest),'Optimized model and preview asset review missing or stale');
  assert(Array.isArray(manifest.models)&&manifest.models.length===902,'Reviewed manifest must map all 902 models');const rows=new Map(manifest.models.map(row=>[row.id,row]));assert.equal(rows.size,902,'Duplicate reviewed model');
  const assetRoot=boundPath(root,plan.assetRoot),expected=new Set();
  const verifyBytes=(name,bytes)=>{const record=manifest.assets[name];assert(record&&record.sha256===sha(bytes)&&record.size===bytes.length,'Reviewed optimized asset differs: '+name);expected.add(name);};
  for(const item of catalog.items) {
    const row=rows.get(item.id),result=ready.results.find(r=>r.id===item.id),receipt=JSON.parse(readFileSync(resolveRepoPath(root,item.outputs.receipt),'utf8'));
    assert(row&&row.artifactSetSha256===result.artifactSetSha256&&row.inputGlbSha256===receipt.outputs.glb.sha256,'Reviewed source artifact set differs: '+item.id);
    assert.equal(row.glb,`/models/furniture/${item.id}.glb`,'Canonical model mapping differs');assert.equal(row.preview,`/models/previews/${item.id}.webp`,'Canonical preview mapping differs');
    const input=readFileSync(resolveRepoPath(root,item.outputs.glb));assert.equal(sha(input),row.inputGlbSha256,'Candidate changed during packaging');
    let optimized=shareImages(input,(name,bytes)=>verifyBytes('/models/furniture/shared-textures/'+name,bytes));
    if(shouldCompressModel(item.id+'.glb',optimized.length))optimized=await compressGeometry(optimized);verifyBytes(row.glb,optimized);
    assert(manifest.assets[row.preview],'Reviewed catalog preview missing');
    assert.notEqual(manifest.assets[row.preview].sha256,item.preview.sha256,'Old preview cannot stand in for the upgraded model');
    verifyPreviewSource(root,row,manifest.assets[row.preview],receipt);expected.add(row.preview);
  }
  assert.deepEqual(Object.keys(manifest.assets).sort(),[...expected].sort(),'Candidate manifest contains unbound assets');
  for(const [name,record] of Object.entries(manifest.assets)){const bytes=readFileSync(resolveRepoPath(assetRoot,name.slice(1)));assert.equal(bytes.length,record.size,'Candidate asset size differs');assert.equal(sha(bytes),record.sha256,'Candidate asset hash differs');}
  return assetRoot;
}
function copyFile(from,to){mkdirSync(path.dirname(to),{recursive:true});copyFileSync(from,to);}
function tarHeader(name,size) {
  const header=Buffer.alloc(512);let filename=name,prefix='';if(Buffer.byteLength(name)>100){const cut=name.lastIndexOf('/');prefix=name.slice(0,cut);filename=name.slice(cut+1);}
  assert(Buffer.byteLength(filename)<=100&&Buffer.byteLength(prefix)<=155,'Archive path exceeds USTAR bounds');header.write(filename,0,100);header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);header.write(size.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);header.fill(32,148,156);header.write('0',156);header.write('ustar\0',257);header.write('00',263);header.write(prefix,345,155);const sum=header.reduce((n,v)=>n+v,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148);return header;
}
export async function packageBetaArchive(dist,archive,expectedInventory) {
  const files=walkFiles(dist),expanded=files.reduce((sum,name)=>sum+lstatSync(resolveRepoPath(dist,name)).size,0);assert(expanded<SITES_LIMIT,'Sites artifact exceeds 250 MiB expanded ceiling');
  if(expectedInventory)verifyArtifactInventory(dist,expectedInventory);
  async function* entries(){for(const name of files){const bytes=readFileSync(resolveRepoPath(dist,name));if(expectedInventory){assert.equal(sha(bytes),expectedInventory.files[name].sha256,'Artifact changed while archiving: '+name);assert.equal(bytes.length,expectedInventory.files[name].size,'Artifact size changed while archiving: '+name);}yield tarHeader('dist/'+name,bytes.length);yield bytes;if(bytes.length%512)yield Buffer.alloc(512-bytes.length%512);}yield Buffer.alloc(1024);}
  await pipeline(Readable.from(entries()),createGzip({level:6}),createWriteStream(archive,{flags:'wx'}));assert(lstatSync(archive).size<SITES_LIMIT,'Sites compressed archive exceeds 250 MiB ceiling');const hash=createHash('sha256');for await(const chunk of createReadStream(archive))hash.update(chunk);
  return {sha256:hash.digest('hex'),size:lstatSync(archive).size,expanded_bytes:expanded,file_count:files.length};
}

export function betaWorkerSource(mode,manifest) {
  assert(['staging','final'].includes(mode),'Invalid Beta worker mode');validateAssetManifest(manifest);
  return `import app from './app.js';\nimport {createLibraryHandler} from './library-assets.js';\nconst library=createLibraryHandler(${JSON.stringify(manifest)});\nexport default {async fetch(request,env,ctx){${mode==='final'?"if(new URL(request.url).pathname.startsWith('/api/library-upload/'))return new Response('Uploads disabled',{status:403});":''}return await library(request,env)??app.fetch(request,env,ctx);}};\n`;
}

export async function buildCatalogRealismBeta(root,plan) {
  const catalog=JSON.parse(readBound(root,plan.catalog,'Frozen catalog'));validateReleaseIdentity(plan,catalog);
  assertCleanFeatureHead(root,plan.featureCommit);
  // There is deliberately no partial/pilot/skip-review mode in the release path.
  const ready=requireCatalogReady(root,catalog);
  const activeBytes=readBound(root,plan.activeManifest,'Active Beta manifest'),active=JSON.parse(activeBytes);validateAssetManifest(active);
  verifyR2Receipt(JSON.parse(readBound(root,plan.activeR2Verification,'Active Beta R2 verification')),activeBytes);
  const candidateBytes=readBound(root,plan.reviewedManifest,'Reviewed optimized candidates'),candidates=JSON.parse(candidateBytes);
  const assetRoot=await verifyReviewedAssets(root,plan,catalog,ready,candidates);
  const uploadManifest={schema:1,assets:Object.fromEntries(Object.entries(candidates.assets).map(([name,record])=>[stagePrefix(plan.featureCommit)+name,record]))};
  const uploadBytes=jsonBytes(uploadManifest);
  if(plan.mode==='final')verifyR2Receipt(JSON.parse(readBound(root,plan.candidateR2Verification,'Candidate R2 verification')),uploadBytes);
  const beta=appInput(root,plan.betaApp,plan.betaSourceCommit,catalog.catalogSha256),feature=appInput(root,plan.featureApp,plan.featureCommit,catalog.catalogSha256,true),app=plan.mode==='staging'?beta:feature;
  readBound(root,plan.featureSource,'Exact feature source archive');assert.equal(plan.featureSource.sha256,feature.provenance.sourceArchive.sha256,'Feature source archive differs from CI app provenance');
  const hostingBytes=readBound(root,plan.betaHosting,'Beta hosting'),hosting=JSON.parse(hostingBytes);assert(hosting.project_id===BETA_PROJECT&&hosting.d1==='DB'&&hosting.r2==='LIBRARY','Beta hosting bindings differ');
  const handler=readBound(root,plan.libraryHandler,'Existing Beta library handler');
  assert(typeof plan.output==='string'&&/^\.generated\/catalog-realism-beta\/[a-zA-Z0-9_-]+$/.test(plan.output),'Output must be a fresh private generated Beta directory');const output=resolveRepoPath(root,plan.output);assert(!existsSync(output),'Output exists; use a new immutable build directory');
  const dist=path.join(output,'dist');mkdirSync(dist,{recursive:true});
  const merged=assembleBetaManifest(plan.mode,active,{schema:1,assets:candidates.assets},plan.featureCommit);
  const omit=name=>name.startsWith('client/experiments/catalog-realism/')||Object.hasOwn(active.assets,'/'+name.slice(7))&&name.startsWith('client/')||Object.hasOwn(candidates.assets,'/'+name.slice(7))&&name.startsWith('client/');
  for(const name of app.files)if(!omit(name))copyFile(resolveRepoPath(app.directory,name),resolveRepoPath(dist,name));
  // Preserve the previously published separate lab, never overlay old app bundles.
  if(plan.mode==='final')for(const name of beta.files)if(/^client\/(?:model-lab\/|experiments\/realism-lab\/)/.test(name))copyFile(resolveRepoPath(beta.directory,name),resolveRepoPath(dist,name));
  assert(existsSync(path.join(dist,'client/model-lab/index.html')),'Existing Beta model-lab route must be preserved');
  for(const name of walkFiles(dist))assert(!/^client\/(?:models\/|textures\/|data\/toronto\/)/.test(name)||!name.endsWith('.glb')&&!name.match(/\.(png|jpe?g|webp|bin|json)$/),'Unmanifested library asset would bypass verified R2 delivery: '+name);
  writeFileSync(path.join(dist,'.openai/hosting.json'),hostingBytes);
  const workerDir=path.join(output,'worker');mkdirSync(workerDir);copyFileSync(path.join(dist,'server/index.js'),path.join(workerDir,'app.js'));writeFileSync(path.join(workerDir,'library-assets.js'),handler);
  const worker=betaWorkerSource(plan.mode,merged);
  writeFileSync(path.join(workerDir,'index.js'),worker);await bundle({entryPoints:[path.join(workerDir,'index.js')],outfile:path.join(dist,'server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
  writeFileSync(path.join(output,'library-manifest.json'),uploadBytes);writeFileSync(path.join(output,'worker-library-manifest.json'),jsonBytes(merged));
  writeFileSync(path.join(output,'candidate-manifest.json'),candidateBytes);writeFileSync(path.join(output,'active-library-manifest.json'),activeBytes);
  // Uploader uses this root with the manifest's full feature-prefixed paths.
  const uploadRoot=path.join(output,'library');for(const name of Object.keys(candidates.assets))copyFile(resolveRepoPath(assetRoot,name.slice(1)),resolveRepoPath(output,'library'+stagePrefix(plan.featureCommit)+name));
  const planBytes=jsonBytes(plan);writeFileSync(path.join(output,'plan.json'),planBytes);
  const records=Object.fromEntries(walkFiles(dist).map(name=>{const bytes=readFileSync(resolveRepoPath(dist,name));return [name,{sha256:sha(bytes),size:bytes.length}];}));writeFileSync(path.join(output,'artifact-inventory.json'),jsonBytes({files:records}));
  // Awaited optimization/bundling must never turn an obsolete review into a
  // release. Recheck the exact source/receipt and app snapshot at commit time.
  const current=requireCatalogReady(root,catalog);assert.equal(canonicalJson(current.results.map(r=>[r.id,r.artifactSetSha256])),canonicalJson(ready.results.map(r=>[r.id,r.artifactSetSha256])),'Reviewed catalog changed during packaging');
  const recheckRecords=value=>{if(!value||typeof value!=='object')return;if(typeof value.path==='string'&&HASH.test(value.sha256))readBound(root,value,'Release plan input');else for(const child of Object.values(value))recheckRecords(child);};recheckRecords(plan);
  verifyArtifactInventory(beta.directory,beta.inventory);verifyArtifactInventory(feature.directory,feature.inventory);
  for(const input of feature.provenance.cacheOverlay.sourceInputs)readBound(root,input,'Feature app source input');
  for(const [name,record] of Object.entries(uploadManifest.assets)){const bytes=readFileSync(resolveRepoPath(uploadRoot,name.slice(1)));assert.equal(sha(bytes),record.sha256,'Staged R2 asset changed during packaging');assert.equal(bytes.length,record.size,'Staged R2 asset size changed during packaging');}
  const artifact=await packageBetaArchive(dist,path.join(output,'sites-catalog-realism-beta.tar.gz'),{files:records});
  const receipt={version:1,scope:'beta-only',mode:plan.mode,project_id:BETA_PROJECT,commit_sha:plan.featureCommit,beta_source_commit:plan.betaSourceCommit,catalogSha256:catalog.catalogSha256,planSha256:sha(planBytes),appInventorySha256:app.provenance.inventorySha256,artifactInventorySha256:sha(jsonBytes({files:records})),featureSourceSha256:plan.featureSource.sha256,activeManifestSha256:sha(activeBytes),reviewedManifestSha256:sha(candidateBytes),candidateManifestSha256:sha(uploadBytes),workerManifestSha256:sha(jsonBytes(merged)),catalogCount:ready.count,archive:artifact,uploadRoot,limitations:['Offline packaging does not establish deployment success. Publish and verify through the existing Beta project only.']};
  writeFileSync(path.join(output,'source-context.json'),jsonBytes(receipt));
  const python=process.env.PYTHON??(process.platform==='win32'?'python':'python3');
  const sourceArchive=JSON.parse(execFileSync(python,[path.join(root,'scripts/catalog-realism-source.py'),'release','--source',boundPath(root,plan.featureSource.path),'--sha256',plan.featureSource.sha256,'--context',path.join(output,'source-context.json'),'--hosting',boundPath(root,plan.betaHosting.path),'--output',path.join(output,'sites-source.tar.gz')],{encoding:'utf8'}));
  receipt.archives={'sites-catalog-realism-beta.tar.gz':artifact,'sites-source.tar.gz':sourceArchive};
  recheckRecords(plan);verifyArtifactInventory(dist,{files:records});
  assertCleanFeatureHead(root,plan.featureCommit);
  writeFileSync(path.join(output,'release.json'),jsonBytes(receipt));return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert(process.argv.length===3,'Pass the reviewed Beta release plan JSON path');const root=fileURLToPath(new URL('../',import.meta.url));const plan=JSON.parse(readFileSync(boundPath(root,process.argv[2]),'utf8'));console.log(JSON.stringify(await buildCatalogRealismBeta(root,plan),null,2));}
