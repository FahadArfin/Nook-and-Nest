// Candidate compatibility and evidence checks. Passing these is not an aesthetic verdict.
import assert from 'node:assert/strict';
import {readFileSync,statSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {resolveRepoPath,imageDimensions,validateKhronosGlb} from './model-pipeline-inspect.mjs';
import {hashCatalogInventory} from './catalog-realism-inventory.mjs';

export const CATALOG_REVIEW_VIEWS = Object.freeze(['front','rear','underside','clay','detail']);
const HASH=/^[a-f0-9]{64}$/;
const MAX_BYTES=256*1024*1024;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const canonical=value=>JSON.stringify(sorted(value));
const same=(a,b,label)=>assert.equal(canonical(a),canonical(b),label);
const hashContract=item=>sha(canonical(Object.fromEntries(Object.entries(item).filter(([key])=>!['state','contractSha256'].includes(key)))));
const finiteArray=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);

/** Python render-time text is immutable; parsed values use JSON/IEEE-754 semantics. */
export function verifyRenderConfiguration(binding) {
  const text=binding?.configurationJson;
  assert(typeof text==='string'&&Buffer.byteLength(text,'utf8')>0&&Buffer.byteLength(text,'utf8')<=256*1024,'Bound render configurationJson text is required');
  assert(HASH.test(binding.configurationSha256)&&sha(Buffer.from(text,'utf8'))===binding.configurationSha256,'Render configuration hash changed');
  let parsed;try{parsed=JSON.parse(text);}catch{assert.fail('Render configurationJson is invalid JSON');}
  const configuration=binding.configuration;
  assert(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&configuration&&typeof configuration==='object'&&!Array.isArray(configuration),'Render configuration must be a JSON object');
  const validate=value=>{
    if(value===null||typeof value==='string'||typeof value==='boolean')return;
    if(typeof value==='number'){assert(Number.isFinite(value),'Render configuration contains a nonfinite number');return;}
    assert(value&&typeof value==='object','Render configuration contains a non-JSON value');
    for(const entry of Object.values(value))validate(entry);
  };
  validate(parsed);validate(configuration);
  same(parsed,configuration,'Render configuration text differs from configuration values');
  return binding.configurationSha256;
}

