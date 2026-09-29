import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import materials from '../src/modelMaterials.json';
import {catalog,isCeilingMounted,isSurfaceMounted,isWallMounted} from '../src/catalog';

type Row=[string,string,string,number,number,number,string,string,string,string];
const rows=readdirSync('src').filter(f=>/^household\w*Expansion\.json$/.test(f)).sort()
 .flatMap(f=>JSON.parse(readFileSync('src/'+f,'utf8')) as Row[]);
type Glb={scenes:{nodes:number[]}[];nodes:{name?:string;camera?:number;mesh?:number;matrix?:number[];translation?:number[];rotation?:number[];scale?:number[]}[];
 accessors:{bufferView:number;byteOffset?:number;componentType:number;count:number;type:string;min?:number[];max?:number[]}[];
 bufferViews:{buffer:number;byteOffset?:number;byteLength:number;byteStride?:number}[];
 meshes:{primitives:{attributes:{POSITION:number};indices:number;mode?:number;material:number}[]}[];
 materials:{name:string}[];buffers:{uri?:string}[];images?:{uri?:string}[]};
function loadGlb(id:string){
 const file=readFileSync(`public/models/furniture/${id}.glb`);
 expect(file.readUInt32LE(0),id).toBe(0x46546c67);expect(file.readUInt32LE(4),id).toBe(2);expect(file.readUInt32LE(8),id).toBe(file.length);
 let document:Glb|undefined,binary:Buffer|undefined;
 for(let offset=12;offset<file.length;){
  const length=file.readUInt32LE(offset),kind=file.readUInt32LE(offset+4),data=file.subarray(offset+8,offset+8+length);
  expect(offset+8+length,id).toBeLessThanOrEqual(file.length);
  if(kind===0x4e4f534a)document=JSON.parse(data.toString('utf8')) as Glb;
  if(kind===0x004e4942)binary=data;offset+=8+length;
 }
 if(!document||!binary)throw Error(id+' lacks JSON/BIN chunk');
 return {file,doc:document,bin:binary};
}

describe('household collection asset contract',()=>{
 it('keeps unique catalog IDs, declared mounts, editable source and rendered preview files',()=>{
  expect(rows.length).toBeGreaterThan(120);expect(new Set(rows.map(r=>r[0])).size).toBe(rows.length);
  for(const row of rows){
   const id=row[0],entry=catalog.filter(c=>c.id===id);expect(entry,id).toHaveLength(1);
   expect([entry[0].widthMm,entry[0].depthMm,entry[0].heightMm],id).toEqual(row.slice(3,6));
   expect(isWallMounted(id),id).toBe(row[8]==='wall');expect(isSurfaceMounted(id),id).toBe(row[8]==='surface');expect(isCeilingMounted(id),id).toBe(row[8]==='ceiling');
   expect(statSync(`assets-source/blender/${id}.blend`).size,id).toBeGreaterThan(10000);
   expect(statSync(`assets-source/previews/${id}.png`).size,id).toBeGreaterThan(1000);
   const preview=readFileSync(`public/models/previews/${id}.webp`);
   expect(preview.subarray(0,4).toString(),id).toBe('RIFF');expect(preview.subarray(8,12).toString(),id).toBe('WEBP');
  }
 });

 it('measures actual vertex bounds and enforces isolated, self-contained, bounded exports and exact material keys',()=>{
  const metadata=materials as Record<string,{id:string;label:string;color:string}[]>;
  const sourceKeys=JSON.parse(readFileSync('assets-source/household-material-keys.json','utf8')) as {models:Record<string,{sourceToExport:Record<string,string>;exportKeys:string[]}>};
  for(const row of rows){
   const id=row[0],{doc,bin,file}=loadGlb(id);
   expect(doc.scenes,id).toHaveLength(1);expect(doc.nodes.some(n=>/^Cube(?:\.\d+)?$/.test(n.name??'')||n.camera!==undefined),id).toBe(false);
   expect(doc.buffers.every(b=>!b.uri),id).toBe(true);expect((doc.images??[]).every(i=>!i.uri),id).toBe(true);
   // Authoring pipeline bakes world transforms so accessor vertices are model-space coordinates.
   for(const node of doc.nodes){expect(node.matrix,id).toBeUndefined();expect(node.translation??[0,0,0],id).toEqual([0,0,0]);expect(node.rotation??[0,0,0,1],id).toEqual([0,0,0,1]);expect(node.scale??[1,1,1],id).toEqual([1,1,1]);}
   const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];let triangles=0;
   for(const primitive of doc.meshes.flatMap(m=>m.primitives)){
    expect(primitive.mode??4,id).toBe(4);const a=doc.accessors[primitive.attributes.POSITION],v=doc.bufferViews[a.bufferView];
    expect(a.componentType,id).toBe(5126);expect(a.type,id).toBe('VEC3');expect(v.buffer,id).toBe(0);
    const start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
    expect(start+(a.count-1)*stride+12,id).toBeLessThanOrEqual(bin.length);
    for(let i=0;i<a.count;i++)for(let axis=0;axis<3;axis++){
     const value=bin.readFloatLE(start+i*stride+axis*4);if(!Number.isFinite(value))throw Error(id+' has nonfinite vertex');
     low[axis]=Math.min(low[axis],value);high[axis]=Math.max(high[axis],value);
    }
    triangles+=doc.accessors[primitive.indices].count/3;
    expect(primitive.material,id).toBeLessThan(doc.materials.length);
   }
   const dimensions=[row[3],row[5],row[4]];
   for(let axis=0;axis<3;axis++){
    expect((high[axis]-low[axis])*1000,id).toBeCloseTo(dimensions[axis],1);
    expect(axis===1?low[axis]:low[axis]+high[axis],id).toBeCloseTo(0,5);
   }
   expect(triangles,id).toBeGreaterThan(0);expect(triangles,id).toBeLessThanOrEqual(50000);expect(file.length,id).toBeLessThanOrEqual(3000000);
   expect(metadata[id]?.map(m=>m.id),id).toEqual(doc.materials.map(m=>m.name));
   expect(doc.materials.some(m=>/\.[0-9]+$/.test(m.name)),id+' stable material keys').toBe(false);
   expect(sourceKeys.models[id]?.exportKeys,id+' source-to-export material keys').toEqual(doc.materials.map(m=>m.name));
   expect(Object.values(sourceKeys.models[id]?.sourceToExport??{}).length,id+' preserved source aliases').toBeGreaterThan(0);
   expect(metadata[id]?.every(m=>m.label.length>0&&/^#[0-9a-f]{6}$/i.test(m.color)),id).toBe(true);
  }
 });

 it('accounts for every research family without promoting files to acceptance or duplicating the existing high chair',()=>{
  const progress=JSON.parse(readFileSync('assets-source/household-progress.json','utf8')) as {families:Record<string,{status:string;catalogIds:string[]}>};
  expect(Object.keys(progress.families)).toHaveLength(138);
  for(let n=1;n<=138;n++){const f=progress.families[`HOME-${String(n).padStart(3,'0')}`];expect(f).toBeDefined();expect(f.catalogIds.length).toBeGreaterThan(0);if(n<=8)expect(f.status).toBe('released');}
  expect(progress.families['HOME-072']).toMatchObject({status:'covered-existing',catalogIds:['high-chair']});
  const covered=new Set(Object.values(progress.families).flatMap(f=>f.catalogIds));
  for(const row of rows)expect(covered.has(row[0]),row[0]).toBe(true);
 });
});
