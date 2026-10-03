// Bounded experiment acceptance: inspect actual GLB binary vertices, not declared bounds.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const folder='public/experiments/realism-lab';
const ids=['sofa-current','sofa-material','sofa-refined','table-current','table-material','table-refined'];
const keys={sofa:['wood-honey-textured','upholstery-textured','tailored-tone-on-tone-stitch','joinery-aged-brass'],table:['walnut','matte-rubber','honey-oak','champagne-brass']};
function transform(n,p){
 if(n.matrix){const m=n.matrix;return [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);}
 const v=p.map((x,i)=>x*(n.scale?.[i]??1)),[x,y,z,w]=n.rotation??[0,0,0,1];
 const tx=2*(y*v[2]-z*v[1]),ty=2*(z*v[0]-x*v[2]),tz=2*(x*v[1]-y*v[0]);
 return [v[0]+w*tx+y*tz-z*ty,v[1]+w*ty+z*tx-x*tz,v[2]+w*tz+x*ty-y*tx].map((p,i)=>p+(n.translation?.[i]??0));
}
export function inspect(id){
 const bytes=readFileSync(`${folder}/${id}.glb`);assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jlen=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jlen)),bin=bytes.subarray(28+jlen);
 assert.equal(g.scenes.length,1);assert.equal(g.buffers.length,1);assert(!g.buffers[0].uri);
 assert(!/"(?:authoring_owner|lab_review_owner)"/.test(JSON.stringify(g)),id+': operational ownership must not travel with an imported asset');
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity],geometry=new Set(),faces=[];let triangles=0,primitives=0;
 function accessor(index,components){
  const a=g.accessors[index];assert(a&&!a.sparse);const v=g.bufferViews[a.bufferView];assert(v?.buffer===0);
  const stride=v.byteStride??components*4,start=(v.byteOffset??0)+(a.byteOffset??0);
  assert.equal(a.componentType,5126);assert((a.byteOffset??0)+(a.count-1)*stride+components*4<=v.byteLength);
  return Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,k)=>bin.readFloatLE(start+i*stride+k*4)));
 }
 function visit(index,parents=[]){
  assert(!parents.includes(index));const n=g.nodes[index];assert(n&&n.camera===undefined);
  if(n.mesh!==undefined)for(const p of g.meshes[n.mesh].primitives){
   assert.equal(p.mode??4,4);primitives++;assert(g.materials[p.material]);
   const points=accessor(p.attributes.POSITION,3),normals=accessor(p.attributes.NORMAL,3);
   assert.equal(points.length,normals.length);assert(normals.every(n=>n.every(Number.isFinite)));
   if(id!=='table-current')assert.equal(accessor(p.attributes.TEXCOORD_0,2).length,points.length);
   const world=[];
   for(let point of points){for(const i of [index,...parents])point=transform(g.nodes[i],point);
    assert(point.every(Number.isFinite));point.forEach((v,i)=>{low[i]=Math.min(low[i],v);high[i]=Math.max(high[i],v);});
    const key=point.map(v=>v.toFixed(6)).join(',');geometry.add(key);world.push(key);
   }
   const a=g.accessors[p.indices];assert(a&&!a.sparse&&a.count%3===0);triangles+=a.count/3;
   assert([5121,5123,5125].includes(a.componentType));
   const size={5121:1,5123:2,5125:4}[a.componentType],v=g.bufferViews[a.bufferView],start=(v.byteOffset??0)+(a.byteOffset??0);
   assert((a.byteOffset??0)+a.count*size<=v.byteLength);
   for(let i=0;i<a.count;i+=3){const face=[];for(let j=0;j<3;j++){const vertex=bin.readUIntLE(start+(i+j)*size,size);assert(vertex<world.length,id+': index bounds');face.push(world[vertex]);}faces.push(face.sort().join('|'));}
  }
  for(const child of n.children??[])visit(child,[index,...parents]);
 }
 for(const root of g.scenes[g.scene??0].nodes)visit(root);
 const family=id.split('-')[0],dims=family==='sofa'?[2000,780,850]:[1000,400,550];
 dims.forEach((d,i)=>{assert(Math.abs((high[i]-low[i])*1000-d)<.15,`${id}: dimension ${i}: ${(high[i]-low[i])*1000} vs ${d}`);assert(Math.abs(i===1?low[i]:low[i]+high[i])<.00015,`${id}: origin`);});
 assert.deepEqual(g.materials.map(m=>m.name).sort(),[...keys[family]].sort(),id+': material keys');
 assert(triangles>0&&triangles<40_000,id+': triangle budget');assert(bytes.length<8_000_000,id+': byte budget');assert(primitives<=8,id+': draw budget');
 for(const image of g.images??[]){assert(image.uri===undefined&&image.bufferView!==undefined,id+': external texture');const v=g.bufferViews[image.bufferView];assert(v&&(v.byteOffset??0)+v.byteLength<=bin.length);}
 if(id!=='table-current')for(const material of g.materials.filter(m=>/oak|walnut|wood|upholstery/.test(m.name))){
  for(const ref of [material.pbrMetallicRoughness?.baseColorTexture,material.pbrMetallicRoughness?.metallicRoughnessTexture,material.normalTexture])assert(ref&&g.images?.[g.textures[ref.index].source],id+': missing exported PBR map on '+material.name);
 }
 assert(statSync(`assets-source/experiments/realism-lab/${id}.blend`).size>1000,id+': editable source');
 return {id,dimensionsMm:{width:dims[0],depth:dims[2],height:dims[1]},boundsMm:{low:low.map(v=>v*1000),high:high.map(v=>v*1000)},triangles,bytes:bytes.length,primitives,images:g.images?.length??0,materialKeys:g.materials.map(m=>m.name),geometryHash:createHash('sha256').update([...geometry].sort().join('\n')).digest('hex'),topologyHash:createHash('sha256').update(faces.sort().join('\n')).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex')};
}
const variants=ids.map(inspect);
const tableA=variants.find(v=>v.id==='table-current'),tableB=variants.find(v=>v.id==='table-material');
assert.equal(tableA.geometryHash,tableB.geometryHash,'Material-only control must preserve the same measured vertex set');
assert.equal(tableA.triangles,tableB.triangles,'Material-only control must preserve triangles');
assert.equal(tableA.topologyHash,tableB.topologyHash,'Material-only control must preserve actual triangle positions');
assert.equal(variants[0].geometryHash,variants[1].geometryHash,'Sofa material control geometry');
assert.equal(variants[0].triangles,variants[1].triangles,'Sofa material control topology');
const sofaBytes=ids.slice(0,2).map(id=>readFileSync(`${folder}/${id}.glb`));
assert(sofaBytes[0].subarray(20+sofaBytes[0].readUInt32LE(12)).equals(sofaBytes[1].subarray(20+sofaBytes[1].readUInt32LE(12))),'Sofa material control must preserve entire binary chunk');
const result={version:1,generatedAt:new Date().toISOString(),variants,notes:['Two representative assets; this is not an Astra-versus-other-model benchmark.','Sofa moss color is applied consistently as in the Nook & Nest catalog.','Generated images guided construction; dimensions come from the catalog.','Only the selected model loads; costs shown are source GLB bytes, without production mesh compression.']};
writeFileSync(`${folder}/results.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({accepted:variants.length,variants:variants.map(({id,triangles,bytes,primitives,images})=>({id,triangles,bytes,primitives,images})),materialControlGeometryIdentical:true},null,2));