/** Review-only lossless WebP envelope. GLB texture policy remains PNG/JPEG. */
export function reviewImageDimensions(bytes,label='review image') {
  if(bytes.length<12||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')return imageDimensions(bytes,label);
  assert(bytes.length<=64*1024*1024&&bytes.readUInt32LE(4)+8===bytes.length,`${label}: invalid RIFF length`);
  let offset=12,canvas=null,dimensions=null,count=0;const seen=new Set();
  while(offset<bytes.length) {
    assert(offset+8<=bytes.length&&++count<=16,`${label}: truncated or excessive WebP chunks`);
    const type=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8,end=start+size;assert(end+(size%2)<=bytes.length,`${label}: truncated WebP chunk`);
    assert(!seen.has(type),`${label}: duplicate WebP chunk`);seen.add(type);
    assert(type!=='VP8 '&&type!=='ALPH',`${label}: review WebP must use lossless VP8L`);assert(type!=='ANIM'&&type!=='ANMF',`${label}: animated WebP is not a review image`);
    if(type==='VP8X') {
      assert(offset===12&&size===10,`${label}: invalid WebP extended header`);const flags=bytes[start];assert(!(flags&2),`${label}: animation is not permitted`);assert(!(flags&0xc1)&&bytes.readUIntLE(start+1,3)===0,`${label}: invalid WebP reserved flags`);
      canvas={width:bytes.readUIntLE(start+4,3)+1,height:bytes.readUIntLE(start+7,3)+1};
    }else if(type==='VP8L') {
      assert(size>=6&&bytes[start]===0x2f,`${label}: invalid lossless VP8L header`);const bits=bytes.readUInt32LE(start+1);assert((bits>>>29)===0,`${label}: unsupported VP8L version`);
      dimensions={width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};
    }else assert(['ICCP','EXIF','XMP '].includes(type)&&canvas&&size<=1024*1024,`${label}: unsupported or oversized WebP metadata`);
    if(size%2)assert(bytes[end]===0,`${label}: invalid WebP padding`);offset=end+(size%2);
  }
  assert(dimensions&&dimensions.width<=8192&&dimensions.height<=8192&&dimensions.width*dimensions.height<=32*1024*1024,`${label}: missing VP8L or excessive dimensions`);
  if(canvas)same(canvas,dimensions,`${label}: WebP canvas dimensions differ`);
  return {...dimensions,mimeType:'image/webp',lossless:true};
}

function recordBytes(root,record,label,expectedPath) {
  assert(record&&HASH.test(record.sha256),`${label}: missing SHA256 hash`);
  const filename=resolveRepoPath(root,record.path);
  if(expectedPath) assert.equal(filename,resolveRepoPath(root,expectedPath),`${label}: path differs from frozen contract`);
  const stat=statSync(filename);assert(stat.isFile()&&stat.size>0&&stat.size<=MAX_BYTES,`${label}: file empty or exceeds 256 MiB`);
  if(record.bytes!==undefined) assert.equal(stat.size,record.bytes,`${label}: byte count differs`);
  const bytes=readFileSync(filename);assert.equal(sha(bytes),record.sha256,`${label}: file hash differs`);return bytes;
}
function assertBlend(bytes,label) {
  assert(bytes.length>12&&(bytes.toString('ascii',0,7)==='BLENDER'||bytes.readUInt32LE(0)===0xfd2fb528||(bytes[0]===0x1f&&bytes[1]===0x8b)),`${label}: invalid Blender source signature`);
}
function transform(node,point) {
  if(node.matrix) {
    const m=node.matrix;assert(finiteArray(m,16)&&m[3]===0&&m[7]===0&&m[11]===0&&m[15]===1&&!node.translation&&!node.rotation&&!node.scale,'Invalid affine node transform');
    return [0,1,2].map(i=>m[i]*point[0]+m[i+4]*point[1]+m[i+8]*point[2]+m[i+12]);
  }
  const s=node.scale??[1,1,1],t=node.translation??[0,0,0],r=node.rotation??[0,0,0,1];
  assert(finiteArray(s,3)&&finiteArray(t,3)&&finiteArray(r,4)&&Math.abs(r.reduce((a,v)=>a+v*v,0)-1)<.0001,'Invalid node TRS transform');
  const v=point.map((p,i)=>p*s[i]),[x,y,z,w]=r,tx=2*(y*v[2]-z*v[1]),ty=2*(z*v[0]-x*v[2]),tz=2*(x*v[1]-y*v[0]);
  return [v[0]+w*tx+y*tz-z*ty,v[1]+w*ty+z*tx-x*tz,v[2]+w*tz+x*ty-y*tx].map((p,i)=>p+t[i]);
}
const nodeTransform=node=>node.matrix?{matrix:node.matrix}:{translation:node.translation??[0,0,0],rotation:node.rotation??[0,0,0,1],scale:node.scale??[1,1,1]};

/** Inspect actual uncompressed authoring vertices. Runtime compression has a separate byte-equivalence gate. */
export function inspectCatalogGlb(bytes) {
  assert(bytes.length>=28&&bytes.length<=MAX_BYTES&&bytes.toString('ascii',0,4)==='glTF'&&bytes.readUInt32LE(4)===2&&bytes.readUInt32LE(8)===bytes.length,'GLB: invalid binary header');
  const n=bytes.readUInt32LE(12);assert(n>0&&n<=16*1024*1024&&n%4===0&&28+n<=bytes.length&&bytes.readUInt32LE(16)===0x4e4f534a,'GLB: invalid JSON chunk');
  const g=JSON.parse(bytes.subarray(20,20+n).toString('utf8')),length=bytes.readUInt32LE(20+n);
  assert(bytes.readUInt32LE(24+n)===0x004e4942&&length%4===0&&28+n+length===bytes.length,'GLB: invalid BIN chunk');
  assert(g.asset?.version==='2.0'&&g.buffers?.length===1&&!g.buffers[0].uri&&Number.isSafeInteger(g.buffers[0].byteLength)&&g.buffers[0].byteLength>0&&length-g.buffers[0].byteLength>=0&&length-g.buffers[0].byteLength<=3,'GLB: authoring candidate needs one embedded buffer');
  const binary=bytes.subarray(28+n,28+n+g.buffers[0].byteLength);
  const view=index=>{const v=g.bufferViews?.[index];assert(v&&v.buffer===0&&!v.extensions,'GLB: invalid or compressed authoring bufferView');const o=v.byteOffset??0;assert(Number.isSafeInteger(o)&&o>=0&&Number.isSafeInteger(v.byteLength)&&v.byteLength>0&&o+v.byteLength<=binary.length,'GLB: bufferView exceeds binary');return binary.subarray(o,o+v.byteLength);};
  for(let i=0;i<(g.bufferViews?.length??0);i++)view(i);
  const cache=new Map();
  const accessor=index=>{
    if(cache.has(index))return cache.get(index);
    const a=g.accessors?.[index],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16}[a?.type],sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},size=sizes[a?.componentType];
    assert(a&&!a.sparse&&components&&size&&Number.isSafeInteger(a.count)&&a.count>0&&a.count<=5000000,'GLB: invalid or unsupported accessor');
    const data=view(a.bufferView),v=g.bufferViews[a.bufferView],stride=v.byteStride??components*size,offset=a.byteOffset??0;
    assert(Number.isSafeInteger(stride)&&stride>=components*size&&stride%size===0&&stride<=252&&Number.isSafeInteger(offset)&&offset>=0&&offset%size===0&&offset+(a.count-1)*stride+components*size<=data.length,'GLB: accessor exceeds buffer');
    const raw=Buffer.alloc(a.count*components*size),values=new Array(a.count);
    for(let i=0;i<a.count;i++) {values[i]=[];data.copy(raw,i*components*size,offset+i*stride,offset+i*stride+components*size);for(let c=0;c<components;c++) {const at=offset+i*stride+c*size;let value=a.componentType===5126?data.readFloatLE(at):a.componentType===5120?data.readInt8(at):a.componentType===5122?data.readInt16LE(at):data.readUIntLE(at,size);assert(Number.isFinite(value),'GLB: non-finite accessor');if(a.normalized&&a.componentType!==5126)value=a.componentType===5120?Math.max(value/127,-1):a.componentType===5122?Math.max(value/32767,-1):value/({5121:255,5123:65535,5125:4294967295}[a.componentType]);values[i].push(value);}}
    const result={values,hash:sha(raw),type:a.type,componentType:a.componentType,normalized:!!a.normalized,count:a.count};cache.set(index,result);return result;
  };
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity],nodePaths=new Map(),uniquePaths=new Set(),parents=new Map(),visited=new Set(),primitiveRecords=[];let triangles=0;
  const walk=(index,ancestors=[],parentPath='')=>{
    assert(Number.isInteger(index)&&!visited.has(index)&&ancestors.length<128,'GLB: cyclic or multiply-parented nodes');visited.add(index);
    const node=g.nodes?.[index];assert(node,'GLB: missing scene node');transform(node,[0,0,0]);
    const segment=node.name??`@${index}`,nodePath=`${parentPath}/${segment}`;assert(!uniquePaths.has(nodePath),'GLB: ambiguous duplicate node path');uniquePaths.add(nodePath);nodePaths.set(index,nodePath);parents.set(index,ancestors[0]);
    if(node.mesh!==undefined) {const mesh=g.meshes?.[node.mesh];assert(mesh?.primitives?.length,'GLB: missing mesh');for(const p of mesh.primitives) {
      assert((p.mode??4)===4&&!p.extensions,'GLB: authoring mesh must use uncompressed triangles');
      const positions=accessor(p.attributes?.POSITION);assert(positions.type==='VEC3','GLB: missing VEC3 positions');
      const indices=p.indices===undefined?null:accessor(p.indices);if(indices)assert(indices.type==='SCALAR'&&!indices.normalized&&[5121,5123,5125].includes(indices.componentType)&&indices.values.every(([i])=>i<positions.count),'GLB: invalid triangle indices');
      const count=indices?.count??positions.count;assert(count%3===0,'GLB: incomplete triangle');triangles+=count/3;assert(triangles<=5000000,'GLB: absolute triangle limit exceeded');
      for(const [attribute,id] of Object.entries(p.attributes??{})) {const a=accessor(id);assert(a.count===positions.count,`GLB: ${attribute} count differs from positions`);}
      for(const target of p.targets??[])for(const id of Object.values(target))assert(accessor(id).count===positions.count,'GLB: morph target count differs');
      for(let point of positions.values) {for(const id of [index,...ancestors])point=transform(g.nodes[id],point);assert(point.every(Number.isFinite),'GLB: nonfinite world vertex');point.forEach((v,a)=>{low[a]=Math.min(low[a],v);high[a]=Math.max(high[a],v);});}
      assert(g.materials?.[p.material],'GLB: missing material');primitiveRecords.push({node:index,path:nodePath,primitive:p});
    }}
    for(const child of node.children??[])walk(child,[index,...ancestors],nodePath);
  };
  assert(g.scenes?.length===1&&g.scenes[g.scene??0]?.nodes?.length,'GLB: expected one populated default scene');
  for(const node of g.scenes[g.scene??0].nodes)walk(node);
  assert(visited.size===(g.nodes?.length??0),'GLB: unreachable nodes cannot hide geometry or motion');assert(triangles>0,'GLB: no triangles');
  const names=(g.materials??[]).map(m=>m.name);assert(names.every(n=>typeof n==='string'&&n.length)&&new Set(names).size===names.length,'GLB: distinct material names required');
  const images=(g.images??[]).map((image,index)=>{assert(image.uri===undefined&&image.bufferView!==undefined,'GLB: candidate images must be embedded');const content=view(image.bufferView),dimensions=imageDimensions(content,`Image ${index}`);assert.equal(image.mimeType,dimensions.mimeType,'GLB: image MIME differs');return {index,mimeType:image.mimeType,sha256:sha(content),bytes:content.length,...dimensions,content};});
  const geometry=primitiveRecords.map(({path,primitive:p})=>({path,material:g.materials[p.material].name,attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,i])=>[k,accessor(i).hash])),indices:p.indices===undefined?null:accessor(p.indices).hash,targets:(p.targets??[]).map(target=>Object.fromEntries(Object.entries(target).map(([k,i])=>[k,accessor(i).hash])))}));
  const geometryHash=sha(canonical(geometry));
  const animationContract=(g.animations??[]).map(animation=>({...animation,samplers:animation.samplers.map(s=>({...s,input:accessor(s.input).hash,output:accessor(s.output).hash})),channels:animation.channels.map(c=>({...c,target:{...c.target,node:nodePaths.get(c.target.node)}}))}));
  const skinContract=(g.skins??[]).map(skin=>({...skin,joints:skin.joints.map(n=>nodePaths.get(n)),skeleton:skin.skeleton===undefined?null:nodePaths.get(skin.skeleton),inverseBindMatrices:skin.inverseBindMatrices===undefined?null:accessor(skin.inverseBindMatrices).hash}));
  return {document:g,binary,accessor,view,nodePaths,parents,primitiveRecords,images,bounds:{min:low,max:high},triangles,primitives:primitiveRecords.length,geometryHash,animationContract,skinContract,bytes:bytes.length,sha256:sha(bytes)};
}

