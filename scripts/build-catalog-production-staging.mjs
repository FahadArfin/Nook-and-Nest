/** Small production wrappers; the staged application is the pinned public build. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'esbuild';
export const SITES_LIMIT=250*1024*1024;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const importPath=name=>JSON.stringify(path.resolve(name).replaceAll('\\','/'));
export function stagingWorkerSource(prior,handler,manifest,prefix){
 assert(/^\/experiments\/catalog-realism\/[a-f0-9]{40}$/.test(prefix),'Exact commit staging prefix required');
 assert(manifest.schema===1&&Object.keys(manifest.assets??{}).length>0,'Staging assets required');
 for(const name of Object.keys(manifest.assets))assert(name.startsWith(prefix+'/'),'Every staging asset must retain its isolated prefix');
 return `import prior from ${importPath(prior)};\nimport {createLibraryHandler} from ${importPath(handler)};\nconst library=createLibraryHandler(${JSON.stringify(manifest)});\nexport default {...prior,async fetch(request,env,ctx){const name=new URL(request.url).pathname;if(name.startsWith('/api/library-upload/')||name.startsWith(${JSON.stringify(prefix+'/')})||name.startsWith(${JSON.stringify('/api/library-assets'+prefix+'/')}))return await library(request,env)??new Response('Unknown staged asset',{status:404});return prior.fetch(request,env,ctx);}};\n`;
}
export function finalWorkerSource(prior){
 return `import prior from ${importPath(prior)};\nexport default {...prior,fetch(request,env,ctx){if(new URL(request.url).pathname.startsWith('/api/library-upload/'))return new Response('Uploads disabled',{status:403,headers:{'Cache-Control':'no-store'}});return prior.fetch(request,env,ctx);}};\n`;
}
export function assertReleaseSizes({slimBytes,incrementalBytes},staging){
 assert(slimBytes<SITES_LIMIT,'Slim release exceeds 250 MiB');
 if(incrementalBytes>=SITES_LIMIT){assert(staging?.mode==='production-staging','Incremental bridge exceeds 250 MiB');assert(staging.promotionVerified===true,'Oversized bridge requires verified production staging');assert(staging.stagingBytes<SITES_LIMIT,'Staging release exceeds 250 MiB');}
}
export function assertPromotedClient(scripts,promotion){
 assert(/^[a-f0-9]{64}$/.test(promotion?.assetSetSha256),'Approved client revision missing');
 assert(scripts.some(source=>source.includes(promotion.assetSetSha256)),'Compiled production catalog revision missing or stale');
 assert(scripts.some(source=>source.includes('?catalog_realism=')),'Compiled production model URL query missing');
}
async function compile(contents,output){
 const result=await build({stdin:{contents,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
 writeFileSync(output,result.outputFiles[0].contents);
}
export async function finalizeProductionWorker(root){
 const promotionFile=path.join(root,'.generated/catalog-realism-promotion.json');
 if(!existsSync(promotionFile)){assert(process.env.NOOK_CATALOG_RELEASE_MODE!=='production-staging','Production promotion receipt missing');return {enabled:false};}
 const promotion=JSON.parse(readFileSync(promotionFile));assert(promotion.scope==='production'&&promotion.version===1&&promotion.models?.length===902,'Invalid production promotion receipt');
 const target=path.join(root,'dist/server/index.js'),proofPath=path.join(root,'.generated/catalog-production-final-server.json');
 const input=readFileSync(target),helperSha256=sha(readFileSync(fileURLToPath(import.meta.url)));
 if(existsSync(proofPath)){const proof=JSON.parse(readFileSync(proofPath));if(proof.outputSha256===sha(input)){assert(proof.helperSha256===helperSha256&&proof.promotionSha256===sha(readFileSync(promotionFile)),'Final worker wrapper binding is stale');return proof;}}
 const source=path.join(root,'.generated/catalog-production-final-app.mjs');mkdirSync(path.dirname(source),{recursive:true});writeFileSync(source,input);
 await compile(finalWorkerSource(source),target);
 const proof={version:1,enabled:true,inputSha256:sha(input),outputSha256:sha(readFileSync(target)),helperSha256,promotionSha256:sha(readFileSync(promotionFile))};
 writeFileSync(proofPath,JSON.stringify(proof,null,2)+'\n');return proof;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const command=process.argv[2];
 if(command==='finalize'){assert.equal(process.argv.length,3);console.log(JSON.stringify(await finalizeProductionWorker(fileURLToPath(new URL('../',import.meta.url)))));}
 else{assert(command==='wrapper'&&process.argv.length===8,'Usage: build-catalog-production-staging.mjs finalize | wrapper PRIOR HANDLER MANIFEST PREFIX OUTPUT');await compile(stagingWorkerSource(process.argv[3],process.argv[4],JSON.parse(readFileSync(process.argv[5])),process.argv[6]),process.argv[7]);}
}
