#!/usr/bin/env node
/** Prepare lossless delivery bytes from the fully reviewed catalog. No approval or upload. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadReviewCatalog} from './catalog-realism-review.mjs';
import {requireCatalogReady} from './lib/catalog-realism-validate.mjs';
import {resolveRepoPath} from './lib/model-pipeline-inspect.mjs';
import {shareImages,shouldCompressModel} from './optimize-model-assets.mjs';
import {compressGeometry} from './compress-model-geometry.mjs';
import {reviewedAssetSetSha256,assertCleanFeatureHead} from './build-catalog-realism-beta.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function prepareCatalogRealismAssets(root,outputName,featureCommit) {
  assert(/^[a-f0-9]{40}$/.test(featureCommit),'Exact feature commit required');
  assert(/^\.generated\/catalog-realism-assets\/[a-zA-Z0-9_-]+$/.test(outputName),'Use a fresh generated catalog asset directory');
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),featureCommit,'Feature commit is not the selected worktree HEAD');
  assert(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim().startsWith('codex/'),'Feature branch required');
  assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'','Commit the reviewed source and assets before preparing delivery bytes');
  const catalog=loadReviewCatalog(root),ready=requireCatalogReady(root,catalog);
  assert.equal(ready.count,902,'Whole catalog approval is required');
  const output=resolveRepoPath(root,outputName);
  assert(!existsSync(output),'Output exists; retain it and choose a new immutable directory');
  mkdirSync(output,{recursive:true});
  const assets={},models=[];
  let authoringBytes=0;
  function save(name,bytes,type) {
    const record={sha256:sha(bytes),size:bytes.length,type};
    assert(bytes.length>0&&bytes.length<=32*1024*1024,'Library object exceeds delivery limit: '+name);
    if(assets[name]){assert.deepEqual(assets[name],record,'Asset name collision');return;}
    const target=resolveRepoPath(output,'library/'+name.slice(1));
    mkdirSync(path.dirname(target),{recursive:true});
    writeFileSync(target,bytes,{flag:'wx'});assets[name]=record;
  }
  for(const item of catalog.items) {
    const receipt=JSON.parse(readFileSync(resolveRepoPath(root,item.outputs.receipt),'utf8'));
    const input=readFileSync(resolveRepoPath(root,item.outputs.glb));
    assert.equal(sha(input),receipt.outputs.glb.sha256,'Candidate changed before delivery preparation');
    authoringBytes+=input.length;
    let model=shareImages(input,(name,bytes)=>save('/models/furniture/shared-textures/'+name,bytes,name.endsWith('.png')?'image/png':'image/jpeg'));
    if(shouldCompressModel(item.id+'.glb',model.length))model=await compressGeometry(model);
    const glb=`/models/furniture/${item.id}.glb`,preview=`/models/previews/${item.id}.webp`;
    save(glb,model,'model/gltf-binary');
    const front=receipt.renders.find(render=>render.view==='front');
    const previewBytes=readFileSync(resolveRepoPath(root,front.path));
    assert.equal(sha(previewBytes),front.sha256,'Approved front render changed');
    save(preview,previewBytes,'image/webp');
    models.push({id:item.id,inputGlbSha256:receipt.outputs.glb.sha256,
      artifactSetSha256:ready.results.find(result=>result.id===item.id).artifactSetSha256,
      glb,preview,previewSource:{path:front.path,sha256:front.sha256}});
  }
  const after=requireCatalogReady(root,catalog);
  assert.deepEqual(after.results.map(row=>[row.id,row.artifactSetSha256]),ready.results.map(row=>[row.id,row.artifactSetSha256]),'Reviewed source changed during delivery preparation');
  const manifest={version:1,scope:'beta-only',featureCommit,catalogSha256:catalog.catalogSha256,assets,models};
  const manifestPath=path.join(output,'candidate-manifest.pending-review.json');
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  const modelBytes=Object.entries(assets).filter(([name])=>name.endsWith('.glb')).reduce((sum,[,r])=>sum+r.size,0);
  const textureBytes=Object.entries(assets).filter(([name])=>name.includes('/shared-textures/')).reduce((sum,[,r])=>sum+r.size,0);
  const previewBytes=Object.entries(assets).filter(([name])=>name.endsWith('.webp')).reduce((sum,[,r])=>sum+r.size,0);
  const report={version:1,scope:'beta-only',count:models.length,featureCommit,assetSetSha256:reviewedAssetSetSha256(manifest),
    authoringBytes,modelBytes,textureBytes,previewBytes,modelAndTextureSavings:authoringBytes-modelBytes-textureBytes,
    manifest:manifestPath,assetRoot:path.join(output,'library'),
    status:'pending explicit delivery review; not uploaded or published'};
  writeFileSync(path.join(output,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  assertCleanFeatureHead(root,featureCommit);
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert.equal(process.argv.length,4,'Usage: node scripts/prepare-catalog-realism-assets.mjs .generated/catalog-realism-assets/NAME FEATURE_COMMIT');
  console.log(JSON.stringify(await prepareCatalogRealismAssets(fileURLToPath(new URL('../',import.meta.url)),process.argv[2],process.argv[3]),null,2));
}