const imageRoles=material=>({baseColor:material.pbrMetallicRoughness?.baseColorTexture,normal:material.normalTexture,orm:material.pbrMetallicRoughness?.metallicRoughnessTexture,occlusion:material.occlusionTexture,emissive:material.emissiveTexture});
function textureContract(model,reference) {
  if(!reference)return null;
  const texture=model.document.textures?.[reference.index],image=model.images[texture?.source];assert(image,'Material texture has no embedded image');
  return {image:image.sha256,reference:Object.fromEntries(Object.entries(reference).filter(([key])=>key!=='index')),sampler:texture.sampler===undefined?{}:model.document.samplers?.[texture.sampler]??{},extensions:texture.extensions??{}};
}
const neutralTextureCache=new WeakMap();
function neutralTexture(model,material,kind) {
  const reference=imageRoles(material)[kind];if(!reference)return true;
  if(kind==='normal'&&reference.scale===0)return true;
  if(kind==='occlusion'&&reference.strength===0)return true;
  const image=model.images[model.document.textures?.[reference.index]?.source];
  if(!image||image.mimeType!=='image/png'||!['normal','orm','occlusion'].includes(kind))return false;
  let cache=neutralTextureCache.get(model);if(!cache){cache=new Map();neutralTextureCache.set(model,cache);}
  const key=[image.index,kind,material.pbrMetallicRoughness?.metallicFactor??1].join('/');if(cache.has(key))return cache.get(key);
  let neutral=false;
  try {
    const constant=(channel,value)=>{const range=pngChannel(image.content,channel);return range.min===value/255&&range.max===value/255;};
    if(kind==='normal')neutral=constant(0,128)&&constant(1,128)&&constant(2,255);
    else if(kind==='occlusion')neutral=constant(0,255);
    else neutral=constant(1,255)&&((material.pbrMetallicRoughness?.metallicFactor??1)===0||constant(2,255));
  }catch{/* Unsupported historical image encodings are compared by exact bytes. */}
  cache.set(key,neutral);return neutral;
}
function movingContract(model) {
  const nodes=model.document.nodes,marked=new Set();
  nodes.forEach((n,i)=>{if(n.extras?.motion_role||n.extras?.shared_geometry||/^linked_bough_/.test(n.name??'')) {marked.add(i);let parent=model.parents.get(i);while(parent!==undefined){marked.add(parent);parent=model.parents.get(parent);}const children=[...(n.children??[])];while(children.length){const child=children.pop();marked.add(child);children.push(...(nodes[child]?.children??[]));}}});
  return [...marked].map(i=>({path:model.nodePaths.get(i),parent:model.nodePaths.get(model.parents.get(i))??null,transform:nodeTransform(nodes[i]),extras:nodes[i].extras??{},skin:nodes[i].skin??null,weights:nodes[i].weights??null,
    ...(nodes[i].extras?.shared_geometry?{sharedWith:nodes.flatMap((node,j)=>node.mesh===nodes[i].mesh?[model.nodePaths.get(j)]:[]).sort()}:{}),
    ...(nodes[i].extras?.motion_role||nodes[i].extras?.shared_geometry?{materials:(model.document.meshes?.[nodes[i].mesh]?.primitives??[]).map(p=>model.document.materials[p.material].name).sort()}:{}),
  })).sort((a,b)=>a.path.localeCompare(b.path));
}

function extensionTextureContracts(model,extensions) {
  const found=[];
  const walk=(object,path='')=>{for(const [key,value] of Object.entries(object??{})){if(value&&typeof value==='object'){if(key.endsWith('Texture')&&value.index!==undefined)found.push([path+'/'+key,textureContract(model,value)]);else walk(value,path+'/'+key);}}};
  walk(extensions);return found;
}
function appearanceSignature(model) {
  const materialSignature=material=>{
    const m=structuredClone(material);delete m.extras;
    if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}
    for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete m[key];
    return {...m,textureRoles:Object.fromEntries(Object.entries(imageRoles(material)).map(([kind,reference])=>[kind,neutralTexture(model,material,kind)?null:textureContract(model,reference)])),extensionTextures:extensionTextureContracts(model,material.extensions)};
  };
  const used=new Set(model.primitiveRecords.map(r=>r.primitive.material));
  return sha(canonical(model.document.materials.filter((_,i)=>used.has(i)).map(materialSignature).sort((a,b)=>a.name.localeCompare(b.name))));
}

