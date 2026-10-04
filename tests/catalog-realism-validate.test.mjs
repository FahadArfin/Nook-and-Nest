import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {hashCatalogInventory} from '../scripts/lib/catalog-realism-inventory.mjs';

const validator = await import('../scripts/lib/catalog-realism-validate.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(sort(value));
function sort(value) { return Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,sort(value[key])])) : value; }
const contract = item => sha(canonical(Object.fromEntries(Object.entries(item).filter(([key]) => !['state','contractSha256'].includes(key)))));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function model({improved = false, mutate = () => {}} = {}) {
  const chunks = [];
  const g = {asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'body',mesh:0,children:[1]},{name:'moving panel',mesh:1,translation:[.1,0,0],extras:{motion_role:'sliding_leaf',slide_travel:.4}}],
    buffers:[{byteLength:0}],bufferViews:[],accessors:[],meshes:[],materials:[{name:'wood',pbrMetallicRoughness:{baseColorFactor:[.5,.4,.3,1],roughnessFactor:.8,metallicFactor:0}}]};
  const append = bytes => {const byteOffset=chunks.reduce((n,b)=>n+b.length,0);const index=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset,byteLength:bytes.length});chunks.push(bytes,Buffer.alloc((4-bytes.length%4)%4));return index;};
  const accessor = (values,type) => {const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>bytes.writeFloatLE(v,i*4));const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type];const index=g.accessors.length;g.accessors.push({bufferView:append(bytes),componentType:5126,count:values.length/components,type,...(['VEC3','SCALAR'].includes(type)?{min:Array.from({length:components},(_,a)=>Math.min(...values.filter((_,i)=>i%components===a))),max:Array.from({length:components},(_,a)=>Math.max(...values.filter((_,i)=>i%components===a)))}:{})});return index;};
  const position=accessor([-.5,0,-.4,.5,0,-.4,0,.8,.4],'VEC3');
  const normal=accessor([0,1,0,0,1,0,0,1,0],'VEC3');
  const uv=accessor([0,0,1,0,.5,1],'VEC2');
  const primitive = () => ({attributes:{POSITION:position,NORMAL:normal,TEXCOORD_0:uv},material:0});
  g.meshes.push({primitives:[primitive()]},{primitives:[primitive()]});
  if(improved) { const detail=accessor([-.1,.2,0,.1,.2,0,0,.3,.05],'VEC3');g.meshes.push({primitives:[{attributes:{POSITION:detail,NORMAL:normal,TEXCOORD_0:uv},material:0}]});g.nodes[0].children.push(2);g.nodes.push({name:'detail joinery',mesh:2}); }
  mutate(g,{append,accessor});
  const binary=Buffer.concat(chunks);g.buffers[0].byteLength=binary.length;
  let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const header=Buffer.alloc(20),tail=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(binary.length);tail.writeUInt32LE(0x004e4942,4);
  return {bytes:Buffer.concat([header,json,tail,binary]),g,binary};
}

