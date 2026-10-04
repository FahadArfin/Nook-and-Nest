import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {catalogProductionDefine} from '../scripts/catalog-production-activation.mjs';

async function paths(revision, dev = false) {
  const result = await build({entryPoints:['src/modelAssetPath.ts'],bundle:true,write:false,format:'esm',platform:'node',
    define:{'import.meta.env.DEV':JSON.stringify(dev),'import.meta.env.VITE_CATALOG_REALISM_VERSION':JSON.stringify(revision),...catalogProductionDefine(dev?'serve':'build',revision)}});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}

test('ordinary production builds activate the fixed approved catalog revision', async()=>{
  const model=await paths('');
  const revision='93a1350377b0a81b4c9dad3ca14b6f46c7043cf00ae76049630929ca2e7abb79';
  assert.equal(model.modelAssetPath('sofa'),`/models/furniture/sofa.glb?catalog_realism=${revision}`);
  assert.equal(model.modelAssetPath('sofa',true),`/api/previews/sofa.webp?catalog_realism=${revision}`);
  assert.equal((await paths('invalid')).modelAssetPath('sofa'),model.modelAssetPath('sofa'));
});

test('ordinary local development retains baseline assets until explicitly selected', async()=>{
  assert.equal((await paths('',true)).modelAssetPath('sofa'),'/models/furniture/sofa.glb?v=sofa-realism-1');
});

test('beta catalog revision selects fresh canonical assets and preserves scenery', async()=>{
  const revision='a'.repeat(64),model=await paths(revision),ordinary=await paths('');
  assert.equal(model.modelAssetPath('queen-bed'),`/models/furniture/queen-bed.glb?catalog_realism=${revision}`);
  assert.equal(model.modelAssetPath('queen-bed',true),`/api/previews/queen-bed.webp?catalog_realism=${revision}`);
  assert.equal(model.modelAssetPath('backdrop-city'),ordinary.modelAssetPath('backdrop-city'));
});

test('opt-in local preview loads isolated candidates rather than baseline assets', async()=>{
  const revision='b'.repeat(64),model=await paths(revision,true);
  assert.equal(model.modelAssetPath('queen-bed'),`/experiments/catalog-realism/models/queen-bed.glb?catalog_realism=${revision}`);
});

test('bedding trim follows selected fabric in production and explicit beta builds', async()=>{
  for(const [revision,enabled] of [['',true],['a'.repeat(64),true]]){
    const built=await build({entryPoints:['src/catalogRealism.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.DEV':'false',...catalogProductionDefine('build',revision)}});
    const module=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
    assert.equal(module.usesCatalogRealismBeddingTrim('queen-bed','modern-tailored-welting'),enabled);
    assert.equal(module.usesCatalogRealismBeddingTrim('table-lamp','tailored-tone-on-tone-stitch'),false);
    assert.equal(module.usesCatalogRealismBeddingTrim('queen-bed','modern-porcelain-detail'),false);
  }
});