function primitiveSignature(model,p) {
  const content=index=>{const a=model.accessor(index);return {hash:a.hash,type:a.type,componentType:a.componentType,normalized:a.normalized,count:a.count};};
  return {mode:p.mode??4,material:model.document.materials[p.material].name,attributes:Object.fromEntries(Object.entries(p.attributes).map(([name,index])=>[name,content(index)])),indices:p.indices===undefined?null:content(p.indices),targets:(p.targets??[]).map(target=>Object.fromEntries(Object.entries(target).map(([name,index])=>[name,content(index)]))),extras:p.extras??{},extensions:p.extensions??{}};
}
function worldPositions(model,record) {
  const chain=[record.node];let parent=model.parents.get(record.node);while(parent!==undefined){chain.push(parent);parent=model.parents.get(parent);}
  return model.accessor(record.primitive.attributes.POSITION).values.map(position=>{for(const node of chain)position=transform(model.document.nodes[node],position);return position;});
}
// Compare rendered triangles, not exporter node names, accessor numbering or
// duplicated vertices. Cyclic rotations are equivalent; reversed winding is not.
export function semanticTriangleHash(model) {
  const triangles=[],g=model.document;
  const rounded=(values,scale=1e6)=>values.map(v=>Math.round(v*scale));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  const unit=v=>{const length=Math.hypot(...v);assert(length>1e-12,'Singular normal transform');return v.map(n=>n/length);};
  for(const record of model.primitiveRecords) {
    const p=record.primitive,material=g.materials[p.material],uvSets=new Set();
    const textures=object=>{for(const [key,value] of Object.entries(object??{}))if(value&&typeof value==='object'){if(key.endsWith('Texture')&&value.index!==undefined)uvSets.add(value.extensions?.KHR_texture_transform?.texCoord??value.texCoord??0);else textures(value);}};
    const activeTextures=structuredClone(material);
    if(neutralTexture(model,material,'normal'))delete activeTextures.normalTexture;
    if(neutralTexture(model,material,'occlusion'))delete activeTextures.occlusionTexture;
    if(neutralTexture(model,material,'orm')&&activeTextures.pbrMetallicRoughness)delete activeTextures.pbrMetallicRoughness.metallicRoughnessTexture;
    textures(activeTextures);
    const chain=[record.node];let parent=model.parents.get(record.node);while(parent!==undefined){chain.push(parent);parent=model.parents.get(parent);}
    const world=point=>{for(const index of chain)point=transform(g.nodes[index],point);return point;};
    const origin=world([0,0,0]),axes=[[1,0,0],[0,1,0],[0,0,1]].map(p=>world(p).map((v,i)=>v-origin[i]));
    const cofactors=[cross(axes[1],axes[2]),cross(axes[2],axes[0]),cross(axes[0],axes[1])],det=dot(axes[0],cofactors[0]);assert(Math.abs(det)>1e-15,'Singular world transform');
    const normal=v=>unit([0,1,2].map(i=>cofactors.reduce((sum,c,j)=>sum+c[i]*v[j],0)/det));
    const direction=v=>unit([0,1,2].map(i=>axes.reduce((sum,c,j)=>sum+c[i]*v[j],0)));
    const positions=model.accessor(p.attributes.POSITION).values,normals=p.attributes.NORMAL===undefined?null:model.accessor(p.attributes.NORMAL).values;
    const colors=p.attributes.COLOR_0===undefined?null:model.accessor(p.attributes.COLOR_0).values;
    const tangents=activeTextures.normalTexture&&p.attributes.TANGENT!==undefined?model.accessor(p.attributes.TANGENT).values:null;
    // Historical models can have an unbound texture UV. Preserve that state in
    // the signature; only newly added maps have the strict UV/tangent gate.
    const uvs=[...uvSets].sort().map(set=>[set,p.attributes[`TEXCOORD_${set}`]===undefined?null:model.accessor(p.attributes[`TEXCOORD_${set}`]).values]);
    const corners=positions.map((position,i)=>JSON.stringify([rounded(world(position)),normals?rounded(normal(normals[i]),1e5):null,colors?rounded(colors[i]):null,uvs.map(([set,values])=>[set,values?rounded(values[i]):null]),tangents?[...rounded(direction(tangents[i]),1e5),Math.sign(det)*tangents[i][3]]:null]));
    const indices=p.indices===undefined?positions.map((_,i)=>i):model.accessor(p.indices).values.map(([i])=>i);
    for(let i=0;i<indices.length;i+=3){const c=indices.slice(i,i+3).map(index=>corners[index]);const cycle=[c.join('|'),[c[1],c[2],c[0]].join('|'),[c[2],c[0],c[1]].join('|')].sort()[0];triangles.push(sha(material.name+'|'+cycle));}
  }
  return sha(triangles.sort().join(''));
}
function checkAquarium(baseline,candidate,receipt) {
  same(candidate.document.materials,baseline.document.materials,'Aquarium protected materials must remain exact');
  same(candidate.images.map(i=>i.sha256),baseline.images.map(i=>i.sha256),'Aquarium protected images must remain exact');
  if(!receipt.recipe.capabilities?.includes('aquarium-additive-casework')) {
    same(candidate.geometryHash,baseline.geometryHash,'Aquarium protected geometry must remain exact without the casework recipe capability');return;
  }
  const preservation=receipt.aquariumPreservation;
  assert(preservation?.mode==='additive-casework-only'&&Array.isArray(preservation.additions)&&preservation.additions.length>0&&preservation.additions.length<=32,'Aquarium casework requires a bounded explicit additions list');
  const oldPaths=new Set(baseline.nodePaths.values()),candidateByPath=new Map([...candidate.nodePaths].map(([index,path])=>[path,index]));
  const oldNodeContract=(model,index)=>{
    const node=model.document.nodes[index];return {name:node.name,transform:nodeTransform(node),extras:node.extras??{},extensions:node.extensions??{},skin:node.skin??null,weights:node.weights??null,
      children:(node.children??[]).map(i=>model.nodePaths.get(i)).filter(p=>oldPaths.has(p)),
      sharedWith:node.mesh===undefined?[]:model.document.nodes.flatMap((other,i)=>other.mesh===node.mesh&&oldPaths.has(model.nodePaths.get(i))?[model.nodePaths.get(i)]:[]).sort()};
  };
  for(const [index,path] of baseline.nodePaths) {
    const next=candidateByPath.get(path);assert(next!==undefined,'Aquarium original node name or hierarchy changed: '+path);
    same(oldNodeContract(candidate,next),oldNodeContract(baseline,index),'Aquarium original node transform, hierarchy, extras or sharing changed: '+path);
    const original=baseline.primitiveRecords.filter(r=>r.node===index).map(r=>primitiveSignature(baseline,r.primitive));
    const actual=candidate.primitiveRecords.filter(r=>r.node===next).map(r=>primitiveSignature(candidate,r.primitive));
    same(actual,original,'Aquarium original primitive content changed: '+path);
  }
  const additions=candidate.primitiveRecords.filter(r=>!oldPaths.has(r.path)),newNodes=[...candidate.nodePaths].filter(([,p])=>!oldPaths.has(p));
  assert(newNodes.length===preservation.additions.length&&additions.length>0&&additions.length<=16,'Aquarium undeclared or excessive casework additions');
  const declarations=new Map(preservation.additions.map(entry=>[entry.node,entry]));assert(declarations.size===preservation.additions.length,'Aquarium duplicate casework node declarations');
  for(const [index] of newNodes) {
    const node=candidate.document.nodes[index],declaration=declarations.get(node.name);
    assert(declaration&&['casework','fastener'].includes(declaration.kind)&&node.name.startsWith(`detail_${declaration.kind}_`),'Aquarium addition must have an explicit casework/fastener name');
    assert(node.mesh!==undefined&&!(node.children??[]).length&&node.skin===undefined&&node.weights===undefined&&!node.extras?.motion_role&&!node.extras?.shared_geometry,'Aquarium casework must be independent static mesh nodes');
  }
  const tank={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};let protectedCount=0;
  for(const record of baseline.primitiveRecords)if(['aquarium-clear-glass','aquarium-water-surface'].includes(baseline.document.materials[record.primitive.material].name)) {
    protectedCount++;for(const point of worldPositions(baseline,record))point.forEach((v,a)=>{tank.min[a]=Math.min(tank.min[a],v);tank.max[a]=Math.max(tank.max[a],v);});
  }
  assert(protectedCount>0&&tank.min.every((v,a)=>v<tank.max[a]),'Aquarium exterior validation needs original glazing/water bounds');
  let addedTriangles=0;
  for(const record of additions) {
    const p=record.primitive,material=candidate.document.materials[p.material],positions=worldPositions(candidate,record);
    assert(/wood|walnut|oak|metal|brass|steel|case|frame|hardware|fastener/i.test(material.name)&&(material.alphaMode??'OPAQUE')==='OPAQUE'&&(material.emissiveFactor??[0,0,0]).every(v=>v===0),'Aquarium additions may use only original opaque casework materials');
    for(const point of positions)point.forEach((v,a)=>assert(v>=baseline.bounds.min[a]-.000001&&v<=baseline.bounds.max[a]+.000001,'Aquarium addition exceeds original bounds'));
    const indices=p.indices===undefined?positions.map((_,i)=>i):candidate.accessor(p.indices).values.map(([i])=>i);addedTriangles+=indices.length/3;
    for(let offset=0;offset<indices.length;offset+=3) {
      const triangle=indices.slice(offset,offset+3).map(i=>positions[i]);
      assert([0,1,2].some(a=>Math.max(...triangle.map(p=>p[a]))<=tank.min[a]+.000001||Math.min(...triangle.map(p=>p[a]))>=tank.max[a]-.000001),'Aquarium casework addition enters protected tank interior; exterior details only');
    }
  }
  assert(addedTriangles<=Math.min(4096,Math.max(256,Math.ceil(baseline.triangles*.15))),'Aquarium casework triangle overhead exceeded');
}

