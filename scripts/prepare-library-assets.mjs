import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const libraryFolders=['models','textures','data/toronto'];
export function prepareLibrary(root='dist/client', output='.generated') {
  const assets={};
  const types={'.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.gz':'application/gzip','.html':'text/html; charset=utf-8'};
  function walk(folder) {
    for(const entry of readdirSync(path.join(root,folder),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const relative=folder+'/'+entry.name;
      if(entry.isDirectory()){walk(relative);continue;}
      const bytes=readFileSync(path.join(root,relative)),sha256=createHash('sha256').update(bytes).digest('hex');
      if(bytes.length>32*1024*1024)throw Error('Asset exceeds bounded upload size: '+relative);
      assets['/'+relative]={sha256,size:bytes.length,type:types[path.extname(relative)]??'application/octet-stream'};
    }
  }
  for(const folder of libraryFolders)walk(folder);
  mkdirSync(output,{recursive:true});
  writeFileSync(path.join(output,'library-manifest.json'),JSON.stringify({schema:1,assets},null,2)+'\n');
  console.log('Prepared R2 manifest: '+Object.keys(assets).length+' assets');
  return assets;
}
