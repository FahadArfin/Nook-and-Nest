import {readFile,stat,readdir,mkdir,writeFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../docs/asset-pipeline.json',import.meta.url),'utf8'));
const root=new URL('../',import.meta.url),ids=new Set();
for(const r of manifest.recipes){
 if(!r.id||ids.has(r.id)||!r.outputs.length)throw Error('Invalid or duplicate recipe '+r.id);ids.add(r.id);
 for(const p of [...r.generators,...r.inputs]){if(p.includes('..')||p.startsWith('/'))throw Error('Invalid relative path '+p);await stat(new URL(p,root));}
}
if(process.argv.includes('--inventory')){
 const files=[];async function walk(dir){for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else files.push({path:p,bytes:(await stat(new URL(p,root))).size});}}
 await walk('public/models');files.sort((a,b)=>a.path.localeCompare(b.path));await mkdir(new URL('.generated/',root),{recursive:true});await writeFile(new URL('.generated/asset-inventory.json',root),JSON.stringify({version:1,files},null,2)+'\n');
}
console.log('Verified '+ids.size+' asset pipeline recipes');
