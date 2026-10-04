import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {resolveConfig} from 'vite';
import {catalogProductionDefine,productionCatalogRevision} from '../scripts/catalog-production-activation.mjs';
import {sha256,readRuntimeCatalog} from '../scripts/lib/catalog-realism-inventory.mjs';
import {productionBinding,readProductionManifest,assertProductionReadiness,assertProductionRuntime,regenerateReviewedModel} from '../scripts/prepare-catalog-production-assets.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(readFileSync(path.join(root,'assets-source/catalog-realism/catalog.json'),'utf8'));
const readiness=manifest=>({ok:true,count:manifest.models.length,results:manifest.models.map(row=>({id:row.id,ok:true,artifactSetSha256:row.artifactSetSha256,stats:{visualReview:'approved'}}))});

test('active runtime preserves approved dimensions and mounting for all 902 models',async()=>{
  const runtime=await readRuntimeCatalog(root);
  assertProductionRuntime(catalog,runtime);
  const resized=structuredClone(runtime);resized.catalog[0].widthMm+=1;
  assert.throws(()=>assertProductionRuntime(catalog,resized),/dimensions/);
  const remounted=structuredClone(runtime);remounted.catalog[0].mount='incompatible-test-mount';
  assert.throws(()=>assertProductionRuntime(catalog,remounted),/mounting/);
  const missing=structuredClone(runtime);missing.catalog.pop();
  assert.throws(()=>assertProductionRuntime(catalog,missing),/coverage/);
});

test('production promotion binds the exact reviewed 902-model delivery and runtime revision',async()=>{
  const manifest=readProductionManifest(root);
  assert.equal(manifest.models.length,902);
  assert.equal(Object.keys(manifest.assets).length,1883);
  assertProductionReadiness(catalog,manifest,readiness(manifest));
  assert.equal(productionCatalogRevision,productionBinding.assetSetSha256);
  const config=await resolveConfig({root,mode:'production'},'build');
  assert.equal(config.define['import.meta.env.VITE_CATALOG_REALISM_VERSION'],JSON.stringify(productionBinding.assetSetSha256));
  const built=await build({entryPoints:['src/modelAssetPath.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.DEV':'false',...catalogProductionDefine('build')}});
  const runtime=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  for(const row of manifest.models){
    assert.equal(runtime.modelAssetPath(row.id),`${row.glb}?catalog_realism=${productionBinding.assetSetSha256}`);
    assert.equal(runtime.modelAssetPath(row.id,true),`/api/previews/${row.id}.webp?catalog_realism=${productionBinding.assetSetSha256}`);
  }
  assert(!runtime.modelAssetPath('backdrop-city').includes('catalog_realism'));
});

test('production promotion rejects incomplete, stale, or unapproved model evidence',()=>{
  const manifest=readProductionManifest(root),ready=readiness(manifest);
  const stale=structuredClone(ready);stale.results[0].artifactSetSha256='0'.repeat(64);
  assert.throws(()=>assertProductionReadiness(catalog,manifest,stale),/artifact set/);
  const pending=structuredClone(ready);pending.results[0].stats.visualReview='missing';
  assert.throws(()=>assertProductionReadiness(catalog,manifest,pending),/approval/);
  const missing=structuredClone(ready);missing.results.pop();
  assert.throws(()=>assertProductionReadiness(catalog,manifest,missing),/coverage/);
  const extra=structuredClone(manifest);extra.models[0].id='backdrop-city';
  assert.throws(()=>assertProductionReadiness(catalog,extra,ready),/review|coverage/i);
});

test('production regeneration matches reviewed geometry, shared image and preview bytes',async()=>{
  const manifest=readProductionManifest(root),ready=readiness(manifest);
  for(const id of ['abstract-poster','bookshelf']){
    const item=catalog.items.find(row=>row.id===id),row=manifest.models.find(row=>row.id===id),saved=new Map();
    await regenerateReviewedModel(root,item,row,ready.results.find(result=>result.id===id),manifest.assets,(name,bytes)=>saved.set(name,bytes));
    assert(saved.has(row.glb)&&saved.has(row.preview));
    assert([...saved.keys()].some(name=>name.includes('/shared-textures/')));
    for(const [name,bytes] of saved){assert.equal(sha256(bytes),manifest.assets[name].sha256);assert.equal(bytes.length,manifest.assets[name].size);}
    assert.equal(sha256(saved.get(row.preview)),row.previewSource.sha256);
  }
});

test('production regeneration rejects changed source, preview mapping or delivery bytes',async()=>{
  const manifest=readProductionManifest(root),row=manifest.models[0],item=catalog.items.find(item=>item.id===row.id),result=readiness(manifest).results[0];
  await assert.rejects(regenerateReviewedModel(root,item,{...row,inputGlbSha256:'0'.repeat(64)},result,manifest.assets,()=>{}),/source|Candidate/);
  await assert.rejects(regenerateReviewedModel(root,item,{...row,previewSource:{...row.previewSource,path:'public/models/previews/'+row.id+'.webp'}},result,manifest.assets,()=>{}),/approved front/);
  const assets=structuredClone(manifest.assets);assets[row.glb].sha256='0'.repeat(64);
  await assert.rejects(regenerateReviewedModel(root,item,row,result,assets,()=>{}),/delivery/);
});
