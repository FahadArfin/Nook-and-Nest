#!/usr/bin/env node
/** Promote exact approved delivery bytes into a build, without changing source assets. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadReviewCatalog} from './catalog-realism-review.mjs';
import {requireCatalogReady} from './lib/catalog-realism-validate.mjs';
import {canonicalJson,sha256,readRuntimeCatalog} from './lib/catalog-realism-inventory.mjs';
import {resolveRepoPath} from './lib/model-pipeline-inspect.mjs';
import {shareImages,shouldCompressModel} from './optimize-model-assets.mjs';
import {compressGeometry} from './compress-model-geometry.mjs';
import {reviewedAssetSetSha256,verifyPreviewSource} from './build-catalog-realism-beta.mjs';

export const productionBinding=Object.freeze({
  manifestPath:'assets-source/catalog-realism/production-delivery.json',
  reviewedManifestSha256:'2099ba30567918b16ec9fb6f032bbef5a63013249ef6cf01acbe8f71263d74d4',
  sourceFeatureCommit:'35ae301a91ad22f6a26ace7853f94853f0ad5927',
  catalogSha256:'46cc5f5b689e3bceb14277edfceb6f5394fec2e22445ddfb017f509606f412ab',
  assetSetSha256:'93a1350377b0a81b4c9dad3ca14b6f46c7043cf00ae76049630929ca2e7abb79',
  count:902,
});
const reportName='.generated/catalog-realism-promotion.json';
const readinessRows=ready=>ready.results.map(({id,artifactSetSha256})=>({id,artifactSetSha256}));

function assertReviewedIdentity(manifest){
  assert(manifest.version===1&&manifest.scope==='beta-only'&&manifest.featureCommit===productionBinding.sourceFeatureCommit&&manifest.catalogSha256===productionBinding.catalogSha256,'Original reviewed delivery identity differs');
  assert(manifest.review?.decision==='approved'&&typeof manifest.review.reviewer==='string'&&manifest.review.reviewer.trim().length>=3,'Explicit delivery review is required');
  assert.equal(reviewedAssetSetSha256(manifest),productionBinding.assetSetSha256,'Reviewed delivery asset set changed');
  assert.equal(manifest.review.assetSetSha256,productionBinding.assetSetSha256,'Delivery review is stale');
}

export function readProductionManifest(root){
  const bytes=readFileSync(resolveRepoPath(root,productionBinding.manifestPath));
  assert.equal(sha256(bytes),productionBinding.reviewedManifestSha256,'Committed reviewed delivery manifest changed');
  const manifest=JSON.parse(bytes);assertReviewedIdentity(manifest);return manifest;
}

export function assertProductionReadiness(catalog,manifest,ready){
  assertReviewedIdentity(manifest);
  assert(catalog.catalogSha256===productionBinding.catalogSha256&&catalog.items.length===productionBinding.count,'Production catalog coverage changed');
  assert(ready.ok&&ready.count===productionBinding.count&&ready.results.length===productionBinding.count&&manifest.models.length===productionBinding.count,'Whole-catalog readiness coverage required');
  const expected=catalog.items.map(item=>item.id).sort();
  assert.equal(new Set(expected).size,productionBinding.count,'Duplicate production model');
  assert.deepEqual(manifest.models.map(row=>row.id).sort(),expected,'Reviewed model coverage differs');
  assert.deepEqual(ready.results.map(row=>row.id).sort(),expected,'Approval coverage differs');
  const results=new Map(ready.results.map(row=>[row.id,row]));
  for(const row of manifest.models){
    const result=results.get(row.id);
    assert(result.ok&&result.stats.visualReview==='approved','Current approval required: '+row.id);
    assert.equal(row.artifactSetSha256,result.artifactSetSha256,'Reviewed source artifact set differs: '+row.id);
    assert.equal(row.glb,`/models/furniture/${row.id}.glb`,'Canonical model mapping differs');
    assert.equal(row.preview,`/models/previews/${row.id}.webp`,'Canonical preview mapping differs');
  }
  for(const [name,record] of Object.entries(manifest.assets)){
    assert(/^\/models\/(?:furniture\/(?:[a-z0-9-]+\.glb|shared-textures\/[a-f0-9]{64}\.(?:png|jpg))|previews\/[a-z0-9-]+\.webp)$/.test(name)&&!name.includes('/backdrop-'),'Unexpected production asset path');
    assert(/^[a-f0-9]{64}$/.test(record.sha256)&&Number.isSafeInteger(record.size)&&record.size>0&&record.size<=32*1024*1024,'Invalid production asset record');
    assert.equal(record.type,name.endsWith('.glb')?'model/gltf-binary':name.endsWith('.webp')?'image/webp':name.endsWith('.png')?'image/png':'image/jpeg','Production content type differs');
  }
}

/** The save callback receives bytes only after their reviewed digest and size match. */
export async function regenerateReviewedModel(root,item,row,result,assets,save){
  assert(row.id===item.id&&result.id===item.id&&result.ok&&result.stats.visualReview==='approved'&&row.artifactSetSha256===result.artifactSetSha256,'Current source artifact approval differs');
  assert.equal(row.glb,`/models/furniture/${item.id}.glb`,'Canonical model mapping differs');
  assert.equal(row.preview,`/models/previews/${item.id}.webp`,'Canonical preview mapping differs');
  const receipt=JSON.parse(readFileSync(resolveRepoPath(root,item.outputs.receipt),'utf8'));
  assert.equal(receipt.outputs.glb.sha256,row.inputGlbSha256,'Reviewed source GLB differs');
  const input=readFileSync(resolveRepoPath(root,item.outputs.glb));
  assert.equal(sha256(input),row.inputGlbSha256,'Candidate source changed during production preparation');
  const checkedSave=(name,bytes)=>{
    const record=assets[name];
    assert(record&&record.sha256===sha256(bytes)&&record.size===bytes.length,'Reviewed delivery bytes differ: '+name);
    save(name,bytes);
  };
  let model=shareImages(input,(name,bytes)=>checkedSave('/models/furniture/shared-textures/'+name,bytes));
  if(shouldCompressModel(item.id+'.glb',model.length))model=await compressGeometry(model);
  checkedSave(row.glb,model);
  verifyPreviewSource(root,row,assets[row.preview],receipt);
  assert.notEqual(assets[row.preview].sha256,item.preview.sha256,'Original preview cannot replace the approved new render');
  checkedSave(row.preview,readFileSync(resolveRepoPath(root,row.previewSource.path)));
}

