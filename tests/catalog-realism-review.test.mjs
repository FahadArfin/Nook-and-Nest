import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sha256,canonicalJson,hashCatalogContract} from '../scripts/lib/catalog-realism-inventory.mjs';
const api=await import('../scripts/catalog-realism-review.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const views=['front','rear','detail','underside','clay'];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
function model(improved=false){
  const binary=Buffer.alloc(36);[-.5,0,-.5,.5,0,-.5,0,1,.5].forEach((v,i)=>binary.writeFloatLE(v,i*4));
  const g={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'body',mesh:0}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-.5,0,-.5],max:[.5,1,.5]}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{name:'wood',pbrMetallicRoughness:{baseColorFactor:[.5,.4,.3,1],metallicFactor:0,roughnessFactor:improved?.6:.8}}]};
  let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const header=Buffer.alloc(20),tail=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(binary.length);tail.writeUInt32LE(0x004e4942,4);return {g,bytes:Buffer.concat([header,json,tail,binary])};
}
function fixture(t){
  const root=mkdtempSync(path.join(tmpdir(),'catalog-review-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const write=(name,bytes)=>{mkdirSync(path.dirname(path.join(root,name)),{recursive:true});writeFileSync(path.join(root,name),bytes);};
  const record=name=>{const b=readFileSync(path.join(root,name));return {path:name,bytes:b.length,sha256:sha256(b)};};
  const id='table',base=model(),candidate=model(true);write('baseline.glb',base.bytes);write('baseline.blend','BLENDER-v300 original');write('preview.webp',png);write('build.py','# original recipe');write('material-plan.json','{}');
  const item={id,state:'pending',sourceBlend:record('baseline.blend'),baselineGlb:record('baseline.glb'),preview:record('preview.webp'),materialKeys:['wood'],baselineGltf:{materials:base.g.materials,nodes:base.g.nodes,scenes:base.g.scenes,scene:0,animations:[],skins:[],extensionsUsed:[],extensionsRequired:[],images:[],textures:[],samplers:[]},outputs:{sourceBlend:`assets-source/catalog-realism/candidates/${id}.blend`,glb:`public/experiments/catalog-realism/models/${id}.glb`,receipt:`assets-source/catalog-realism/receipts/${id}.json`}};item.contractSha256=hashCatalogContract(item);
  write(item.outputs.sourceBlend,'BLENDER-v300 revised editable source');write(item.outputs.glb,candidate.bytes);
  const receipt={version:1,catalogId:id,inputContractSha256:item.contractSha256,state:'processed',recipe:{id:'recipe',version:1,...record('build.py')},materialPlan:record('material-plan.json'),inputs:[record('build.py'),record('material-plan.json')],outputs:{sourceBlend:record(item.outputs.sourceBlend),glb:record(item.outputs.glb)},changes:[{kind:'surface',description:'Refined original roughness.'}],renders:[]};
  const inputs=[...receipt.inputs,...Object.values(receipt.outputs)].sort((a,b)=>a.path.localeCompare(b.path));const inputHash=sha256(canonicalJson(inputs)),configurationJson='{"version":1}';receipt.renderBinding={inputs,beforeSha256:inputHash,afterSha256:inputHash,configurationSha256:sha256(configurationJson),configuration:{version:1},configurationJson};
  for(const view of views){const file=`assets-source/catalog-realism/renders/table/${view}.png`;write(file,png);receipt.renders.push({view,...record(file),glbSha256:receipt.outputs.glb.sha256,inputSetSha256:inputHash,renderConfigSha256:receipt.renderBinding.configurationSha256});}
  const save=()=>write(item.outputs.receipt,JSON.stringify(receipt));save();return {root,item,receipt,write,save,record};
}
function decision(f,result){return {catalogId:f.item.id,decision:'approved',reviewer:'Explicit fixture reviewer',artifactSetSha256:result.artifactSetSha256,views:Object.fromEntries(f.receipt.renders.map(r=>[r.view,{sha256:r.sha256,note:`Inspected ${r.view} construction and its visible surface details.`}]))};}
test('format recording validates exact bytes without granting review',async t=>{assert.equal(typeof api.recordFormatValidation,'function');const f=fixture(t);await api.recordFormatValidation(f.root,f.item);const saved=JSON.parse(readFileSync(path.join(f.root,f.item.outputs.receipt)));assert.equal(saved.formatValidation.numErrors,0);assert.equal(saved.formatValidation.sha256,saved.outputs.glb.sha256);assert.equal(saved.state,'processed');assert.equal(saved.review,undefined);});
test('explicit review binds five unique notes and exact inspected artifact',async t=>{assert.equal(typeof api.inspectReviewItem,'function');const f=fixture(t),result=api.inspectReviewItem(f.root,f.item,f.receipt);await api.recordReviewDecision(f.root,f.item,decision(f,result));const saved=JSON.parse(readFileSync(path.join(f.root,f.item.outputs.receipt)));assert.equal(saved.state,'reviewed');assert.equal(saved.review.artifactSetSha256,result.artifactSetSha256);assert.equal(saved.formatValidation.numErrors,0);});
test('a stale image or wrong artifact decision cannot update the receipt',async t=>{assert.equal(typeof api.recordReviewDecision,'function');const f=fixture(t),result=api.inspectReviewItem(f.root,f.item,f.receipt),original=readFileSync(path.join(f.root,f.item.outputs.receipt));const d=decision(f,result);d.artifactSetSha256='0'.repeat(64);await assert.rejects(api.recordReviewDecision(f.root,f.item,d),/artifact|stale/i);f.write(f.receipt.renders[2].path,Buffer.from('changed render'));await assert.rejects(api.recordReviewDecision(f.root,f.item,decision(f,result)),/hash|byte|render/i);assert.deepEqual(readFileSync(path.join(f.root,f.item.outputs.receipt)),original);});
test('repeated view notes and mismatched viewed-image hashes are rejected',async t=>{assert.equal(typeof api.recordReviewDecision,'function');const f=fixture(t),result=api.inspectReviewItem(f.root,f.item,f.receipt),d=decision(f,result);d.views.rear.note=d.views.front.note;await assert.rejects(api.recordReviewDecision(f.root,f.item,d),/unique|repeat/i);d.views.rear.note='Rear joinery and back panels inspected.';d.views.rear.sha256='0'.repeat(64);await assert.rejects(api.recordReviewDecision(f.root,f.item,d),/image|render|hash/i);});

test('Python render configuration survives real JS format recording and Python contact verification',async t=>{
  const f=fixture(t),python=process.env.PYTHON??'python';
  const binding=JSON.parse(execFileSync(python,['-c','import json,runpy; r=runpy.run_path("tools/blender/catalog_realism/review.py"); print(json.dumps(r["configuration_binding"]({"one":1.0,"zero":-0.0,"tiny":1e-7,"large":1.2345678901234567e20,"float32":.14000000059604645,"label":"paper café","enabled":True})))'],{encoding:'utf8'}));
  Object.assign(f.receipt.renderBinding,binding);for(const render of f.receipt.renders)render.renderConfigSha256=binding.configurationSha256;f.save();
  const before=api.inspectReviewItem(f.root,f.item);
  await api.recordFormatValidation(f.root,f.item);
  const saved=JSON.parse(readFileSync(path.join(f.root,f.item.outputs.receipt))),after=api.inspectReviewItem(f.root,f.item);
  assert.equal(saved.renderBinding.configurationJson,binding.configurationJson);assert.equal(before.artifactSetSha256,after.artifactSetSha256);
  const checked=JSON.parse(execFileSync(python,['-c','import json,runpy,sys; from pathlib import Path; a=json.load(sys.stdin); c=runpy.run_path("scripts/catalog-realism-contact.py"); print(json.dumps(c["current_model"](Path(a["root"]),a["item"])))'],{input:JSON.stringify({root:f.root,item:f.item}),encoding:'utf8'}));
  assert.equal(checked.id,f.item.id);assert.equal(checked.renderConfigSha256,binding.configurationSha256);
});

test('configuration evidence rejects altered values, stale hashes, missing text and nonfinite numeric text',t=>{
  for(const mutate of [b=>{b.configuration.version=2;},b=>{b.configurationSha256='0'.repeat(64);},b=>{delete b.configurationJson;},b=>{b.configurationJson='{"value":1e999}';b.configurationSha256=sha256(b.configurationJson);b.configuration={value:Infinity};},b=>{b.configuration={version:true};}]){
    const f=fixture(t);mutate(f.receipt.renderBinding);assert.throws(()=>api.verifyRenderEvidence(f.root,f.receipt),/configuration|nonfinite/i);assert.throws(()=>api.inspectReviewItem(f.root,f.item,f.receipt),/configuration|nonfinite/i);
  }
});
