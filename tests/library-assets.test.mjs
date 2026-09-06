import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLibraryHandler} from '../worker/library-assets.js';

const bytes=Buffer.from('glTF-example'),hash=createHash('sha256').update(bytes).digest('hex');
const manifest={assets:{'/models/furniture/test.glb':{sha256:hash,size:bytes.length,type:'model/gltf-binary'},'/models/previews/test.webp':{sha256:hash,size:bytes.length,type:'image/webp'}}};
const handler=createLibraryHandler(manifest);
function environment(){
 const objects=new Map();
 return {objects,LIBRARY_UPLOAD_TOKEN:'test-secret',ASSETS:{fetch:async()=>new Response('packaged')},LIBRARY:{
  async head(key){return objects.has(key)?{size:objects.get(key).length}:null;},
  async put(key,stream,options){const b=Buffer.from(await new Response(stream).arrayBuffer());assert.equal(createHash('sha256').update(b).digest('hex'),options.sha256);objects.set(key,b);},
  async get(key,options){const b=objects.get(key);if(!b)return null;const range=options?.range;return {body:range?b.subarray(range.offset,range.offset+range.length):b,size:b.length};}
 }};
}
const req=(path,init)=>new Request('https://nook.test'+path,init);
async function upload(env,body=bytes){return handler(req('/api/library-upload/'+hash,{method:'PUT',body,headers:{authorization:'Bearer test-secret','content-length':String(body.length)}}),env);}
test('upload requires separate secret and current release allowlist',async()=>{
 const env=environment();
 assert.equal((await handler(req('/api/library-upload/'+hash,{method:'PUT',body:bytes}),env)).status,401);
 assert.equal((await handler(req('/api/library-upload/'+'0'.repeat(64),{method:'PUT',body:bytes,headers:{authorization:'Bearer test-secret'}}),env)).status,404);
 assert.equal(env.objects.size,0);
});
test('validates size and SHA-256 before accepting immutable objects',async()=>{
 const env=environment();
 assert.equal((await upload(env,Buffer.from('bad'))).status,400);
 assert.equal((await upload(env,Buffer.alloc(bytes.length))).status,400);
 assert.equal(env.objects.size,0);
 assert.equal((await upload(env)).status,204);
 assert.deepEqual(env.objects.get('library/'+hash),bytes);
});
test('serves stable paths, typed previews, ETags, HEAD and byte ranges from R2',async()=>{
 const env=environment();await upload(env);
 const response=await handler(req('/models/furniture/test.glb?v=old'),env);
 assert.equal(response.headers.get('x-nook-asset-storage'),'r2');
 assert.equal(response.headers.get('content-type'),'model/gltf-binary');
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 assert.equal((await handler(req('/models/furniture/test.glb',{headers:{'if-none-match':'"'+hash+'"'}}),env)).status,304);
 const range=await handler(req('/models/furniture/test.glb',{headers:{range:'bytes=0-3'}}),env);
 assert.equal(range.status,206);assert.equal(await range.text(),'glTF');
 const suffix=await handler(req('/models/furniture/test.glb',{headers:{range:'bytes=-7'}}),env);
 assert.equal(await suffix.text(),'example');
 assert.equal((await handler(req('/models/furniture/test.glb',{headers:{range:'bytes=999-'}}),env)).status,416);
 assert.equal(await (await handler(req('/models/furniture/test.glb',{method:'HEAD'}),env)).text(),'');
 assert.equal((await handler(req('/api/previews/test.webp'),env)).headers.get('content-type'),'image/webp');
 const direct=await handler(req('/api/library-assets/models/furniture/test.glb'),env);
 assert.equal(direct.headers.get('x-nook-asset-storage'),'r2');assert.equal(await direct.text(),bytes.toString());
 assert.equal(await handler(req('/api/projects'),env),null);
});
test('bridge keeps packaged fallback; missing library assets never become SPA HTML',async()=>{
 const env=environment();
 assert.equal(await (await handler(req('/models/furniture/test.glb'),env)).text(),'packaged');
 env.ASSETS.fetch=async()=>new Response('missing',{status:404});
 assert.equal((await handler(req('/models/furniture/test.glb'),env)).status,503);
 env.LIBRARY.get=async()=>{throw Error('outage');};
 assert.equal((await handler(req('/models/furniture/test.glb'),env)).status,503);
});