function fixture(t,{id='study-table',baselineMutate}={}) {
  const root=mkdtempSync(path.join(tmpdir(),'catalog-realism-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const write=(file,bytes)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),bytes);};
  const record=file=>({path:file,sha256:sha(readFileSync(path.join(root,file))),bytes:readFileSync(path.join(root,file)).length});
  const base=model({mutate:baselineMutate});
  write(`public/models/furniture/${id}.glb`,base.bytes);
  write(`assets-source/blender/${id}.blend`,Buffer.from('BLENDER-v300 original source'));
  write(`public/models/previews/${id}.webp`,png);
  write('tools/blender/catalog_realism/build.py','# original authored recipe v1\n');
  write('assets-source/catalog-realism/material-plan.json','{"version":1}\n');
  const item={id,name:'Study table',category:'Living',family:'wood',shape:'table',mount:'floor',dimensionsMm:[1100,800,800],sourceBlend:record(`assets-source/blender/${id}.blend`),baselineGlb:record(`public/models/furniture/${id}.glb`),preview:record(`public/models/previews/${id}.webp`),materialKeys:['wood'],materialControls:[],baselineGltf:{materials:base.g.materials,nodes:base.g.nodes,scenes:base.g.scenes,scene:0,animations:[],skins:[],extensionsUsed:[],extensionsRequired:[],images:[],textures:[],samplers:[]},supportSurfaces:{},baselineCost:{bytes:base.bytes.length,triangles:2,primitives:2},state:'pending',outputs:{sourceBlend:`assets-source/catalog-realism/candidates/${id}.blend`,glb:`public/experiments/catalog-realism/models/${id}.glb`,receipt:`assets-source/catalog-realism/receipts/${id}.json`}};
  item.contractSha256=contract(item);
  item.baselineGltf.animations=base.g.animations??[];item.baselineGltf.skins=base.g.skins??[];item.baselineGltf.textures=base.g.textures??[];item.baselineGltf.samplers=base.g.samplers??[];
  item.baselineGltf.images=(base.g.images??[]).map((im,index)=>{const v=base.g.bufferViews[im.bufferView],data=base.binary.subarray(v.byteOffset,v.byteOffset+v.byteLength);return {index,...(im.name?{name:im.name}:{}),mimeType:im.mimeType,sha256:sha(data),bytes:data.length};});item.contractSha256=contract(item);
  item.materialKeys=base.g.materials.map(m=>m.name);item.contractSha256=contract(item);
  write(item.outputs.sourceBlend,Buffer.from('BLENDER-v300 candidate source, detailed editable parts'));
  write(item.outputs.glb,model({improved:true,mutate:baselineMutate}).bytes);
  const recipe={id:'catalog-construction-refinement',version:1,...record('tools/blender/catalog_realism/build.py')};
  const materialPlan=record('assets-source/catalog-realism/material-plan.json');
  const receipt={version:1,catalogId:id,inputContractSha256:item.contractSha256,state:'processed',recipe,materialPlan,inputs:[record(recipe.path),materialPlan],outputs:{sourceBlend:record(item.outputs.sourceBlend),glb:record(item.outputs.glb)},changes:[{kind:'geometry',description:'Added separately authored joinery detail inside the original envelope.'}],renders:[]};
  const save=()=>write(item.outputs.receipt,JSON.stringify(receipt));save();
  const setCandidate=mutate=>{write(item.outputs.glb,model({improved:true,mutate}).bytes);receipt.outputs.glb=record(item.outputs.glb);save();};
  return {root,item,receipt,write,record,save,setCandidate};
}
function inspect(f) { assert.equal(typeof validator.inspectCandidate,'function','candidate validator must be implemented'); return validator.inspectCandidate(f.root,f.item,f.receipt); }
function rejected(f,pattern) {const result=inspect(f);assert.equal(result.ok,false,JSON.stringify(result));assert.match(result.issues.join('\n'),pattern);}

test('per-model recipe additions and shared dependency edits invalidate only their consumer',t=>{
  const f=fixture(t),base='tools/blender/catalog_realism/refinements/';
  f.write(base+'other.py','# other model\n');assert.equal(inspect(f).ok,true);
  f.write(base+f.item.id+'.py','# selected model correction\n');rejected(f,/refinement input set/i);
  f.write(base+f.item.id+'.json',JSON.stringify({version:1,dependencies:['turned.py']}));
  f.write(base+'turned.py','# shared turned geometry v1\n');
  f.receipt.modelRefinementInputs=validator.modelRefinementInputs(f.root,f.item.id);
  rejected(f,/refinement must be bound/i);
  f.receipt.inputs.push(...f.receipt.modelRefinementInputs);assert.equal(inspect(f).ok,true,inspect(f).issues.join('\n'));
  f.write(base+'unrelated.py','# another recipe\n');assert.equal(inspect(f).ok,true);
  f.write(base+'turned.py','# shared turned geometry v2\n');rejected(f,/hash|byte|refinement/i);
});

test('per-model refinement manifests reject traversal, duplicates and missing entrypoints',t=>{
  const f=fixture(t),base='tools/blender/catalog_realism/refinements/',id=f.item.id;
  f.write(base+id+'.json',JSON.stringify({version:1,dependencies:[]}));rejected(f,/entrypoint/i);
  f.write(base+id+'.py','# entrypoint\n');
  for(const dependencies of [['../escape.py'],[id+'.py'],['a.py','a.py']]){
    f.write(base+id+'.json',JSON.stringify({version:1,dependencies}));rejected(f,/dependency list/i);
  }
});

function legacyUvFixture(t,{id='designed-basin-console'}={}) {
  const missing=id==='bud-vase-trio',rug=id.startsWith('designed-rug-'),key=missing?'dusty-rose':rug?'original-cultural-rug-pattern':'honed-travertine';
  const mutate=(g,{append,accessor})=>{delete g.nodes[1].extras;g.materials[0].name=key;g.materials.push({name:'detail-key'});if(g.meshes[2])g.meshes[2].primitives[0].material=1;g.images=[{bufferView:append(png),mimeType:'image/png'}];g.textures=[{source:0}];g.materials[0].pbrMetallicRoughness.baseColorTexture={index:0,texCoord:-1};if(missing){const uv=accessor([0,1,0,1,0,1],'VEC2');g.meshes.forEach(m=>m.primitives.forEach(p=>p.attributes.TEXCOORD_0=uv));}};
  const f=fixture(t,{id,baselineMutate:mutate});
  f.setCandidate((g,h)=>{mutate(g,h);g.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord=0;});
  const repair={materialKey:key,kind:'baseColor',from:-1,to:0,mode:missing?'missing-source-uv-zero':'authored-source-uv0',imageSha256:sha(png),reason:'Restore the source-evidenced original image UV binding.'};
  const evidence={version:1,scope:'read-only-native-source-uv',before:{counts:{}},after:{counts:{}},models:{[id]:{sourceBlend:f.item.sourceBlend,baselineGlb:f.item.baselineGlb,materials:[{materialKey:key,baselineTextureInfo:{index:0,texCoord:-1},nodes:[{name:'Image Texture',type:'TEX_IMAGE',inputs:[{name:'Vector',links:[],default:[0,0,0]}]},{type:'BSDF_PRINCIPLED',inputs:[{name:'Base Color',links:[{node:'Image Texture',socket:'Color'}]}]}],meshCharts:[{materialPolygonCount:1,layers:missing?[]:[{index:0,name:'UVMap',activeRender:true}]}]}]}}};
  const evidencePath='assets-source/catalog-realism/legacy-uv-source-evidence.json',planPath='assets-source/catalog-realism/legacy-uv-repair-plan.json';
  f.write(evidencePath,JSON.stringify(evidence));const sourceEvidence=f.record(evidencePath);
  const plan={version:1,scope:'beta-only',sourceEvidence,models:{[id]:{sourceBlendSha256:f.item.sourceBlend.sha256,baselineGlbSha256:f.item.baselineGlb.sha256,repairs:[repair]}}};
  f.write(planPath,JSON.stringify(plan));f.receipt.legacyUvRepairPlan=f.record(planPath);f.receipt.inputs.push(sourceEvidence,f.receipt.legacyUvRepairPlan);f.receipt.textureCoordinateRepairs=[repair];
  return {...f,mutate,key,plan,evidence};
}

test('source-evidenced legacy UV repair accepts only the original chart and image',t=>{
  for(const id of ['designed-basin-console','designed-rug-kilim','bud-vase-trio']){const f=legacyUvFixture(t,{id}),r=inspect(f);assert.equal(r.ok,true,r.issues.join('\n'));}
});
test('legacy UV repair cannot waive changed channels, missing evidence or altered charts',t=>{
  for(const mode of ['missing','stale','image','color','uv','sampler','declaration']) {
    const f=legacyUvFixture(t,{id:mode==='uv'?'bud-vase-trio':'designed-basin-console'});
    if(mode==='missing')delete f.receipt.legacyUvRepairPlan;
    else if(mode==='stale')f.write(f.plan.sourceEvidence.path,'{}');
    else if(mode==='declaration')f.receipt.textureCoordinateRepairs[0].to=1;
    else f.setCandidate((g,h)=>{f.mutate(g,h);g.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord=0;if(mode==='image')g.images[0].bufferView=h.append(Buffer.concat([png,Buffer.from('changed')]));if(mode==='color')g.materials[0].pbrMetallicRoughness.baseColorFactor=[1,1,1,1];if(mode==='sampler'){g.samplers=[{wrapS:33071}];g.textures[0].sampler=0;}if(mode==='uv')g.meshes[0].primitives[0].attributes.TEXCOORD_0=h.accessor([0,1,.1,1,0,1],'VEC2');});
    rejected(f,/legacy|repair|hash|byte|color|binding|constant/i);
  }
});
test('repaired original rug atlas rejects a moved UV island despite unchanged range',t=>{
  const f=legacyUvFixture(t,{id:'designed-rug-persian'});
  f.setCandidate((g,h)=>{f.mutate(g,h);g.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord=0;g.meshes[0].primitives[0].attributes.TEXCOORD_0=h.accessor([1,0,0,0,.5,1],'VEC2');});
  rejected(f,/chart|atlas/i);
});
test('legacy binding repair by itself does not count as a visual model improvement',t=>{
  const f=legacyUvFixture(t);
  const original=model({mutate:(g,h)=>{f.mutate(g,h);g.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord=0;}});
  f.write(f.item.outputs.glb,original.bytes);f.receipt.outputs.glb=f.record(f.item.outputs.glb);
  rejected(f,/unchanged|improvement/i);
});

test('an authored candidate preserves measured contracts without requiring a visual approval yet',t=>{
  const f=fixture(t),result=inspect(f);assert.equal(result.ok,true,result.issues.join('\n'));assert.equal(result.stats.visualReview,'missing');assert.equal(result.stats.improvementDetected,true);assert.match(result.artifactSetSha256,/^[a-f0-9]{64}$/);
});
test('loss of moving metadata, travel, pivot, or hierarchy fails closed',t=>{
  for(const mutate of [g=>delete g.nodes[1].extras.motion_role,g=>g.nodes[1].extras.slide_travel=.8,g=>g.nodes[1].translation=[.2,0,0],g=>{g.nodes[0].children=[2];g.scenes[0].nodes.push(1);}]) {const f=fixture(t);f.setCandidate(mutate);rejected(f,/motion|moving|hierarchy|transform|node/i);}
});
test('catalog contract edits and real binary envelope drift are rejected',t=>{
  const f=fixture(t);f.item.dimensionsMm[0]++;rejected(f,/contract/i);
  const other=fixture(t);other.setCandidate(g=>g.nodes[0].translation=[.002,0,0]);rejected(other,/bounds|envelope|transform/i);
});
test('static root nominal dimensions and authored construction metadata remain exact',t=>{
  const extras=g=>{g.nodes[0].extras={catalog_id:'study-table',nominal_width_m:1.1,construction:'original joinery'};g.nodes[0].children=g.nodes[0].children.filter(i=>i!==1);g.scenes[0].nodes.push(1);};
  const f=fixture(t,{baselineMutate:extras});f.setCandidate(g=>{extras(g);delete g.nodes[0].extras.construction;});rejected(f,/root.*extras|metadata/i);
});

function webpHeader({extended=false,lossy=false,width=640,height=480}={}) {
  const chunk=(name,data)=>{const header=Buffer.alloc(8);header.write(name);header.writeUInt32LE(data.length,4);return Buffer.concat([header,data,Buffer.alloc(data.length%2)]);};
  const image=Buffer.alloc(6);image[0]=0x2f;image.writeUInt32LE((width-1)|((height-1)<<14),1);const chunks=[];
  if(extended){const extension=Buffer.alloc(10);extension[0]=0x20;extension.writeUIntLE(width-1,4,3);extension.writeUIntLE(height-1,7,3);chunks.push(chunk('VP8X',extension),chunk('ICCP',Buffer.from('profile')));}
  chunks.push(chunk(lossy?'VP8 ':'VP8L',image));const body=Buffer.concat(chunks),header=Buffer.alloc(12);header.write('RIFF');header.writeUInt32LE(body.length+4,4);header.write('WEBP',8);return Buffer.concat([header,body]);
}
test('review image header accepts bounded lossless WebP with optional ICC profile',()=>{
  for(const extended of [false,true])assert.deepEqual(validator.reviewImageDimensions(webpHeader({extended})),{width:640,height:480,mimeType:'image/webp',lossless:true});
  assert.equal(validator.reviewImageDimensions(png).mimeType,'image/png');
});
test('review WebP rejects lossy, animation, truncated payloads and inconsistent canvas sizes',()=>{
  assert.throws(()=>validator.reviewImageDimensions(webpHeader({lossy:true})),/lossless|VP8L/i);
  const animated=webpHeader({extended:true});animated[20]|=2;assert.throws(()=>validator.reviewImageDimensions(animated),/animation|animated/i);
  const truncated=webpHeader().subarray(0,-2);assert.throws(()=>validator.reviewImageDimensions(truncated),/length|truncated|RIFF/i);
  const canvas=webpHeader({extended:true});canvas.writeUIntLE(31,24,3);assert.throws(()=>validator.reviewImageDimensions(canvas),/canvas|dimensions/i);
});
test('candidate review accepts full-resolution lossless WebP without changing embedded texture policy',t=>{
  const f=fixture(t),name=`assets-source/catalog-realism/renders/${f.item.id}/front.webp`;f.write(name,webpHeader());f.receipt.renders=[{view:'front',...f.record(name),resolution:[640,480]}];assert.equal(inspect(f).ok,true,inspect(f).issues.join('\n'));
  f.write(name,webpHeader({width:320,height:240}));f.receipt.renders=[{view:'front',...f.record(name),resolution:[320,240]}];rejected(f,/resolution|640|480/i);
});
test('canonical tint, alpha and emission cannot silently change',t=>{
  for(const mutate of [g=>g.materials[0].name='replacement',g=>g.materials[0].pbrMetallicRoughness.baseColorFactor=[1,1,1,1],g=>g.materials[0].alphaMode='BLEND',g=>g.materials[0].emissiveFactor=[1,0,0]]) {const f=fixture(t);f.setCandidate(mutate);rejected(f,/material|alpha|emissi|color/i);}
});
test('missing output hashes and changed recipes make resume fail closed',t=>{
  const f=fixture(t);delete f.receipt.outputs.glb.sha256;rejected(f,/sha256|hash/i);
  const other=fixture(t);other.write(other.receipt.recipe.path,'# changed after export\n');rejected(other,/hash|input/i);
  const interrupted=fixture(t);interrupted.receipt.state='running';rejected(interrupted,/state|incomplete/i);
});
test('a changed file or self-reported change cannot qualify an unchanged model',t=>{
  const f=fixture(t);f.write(f.item.outputs.glb,model({mutate:g=>{g.asset.generator='different text only';g.materials[0].extras={pipelineNote:'new descriptive metadata only'};}}).bytes);f.receipt.outputs.glb=f.record(f.item.outputs.glb);rejected(f,/unchanged|improvement/i);
});
test('new normal maps require declared receipt bytes and exported tangent and UV basis',t=>{
  const f=fixture(t);f.write('assets-source/catalog-realism/maps/normal.png',png);const map=f.record('assets-source/catalog-realism/maps/normal.png');f.receipt.inputs.push(map);f.receipt.newMaps=[{...map,materialKey:'wood',kind:'normal',texCoord:1}];
  f.setCandidate((g,{append})=>{g.images=[{bufferView:append(png),mimeType:'image/png'}];g.textures=[{source:0}];g.materials[0].normalTexture={index:0,texCoord:1};});rejected(f,/tangent|UV|TEXCOORD/i);
});
test('aquariums preserve original geometry exactly even when the envelope stays the same',t=>{
  const f=fixture(t,{id:'desktop-aquarium'});rejected(f,/aquarium|protected.*geometry/i);
});
test('all views and current artifact hash are required for review, and changed recipe invalidates acceptance',t=>{
  const f=fixture(t);for(const view of ['front','rear','underside','clay','detail']) {const name=`assets-source/catalog-realism/renders/${f.item.id}/${view}.png`;f.write(name,png);f.receipt.renders.push({...f.record(name),view});}
  const processed=inspect(f);assert.equal(processed.ok,true,processed.issues.join('\n'));
  f.receipt.review={reviewer:'Fixture reviewer',decision:'approved',artifactSetSha256:processed.artifactSetSha256,views:Object.fromEntries(f.receipt.renders.map(r=>[r.view,`Inspected ${r.view} construction, clearances and material detail.`]))};f.receipt.state='reviewed';f.save();assert.equal(inspect(f).stats.visualReview,'approved');
  f.receipt.review.artifactSetSha256='0'.repeat(64);rejected(f,/stale|review/i);
});
test('requireCatalogReady rejects pending models rather than reporting a partial catalog complete',t=>{
  const f=fixture(t);assert.equal(typeof validator.requireCatalogReady,'function');assert.throws(()=>validator.requireCatalogReady(f.root,{version:1,scope:'beta-only',sourceInputs:[],items:[f.item]}),/pending|review|source|manifest/i);
});

test('existing original image bytes and binding cannot be replaced by a newly approved map',t=>{
  const addImage=(g,{append},content=png)=>{g.images=[{name:'original wood artwork',bufferView:append(content),mimeType:'image/png'}];g.textures=[{source:0}];g.materials[0].pbrMetallicRoughness.baseColorTexture={index:0};};
  const f=fixture(t,{baselineMutate:addImage});assert.equal(inspect(f).ok,true,inspect(f).issues.join('\n'));
  const changed=Buffer.from(png);changed[changed.length-1]^=1;
  f.setCandidate((g,helpers)=>addImage(g,helpers,changed));rejected(f,/original.*image|binding/i);
});
test('new normal maps accept their explicit second UV set and valid exported tangent basis',t=>{
  const f=fixture(t);f.write('assets-source/catalog-realism/maps/normal.png',png);const map=f.record('assets-source/catalog-realism/maps/normal.png');f.receipt.inputs.push(map);f.receipt.newMaps=[{...map,materialKey:'wood',kind:'normal',texCoord:1}];
  f.setCandidate((g,{append,accessor})=>{g.images=[{bufferView:append(png),mimeType:'image/png'}];g.textures=[{source:0}];g.materials[0].normalTexture={index:0,texCoord:1};const tangent=accessor([1,0,0,1,1,0,0,1,1,0,0,1],'VEC4');for(const m of g.meshes)for(const p of m.primitives){p.attributes.TEXCOORD_1=p.attributes.TEXCOORD_0;p.attributes.TANGENT=tangent;}});
  assert.equal(inspect(f).ok,true,inspect(f).issues.join('\n'));
});
test('existing animation tracks are supported but changed animation values are rejected',t=>{
  const animate=(g,{accessor},end=.2)=>{const input=accessor([0,1,2],'SCALAR'),output=accessor([0,0,0,.1,0,0,end,0,0],'VEC3');g.animations=[{name:'authored motion',samplers:[{input,output,interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:1,path:'translation'}}]}];};
  const f=fixture(t,{baselineMutate:animate});assert.equal(inspect(f).ok,true,inspect(f).issues.join('\n'));f.setCandidate((g,helpers)=>animate(g,helpers,.3));rejected(f,/animation/i);
});
test('complete review and independently bound Khronos validation pass readiness, stale output fails',async t=>{
  const f=fixture(t);for(const view of ['front','rear','underside','clay','detail']){const file=`assets-source/catalog-realism/renders/${f.item.id}/${view}.png`;f.write(file,png);f.receipt.renders.push({...f.record(file),view});}
  f.receipt.review={reviewer:'Fixture reviewer',decision:'approved',artifactSetSha256:inspect(f).artifactSetSha256,views:Object.fromEntries(f.receipt.renders.map(r=>[r.view,`Inspected ${r.view}, silhouette and material clarity.`]))};f.receipt.state='reviewed';
  f.receipt.formatValidation=await validator.validateKhronosCandidate(f.root,f.item);f.save();
  const manifest={version:1,scope:'beta-only',expectedCount:1,sourceInputs:[f.receipt.materialPlan],items:[f.item]};manifest.catalogSha256=hashCatalogInventory(manifest);
  assert.equal(validator.requireCatalogReady(f.root,manifest).count,1);
  f.write(f.item.outputs.glb,Buffer.from('interrupted export'));assert.throws(()=>validator.requireCatalogReady(f.root,manifest),/not ready.*|hash|byte count/s);
});
test('candidate outputs cannot point into the original catalog or escape through traversal',t=>{
  for(const unsafe of ['public/models/furniture/study-table.glb','../escape.glb']){const f=fixture(t);f.item.outputs.glb=unsafe;f.item.contractSha256=contract(f.item);f.receipt.inputContractSha256=f.item.contractSha256;rejected(f,/output paths|Beta experiment/i);}
});

function aquariumFixture(t) {
  const aquarium=(g,{accessor})=>{
    g.materials.push({name:'aquarium-clear-glass',alphaMode:'BLEND',pbrMetallicRoughness:{baseColorFactor:[1,1,1,.1],metallicFactor:0,roughnessFactor:.1}});
    const mesh=g.meshes.length;g.meshes.push({primitives:[{attributes:{POSITION:accessor([-.2,.4,-.2,.2,.4,-.2,0,.7,.2],'VEC3')},material:1}]});const node=g.nodes.length;g.nodes.push({name:'protected tank glazing',mesh});g.nodes[0].children.push(node);
    const added=g.nodes.find(n=>n.name==='detail joinery');if(added)added.name='detail_casework_base';
  };
  const f=fixture(t,{id:'desktop-aquarium',baselineMutate:aquarium});
  f.receipt.recipe.capabilities=['aquarium-additive-casework'];f.receipt.aquariumPreservation={mode:'additive-casework-only',additions:[{node:'detail_casework_base',kind:'casework'}]};
  f.aquarium=aquarium;return f;
}
test('aquarium casework exception accepts additive exterior geometry with every original primitive unchanged',t=>{
  const f=aquariumFixture(t);assert.equal(inspect(f).ok,true,inspect(f).issues.join('\n'));
});
test('aquarium addition must be declared, exterior, separately named and inside its frozen bounds',t=>{
  for(const mutate of [f=>delete f.receipt.recipe.capabilities,f=>f.receipt.aquariumPreservation.additions=[],f=>f.setCandidate((g,h)=>{f.aquarium(g,h);g.nodes.find(n=>n.name==='detail_casework_base').translation=[0,.3,0];}),f=>f.setCandidate((g,h)=>{f.aquarium(g,h);g.nodes.find(n=>n.name==='detail_casework_base').name='new fish';})]){const f=aquariumFixture(t);mutate(f);rejected(f,/aquarium|casework|exterior|addition|protected/i);}
});
test('aquarium additive flag cannot authorize modified original vertex bytes, normals, pivots or textures',t=>{
  const f=aquariumFixture(t);f.setCandidate((g,h)=>{f.aquarium(g,h);g.meshes[0].primitives[0].attributes.NORMAL=h.accessor([1,0,0,1,0,0,1,0,0],'VEC3');});rejected(f,/original.*primitive|protected.*geometry|aquarium/i);
});
test('cloth sheen may decrease only through the matching frozen fabric plan declaration',t=>{
  const sheen=g=>{g.materials[0].extensions={KHR_materials_sheen:{sheenColorFactor:[1,1,1],sheenRoughnessFactor:.7}};};
  const f=fixture(t,{baselineMutate:sheen});const adjustment={materialKey:'wood',property:'extensions.KHR_materials_sheen.sheenColorFactor',value:[.1,.1,.1],reason:'Reduce the authored white grazing sheen while retaining the selected tint.'};
  f.write(f.receipt.materialPlan.path,JSON.stringify({version:1,models:{[f.item.id]:{baselineGlbSha256:f.item.baselineGlb.sha256,materials:[{materialKey:'wood',profile:'fabric',protectedReason:null,surfaceAdjustments:[{property:adjustment.property,value:adjustment.value,reason:adjustment.reason}]}]}}}));f.receipt.materialPlan=f.record(f.receipt.materialPlan.path);f.receipt.inputs=f.receipt.inputs.map(input=>input.path===f.receipt.materialPlan.path?f.receipt.materialPlan:input);f.receipt.surfaceAdjustments=[adjustment];
  f.setCandidate(g=>{sheen(g);g.materials[0].extensions.KHR_materials_sheen.sheenColorFactor=[.1,.1,.1];});assert.equal(inspect(f).ok,true,inspect(f).issues.join('\n'));
  delete f.receipt.surfaceAdjustments;rejected(f,/extension|sheen/i);
});
test('cloth sheen declaration does not authorize other extension changes or values above the matte bound',t=>{
  const sheen=g=>{g.materials[0].extensions={KHR_materials_sheen:{sheenColorFactor:[1,1,1],sheenRoughnessFactor:.7}};};
  const f=fixture(t,{baselineMutate:sheen});f.receipt.surfaceAdjustments=[{materialKey:'wood',property:'extensions.KHR_materials_sheen.sheenColorFactor',value:[.3,.3,.3],reason:'An adjustment outside the permitted matte finish range.'}];f.setCandidate(g=>{sheen(g);g.materials[0].extensions.KHR_materials_sheen.sheenColorFactor=[.3,.3,.3];});rejected(f,/sheen|adjustment|plan|bound/i);
});

test('semantic triangles ignore export wrappers, vertex indexing and unused UV channels',()=>{
  const original=validator.inspectCatalogGlb(model().bytes);
  const wrapped=validator.inspectCatalogGlb(model({mutate:(g,h)=>{const mesh=g.nodes[0].mesh;delete g.nodes[0].mesh;g.nodes.push({name:'export surface group',mesh});g.nodes[0].children.push(g.nodes.length-1);for(const m of g.meshes)for(const p of m.primitives)p.attributes.TEXCOORD_1=h.accessor([4,4,8,4,6,8],'VEC2');}}).bytes);
  assert.equal(validator.semanticTriangleHash(original),validator.semanticTriangleHash(wrapped));
});
test('semantic triangles preserve winding, world normals and material-bound UV changes',()=>{
  const textured=(g,h)=>{g.images=[{bufferView:h.append(png),mimeType:'image/png'}];g.textures=[{source:0}];g.materials[0].pbrMetallicRoughness.baseColorTexture={index:0};};
  const original=validator.inspectCatalogGlb(model({mutate:textured}).bytes);
  for(const edit of [
    (g,h)=>{g.meshes[0].primitives[0].attributes.POSITION=h.accessor([-.5,0,-.4,0,.8,.4,.5,0,-.4],'VEC3');},
    (g,h)=>{g.meshes[0].primitives[0].attributes.NORMAL=h.accessor([1,0,0,1,0,0,1,0,0],'VEC3');},
    (g,h)=>{g.meshes[0].primitives[0].attributes.TEXCOORD_0=h.accessor([0,0,2,0,1,2],'VEC2');},
    g=>{g.nodes[0].scale=[-1,1,1];},
  ]) {const changed=validator.inspectCatalogGlb(model({mutate:(g,h)=>{textured(g,h);edit(g,h);}}).bytes);assert.notEqual(validator.semanticTriangleHash(original),validator.semanticTriangleHash(changed));}
});
test('reparenting static triangles alone cannot qualify as a model improvement',t=>{
  const f=fixture(t);f.write(f.item.outputs.glb,model({mutate:g=>{const mesh=g.nodes[0].mesh;delete g.nodes[0].mesh;g.nodes.push({name:'catalog_surface_UVMap',mesh});g.nodes[0].children.push(g.nodes.length-1);}}).bytes);f.receipt.outputs.glb=f.record(f.item.outputs.glb);rejected(f,/unchanged|improvement/i);
});
test('historical missing texture UV stays representable while newly added maps retain strict gates',()=>{
  const bytes=model({mutate:(g,h)=>{g.images=[{bufferView:h.append(png),mimeType:'image/png'}];g.textures=[{source:0}];g.materials[0].pbrMetallicRoughness.baseColorTexture={index:0,texCoord:1};}}).bytes;
  assert.match(validator.semanticTriangleHash(validator.inspectCatalogGlb(bytes)),/^[a-f0-9]{64}$/);
});
test('a neutral flat normal or white ORM map and its additional UVs do not count as improvement',t=>{
  const onePixel=rgb=>{
    const chunk=(type,data)=>{const name=Buffer.from(type),body=Buffer.concat([name,data]),header=Buffer.alloc(4),crc=Buffer.alloc(4);header.writeUInt32BE(data.length);let value=0xffffffff;for(const byte of body){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}crc.writeUInt32BE((value^0xffffffff)>>>0);return Buffer.concat([header,body,crc]);};
    const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,...rgb]))),chunk('IEND',Buffer.alloc(0))]);
  };
  for(const kind of ['normal','orm']) {
    const f=fixture(t),bytes=onePixel(kind==='normal'?[128,128,255]:[255,255,255]),mapPath=`assets-source/catalog-realism/maps/${kind}.png`;f.write(mapPath,bytes);const map=f.record(mapPath);f.receipt.inputs.push(map);f.receipt.newMaps=[{...map,materialKey:'wood',kind,texCoord:1}];
    f.write(f.item.outputs.glb,model({mutate:(g,h)=>{g.images=[{bufferView:h.append(bytes),mimeType:'image/png'}];g.textures=[{source:0}];if(kind==='normal')g.materials[0].normalTexture={index:0,texCoord:1};else g.materials[0].pbrMetallicRoughness.metallicRoughnessTexture={index:0,texCoord:1};const tangent=h.accessor([1,0,0,1,1,0,0,1,1,0,0,1],'VEC4');for(const m of g.meshes)for(const p of m.primitives){p.attributes.TEXCOORD_1=p.attributes.TEXCOORD_0;p.attributes.TANGENT=tangent;}}}).bytes);f.receipt.outputs.glb=f.record(f.item.outputs.glb);rejected(f,/unchanged|improvement/i);
  }
});