// Generated data maps use 8-bit PNG. Decode filters to verify effective metallic, not filenames.
function pngChannel(bytes,channel) {
  const dimensions=imageDimensions(bytes);assert.equal(dimensions.mimeType,'image/png','New ORM must be a lossless PNG');
  assert(bytes[24]===8&&bytes[28]===0,'New ORM must use noninterlaced 8-bit PNG');
  const channels={0:1,2:3,4:2,6:4}[bytes[25]];assert(channels&&channel<channels,'New ORM must expose RGB channels');
  const parts=[];for(let offset=8;offset+12<=bytes.length;){const n=bytes.readUInt32BE(offset);assert(offset+12+n<=bytes.length,'PNG chunk exceeds buffer');if(bytes.toString('ascii',offset+4,offset+8)==='IDAT')parts.push(bytes.subarray(offset+8,offset+8+n));offset+=n+12;}
  const stride=dimensions.width*channels,raw=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*dimensions.height});assert.equal(raw.length,(stride+1)*dimensions.height,'PNG decoded length differs');
  let previous=Buffer.alloc(stride),min=255,max=0;
  for(let y=0;y<dimensions.height;y++){const row=Buffer.alloc(stride),filter=raw[y*(stride+1)];assert(filter<=4,'Invalid PNG row filter');for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),prediction=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;row[x]=(raw[y*(stride+1)+1+x]+prediction)&255;if(x%channels===channel){min=Math.min(min,row[x]);max=Math.max(max,row[x]);}}previous=row;}
  return {min:min/255,max:max/255};
}

