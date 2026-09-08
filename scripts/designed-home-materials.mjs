import {readFileSync,writeFileSync} from 'node:fs';
const rows=JSON.parse(readFileSync('src/designedHomeExpansion.json','utf8'));
const result=JSON.parse(readFileSync('src/modelMaterials.json','utf8'));
const srgb=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
for(const [id] of rows){const b=readFileSync(`public/models/furniture/${id}.glb`),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());result[id]=(g.materials??[]).map(m=>({id:m.name,label:m.name.replace(/[-_]/g,' '),color:'#'+(m.pbrMetallicRoughness?.baseColorFactor??[.7,.7,.7]).slice(0,3).map(v=>Math.round(255*srgb(v)).toString(16).padStart(2,'0')).join('')}));}
writeFileSync('src/modelMaterials.json',JSON.stringify(result,null,2)+'\n');