function scanFixture(t,{key='wood',moving=false}={}) {
  const original=(g,h)=>{g.materials[0].name=key;g.images=[{bufferView:h.append(png),mimeType:'image/png'}];g.textures=[{source:0}];g.materials[0].pbrMetallicRoughness.baseColorTexture={index:0};if(!moving)delete g.nodes[1].extras;};
  const f=fixture(t,{baselineMutate:original}),sourcePath='public/textures/realism/material-oak-color.jpg',sourceBytes=Buffer.from(png);sourceBytes[sourceBytes.length-1]^=1;f.write(sourcePath,sourceBytes);
  const provenancePath='assets-source/realism-materials.json',url='https://polyhaven.com/a/oak_veneer_01';
  f.write(provenancePath,JSON.stringify({version:1,materials:{oak:{baseColor:sourcePath,repeatM:1.83,source:url,license:'CC0-1.0'}}}));
  f.write('assets-source/realism-scans.json',JSON.stringify({version:1,scans:{oak_veneer_01:{source:url,license:'CC0-1.0'}}}));
  f.write('assets-source/realism-texture-provenance.json',JSON.stringify({version:1,license:'CC0-1.0',assets:[{asset:{url,license:'CC0'}}]}));
  const source=f.record(sourcePath),provenance=f.record(provenancePath),request={kind:'baseColor',oldSha256:sha(png),source,provenance,reason:'Replace the simplified authored wood image with the retained licensed oak scan.',texCoord:1};
  const planned={materialKey:key,profile:'wood',family:'oak',protectedReason:null,repeatM:[1.83,1.83],replacements:[request]};
  f.write('assets-source/catalog-realism/scan-plan.json',JSON.stringify({version:1,models:{[f.item.id]:{baselineGlbSha256:f.item.baselineGlb.sha256,materials:[planned]}}}));f.receipt.scanPlan=f.record('assets-source/catalog-realism/scan-plan.json');
  f.write(f.receipt.materialPlan.path,JSON.stringify({version:1,models:{[f.item.id]:{baselineGlbSha256:f.item.baselineGlb.sha256,materials:[{materialKey:key,profile:'wood',protectedReason:null}]}}}));f.receipt.materialPlan=f.record(f.receipt.materialPlan.path);f.receipt.inputs=f.receipt.inputs.map(input=>input.path===f.receipt.materialPlan.path?f.receipt.materialPlan:input);
  f.receipt.inputs.push(source,provenance,f.record('assets-source/realism-scans.json'),f.record('assets-source/realism-texture-provenance.json'),f.receipt.scanPlan);
  f.receipt.textureReplacements=[{...request,materialKey:key,profile:'wood',family:'oak',repeatM:[1.83,1.83],newSha256:source.sha256}];f.receipt.newMaps=[{...source,materialKey:key,kind:'baseColor',texCoord:1}];
  f.setCandidate((g,h)=>{original(g,h);g.images[0]={bufferView:h.append(sourceBytes),mimeType:'image/png'};g.materials[0].pbrMetallicRoughness.baseColorTexture={index:0,texCoord:1};for(const mesh of g.meshes)for(const primitive of mesh.primitives)primitive.attributes.TEXCOORD_1=primitive.attributes.TEXCOORD_0;});
  return f;
}
test('ordinary wood scan replacement requires exact per-model plan, old/new hashes and licensed sources',t=>{
  const f=scanFixture(t);assert.equal(inspect(f).ok,true,inspect(f).issues.join('\n'));
  delete f.receipt.textureReplacements;rejected(f,/original.*image|binding/i);
});
test('scan replacement cannot bypass protected art or dynamic materials through a mislabeled plan',t=>{
  for(const options of [{key:'original-printed-art'},{key:'television-screen'},{moving:true}]){const f=scanFixture(t,options);rejected(f,/protected|moving|art|screen|dynamic/i);}
});
test('scan replacement fails closed on stale source, wrong original hash, changed scale or missing provenance input',t=>{
  for(const edit of [f=>f.receipt.textureReplacements[0].oldSha256='0'.repeat(64),f=>f.receipt.textureReplacements[0].repeatM=[.1,.1],f=>f.receipt.inputs=f.receipt.inputs.filter(i=>i.path!=='assets-source/realism-texture-provenance.json'),f=>f.write(f.receipt.textureReplacements[0].source.path,'changed')]){const f=scanFixture(t);edit(f);rejected(f,/hash|replacement|scale|repeat|provenance|source|input|plan/i);}
});

