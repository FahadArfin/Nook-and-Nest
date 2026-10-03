import {copyFileSync,existsSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';

const CANDIDATE_DIRECTORY='experiments/catalog-realism';
const pathKey=name=>process.platform==='win32'?name.toLowerCase():name;

/** Keep raw review candidates in DEV; Beta packaging supplies reviewed R2 assets. */
export function catalogPublicAssets(){
  let config;
  return {
    name:'catalog-filtered-public-assets',
    apply:'build',
    config(){return {build:{copyPublicDir:false}};},
    configResolved(value){config=value;},
    writeBundle:{order:'post',sequential:true,handler(outputOptions,bundle){
      if(!config.publicDir||!existsSync(config.publicDir))return;
      const publicDir=path.resolve(config.publicDir),outDir=path.resolve(config.root,outputOptions.dir??config.build.outDir);
      const relativeOut=path.relative(publicDir,outDir);
      if(!relativeOut||(!relativeOut.startsWith('..'+path.sep)&&relativeOut!=='..'&&!path.isAbsolute(relativeOut)))throw new Error('Filtered public copy requires an output directory outside publicDir');
      // Vite normally copies public files before Rollup writes the bundle. This
      // later filtered copy must preserve the same generated-file precedence.
      const emitted=new Set(Object.keys(bundle).map(pathKey)),parents=new Set();
      for(const name of emitted){const parts=name.split('/');parts.pop();while(parts.length){parents.add(parts.join('/'));parts.pop();}}
      const copy=(source,destination,relative='')=>{
        if(pathKey(relative)===CANDIDATE_DIRECTORY||emitted.has(pathKey(relative)))return;
        const stat=statSync(source);
        if(stat.isDirectory()){
          mkdirSync(destination,{recursive:true});
          for(const name of readdirSync(source))copy(path.join(source,name),path.join(destination,name),relative?relative+'/'+name:name);
        }else if(!parents.has(pathKey(relative))){
          mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(source,destination);
        }
      };
      copy(publicDir,outDir);
    }},
  };
}
