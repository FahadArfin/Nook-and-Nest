import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {stagingWorkerSource,finalWorkerSource,assertReleaseSizes} from '../scripts/build-catalog-production-staging.mjs';
import * as staging from '../scripts/build-catalog-production-staging.mjs';
const commit='a'.repeat(40),prefix='/experiments/catalog-realism/'+commit;
const bytes=Buffer.from('candidate'),hash=createHash('sha256').update(bytes).digest('hex');
const manifest={schema:1,assets:{[prefix+'/models/furniture/test.glb']:{sha256:hash,size:bytes.length,type:'model/gltf-binary'}}};
async function worker(source){
 const dir=mkdtempSync(path.join(tmpdir(),'nook-staging-'));
 try{
  const app=path.join(dir,'app.mjs');writeFileSync(app,"export default {scheduled(){return 'retained'},fetch(request,env,ctx){return new Response(ctx.marker+':'+new URL(request.url).pathname)}}");
  const out=await build({stdin:{contents:source(app,path.resolve('worker/library-assets.js')),resolveDir:dir,loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
  return await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('staging delegates old models, previews, application APIs and ctx while admitting only isolated aliases',async()=>{
 const {default:app}=await worker((prior,handler)=>stagingWorkerSource(prior,handler,manifest,prefix));
 assert.equal(typeof app.scheduled,'function');assert.equal(app.scheduled(),'retained');
 const env={LIBRARY_UPLOAD_TOKEN:'secret',LIBRARY:{get:async()=>({body:bytes,size:bytes.length}),head:async()=>({size:bytes.length})}};
 for(const name of ['/','/api/projects','/models/furniture/test.glb','/api/previews/test.webp'])assert.equal(await(await app.fetch(new Request('https://nook.test'+name),env,{marker:'untouched'})).text(),'untouched:'+name);
 for(const name of [prefix+'/models/furniture/test.glb','/api/library-assets'+prefix+'/models/furniture/test.glb']){const result=await app.fetch(new Request('https://nook.test'+name),env,{});assert.equal(result.headers.get('x-nook-asset-storage'),'r2');assert.equal(await result.text(),'candidate');}
 assert.equal((await app.fetch(new Request('https://nook.test/api/library-upload/'+hash,{method:'HEAD',headers:{authorization:'Bearer secret'}}),env,{})).status,200);
 assert.equal((await app.fetch(new Request('https://nook.test/api/library-upload/'+'b'.repeat(64),{method:'HEAD',headers:{authorization:'Bearer secret'}}),env,{})).status,404);
 assert.equal((await app.fetch(new Request('https://nook.test'+prefix+'/missing.glb'),env,{})).status,404);
 assert.throws(()=>stagingWorkerSource('app','handler',{schema:1,assets:{'/models/furniture/test.glb':Object.values(manifest.assets)[0]}},prefix),/prefix/);
});
test('final denies uploads despite lingering secret and retains normal dispatch',async()=>{
 const {default:app}=await worker(prior=>finalWorkerSource(prior));
 assert.equal(typeof app.scheduled,'function');assert.equal(app.scheduled(),'retained');
 const env={LIBRARY_UPLOAD_TOKEN:'still-present'};
 assert.equal((await app.fetch(new Request('https://nook.test/api/library-upload/'+hash,{method:'PUT'}),env,{})).status,403);
 assert.equal(await(await app.fetch(new Request('https://nook.test/api/projects'),env,{marker:'normal'})).text(),'normal:/api/projects');
});
test('oversized incremental is allowed only by explicit, verified staging mode',()=>{
 const sizes={slimBytes:100,incrementalBytes:300*1024*1024};
 assert.throws(()=>assertReleaseSizes(sizes,undefined),/Incremental/);
 assert.throws(()=>assertReleaseSizes(sizes,{mode:'production-staging'}),/verified/);
 assert.doesNotThrow(()=>assertReleaseSizes(sizes,{mode:'production-staging',promotionVerified:true,stagingBytes:100}));
 assert.throws(()=>assertReleaseSizes({...sizes,slimBytes:300*1024*1024},{mode:'production-staging',promotionVerified:true,stagingBytes:100}),/Slim/);
 assert.throws(()=>assertReleaseSizes(sizes,{mode:'production-staging',promotionVerified:true,stagingBytes:300*1024*1024}),/Staging/);
});
test('production client must compile the approved revision and model URL query',()=>{
 assert.equal(typeof staging.assertPromotedClient,'function');
 const promotion={assetSetSha256:'a'.repeat(64)};
 assert.doesNotThrow(()=>staging.assertPromotedClient(['const revision="'+'a'.repeat(64)+'";','const query="?catalog_realism=";'],promotion));
 assert.throws(()=>staging.assertPromotedClient(['const revision="'+'b'.repeat(64)+'";const query="?catalog_realism=";'],promotion),/revision/);
 assert.throws(()=>staging.assertPromotedClient(['const revision="'+'a'.repeat(64)+'";'],promotion),/query/);
});
