// Refresh only the approved garage/outdoor and sofa metadata; never touch other models.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const rows=[...read('src/garageExpansion.json'),...read('src/outdoorLivingExpansion.json')];
const allowed=[...rows.map(r=>r[0]),...read('src/sofaRealismIds.json')];
if(new Set(allowed).size!==allowed.length)throw Error('Duplicate selected model IDs');
const check=process.argv.includes('--check'),available=process.argv.includes('--available');
const data=read('src/modelMaterials.json'),changed=[];
const srgb=x=>x<=.0031308?x*12.92:1.055*Math.pow(x,1/2.4)-.055;
const hex=values=>'#'+values.slice(0,3).map(v=>Math.round(255*srgb(Math.min(1,Math.max(0,v)))).toString(16).padStart(2,'0')).join('');
for(const id of allowed){
 const path=resolve(root,`public/models/furniture/${id}.glb`);if(available&&!existsSync(path))continue;
 const bytes=readFileSync(path);if(bytes.readUInt32LE(0)!==0x46546c67)throw Error('Invalid GLB '+id);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 const next=doc.materials.map(m=>({id:m.name,label:m.name.replace(/[-_]/g,' ').replace(/textured/g,'').trim(),color:hex(m.pbrMetallicRoughness?.baseColorFactor??[.7,.7,.7,1])}));
 if(new Set(next.map(m=>m.id)).size!==next.length)throw Error('Duplicate material keys '+id);
 if(JSON.stringify(next)!==JSON.stringify(data[id])){changed.push(id);data[id]=next;}
}
if(check&&changed.length)throw Error('Stale material metadata: '+changed.join(', '));
if(!check&&changed.length)writeFileSync(resolve(root,'src/modelMaterials.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({selected:allowed.length,updated:changed.length,check}));
