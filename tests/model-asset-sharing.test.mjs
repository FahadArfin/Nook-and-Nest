import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {shareImages} from '../scripts/optimize-model-assets.mjs';
const parse=b=>{const length=b.readUInt32LE(12);return {g:JSON.parse(b.subarray(20,20+length)),bin:b.subarray(28+length)};};
test('shares images for the entire catalog while preserving every geometry byte, material and moving node',()=>{
 let savings=0;const allImages=new Map(),references=new Map();
 for(const file of readdirSync('public/models/furniture').filter(f=>f.endsWith('.glb'))){
  const input=readFileSync('public/models/furniture/'+file),output=shareImages(input,(name,data)=>{allImages.set(name,data);references.set(name,(references.get(name)??0)+1);});assert.equal(output.readUInt32LE(8),output.length);const source=parse(input),result=parse(output);assert.deepEqual(result.g.nodes,source.g.nodes);assert.deepEqual(result.g.meshes,source.g.meshes);assert.deepEqual(result.g.materials,source.g.materials);
  const imageViews=new Set((source.g.images??[]).map(i=>i.bufferView));let index=0;
  for(const [i,view] of (source.g.bufferViews??[]).entries()){if(imageViews.has(i))continue;const replacement=result.g.bufferViews[index++];assert.equal(view.byteLength,replacement.byteLength);assert.deepEqual(source.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),result.bin.subarray(replacement.byteOffset??0,(replacement.byteOffset??0)+replacement.byteLength),file);}
  for(const [i,image] of (source.g.images??[]).entries()){
   const next=result.g.images[i];if(image.bufferView===undefined)continue;assert.match(next.uri,/^shared-textures\/[a-f0-9]{64}\.(png|jpg)$/);const v=source.g.bufferViews[image.bufferView],bytes=source.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);assert.deepEqual(allImages.get(next.uri.split('/')[1]),bytes);assert.equal(next.uri.split('/')[1].split('.')[0],createHash('sha256').update(bytes).digest('hex'));
  }
  for(const a of result.g.accessors??[]){if(a.bufferView!==undefined)assert.ok(a.bufferView<result.g.bufferViews.length);}
  savings+=input.length-output.length;
 }
 // Palette and catalog changes alter absolute savings. Verify actual reuse and
 // positive net savings, while byte/hash assertions above prove full fidelity.
 savings-=[...allImages.values()].reduce((sum,b)=>sum+b.length,0);assert.ok(savings>0);assert.ok([...references.values()].some(count=>count>1));assert.ok(allImages.size>0);
});