function checkTextureReplacements(baseline,candidate,receipt,root,inputs) {
  const replacements=receipt.textureReplacements??[];assert(Array.isArray(replacements)&&replacements.length<=128,'Texture replacements must be a bounded explicit list');const entries=[...replacements];
  for(const map of receipt.newMaps??[])if(map.scanSource){const source=map.scanSource;assert(source.materialKey===map.materialKey&&source.kind===map.kind,'Scanned new map source role differs');
    const old=baseline.document.materials.find(material=>material.name===map.materialKey);assert(old,'Unknown scanned material');
    if(imageRoles(old)[map.kind]){const entry=replacements.find(row=>row.materialKey===map.materialKey&&row.kind===map.kind);assert(entry,'Existing scan channel needs an explicit texture replacement');for(const field of ['materialKey','profile','family','repeatM','kind','source','provenance','reason','texCoord'])same(source[field],entry[field],'Replacement scan source differs: '+field);}
    else entries.push({...source,newSha256:map.sha256,addedChannel:true});
  }
  assert(entries.length<=256,'Too many scanned channel declarations');const allowed=new Map();if(!entries.length)return allowed;
  assert(!receipt.catalogId.endsWith('-aquarium'),'Aquarium texture replacements are protected');
  const boundJson=(record,label,expected)=>{const bytes=recordBytes(root,record,label,expected);assert(bytes.length<=16*1024*1024,label+' JSON budget exceeded');assert(inputs.some(i=>i.path===record.path&&i.sha256===record.sha256),label+' must be bound in inputs');return JSON.parse(bytes.toString('utf8'));};
  const scanPlan=boundJson(receipt.scanPlan,'scan replacement plan','assets-source/catalog-realism/scan-plan.json');assert(scanPlan.version===1,'Unsupported scan replacement plan');
  const planned=scanPlan.models?.[receipt.catalogId],materialPlan=boundJson(receipt.materialPlan,'material plan').models?.[receipt.catalogId];
  assert(planned?.baselineGlbSha256===baseline.sha256&&materialPlan?.baselineGlbSha256===baseline.sha256,'Scan replacement plans target a different baseline');
  for(const key of new Set((receipt.newMaps??[]).filter(map=>map.scanSource).map(map=>map.materialKey))) {
    const maps=receipt.newMaps.filter(map=>map.materialKey===key&&map.scanSource),plan=planned.materials?.find(row=>row.materialKey===key);
    same(maps.map(map=>map.kind).sort(),['baseColor','normal','orm'],'Scanned material requires its coherent color, normal and ORM map set');
    same((plan?.maps??[]).map(map=>map.kind).sort(),['baseColor','normal','orm'],'Scan plan must explicitly bind all three surface channels');
    const material=candidate.document.materials.find(row=>row.name===key),roles=imageRoles(material);
    const binding=reference=>({texCoord:reference?.extensions?.KHR_texture_transform?.texCoord??reference?.texCoord??0,transform:reference?.extensions?.KHR_texture_transform??null});
    for(const kind of ['normal','orm'])same(binding(roles[kind]),binding(roles.baseColor),'Scanned channels must share the same metric UV binding and transform');
  }
  const scanRecord=inputs.find(i=>i.path==='assets-source/realism-scans.json'),providerRecord=inputs.find(i=>i.path==='assets-source/realism-texture-provenance.json');
  const scans=boundJson(scanRecord,'scan source provenance','assets-source/realism-scans.json'),providers=boundJson(providerRecord,'provider provenance','assets-source/realism-texture-provenance.json');
  const protectedNodes=new Set(),nodes=baseline.document.nodes;
  nodes.forEach((node,index)=>{if(node.extras?.motion_role||node.extras?.shared_geometry||/^linked_bough_/.test(node.name??'')||node.skin!==undefined)protectedNodes.add(index);});
  for(const animation of baseline.document.animations??[])for(const channel of animation.channels)protectedNodes.add(channel.target.node);
  const descendants=[...protectedNodes];while(descendants.length){const node=descendants.pop();for(const child of nodes[node]?.children??[])if(!protectedNodes.has(child)){protectedNodes.add(child);descendants.push(child);}}
  const protectedMaterials=new Set(baseline.primitiveRecords.filter(record=>protectedNodes.has(record.node)).map(record=>baseline.document.materials[record.primitive.material].name));
  for(const entry of entries) {
    const key=entry.materialKey,id=key+'/'+entry.kind,old=baseline.document.materials.find(material=>material.name===key),material=candidate.document.materials.find(material=>material.name===key);
    assert(old&&material&&!allowed.has(id)&&['baseColor','normal','orm'].includes(entry.kind),'Invalid or duplicate texture replacement role');
    const planRows=planned.materials?.filter(row=>row.materialKey===key)??[],classificationRows=materialPlan.materials?.filter(row=>row.materialKey===key)??[];assert(planRows.length===1&&classificationRows.length===1,'Texture replacement needs one exact material plan entry');
    const plan=planRows[0],classification=classificationRows[0];assert(['wood','fabric','canvas'].includes(entry.profile)&&entry.profile===plan.profile&&entry.profile===classification.profile&&!plan.protectedReason&&!classification.protectedReason,'Texture replacement requires an unprotected wood or cloth material profile');
    assert(!protectedMaterials.has(key),'Moving/shared/animated material texture is protected');
    assert(!/(artwork|original-.*(?:art|print|photo|rug)|screen|display|globe|marking|NASA|countertop-surface|surface-stone|door-surface)/i.test(key),'Artwork, screen or runtime finish texture is protected');
    assert((old.alphaMode??'OPAQUE')==='OPAQUE'&&(old.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1])[3]===1&&!old.emissiveTexture&&!(old.emissiveFactor??[]).some(v=>v!==0)&&!['KHR_materials_transmission','KHR_materials_volume','KHR_materials_unlit'].some(name=>old.extensions?.[name]),'Optical, transparent or emissive material texture is protected');
    const families=entry.profile==='wood'?['oak','walnut','teak']:['linen','velvet','canvas','twill'];assert(families.includes(entry.family)&&entry.family===plan.family,'Scan family does not match the material profile');
    assert(finiteArray(entry.repeatM,2)&&entry.repeatM.every(value=>value>=.005&&value<=10),'Scan replacement needs bounded physical repeat dimensions');same(entry.repeatM,plan.repeatM,'Scan replacement repeat scale differs from plan');
    const requests=(entry.addedChannel?plan.maps:plan.replacements)?.filter(request=>request.kind===entry.kind)??[];assert(requests.length===1,'Texture replacement or scanned channel is not explicitly declared in the scan plan');const request=requests[0];
    assert(typeof entry.reason==='string'&&entry.reason.trim().length>=12&&entry.texCoord===1,'Texture replacement needs a reason and independent RealismUV channel');
    for(const field of ['kind',...(entry.addedChannel?[]:['oldSha256']),'source','provenance','reason','texCoord'])same(entry[field],request[field],'Texture replacement differs from scan plan: '+field);
    const oldReference=imageRoles(old)[entry.kind],newReference=imageRoles(material)[entry.kind];assert(newReference&&(entry.addedChannel?!oldReference:oldReference),'Texture replacement requires its declared old/new channel state');
    const oldImage=oldReference?baseline.images[baseline.document.textures[oldReference.index].source]:null,newImage=candidate.images[candidate.document.textures[newReference.index].source];
    assert((entry.addedChannel||(HASH.test(entry.oldSha256)&&entry.oldSha256===oldImage.sha256))&&HASH.test(entry.newSha256)&&entry.newSha256===newImage.sha256&&entry.newSha256!==entry.oldSha256,'Texture replacement old/new image hashes differ or are unchanged');
    recordBytes(root,entry.source,'licensed replacement source');assert(inputs.some(input=>input.path===entry.source.path&&input.sha256===entry.source.sha256),'Replacement source must be bound in inputs');
    const provenance=boundJson(entry.provenance,'replacement family provenance','assets-source/realism-materials.json'),family=provenance.materials?.[entry.family];
    assert(family?.license==='CC0-1.0'&&family[entry.kind]===entry.source.path&&/^https:\/\/(?:polyhaven\.com|ambientcg\.com)\/a\//.test(family.source),'Replacement source lacks its retained licensed family provenance');
    same(entry.repeatM,[family.repeatM,family.repeatM],'Replacement physical repeat differs from retained family provenance');
    assert(Object.values(scans.scans??{}).some(scan=>scan.source===family.source&&scan.license==='CC0-1.0')&&providers.license==='CC0-1.0'&&providers.assets?.some(record=>record.asset?.url===family.source&&['CC0','CC0-1.0'].includes(record.asset.license)),'Replacement provider/license provenance does not match the scan family');
    if(entry.kind==='normal') {
      assert(Number.isFinite(plan.normalStrength)&&plan.normalStrength>=0&&plan.normalStrength<=2&&Math.abs((newReference.scale??1)-plan.normalStrength)<=1e-6,'Scanned normal strength differs from its calibrated plan');
      if(oldReference)assert(Math.abs(plan.normalStrength-(oldReference.scale??1))<=1e-6,'Scanned normal changed the existing normal strength');
      else assert.equal(plan.normalStrength,entry.profile==='wood'?.14:.16,'New scanned normal strength is not calibrated for its material profile');
    }
    assert.equal(entry.newSha256,entry.source.sha256,'Scanned channels must retain exact licensed source bytes');
    if(entry.kind==='orm') {
      // Cloth/timber are dielectric. A nonzero legacy scalar needs a separately
      // proven authored mask; this narrow exception cannot reinterpret it.
      assert.equal(old.pbrMetallicRoughness?.metallicFactor??1,0,'Replacing a nonzero metallic mask requires an explicit per-pixel preservation recipe');
      const factor=material.pbrMetallicRoughness?.metallicFactor??1;assert.equal(factor,0,'Scanned ORM changes effective metallic');
      const oldRoughness=old.pbrMetallicRoughness?.roughnessFactor??1;
      same(plan.roughnessFactor,oldRoughness,'Scanned ORM plan changes the original roughness factor');
      same(material.pbrMetallicRoughness?.roughnessFactor??1,oldRoughness,'Scanned ORM changes the original roughness factor');
    }
    allowed.set(id,entry);
  }
  return allowed;
}
function checkMaterials(baseline,candidate,receipt,root,inputs) {
  const oldByName=new Map(baseline.document.materials.map(m=>[m.name,m]));
  same([...oldByName.keys()].sort(),candidate.document.materials.map(m=>m.name).sort(),'Canonical material keys changed');
  const replacements=checkTextureReplacements(baseline,candidate,receipt,root,inputs);
  const adjustments=receipt.surfaceAdjustments??[];assert(Array.isArray(adjustments)&&adjustments.length<=128,'Surface adjustments must be a bounded list');
  const approvedExtensions=new Map(),adjusted=new Set();
  if(adjustments.length) {
    const planBytes=recordBytes(root,receipt.materialPlan,'material plan');assert(planBytes.length<=16*1024*1024,'Material plan JSON exceeds 16 MiB');
    const modelPlan=JSON.parse(planBytes.toString('utf8')).models?.[receipt.catalogId];
    assert(modelPlan?.baselineGlbSha256===baseline.sha256,'Surface adjustment material plan targets a different baseline GLB');
    for(const adjustment of adjustments) {
      const key=adjustment.materialKey,original=oldByName.get(key),property='extensions.KHR_materials_sheen.sheenColorFactor',oldFactor=original?.extensions?.KHR_materials_sheen?.sheenColorFactor;
      assert(!adjusted.has(key)&&adjustment.property===property&&finiteArray(adjustment.value,3)&&finiteArray(oldFactor,3)&&adjustment.value.every((v,a)=>v>=0&&v<=.2&&v<=oldFactor[a]),'Invalid, duplicate or out-of-bound cloth sheen adjustment');
      assert(typeof adjustment.reason==='string'&&adjustment.reason.trim().length>=12,'Cloth sheen adjustment needs an explicit reason');
      const entry=modelPlan.materials?.find(m=>m.materialKey===key);
      assert(entry&&['fabric','canvas'].includes(entry.profile)&&!entry.protectedReason,'Sheen adjustment requires an unprotected fabric/canvas material-plan profile');
      assert(entry.surfaceAdjustments?.some(a=>a.property===property&&canonical(a.value)===canonical(adjustment.value)&&a.reason===adjustment.reason),'Sheen adjustment must match its frozen material-plan declaration');
      const extensions=structuredClone(original.extensions);extensions.KHR_materials_sheen.sheenColorFactor=adjustment.value;approvedExtensions.set(key,extensions);adjusted.add(key);
    }
  }
  const maps=receipt.newMaps??[];assert(Array.isArray(maps)&&maps.length<=256,'New maps must be a bounded list');const mapIds=new Set();
  for(const map of maps) {assert(oldByName.has(map.materialKey)&&['baseColor','normal','orm','occlusion','emissive'].includes(map.kind),'New map has unknown material or role');const id=map.materialKey+'/'+map.kind;assert(!mapIds.has(id),'Duplicate new map role');mapIds.add(id);recordBytes(root,map,'new map');assert(inputs.some(i=>i.path===map.path&&i.sha256===map.sha256),'New map must be hash-bound in inputs');assert(Number.isSafeInteger(map.texCoord)&&map.texCoord>=0&&map.texCoord<=7,'New map requires explicit UV set');}
  const usedMaps=new Set();
  for(const material of candidate.document.materials) {
    const old=oldByName.get(material.name),label=`Material ${material.name}`;
    same(material.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1],old.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1],label+' base color factor changed');
    for(const [key,fallback] of [['alphaMode','OPAQUE'],['alphaCutoff',.5],['doubleSided',false],['emissiveFactor',[0,0,0]]])same(material[key]??fallback,old[key]??fallback,label+' '+key+' changed');
    same(material.extensions??{},approvedExtensions.get(material.name)??old.extensions??{},label+' protected material extensions changed');
    same(extensionTextureContracts(candidate,material.extensions),extensionTextureContracts(baseline,old.extensions),label+' protected extension texture changed');
    const oldRoles=imageRoles(old),roles=imageRoles(material);
    for(const [kind,reference] of Object.entries(roles)) {
      if(oldRoles[kind]&&!replacements.has(material.name+'/'+kind)) {same(textureContract(candidate,reference),textureContract(baseline,oldRoles[kind]),label+' original '+kind+' image or binding changed');continue;}
      if(!reference)continue;
      const image=candidate.images[candidate.document.textures?.[reference.index]?.source],map=maps.find(m=>m.materialKey===material.name&&m.kind===kind&&m.sha256===image?.sha256);
      // An explicitly declared ORM can also supply neutral AO, without claiming a cavity bake.
      const declared=map??(kind==='occlusion'?maps.find(m=>m.materialKey===material.name&&m.kind==='orm'&&m.sha256===image?.sha256):undefined);
      assert(declared,label+' new '+kind+' image lacks its bound map receipt');usedMaps.add(declared);
      const uv=reference.extensions?.KHR_texture_transform?.texCoord??reference.texCoord??0;assert.equal(uv,declared.texCoord,label+' new map UV differs from receipt');
      assert(image.width<=Math.min(declared.maxResolution??2048,4096)&&image.height<=Math.min(declared.maxResolution??2048,4096),label+' new texture resolution budget exceeded');
      for(const {primitive:p} of candidate.primitiveRecords.filter(r=>candidate.document.materials[r.primitive.material].name===material.name)) {
        assert(p.attributes[`TEXCOORD_${uv}`]!==undefined,label+' new map uses unexported UV/TEXCOORD');
        assert(candidate.accessor(p.attributes[`TEXCOORD_${uv}`]).type==='VEC2',label+' new map UV must be VEC2');
        if(kind==='normal') {
          assert(p.attributes.NORMAL!==undefined&&p.attributes.TANGENT!==undefined,label+' new normal map requires exported normals and tangents');
          const normals=candidate.accessor(p.attributes.NORMAL),tangents=candidate.accessor(p.attributes.TANGENT);assert(normals.type==='VEC3'&&tangents.type==='VEC4',label+' invalid tangent basis');
          for(let i=0;i<normals.count;i++){const n=normals.values[i],t=tangents.values[i];assert(Math.abs(Math.hypot(...n)-1)<.02&&Math.abs(Math.hypot(...t.slice(0,3))-1)<.02&&Math.abs(n.reduce((sum,v,a)=>sum+v*t[a],0))<.02&&Math.abs(Math.abs(t[3])-1)<.001,label+' invalid normal/tangent unit basis');}
        }
      }
      if(kind==='orm'&&!oldRoles.orm) {const factor=material.pbrMetallicRoughness?.metallicFactor??1,original=old.pbrMetallicRoughness?.metallicFactor??1;if(declared.scanSource){assert(factor===0&&original===0,label+' scanned ORM requires preserved dielectric metallic factor');}else {const range=pngChannel(image.content,2);assert(Math.max(Math.abs(range.min*factor-original),Math.abs(range.max*factor-original))<=1/255+.000001,label+' effective metallic changed');}}
    }
    if((!roles.orm&&!oldRoles.orm)||oldRoles.orm)same(material.pbrMetallicRoughness?.metallicFactor??1,old.pbrMetallicRoughness?.metallicFactor??1,label+' metallic factor changed');
  }
  assert.equal(usedMaps.size,maps.length,'Receipt contains unused or preexisting new maps');
}

