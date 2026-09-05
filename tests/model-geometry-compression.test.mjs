import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {MeshoptDecoder} from 'meshoptimizer';
import {compressGeometry,parseGlb} from '../scripts/compress-model-geometry.mjs';
import {shareImages} from '../scripts/optimize-model-assets.mjs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import {Tools} from '@babylonjs/core/Misc/tools.js';
import '@babylonjs/loaders/glTF/index.js';

test('every model above 1 MB decompresses to identical geometry, metadata, materials and animation',async()=>{
 await MeshoptDecoder.ready;let count=0,saved=0;
 for(const file of readdirSync('public/models/furniture').filter(f=>f.endsWith('.glb'))){
  const input=shareImages(readFileSync('public/models/furniture/'+file),()=>{});if(input.length<=1_000_000)continue;
  const output=await compressGeometry(input),before=parseGlb(input),after=parseGlb(output);count++;saved+=input.length-output.length;
  assert(output.length<input.length,file);
  for(const field of ['nodes','meshes','accessors','materials','images','animations','scenes'])assert.deepEqual(after.g[field],before.g[field],file+':'+field);
  for(const [i,v] of before.g.bufferViews.entries()){
   const next=after.g.bufferViews[i],ext=next.extensions?.EXT_meshopt_compression;
   let actual=after.bin.subarray(next.byteOffset??0,(next.byteOffset??0)+next.byteLength);
   if(ext){actual=new Uint8Array(next.byteLength);MeshoptDecoder.decodeGltfBuffer(actual,ext.count,ext.byteStride,after.bin.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength),ext.mode,ext.filter);}
   assert.deepEqual(Buffer.from(actual),before.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),file+': view '+i);
  }
 }
 assert(count>=21);assert(saved>20_000_000);console.log({models:count,savedBytes:saved});
});

test('Babylon imports the compressed aquariums and largest tree using the shipped decoder with identical mesh data',async()=>{
 // Exercise the actual browser decoder asset through Babylon's extension; only script delivery is local.
 const load=Tools.LoadBabylonScriptAsync;
 Tools.LoadBabylonScriptAsync=async()=>{vm.runInThisContext(readFileSync('public/vendor/meshopt-decoder-1.2.0.js','utf8'));
  // Node has no browser Worker API; exercise the same shipped WASM codec on this thread.
  globalThis.MeshoptDecoder.useWorkers=()=>{};};
 try{
  for(const id of ['reef-aquarium','planted-aquarium','desktop-aquarium','weeping-willow']){
   const input=shareImages(readFileSync(`public/models/furniture/${id}.glb`),()=>{}),output=await compressGeometry(input);
   const engine=new NullEngine(),scene=new Scene(engine);
   try{
    const opts={pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}};
    const original=await LoadAssetContainerAsync(input,scene,opts),compressed=await LoadAssetContainerAsync(output,scene,opts);
    assert.equal(compressed.meshes.length,original.meshes.length);
    for(let i=0;i<original.meshes.length;i++){
     const a=original.meshes[i],b=compressed.meshes[i];assert.equal(b.name,a.name);assert.deepEqual(b.getIndices(),a.getIndices());
     for(const kind of a.getVerticesDataKinds())assert.deepEqual(b.getVerticesData(kind),a.getVerticesData(kind),id+':'+kind);
     assert.deepEqual(b.metadata,a.metadata);assert.deepEqual(b.position.asArray(),a.position.asArray());
    }
    original.dispose();compressed.dispose();
   }finally{scene.dispose();engine.dispose();}
  }
 }finally{Tools.LoadBabylonScriptAsync=load;}
});