function coherentScanFixture(t,{existingNormalScale,existingOrm=false}={}) {
  const original=(g,h)=>{
    delete g.nodes[1].extras;g.images=[{bufferView:h.append(png),mimeType:'image/png'}];g.textures=[{source:0}];
    g.materials[0].pbrMetallicRoughness.baseColorTexture={index:0};
    if(existingNormalScale!==undefined)g.materials[0].normalTexture={index:0,scale:existingNormalScale};
    if(existingOrm)g.materials[0].pbrMetallicRoughness.metallicRoughnessTexture={index:0};
  };
  const f=fixture(t,{baselineMutate:original}),url='https://polyhaven.com/a/oak_veneer_01',provenancePath='assets-source/realism-materials.json',payloads={};
  for(const [kind,suffix] of [['baseColor','color'],['normal','normal'],['orm','orm']]){
    const file=`public/textures/realism/material-oak-${suffix}.jpg`;payloads[kind]=readFileSync(new URL('../'+file,import.meta.url));f.write(file,payloads[kind]);
  }
  f.write(provenancePath,JSON.stringify({materials:{oak:{baseColor:'public/textures/realism/material-oak-color.jpg',normal:'public/textures/realism/material-oak-normal.jpg',orm:'public/textures/realism/material-oak-orm.jpg',repeatM:1.83,source:url,license:'CC0-1.0'}}}));
  f.write('assets-source/realism-scans.json',JSON.stringify({scans:{oak:{source:url,license:'CC0-1.0'}}}));
  f.write('assets-source/realism-texture-provenance.json',JSON.stringify({license:'CC0-1.0',assets:[{asset:{url,license:'CC0'}}]}));
  const provenance=f.record(provenancePath),requests=[['baseColor','color'],['normal','normal'],['orm','orm']].map(([kind,suffix])=>({kind,source:f.record(`public/textures/realism/material-oak-${suffix}.jpg`),provenance,reason:'Use the coordinated full-quality licensed oak scan with preserved factors.',texCoord:1}));
  const oldKinds=['baseColor',...(existingNormalScale===undefined?[]:['normal']),...(existingOrm?['orm']:[])];
  const plan={materialKey:'wood',profile:'wood',family:'oak',repeatM:[1.83,1.83],protectedReason:null,normalStrength:existingNormalScale??.14,roughnessFactor:.8,maps:requests,replacements:requests.filter(row=>oldKinds.includes(row.kind)).map(row=>({...row,oldSha256:sha(png)}))};
  f.write('assets-source/catalog-realism/scan-plan.json',JSON.stringify({version:1,models:{[f.item.id]:{baselineGlbSha256:f.item.baselineGlb.sha256,materials:[plan]}}}));f.receipt.scanPlan=f.record('assets-source/catalog-realism/scan-plan.json');
  f.write(f.receipt.materialPlan.path,JSON.stringify({version:1,models:{[f.item.id]:{baselineGlbSha256:f.item.baselineGlb.sha256,materials:[{materialKey:'wood',profile:'wood',protectedReason:null}]}}}));f.receipt.materialPlan=f.record(f.receipt.materialPlan.path);
  const sourceFields={materialKey:'wood',profile:'wood',family:'oak',repeatM:[1.83,1.83]};
  f.receipt.inputs=[f.receipt.recipe,f.receipt.materialPlan,f.receipt.scanPlan,provenance,f.record('assets-source/realism-scans.json'),f.record('assets-source/realism-texture-provenance.json'),...requests.map(row=>row.source)];
  f.receipt.textureReplacements=plan.replacements.map(row=>({...row,...sourceFields,newSha256:row.source.sha256}));
  f.receipt.newMaps=requests.map(row=>({...row.source,materialKey:'wood',kind:row.kind,texCoord:1,scanSource:{...row,...sourceFields}}));
  const setScanCandidate=({strength=Math.fround(plan.normalStrength),roughness=.8,metallic=0,mutate=()=>{}}={})=>f.setCandidate((g,h)=>{
    original(g,h);g.images=[];g.textures=[];
    requests.forEach(({kind},index)=>{g.images.push({bufferView:h.append(payloads[kind]),mimeType:'image/jpeg'});g.textures.push({source:index});});
    const material=g.materials[0];material.pbrMetallicRoughness={...material.pbrMetallicRoughness,baseColorTexture:{index:0,texCoord:1},metallicRoughnessTexture:{index:2,texCoord:1},roughnessFactor:roughness,metallicFactor:metallic};material.normalTexture={index:1,texCoord:1,scale:strength};
    const tangent=h.accessor([1,0,0,1,1,0,0,1,1,0,0,1],'VEC4');for(const mesh of g.meshes)for(const p of mesh.primitives){p.attributes.TEXCOORD_1=p.attributes.TEXCOORD_0;p.attributes.TANGENT=tangent;}mutate(g,h);
  });
  setScanCandidate();return {...f,setScanCandidate,plan,payloads};
}

