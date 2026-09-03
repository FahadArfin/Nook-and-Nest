import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const result={};
const srgb = v => v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055;
for(const file of readdirSync('public/models/furniture').filter(f=>f.endsWith('.glb'))){
  const b=readFileSync(`public/models/furniture/${file}`),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  result[file.slice(0,-4)]=(json.materials??[]).map(m=>({id:m.name,label:m.name.replace(/[-_]/g,' ').replace(/textured/g,'').trim(),color:'#'+(m.pbrMetallicRoughness?.baseColorFactor??[.7,.7,.7]).slice(0,3).map(v=>Math.round(255*srgb(v)).toString(16).padStart(2,'0')).join('')}));
}
writeFileSync('src/modelMaterials.json',JSON.stringify(result,null,2)+'\n');
