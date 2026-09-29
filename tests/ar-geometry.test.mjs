import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {inspectArGlb} from '../scripts/audit-ar-models.mjs';
const root=process.env.NOOK_AR_ASSET_ROOT??resolve('.'),manifest=JSON.parse(readFileSync(new URL('../src/arCatalog.json',import.meta.url)));
test('all allowlisted authored vertex bounds preserve physical axes, dimensions and floor anchoring',()=>{
  for(const [id,entry] of Object.entries(manifest.models)){
    const actual=inspectArGlb(readFileSync(resolve(root,`public/models/furniture/${id}.glb`)));assert.equal(actual.sourceSha256,entry.sourceSha256,`${id}: authored model changed; re-audit before release`);assert.ok(Math.abs(actual.low[1])<.001,`${id}: not on floor`);
    for(const factor of [[1,1,1],[1.2,.8,1.5]]){
      const target=[entry.widthMm,entry.heightMm,entry.depthMm].map((n,i)=>n/1000*factor[i]),scale=target.map((n,i)=>n/entry.authoredSizeM[i]),measured=actual.size.map((n,i)=>n*scale[i]);
      measured.forEach((n,i)=>assert.ok(Math.abs(n-target[i])<1e-6,`${id} axis ${i}: wrong physical scaling`));
    }
  }
});
test('the geometry audit handles actual node matrices and does not rely on accessor bounding-box guesses',()=>{
  const points=Buffer.alloc(24);[0,0,0,1,2,3].forEach((n,i)=>points.writeFloatLE(n,i*4));
  const g={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{translation:[2,3,4],scale:[2,3,4],children:[1]},{mesh:0}],buffers:[{byteLength:24}],bufferViews:[{buffer:0,byteOffset:0,byteLength:24}],accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:2,min:[-999,-999,-999],max:[999,999,999]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}]};
  let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const header=Buffer.alloc(20),tail=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+points.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(points.length);tail.writeUInt32LE(0x004e4942,4);const audit=inspectArGlb(Buffer.concat([header,json,tail,points]));assert.deepEqual(audit.low,[2,3,4]);assert.deepEqual(audit.high,[4,9,16]);assert.deepEqual(audit.size,[2,6,12]);
});