function budgetsFor(item,receipt,baseline) {
  const limits={maxTriangles:Math.min(5000000,Math.max(baseline.triangles+20000,Math.ceil(baseline.triangles*2))),maxPrimitives:Math.min(2048,Math.max(baseline.primitives+32,baseline.primitives*2)),maxGlbBytes:Math.min(MAX_BYTES,Math.max(baseline.bytes*2,16*1024*1024)),maxTextureBytes:Math.min(128*1024*1024,Math.max(baseline.images.reduce((s,i)=>s+i.bytes,0)*2,16*1024*1024)),maxTexturePixels:Math.min(256*1024*1024,Math.max(baseline.images.reduce((s,i)=>s+i.width*i.height,0)*2,32*1024*1024))};
  const requested=receipt.budgets??item.budgets??{};
  for(const [key,value] of Object.entries(requested)){assert(Object.hasOwn(limits,key)&&Number.isSafeInteger(value)&&value>0&&value<=limits[key],`Invalid or excessive ${key} budget`);limits[key]=value;}return limits;
}

export function inspectCandidate(root,item,receipt) {
  const issues=[],stats={visualReview:'missing',improvementDetected:false};let artifactSetSha256=null;
  try {
    root=realpathSync(root);assert(item&&/^[a-z0-9][a-z0-9-]*$/.test(item.id),'Invalid catalog ID');
    assert(HASH.test(item.contractSha256)&&item.contractSha256===hashContract(item),'Frozen catalog contract hash changed');
    const expected={sourceBlend:`assets-source/catalog-realism/candidates/${item.id}.blend`,glb:`public/experiments/catalog-realism/models/${item.id}.glb`,receipt:`assets-source/catalog-realism/receipts/${item.id}.json`};same(item.outputs,expected,'Candidate output paths must remain in the scoped Beta experiment');
    assert(receipt?.version===1&&receipt.catalogId===item.id&&receipt.inputContractSha256===item.contractSha256,'Receipt catalog/input contract differs');
    assert(['processed','reviewed'].includes(receipt.state),'Receipt state is incomplete; interrupted work cannot resume as processed');
    assertBlend(recordBytes(root,item.sourceBlend,'baseline Blender source'),'baseline Blender source');recordBytes(root,item.preview,'baseline preview');
    const baseline=inspectCatalogGlb(recordBytes(root,item.baselineGlb,'baseline GLB'));
    for(const key of ['materials','nodes','scenes','scene','animations','skins','extensionsUsed','extensionsRequired','textures','samplers']) {const fallback=key==='scene'?0:[];same(item.baselineGltf?.[key]??fallback,baseline.document[key]??fallback,'Frozen baseline glTF '+key+' differs');}
    same(item.baselineGltf.images??[],baseline.images.map(({index,mimeType,sha256,bytes})=>({index,...(baseline.document.images[index].name===undefined?{}:{name:baseline.document.images[index].name}),mimeType,sha256,bytes})),'Frozen baseline image hashes differ');same([...item.materialKeys].sort(),baseline.document.materials.map(m=>m.name).sort(),'Frozen material keys differ');
    const inputs=receipt.inputs;assert(Array.isArray(inputs)&&inputs.length>=2&&inputs.length<=512,'Bound recipe and material-plan inputs required');const paths=new Set();
    for(const input of inputs){recordBytes(root,input,'input '+input.path);assert(!paths.has(input.path),'Duplicate input path');paths.add(input.path);}
    const recipe=receipt.recipe;assert(recipe&&typeof recipe.id==='string'&&recipe.id.length&&((Number.isSafeInteger(recipe.version)&&recipe.version>0)||(typeof recipe.version==='string'&&recipe.version.length>0&&recipe.version.length<80)),'Receipt needs a versioned recipe');
    recordBytes(root,recipe,'recipe');assert(inputs.some(i=>i.path===recipe.path&&i.sha256===recipe.sha256),'Recipe hash must be bound in inputs');
    recordBytes(root,receipt.materialPlan,'material plan');assert(inputs.some(i=>i.path===receipt.materialPlan.path&&i.sha256===receipt.materialPlan.sha256),'Material plan hash must be bound in inputs');
    assertBlend(recordBytes(root,receipt.outputs?.sourceBlend,'candidate Blender source',item.outputs.sourceBlend),'candidate Blender source');
    assert.notEqual(receipt.outputs.sourceBlend.sha256,item.sourceBlend.sha256,'Candidate source is unchanged');
    const candidate=inspectCatalogGlb(recordBytes(root,receipt.outputs?.glb,'candidate GLB',item.outputs.glb));
    same(movingContract(candidate),movingContract(baseline),'Moving/shared node metadata, pivot or hierarchy changed');
    for(const side of ['min','max'])for(let axis=0;axis<3;axis++)assert(Math.abs(candidate.bounds[side][axis]-baseline.bounds[side][axis])<=.00100001,'Candidate bounds/envelope moved by more than 1 mm');
    const candidateRoots=new Map(candidate.document.scenes[candidate.document.scene??0].nodes.map(i=>[candidate.nodePaths.get(i),candidate.document.nodes[i]]));
    for(const index of baseline.document.scenes[baseline.document.scene??0].nodes){const root=candidateRoots.get(baseline.nodePaths.get(index)),original=baseline.document.nodes[index];assert(root,'Original root name or hierarchy changed');same(nodeTransform(root),nodeTransform(original),'Root orientation/transform changed');same(root.extras??{},original.extras??{},'Original root extras metadata changed');same(root.extensions??{},original.extensions??{},'Original root extensions changed');}
    same(candidate.animationContract,baseline.animationContract,'Authored animation channels or values changed');same(candidate.skinContract,baseline.skinContract,'Authored skin/joint contract changed');
    for(const ext of baseline.document.extensionsRequired??[])assert(candidate.document.extensionsRequired?.includes(ext),'Required baseline extension removed');
    if(item.id.endsWith('-aquarium'))checkAquarium(baseline,candidate,receipt);
    checkMaterials(baseline,candidate,receipt,root,inputs);
    const budgets=budgetsFor(item,receipt,baseline),uniqueImages=[...new Map(candidate.images.map(i=>[i.sha256,i])).values()];
    const costs={triangles:candidate.triangles,primitives:candidate.primitives,glbBytes:candidate.bytes,textureBytes:uniqueImages.reduce((s,i)=>s+i.bytes,0),texturePixels:uniqueImages.reduce((s,i)=>s+i.width*i.height,0)};
    for(const [key,cost] of Object.entries(costs))assert(cost<=budgets['max'+key[0].toUpperCase()+key.slice(1)],`Candidate ${key} budget exceeded`);
    stats.improvementDetected=semanticTriangleHash(candidate)!==semanticTriangleHash(baseline)||appearanceSignature(candidate)!==appearanceSignature(baseline);
    assert(stats.improvementDetected,'Candidate model is semantically unchanged; processing is not improvement');
    assert(Array.isArray(receipt.changes)&&receipt.changes.length>0&&receipt.changes.length<=256&&receipt.changes.every(c=>typeof c.kind==='string'&&c.kind.trim().length>0),'Receipt requires explicit authored changes');
    assert(Array.isArray(receipt.renders)&&receipt.renders.length<=32,'Receipt requires a bounded renders list');const views=new Set();
    if(receipt.renderBinding)verifyRenderConfiguration(receipt.renderBinding);
    for(const render of receipt.renders){assert(CATALOG_REVIEW_VIEWS.includes(render.view)&&!views.has(render.view),'Duplicate or unsupported rendered review view');views.add(render.view);const dimensions=reviewImageDimensions(recordBytes(root,render,'render '+render.view));if(render.resolution)same(render.resolution,[dimensions.width,dimensions.height],'Render resolution differs from actual image');if(dimensions.mimeType==='image/webp')assert(dimensions.width>=640&&dimensions.height>=480,'Lossless review WebP must retain at least 640 x 480 resolution');}
    const payload=Object.fromEntries(Object.entries(receipt).filter(([key])=>!['review','state','artifactSetSha256','formatValidation'].includes(key)));
    artifactSetSha256=sha(canonical({contractSha256:item.contractSha256,receipt:payload}));
    if(receipt.review) {
      const review=receipt.review;stats.visualReview='stale';
      assert(review.decision==='approved'&&review.artifactSetSha256===artifactSetSha256,'Visual review is stale or not approved');
      assert(typeof review.reviewer==='string'&&review.reviewer.trim().length,'Visual review must identify its reviewer');
      for(const view of CATALOG_REVIEW_VIEWS)assert(views.has(view)&&typeof review.views?.[view]==='string'&&review.views[view].trim().length>=12,'Visual review missing render or inspection notes: '+view);
      stats.visualReview='approved';
    }
    assert(receipt.state!=='reviewed'||stats.visualReview==='approved','Reviewed receipt lacks current visual approval');
    Object.assign(stats,costs,{boundsM:candidate.bounds,budgets,estimatedTextureRgbaMipBytes:Math.ceil(costs.texturePixels*4*4/3),materialKeys:candidate.document.materials.map(m=>m.name),baseline:{triangles:baseline.triangles,primitives:baseline.primitives,glbBytes:baseline.bytes},limits:['Compatibility checks do not establish visual quality or source editability.','Review is an explicit attestation bound to these artifact hashes.']});
  } catch(error) {issues.push(error.message);}
  return {ok:issues.length===0,issues,stats,artifactSetSha256};
}

