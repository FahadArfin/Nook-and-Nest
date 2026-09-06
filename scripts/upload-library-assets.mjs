/** Sequential, resumable upload; credentials come from the process environment only. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [releaseFolder,assetFolder,origin]=process.argv.slice(2);
if(!releaseFolder||!assetFolder||!origin||!process.env.NOOK_LIBRARY_UPLOAD_TOKEN)throw Error('Release directory, asset directory, site origin and upload token are required');
const base=new URL(origin);if(base.protocol!=='https:'||base.pathname!=='/')throw Error('Use the verified HTTPS site origin');
const manifest=JSON.parse(readFileSync(path.join(releaseFolder,'library-manifest.json')));
const headers={Authorization:'Bearer '+process.env.NOOK_LIBRARY_UPLOAD_TOKEN};
let completed=0,bytes=0,cursor=0;
const entries=Object.entries(manifest.assets);
async function transfer(){
for(;;) {
  const entry=entries[cursor++];if(!entry)return;
  const [name,asset]=entry;
  const data=readFileSync(path.join(assetFolder,name.slice(1)));
  if(data.length!==asset.size||createHash('sha256').update(data).digest('hex')!==asset.sha256)throw Error('Local asset integrity failure: '+name);
  const endpoint=new URL('/api/library-upload/'+asset.sha256,base);
  const head=await fetch(endpoint,{method:'HEAD',headers,signal:AbortSignal.timeout(60000),redirect:'error'});
  if(head.status!==200) {
    if(head.status!==404)throw Error('Storage check failed: '+head.status);
    const put=await fetch(endpoint,{method:'PUT',headers:{...headers,'Content-Length':String(data.length)},body:data,signal:AbortSignal.timeout(120000),redirect:'error'});
    if(put.status!==204)throw Error('Upload failed: '+put.status+' '+name);
  }
  // Verify public delivery of every file, including external GLB texture dependencies.
  const delivered=await fetch(new URL(name+'?verify='+asset.sha256,base),{signal:AbortSignal.timeout(120000),redirect:'error'});
  if(delivered.status!==200||delivered.headers.get('x-nook-asset-storage')!=='r2')throw Error('Asset was not delivered from R2: '+name);
  const actual=Buffer.from(await delivered.arrayBuffer());
  if(createHash('sha256').update(actual).digest('hex')!==asset.sha256)throw Error('Public asset hash mismatch: '+name);
  completed++;bytes+=data.length;
  if(completed%20===0)console.log(JSON.stringify({completed,total:Object.keys(manifest.assets).length,bytes}));
}}
const results=await Promise.allSettled(Array.from({length:3},()=>transfer()));
for(const result of results)if(result.status==='rejected')throw result.reason;
const verification={manifest_sha256:createHash('sha256').update(readFileSync(path.join(releaseFolder,'library-manifest.json'))).digest('hex'),completed,bytes,origin:base.origin,verified_at:new Date().toISOString()};
writeFileSync(path.join(releaseFolder,'r2-verification.json'),JSON.stringify(verification,null,2));
console.log(JSON.stringify(verification));
