import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createCatalogInventory,hashCatalogContract,hashCatalogInventory,catalogStatus,readGlbDocument} from '../scripts/lib/catalog-realism-inventory.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function glb(document){
  const text=Buffer.from(JSON.stringify(document)),padding=Buffer.alloc((4-text.length%4)%4,32);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+text.length+padding.length,8);header.writeUInt32LE(text.length+padding.length,12);header.writeUInt32LE(0x4e4f534a,16);
  return Buffer.concat([header,text,padding]);
}
function fixture(t){
  const root=mkdtempSync(path.join(tmpdir(),'catalog-realism-inventory-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const write=(name,bytes)=>{const file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);return {path:name,sha256:sha(bytes),bytes:Buffer.byteLength(bytes)};};
  const row={id:'test-chair',name:'Test chair',category:'Living',shape:'seat',mount:'floor',widthMm:600,depthMm:700,heightMm:800};
  const document={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'frame',mesh:0,extras:{motion_role:'fish',motion_index:0}}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],accessors:[{count:3},{count:3}],materials:[{name:'fabric',pbrMetallicRoughness:{baseColorFactor:[.2,.3,.4,1],metallicFactor:0,roughnessFactor:.8},alphaMode:'BLEND',emissiveFactor:[.1,0,0]}]};
  const inputs=[write('src/catalog.ts','immutable catalog input')];
  write('assets-source/blender/test-chair.blend','BLENDER source');write('public/models/furniture/test-chair.glb',glb(document));write('public/models/previews/test-chair.webp','RIFF preview');
  const runtime={catalog:[row],sourceInputs:inputs,details:{'test-chair':{family:'Chairs & stools',materialControls:[{id:'fabric',color:'#234567'}],supportSurfaces:{shelves:[],supportsDesktop:false,footprint:{x:0,z:0,offset:0,width:600,depth:700}}}}};
  return {root,write,runtime,document};
}
const structuralPass=async()=>({ok:true,issues:[],stats:{visualReview:'missing'},artifactSetSha256:'f'.repeat(64)});
async function inventory(f){return createCatalogInventory(f.root,{runtime:f.runtime,expectedCount:1});}
function processed(f,item){
  const outputs={sourceBlend:f.write(item.outputs.sourceBlend,'BLENDER candidate'),glb:f.write(item.outputs.glb,'candidate GLB')};
  const inputs=[f.write('tools/recipe.py','recipe v1')];
  const receipt={version:1,catalogId:item.id,inputContractSha256:item.contractSha256,state:'processed',inputs,changes:[{kind:'geometry',description:'Authored a fitted seat and joined frame'}],outputs};
  f.write(item.outputs.receipt,JSON.stringify(receipt));return receipt;
}

test('inventory freezes exact materials, authored metadata and support contracts without claiming progress',async t=>{
  const f=fixture(t),a=await inventory(f),b=await inventory(f),item=a.items[0];
  assert.deepEqual(a,b);assert.equal(a.scope,'beta-only');assert.equal(item.state,'pending');
  assert.deepEqual(item.dimensionsMm,[600,700,800]);assert.deepEqual(item.baselineGltf.materials,f.document.materials);
  assert.deepEqual(item.baselineGltf.nodes,f.document.nodes);assert.deepEqual(item.materialKeys,['fabric']);
  assert.equal(item.supportSurfaces.supportsDesktop,false);assert.equal(item.contractSha256,hashCatalogContract(item));
  assert.equal(a.catalogSha256,hashCatalogInventory(a));assert.equal((await catalogStatus(f.root,a,{inspectCandidate:structuralPass})).counts.pending,1);
});

test('inventory rejects duplicate IDs, missing assets, unsafe IDs and unexpected coverage',async t=>{
  const f=fixture(t);f.runtime.catalog.push({...f.runtime.catalog[0]});
  await assert.rejects(()=>createCatalogInventory(f.root,{runtime:f.runtime,expectedCount:2}),/duplicate/i);
  f.runtime.catalog.pop();await assert.rejects(()=>createCatalogInventory(f.root,{runtime:f.runtime,expectedCount:902}),/coverage/i);
  const original=f.runtime.catalog[0].id;f.runtime.catalog[0].id='../escape';
  await assert.rejects(()=>inventory(f),/catalog id/i);f.runtime.catalog[0].id=original;
  rmSync(path.join(f.root,'assets-source/blender/test-chair.blend'));
  await assert.rejects(()=>inventory(f),/ENOENT|missing/i);
});

test('hashes ignore only mutable work state and remain sensitive to dimension, material and output changes',async t=>{
  const f=fixture(t),manifest=await inventory(f),item=manifest.items[0];
  assert.equal(hashCatalogContract({...item,state:'processed'}),item.contractSha256);
  for(const mutate of [v=>v.dimensionsMm[0]++,v=>v.baselineGltf.materials[0].alphaMode='OPAQUE',v=>v.outputs.glb='public/elsewhere.glb']){
    const changed=structuredClone(item);mutate(changed);assert.notEqual(hashCatalogContract(changed),item.contractSha256);
  }
});

test('stale source inputs and baseline bytes invalidate otherwise processed receipts',async t=>{
  const f=fixture(t),manifest=await inventory(f),item=manifest.items[0];processed(f,item);
  assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate:structuralPass})).counts.processed,1);
  f.write('src/catalog.ts','changed catalog');let status=await catalogStatus(f.root,manifest,{inspectCandidate:structuralPass});
  assert.equal(status.counts.stale,1);assert.match(status.items[0].reason,/input/i);
  f.write('src/catalog.ts','immutable catalog input');f.write(item.sourceBlend.path,'changed baseline');
  status=await catalogStatus(f.root,manifest,{inspectCandidate:structuralPass});assert.equal(status.counts.stale,1);assert.match(status.items[0].reason,/baseline/i);
});

