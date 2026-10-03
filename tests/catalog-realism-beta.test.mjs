import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,truncateSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const beta=await import('../scripts/build-catalog-realism-beta.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const sha=b=>createHash('sha256').update(b).digest('hex');
const commit='a'.repeat(40),catalogHash='b'.repeat(64);
const asset=(label)=>({sha256:sha(label),size:Buffer.byteLength(label),type:'model/gltf-binary'});
const active={schema:1,assets:{'/models/furniture/table.glb':asset('old table'),'/textures/wall.png':{...asset('wall'),type:'image/png'}}};
const candidate={schema:1,assets:{'/models/furniture/table.glb':asset('new table'),'/models/previews/table.webp':{...asset('preview'),type:'image/webp'},['/models/furniture/shared-textures/'+sha('texture')+'.png']:{...asset('texture'),type:'image/png'}}};

test('staging leaves every active canonical URL unchanged and adds only the feature prefix',()=>{
  const merged=beta.assembleBetaManifest('staging',active,candidate,commit);
  for(const [name,record] of Object.entries(active.assets))assert.deepEqual(merged.assets[name],record);
  assert.deepEqual(merged.assets[`/experiments/catalog-realism/${commit}/models/furniture/table.glb`],candidate.assets['/models/furniture/table.glb']);
  assert.equal(Object.keys(merged.assets).length,Object.keys(active.assets).length+Object.keys(candidate.assets).length);
});
test('final replaces canonical catalog assets while retaining unrelated active assets',()=>{
  const merged=beta.assembleBetaManifest('final',active,candidate,commit);
  assert.deepEqual(merged.assets['/models/furniture/table.glb'],candidate.assets['/models/furniture/table.glb']);
  assert.deepEqual(merged.assets['/textures/wall.png'],active.assets['/textures/wall.png']);
});
test('candidate manifests reject arbitrary upload paths, traversal, old scoped collisions and oversized objects',()=>{
  for(const bad of ['/api/projects','/models/furniture/../secret','/models/furniture/a.glb?x=1'])assert.throws(()=>beta.assembleBetaManifest('staging',active,{schema:1,assets:{[bad]:asset('x')}},commit),/candidate|path/i);
  assert.throws(()=>beta.assembleBetaManifest('staging',active,{schema:1,assets:{'/models/furniture/x.glb':{...asset('x'),size:33*1024*1024}}},commit),/size|32 MiB/i);
  const collision=structuredClone(active);collision.assets[`/experiments/catalog-realism/${commit}/models/furniture/table.glb`]=asset('bad');assert.throws(()=>beta.assembleBetaManifest('staging',collision,candidate,commit),/collision/i);
});
test('final R2 evidence must match the exact staged bytes and fixed Beta origin',()=>{
  const bytes=Buffer.from(JSON.stringify(candidate));const receipt={manifest_sha256:sha(bytes),completed:3,bytes:Object.values(candidate.assets).reduce((n,a)=>n+a.size,0),origin:beta.BETA_ORIGIN,verified_at:new Date().toISOString()};
  beta.verifyR2Receipt(receipt,bytes);
  for(const edit of [r=>r.completed--,r=>r.bytes++,r=>r.manifest_sha256='0'.repeat(64),r=>r.origin='https://production.example']){const r=structuredClone(receipt);edit(r);assert.throws(()=>beta.verifyR2Receipt(r,bytes),/R2|Beta/i);}
});
test('app artifact inventories reject stale files and unexpected additions',t=>{
  const root=mkdtempSync(path.join(tmpdir(),'catalog-beta-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(path.join(root,'client'));writeFileSync(path.join(root,'client/index.html'),'app');
  const inventory={files:{'client/index.html':{sha256:sha('app'),size:3}}};assert.equal(beta.verifyArtifactInventory(root,inventory).length,1);
  writeFileSync(path.join(root,'client/index.html'),'different');assert.throws(()=>beta.verifyArtifactInventory(root,inventory),/hash|size/i);
  writeFileSync(path.join(root,'client/index.html'),'app');writeFileSync(path.join(root,'unexpected.txt'),'oops');assert.throws(()=>beta.verifyArtifactInventory(root,inventory),/inventory|unexpected/i);
});
test('generated staging wrapper serves old canonical and new staged bytes; final uses new canonical and disables uploads',async t=>{
  const root=mkdtempSync(path.join(tmpdir(),'catalog-beta-worker-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  writeFileSync(path.join(root,'package.json'),'{"type":"module"}');writeFileSync(path.join(root,'app.js'),'export default {fetch:()=>new Response("existing app")};');writeFileSync(path.join(root,'library-assets.js'),readFileSync(new URL('../worker/library-assets.js',import.meta.url)));
  const data=new Map([['old table',asset('old table')],['new table',asset('new table')]].map(([bytes,record])=>['library/'+record.sha256,bytes]));
  const env={ASSETS:{fetch:async()=>new Response('missing',{status:404})},LIBRARY:{get:async key=>data.has(key)?{body:data.get(key)}:null}};
  for(const mode of ['staging','final']){
    const manifest=beta.assembleBetaManifest(mode,active,candidate,commit),filename=path.join(root,mode+'.mjs');writeFileSync(filename,beta.betaWorkerSource(mode,manifest));const {default:worker}=await import(pathToFileURL(filename));
    const canonical=await worker.fetch(new Request(beta.BETA_ORIGIN+'/models/furniture/table.glb?v=old'),env);assert.equal(await canonical.text(),mode==='staging'?'old table':'new table');assert.equal(canonical.headers.get('x-nook-asset-storage'),'r2');
    assert.equal(await (await worker.fetch(new Request(beta.BETA_ORIGIN+'/api/session'),env)).text(),'existing app');
    if(mode==='staging')assert.equal(await(await worker.fetch(new Request(beta.BETA_ORIGIN+`/experiments/catalog-realism/${commit}/models/furniture/table.glb`),env)).text(),'new table');
    else assert.equal((await worker.fetch(new Request(beta.BETA_ORIGIN+'/api/library-upload/'+asset('new table').sha256),env)).status,403);
  }
});
test('publishable archive contains exact dist bytes and enforces the expanded size ceiling',async t=>{
  const root=mkdtempSync(path.join(tmpdir(),'catalog-beta-tar-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const dist=path.join(root,'dist');mkdirSync(path.join(dist,'client'),{recursive:true});writeFileSync(path.join(dist,'client/index.html'),'exact app');
  const archive=path.join(root,'release.tar.gz'),receipt=await beta.packageBetaArchive(dist,archive),compressed=readFileSync(archive),tar=gunzipSync(compressed);
  assert.equal(receipt.sha256,sha(compressed));assert.equal(receipt.expanded_bytes,9);assert.equal(receipt.file_count,1);assert.equal(tar.subarray(0,100).toString().replace(/\0.*$/s,''),'dist/client/index.html');assert.equal(tar.subarray(512,521).toString(),'exact app');
  truncateSync(path.join(dist,'client/index.html'),beta.SITES_LIMIT);await assert.rejects(()=>beta.packageBetaArchive(dist,path.join(root,'oversized.tar.gz')),/250 MiB/);
});
test('packaging requires Beta-only identity, full 902 coverage and feature cache provenance',()=>{
  const plan={version:1,scope:'beta-only',projectId:beta.BETA_PROJECT,featureCommit:commit,betaSourceCommit:'c'.repeat(40),mode:'staging'};
  assert.throws(()=>beta.validateReleaseIdentity({...plan,projectId:'production'}, {expectedCount:902,items:Array(902).fill({})}),/Beta/i);
  assert.throws(()=>beta.validateReleaseIdentity(plan,{expectedCount:901,items:Array(901).fill({})}),/902/i);
  assert.throws(()=>beta.validateAppProvenance({commit_sha:commit,validation:{conclusion:'success',check:'Validate'},catalogRevision:'old'},commit,catalogHash,true),/revision/i);
});
test('final app cache revision changes when models are refined on a new feature commit',()=>{
  const revision=beta.catalogCacheRevision(catalogHash,commit),nextCommit='d'.repeat(40);
  assert.notEqual(revision,beta.catalogCacheRevision(catalogHash,nextCommit));
  const provenance={commit_sha:commit,catalogRevision:revision,inventorySha256:'e'.repeat(64),validation:{check:'Validate',conclusion:'success',run_id:'123',event:'pull_request',repository:'FahadArfin/Nook-and-Nest',head_ref:'codex/catalog-realism-overhaul',source_sha:commit,validated_sha:'f'.repeat(40),pr_number:12},sourceArchive:{path:'sites-source.tar.gz',sha256:'e'.repeat(64)},cacheOverlay:{decision:'validated',query:`catalog_realism=${revision}`}};
  beta.validateAppProvenance(provenance,commit,catalogHash,true);
  assert.throws(()=>beta.validateAppProvenance({...provenance,commit_sha:nextCommit},nextCommit,catalogHash,true),/revision/i);
  assert.throws(()=>beta.validateAppProvenance({...provenance,catalogRevision:catalogHash},commit,catalogHash,true),/revision/i);
});
function cacheSourceFixture(t){
  const root=mkdtempSync(path.join(tmpdir(),'catalog-beta-cache-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const inputs=['src/catalogRealism.ts','src/catalogRealismBeds.json','src/modelAssetPath.ts','src/scene/FurnitureModelLibrary.ts'].map(name=>{
    const bytes=name.endsWith('.json')?'["queen-bed"]\n':`// ${name}\n`,file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);return {path:name,sha256:sha(bytes)};
  });
  return {root,inputs};
}
test('final app cache provenance requires the bedding trim ID source binding',t=>{
  const {root,inputs}=cacheSourceFixture(t);beta.verifyFinalAppSourceInputs(root,inputs);
  assert.throws(()=>beta.verifyFinalAppSourceInputs(root,inputs.filter(input=>input.path!=='src/catalogRealismBeds.json')),/catalogRealismBeds\.json.*missing SHA256/);
});
test('final app cache provenance rejects a stale bedding trim ID source binding',t=>{
  const {root,inputs}=cacheSourceFixture(t);beta.verifyFinalAppSourceInputs(root,inputs);
  writeFileSync(path.join(root,'src/catalogRealismBeds.json'),'["queen-bed","single-bed"]\n');
  assert.throws(()=>beta.verifyFinalAppSourceInputs(root,inputs),/catalogRealismBeds\.json.*stale hash/);
});
test('catalog previews must be exact current front render bytes rather than an unrelated reviewed image',t=>{
  const root=mkdtempSync(path.join(tmpdir(),'catalog-beta-preview-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const bytes=Buffer.alloc(26);bytes.write('RIFF');bytes.writeUInt32LE(18,4);bytes.write('WEBP',8);bytes.write('VP8L',12);bytes.writeUInt32LE(6,16);bytes[20]=0x2f;bytes.writeUInt32LE(639|(479<<14),21);writeFileSync(path.join(root,'front.webp'),bytes);
  const front={view:'front',path:'front.webp',sha256:sha(bytes)},row={previewSource:{path:front.path,sha256:front.sha256}},record={sha256:sha(bytes),size:bytes.length};beta.verifyPreviewSource(root,row,record,{renders:[front]});
  assert.throws(()=>beta.verifyPreviewSource(root,row,{...record,sha256:sha('unrelated preview')},{renders:[front]}),/exact approved/);
  assert.throws(()=>beta.verifyPreviewSource(root,row,record,{renders:[{...front,view:'detail'}]}),/front/);
});