function backdropSnapshot(root){
  const result={};
  for(const folder of ['models/furniture','models/previews']){
    const directory=resolveRepoPath(root,'dist/client/'+folder);
    for(const name of readdirSync(directory).filter(name=>name.startsWith('backdrop-')).sort())
      result[folder+'/'+name]=sha256(readFileSync(path.join(directory,name)));
  }
  assert.equal(Object.keys(result).filter(name=>name.endsWith('.glb')).length,6,'Six existing backdrop models must remain available');
  return result;
}

export function assertProductionRuntime(catalog,runtime){
  assert.deepEqual(runtime.catalog.map(row=>row.id).sort(),catalog.items.map(row=>row.id).sort(),'Runtime catalog coverage differs from the approved production catalog');
  const rows=new Map(runtime.catalog.map(row=>[row.id,row]));
  for(const item of catalog.items){
    const current=rows.get(item.id);
    assert.deepEqual([current.widthMm,current.depthMm,current.heightMm],item.dimensionsMm,'Runtime dimensions differ: '+item.id);
    assert.equal(current.mount,item.mount,'Runtime mounting differs: '+item.id);
  }
}

export async function prepareCatalogProductionAssets(root,{onProgress}={}){
  // A failed rebuild must not leave a previous success record for packaging.
  const reportFile=resolveRepoPath(root,reportName);if(existsSync(reportFile))unlinkSync(reportFile);
  const manifest=readProductionManifest(root),catalog=loadReviewCatalog(root),ready=requireCatalogReady(root,catalog);
  assertProductionReadiness(catalog,manifest,ready);
  const runtime=await readRuntimeCatalog(root);
  assertProductionRuntime(catalog,runtime);
  const scenery=backdropSnapshot(root),saved=new Set(),rows=new Map(manifest.models.map(row=>[row.id,row])),results=new Map(ready.results.map(row=>[row.id,row]));
  const save=(name,bytes)=>{
    if(saved.has(name))return;
    const file=resolveRepoPath(root,'dist/client'+name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);saved.add(name);
  };
  let completed=0;
  for(const item of catalog.items){
    await regenerateReviewedModel(root,item,rows.get(item.id),results.get(item.id),manifest.assets,save);
    completed++;if(completed%50===0||completed===productionBinding.count)onProgress?.({completed,total:productionBinding.count});
  }
  assert.deepEqual([...saved].sort(),Object.keys(manifest.assets).sort(),'Production delivery contains unbound or missing assets');
  for(const [name,record] of Object.entries(manifest.assets)){
    const bytes=readFileSync(resolveRepoPath(root,'dist/client'+name));
    assert(bytes.length===record.size&&sha256(bytes)===record.sha256,'Production output changed: '+name);
  }
  const after=requireCatalogReady(root,loadReviewCatalog(root));
  assertProductionReadiness(catalog,readProductionManifest(root),after);
  assert.deepEqual(readinessRows(after),readinessRows(ready),'Approval artifacts changed during production preparation');
  assert.deepEqual(backdropSnapshot(root),scenery,'Backdrop assets changed during catalog preparation');
  const report={version:1,scope:'production',catalogSha256:productionBinding.catalogSha256,
    sourceFeatureCommit:productionBinding.sourceFeatureCommit,reviewedManifestSha256:productionBinding.reviewedManifestSha256,
    assetSetSha256:productionBinding.assetSetSha256,readinessSha256:sha256(canonicalJson(readinessRows(ready))),
    assets:manifest.assets,models:manifest.models};
  mkdirSync(path.dirname(reportFile),{recursive:true});writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  return {count:manifest.models.length,assetCount:saved.size,assetSetSha256:report.assetSetSha256,report:reportName};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert.equal(process.argv.length,2,'Usage: node scripts/prepare-catalog-production-assets.mjs');
  console.log(JSON.stringify(await prepareCatalogProductionAssets(fileURLToPath(new URL('../',import.meta.url)),{onProgress:({completed,total})=>console.log(`Verified production models: ${completed}/${total}`)})));
}