test('immutable source snapshots retain catalog identity and reject changed bytes or redirected paths',async t=>{
  const f=fixture(t),manifest=await inventory(f),originalHash=manifest.catalogSha256;
  const source=manifest.sourceInputs[0],snapshot='assets-source/catalog-realism/baseline-inputs/'+source.path;
  f.write(snapshot,readFileSync(path.join(f.root,source.path)));
  manifest.sourceInputs=[{...source,path:snapshot,sourcePath:source.path}];
  assert.equal(hashCatalogInventory(manifest),originalHash,'Snapshot relocation must retain the original catalog identity');
  f.write(source.path,'authorized app-only behavior change');
  assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate:structuralPass})).counts.pending,1);
  const bad=structuredClone(manifest);bad.sourceInputs[0].path='src/catalog.ts';
  assert.throws(()=>hashCatalogInventory(bad),/snapshot|path/i);
  f.write(snapshot,'changed frozen bytes');
  assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate:structuralPass})).counts.stale,1);
});

test('receipt inputs and output hashes cannot silently survive changes',async t=>{
  const f=fixture(t),manifest=await inventory(f),item=manifest.items[0];let receipt=processed(f,item);
  f.write(receipt.inputs[0].path,'recipe v2');assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate:structuralPass})).counts.stale,1);
  receipt=processed(f,item);f.write(receipt.outputs.glb.path,'changed candidate');
  assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate:structuralPass})).counts.stale,1);
});

test('empty changes and rejected structural validation never count as processed',async t=>{
  const f=fixture(t),manifest=await inventory(f),item=manifest.items[0],receipt=processed(f,item);
  receipt.changes=[];f.write(item.outputs.receipt,JSON.stringify(receipt));
  assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate:structuralPass})).counts.failed,1);
  processed(f,item);const result=await catalogStatus(f.root,manifest,{inspectCandidate:async()=>({ok:false,issues:['Changed sliding node'],stats:{}})});
  assert.equal(result.counts.failed,1);assert.match(result.items[0].reason,/sliding/);
});

test('review needs every current rendered view and the validated artifact set',async t=>{
  const f=fixture(t),manifest=await inventory(f),item=manifest.items[0],receipt=processed(f,item);
  const names=['front','rear','detail','underside','clay'];receipt.state='reviewed';
  receipt.review={decision:'approved',artifactSetSha256:'f'.repeat(64),views:Object.fromEntries(names.map(view=>[view,'Inspected authored construction and contact.']))};
  receipt.renders=names.map(view=>({view,...f.write(`assets-source/catalog-realism/renders/test-chair/${view}.png`,`PNG ${view}`)}));
  const inspectCandidate=async()=>({ok:true,issues:[],stats:{visualReview:'approved'},artifactSetSha256:'f'.repeat(64)});
  f.write(item.outputs.receipt,JSON.stringify(receipt));assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate})).counts.reviewed,1);
  receipt.renders.pop();f.write(item.outputs.receipt,JSON.stringify(receipt));assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate})).counts.failed,1);
  receipt.renders.push({view:'clay',...f.write('assets-source/catalog-realism/renders/test-chair/clay.png','PNG clay')});receipt.review.artifactSetSha256='e'.repeat(64);
  f.write(item.outputs.receipt,JSON.stringify(receipt));assert.equal((await catalogStatus(f.root,manifest,{inspectCandidate})).counts.stale,1);
});

test('malformed GLB and manifest tampering are rejected',async t=>{
  const f=fixture(t),manifest=await inventory(f);
  assert.throws(()=>readGlbDocument(Buffer.from('not GLB')),/GLB/);
  const bytes=glb(f.document);bytes.writeUInt32LE(bytes.length+4,8);assert.throws(()=>readGlbDocument(bytes),/GLB/);
  manifest.items[0].name='Changed';await assert.rejects(()=>catalogStatus(f.root,manifest,{inspectCandidate:structuralPass}),/manifest|contract/i);
});

test('tracked inventory covers the actual bundled runtime catalog and all 902 pending baseline contracts',async()=>{
  const root=path.resolve(import.meta.dirname,'..');
  const manifest=JSON.parse(readFileSync(path.join(root,'assets-source/catalog-realism/catalog.json'),'utf8'));
  const current=await createCatalogInventory(root);
  assert.equal(hashCatalogInventory(manifest),manifest.catalogSha256,'Frozen catalog identity changed');
  for(const source of manifest.sourceInputs){
    assert.equal(source.path,'assets-source/catalog-realism/baseline-inputs/'+source.sourcePath,'Frozen source must use its deterministic immutable snapshot');
    const bytes=readFileSync(path.join(root,source.path));assert.equal(sha(bytes),source.sha256,'Original source snapshot changed');assert.equal(bytes.length,source.bytes);
  }
  assert.equal(current.items.length,902);assert(current.items.every(item=>item.state==='pending'));
  for(let i=0;i<current.items.length;i++)assert.deepEqual(current.items[i],manifest.items[i],`Frozen contract mismatch for ${current.items[i].id}`);
  assert.equal(current.items.filter(item=>item.id.endsWith('-aquarium')).length,3);
  assert.equal(current.items.find(item=>item.id==='display-bookcase').supportSurfaces.shelves.length,3);
  assert.equal(current.items.find(item=>item.id==='door-barn-brace').baselineGltf.nodes.some(node=>node.extras?.motion_role==='sliding_leaf'),true);
});