test('coherent licensed scan JPEG channels preserve factors and accept only float32 normal rounding',t=>{
  for(const options of [{},{existingNormalScale:1.5,existingOrm:true}]){const f=coherentScanFixture(t,options),result=inspect(f);assert.equal(result.ok,true,result.issues.join('\n'));}
  const f=coherentScanFixture(t);f.setScanCandidate({strength:.14001});rejected(f,/normal strength/i);
});
test('scanned ORM cannot double-apply roughness, change metallic, or silently re-encode its source',t=>{
  for(const edit of [f=>f.setScanCandidate({roughness:.64}),f=>f.setScanCandidate({metallic:.1}),f=>{
    const bytes=Buffer.from(f.payloads.orm);bytes[bytes.length-1]^=1;
    const file='assets-source/catalog-realism/maps/reencoded-orm.jpg';f.write(file,bytes);const record=f.record(file);f.receipt.inputs.push(record);
    Object.assign(f.receipt.newMaps.find(row=>row.kind==='orm'),record);
    f.setScanCandidate({mutate:(g,h)=>{g.images[2]={bufferView:h.append(bytes),mimeType:'image/jpeg'};}});
  }]){
    const f=coherentScanFixture(t);edit(f);rejected(f,/roughness|metallic|hash|source/i);
  }
});
test('scanned channels must retain their complete family and common metric UV binding',t=>{
  const missing=coherentScanFixture(t);missing.receipt.newMaps=missing.receipt.newMaps.filter(row=>row.kind!=='normal');rejected(missing,/coherent|three|channel/i);
  const uv=coherentScanFixture(t);uv.setScanCandidate({mutate:g=>{g.materials[0].normalTexture.extensions={KHR_texture_transform:{scale:[2,2]}};}});rejected(uv,/UV|transform/i);
  const source=coherentScanFixture(t);source.receipt.newMaps.find(row=>row.kind==='normal').scanSource.family='walnut';rejected(source,/family|profile/i);
});
