import {it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import garage from '../src/garageExpansion.json';
import outdoor from '../src/outdoorLivingExpansion.json';
import materials from '../src/modelMaterials.json';

type Node={children?:number[];mesh?:number;camera?:number;matrix?:number[];translation?:number[];rotation?:number[];scale?:number[]};
type Accessor={bufferView:number;byteOffset?:number;componentType:number;count:number;type:string;sparse?:unknown};
type View={buffer:number;byteOffset?:number;byteLength:number;byteStride?:number};
type TexRef={index:number};
type Glb={scenes:{nodes:number[]}[];scene?:number;nodes:Node[];buffers:{uri?:string}[];cameras?:unknown[];
  accessors:Accessor[];bufferViews:View[];images?:{uri?:string;bufferView?:number;mimeType?:string}[];textures?:{source:number}[];
  meshes:{primitives:{mode?:number;indices:number;material:number;attributes:{POSITION:number;TEXCOORD_0:number}}[]}[];
  materials:{name:string;extras?:{nook_canonical_material_key?:string;realism_family?:string};normalTexture?:TexRef;
    pbrMetallicRoughness?:{baseColorTexture?:TexRef;metallicRoughnessTexture?:TexRef}}[]};

function loadGlb(id:string){
  const bytes=readFileSync(`public/models/furniture/${id}.glb`);
  assert.equal(bytes.readUInt32LE(0),0x46546c67,id);assert.equal(bytes.readUInt32LE(4),2,id);
  assert.equal(bytes.readUInt32LE(8),bytes.length,id);assert(bytes.length<5_000_000,`${id}: model budget`);
  let doc:Glb|undefined,bin:Buffer|undefined;
  for(let offset=12;offset<bytes.length;){
    assert(offset+8<=bytes.length,id);const length=bytes.readUInt32LE(offset),kind=bytes.readUInt32LE(offset+4);
    assert(length%4===0&&offset+8+length<=bytes.length,id);const part=bytes.subarray(offset+8,offset+8+length);
    if(kind===0x4e4f534a){assert.equal(doc,undefined,id);doc=JSON.parse(part.toString('utf8')) as Glb;}
    if(kind===0x004e4942){assert.equal(bin,undefined,id);bin=part;}offset+=8+length;
  }
  assert(doc&&bin,`${id}: JSON/BIN missing`);return {doc,bin};
}

// Same matrix/quaternion transform as garage_outdoor_verify.py. Read actual
// POSITION values, never accessor min/max or the generated audit's bounds.
function transform(n:Node,p:number[]):number[]{
  if(n.matrix){const m=n.matrix;return [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);}
  const v=p.map((x,i)=>x*(n.scale?.[i]??1)),[x,y,z,w]=n.rotation??[0,0,0,1];
  const tx=2*(y*v[2]-z*v[1]),ty=2*(z*v[0]-x*v[2]),tz=2*(x*v[1]-y*v[0]);
  return [v[0]+w*tx+y*tz-z*ty,v[1]+w*ty+z*tx-x*tz,v[2]+w*tz+x*ty-y*tx]
    .map((value,i)=>value+(n.translation?.[i]??0));
}

it('keeps the 103 new garage/outdoor exports dimensionally accurate, self-contained and independently editable',()=>{
  // Existing placement tests cover catalog/mount/schema behavior; existing
  // optimization tests cover byte preservation. This reads only the new assets,
  // without loading Blender/Babylon, recompressing, or doing support ray scans.
  const metadata=materials as Record<string,{id:string}[]>;
  for(const row of [...garage,...outdoor]){
    const id=String(row[0]),{doc:g,bin}=loadGlb(id);
    assert.equal(g.scenes.length,1,id);assert.equal(g.buffers.length,1,id);assert(!g.buffers[0].uri,id);
    assert(!g.cameras?.length&&g.nodes.every(n=>n.camera===undefined),`${id}: camera leaked into export`);
    const viewBytes=(index:number)=>{const v=g.bufferViews[index];assert(v&&v.buffer===0,id);
      assert((v.byteOffset??0)+v.byteLength<=bin.length,id);return v;};
    for(const im of g.images??[]){
      assert(!im.uri&&im.bufferView!==undefined,`${id}: external image dependency`);viewBytes(im.bufferView);
      assert(['image/png','image/jpeg'].includes(im.mimeType??''),`${id}: unsupported embedded image`);
    }
    const checkTexture=(ref:TexRef|undefined)=>{assert(ref,`${id}: missing PBR map`);
      const texture=g.textures?.[ref.index];assert(texture&&g.images?.[texture.source],`${id}: broken PBR image reference`);};
    const names=g.materials.map(m=>m.name);
    assert(names.length&&names.length===new Set(names).size,id);
    assert.deepEqual(metadata[id]?.map(m=>m.id),names,`${id}: runtime material keys disagree`);
    for(const m of g.materials){
      assert(m.name&&!/\.[0-9]+$/.test(m.name),`${id}: unstable material key`);
      assert.equal(m.extras?.nook_canonical_material_key,m.name,`${id}: editable material key drift`);
      if(m.extras?.realism_family){
        // Glazed ceramic deliberately retains solid pigment instead of a stone
        // colour image; its fine normal/roughness maps still must be embedded.
        if(m.extras.realism_family!=='ceramic')checkTexture(m.pbrMetallicRoughness?.baseColorTexture);
        checkTexture(m.normalTexture);checkTexture(m.pbrMetallicRoughness?.metallicRoughnessTexture);
      }
    }
    const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];let triangles=0;
    const visit=(index:number,parents:number[])=>{
      assert(!parents.includes(index),`${id}: node cycle`);const node=g.nodes[index];assert(node,id);
      if(node.mesh!==undefined)for(const primitive of g.meshes[node.mesh].primitives){
        assert.equal(primitive.mode??4,4,id);assert(g.materials[primitive.material],`${id}: missing primitive material`);
        const a=g.accessors[primitive.attributes.POSITION],uv=g.accessors[primitive.attributes.TEXCOORD_0];
        assert(a&&uv&&uv.count===a.count&&uv.type==='VEC2',`${id}: missing exported UVs`);
        assert.equal(a.componentType,5126,id);assert.equal(a.type,'VEC3',id);assert(!a.sparse&&a.count>0,id);
        const v=viewBytes(a.bufferView),stride=v.byteStride??12,start=(v.byteOffset??0)+(a.byteOffset??0);
        assert(stride>=12&&(a.byteOffset??0)+(a.count-1)*stride+12<=v.byteLength,id);
        for(let i=0;i<a.count;i++){
          let p=[0,1,2].map(axis=>bin.readFloatLE(start+i*stride+axis*4));
          for(const n of [index,...parents])p=transform(g.nodes[n],p);
          for(let axis=0;axis<3;axis++){assert(Number.isFinite(p[axis]),`${id}: nonfinite position`);low[axis]=Math.min(low[axis],p[axis]);high[axis]=Math.max(high[axis],p[axis]);}
        }
        const indices=g.accessors[primitive.indices];assert(indices&&indices.count%3===0,id);triangles+=indices.count/3;
      }
      for(const child of node.children??[])visit(child,[index,...parents]);
    };
    for(const index of g.scenes[0].nodes)visit(index,[]);
    const expected=[Number(row[3]),Number(row[5]),Number(row[4])];
    for(let axis=0;axis<3;axis++){
      assert(Math.abs((high[axis]-low[axis])*1000-expected[axis])<.12,`${id}: actual ${axis} dimension drift`);
      assert(Math.abs(axis===1?low[axis]:low[axis]+high[axis])<.00012,`${id}: base/center drift`);
    }
    assert(triangles>0&&triangles<50_000,`${id}: triangle budget`);
    assert(statSync(`assets-source/blender/${id}.blend`).size>1000,`${id}: editable source missing`);
    const png=readFileSync(`assets-source/previews/${id}.png`),webp=readFileSync(`public/models/previews/${id}.webp`);
    assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`${id}: source preview missing`);
    assert.equal(webp.subarray(0,4).toString(),'RIFF',id);assert.equal(webp.subarray(8,12).toString(),'WEBP',id);
  }
});
