import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';

async function paths(revision, dev = false) {
  const result = await build({entryPoints:['src/modelAssetPath.ts'],bundle:true,write:false,format:'esm',platform:'node',
    define:{'import.meta.env.DEV':JSON.stringify(dev),'import.meta.env.VITE_CATALOG_REALISM_VERSION':JSON.stringify(revision)}});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}

test('ordinary builds retain existing sofa and preview cache contracts', async()=>{
  const model=await paths('');
  assert.equal(model.modelAssetPath('sofa'),'/models/furniture/sofa.glb?v=sofa-realism-1');
  assert.equal(model.modelAssetPath('sofa',true),'/api/previews/sofa.webp?v=sofa-realism-1');
  assert.equal((await paths('invalid')).modelAssetPath('sofa'),model.modelAssetPath('sofa'));
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

test('bedding trim follows the selected fabric color only in the beta catalog', async()=>{
  for(const [revision,enabled] of [['',false],['a'.repeat(64),true]]){
    const built=await build({entryPoints:['src/catalogRealism.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.DEV':'false','import.meta.env.VITE_CATALOG_REALISM_VERSION':JSON.stringify(revision)}});
    const module=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
    assert.equal(module.usesCatalogRealismBeddingTrim('queen-bed','modern-tailored-welting'),enabled);
    assert.equal(module.usesCatalogRealismBeddingTrim('table-lamp','tailored-tone-on-tone-stitch'),false);
    assert.equal(module.usesCatalogRealismBeddingTrim('queen-bed','modern-porcelain-detail'),false);
  }
});