/** Run after export; report is bound to the exact candidate GLB, independently of the review. */
export async function validateKhronosCandidate(root,item) {
  root=realpathSync(root);const file=resolveRepoPath(root,item.outputs.glb);assert(statSync(file).size<=MAX_BYTES,'Candidate exceeds GLB byte bound');const bytes=readFileSync(file);
  return {sha256:sha(bytes),...await validateKhronosGlb(bytes,{uri:item.outputs.glb})};
}

export function requireCatalogReady(root,manifest) {
  root=realpathSync(root);assert(manifest?.version===1&&manifest.scope==='beta-only'&&Array.isArray(manifest.items)&&manifest.items.length>0,'Invalid Beta catalog manifest');
  assert(Array.isArray(manifest.sourceInputs)&&manifest.sourceInputs.length>0,'Manifest source inputs missing');for(const input of manifest.sourceInputs)recordBytes(root,input,'manifest source');
  assert(HASH.test(manifest.catalogSha256)&&manifest.catalogSha256===hashCatalogInventory(manifest),'Manifest catalog SHA256 missing or changed');
  assert(Number.isSafeInteger(manifest.expectedCount)&&manifest.expectedCount>0&&manifest.expectedCount===manifest.items.length,'Manifest catalog coverage is incomplete');
  const ids=new Set(),results=[],failures=[];
  for(const item of manifest.items) {
    assert(!ids.has(item.id),'Duplicate catalog item');ids.add(item.id);
    try {const file=resolveRepoPath(root,item.outputs.receipt);assert(statSync(file).size<=2*1024*1024,'Receipt JSON exceeds 2 MiB');const receipt=JSON.parse(readFileSync(file,'utf8')),result=inspectCandidate(root,item,receipt);results.push({id:item.id,...result});if(!result.ok||result.stats.visualReview!=='approved')failures.push(`${item.id}: ${result.issues.join('; ')||'visual review pending'}`);
      const format=receipt.formatValidation;assert(format&&format.sha256===receipt.outputs.glb.sha256&&format.numErrors===0&&typeof format.validatorVersion==='string','Khronos validation missing or stale');
    }catch(error){failures.push(`${item.id}: ${error.code==='ENOENT'?'candidate pending':error.message}`);}
  }
  assert(failures.length===0,`Catalog is not ready (${failures.length} pending/failed checks):\n${failures.join('\n')}`);return {ok:true,count:results.length,results};
}
