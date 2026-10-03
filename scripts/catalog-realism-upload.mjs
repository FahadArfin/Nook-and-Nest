/** Upload only a hash-bound staging release to the existing private Beta 1. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,lstatSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {BETA_ORIGIN,BETA_PROJECT,verifyR2Receipt} from './build-catalog-realism-beta.mjs';
import {resolveRepoPath} from './lib/model-pipeline-inspect.mjs';

const HASH=/^[a-f0-9]{64}$/,COMMIT=/^[a-f0-9]{40}$/;
const MAX_BYTES=32*1024*1024,sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourcePath=fileURLToPath(import.meta.url);
const canonicalAsset=name=>/^\/models\/furniture\/[a-z0-9-]+\.glb$/.test(name)||/^\/models\/previews\/[a-z0-9-]+\.webp$/.test(name)||/^\/models\/furniture\/shared-textures\/[a-f0-9]{64}\.(?:png|jpg)$/.test(name);

export async function uploadBetaLibrary(releaseDir,assetRoot,{fetch=globalThis.fetch,environment=process.env,onProgress}={}) {
  assert(onProgress===undefined||typeof onProgress==='function','Progress callback must be a function');
  const uploadToken=environment.NOOK_LIBRARY_UPLOAD_TOKEN,ownerToken=environment.NOOK_SITES_AUTH_TOKEN;
  assert(typeof uploadToken==='string'&&uploadToken.length>0,'NOOK_LIBRARY_UPLOAD_TOKEN is required');
  assert(ownerToken===undefined||typeof ownerToken==='string'&&ownerToken.length>0,'Optional Sites owner token must be nonempty');
  const releasePath=path.join(releaseDir,'release.json'),manifestPath=path.join(releaseDir,'library-manifest.json');
  const releaseBytes=readFileSync(releasePath),manifestBytes=readFileSync(manifestPath),uploaderHash=sha(readFileSync(sourcePath));
  const release=JSON.parse(releaseBytes),manifest=JSON.parse(manifestBytes);
  assert(release.version===1&&release.scope==='beta-only'&&release.mode==='staging'&&release.project_id===BETA_PROJECT&&COMMIT.test(release.commit_sha)&&release.catalogCount===902,'A complete Beta 1 staging release is required');
  assert(HASH.test(release.candidateManifestSha256)&&sha(manifestBytes)===release.candidateManifestSha256,'Staged manifest hash differs from release');
  assert(manifest.schema===1&&manifest.assets&&typeof manifest.assets==='object'&&!Array.isArray(manifest.assets),'Staged assets missing');
  const prefix=`/experiments/catalog-realism/${release.commit_sha}`,entries=Object.entries(manifest.assets);
  assert(entries.length>0,'Staged asset manifest is empty');
  const files=new Map(),hashRecords=new Map();
  function readAsset(name,record){
    const file=resolveRepoPath(assetRoot,name.slice(1)),stat=lstatSync(file);
    assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size===record.size,'Local asset size changed: '+name);
    const bytes=readFileSync(file);assert(bytes.length===record.size&&sha(bytes)===record.sha256,'Local asset hash changed: '+name);return bytes;
  }
  // Validate every path and source before any remote mutation.
  for(const [name,record] of entries){
    assert(name.startsWith(prefix)&&canonicalAsset(name.slice(prefix.length)),'Only this feature staging subtree may be uploaded');
    assert(record&&HASH.test(record.sha256)&&Number.isSafeInteger(record.size)&&record.size>0&&record.size<=MAX_BYTES,'Asset size must be 1 byte to 32 MiB with SHA256');
    const type=name.endsWith('.glb')?'model/gltf-binary':name.endsWith('.webp')?'image/webp':name.endsWith('.jpg')?'image/jpeg':'image/png';
    assert(record.type===type,'Asset content type differs');
    if(hashRecords.has(record.sha256))assert.deepEqual(hashRecords.get(record.sha256),record,'Duplicate hash has inconsistent metadata');
    hashRecords.set(record.sha256,record);readAsset(name,record);files.set(name,record);
  }
  async function request(name,method='GET',body){
    const url=new URL(name,BETA_ORIGIN);assert(url.origin===BETA_ORIGIN,'Fixed Beta origin required');
    const headers={'Cache-Control':'no-cache'};
    if(ownerToken)headers['OAI-Sites-Authorization']='Bearer '+ownerToken;
    if(method!=='GET')headers.Authorization='Bearer '+uploadToken;
    if(body){headers['Content-Length']=String(body.length);headers['Content-Type']='application/octet-stream';}
    try{return await fetch(url,{method,headers,body,redirect:'error',signal:AbortSignal.timeout(120000)});}
    catch{throw Error(`Beta ${method} request failed: ${url.pathname}`);}
  }
  let completed=0,bytes=0,uploaded=0,reused=0,cursor=0,failed=false;
  async function transfer(){for(;;){
    if(failed)return;const entry=entries[cursor++];if(!entry)return;const [name,record]=entry;
    try{
      const local=readAsset(name,record),endpoint='/api/library-upload/'+record.sha256;
      const head=await request(endpoint,'HEAD');
      assert(head.status===200||head.status===404,'Beta storage HEAD failed: '+head.status);
      if(head.status===404){const put=await request(endpoint,'PUT',local);assert(put.status===204,'Beta storage PUT failed: '+put.status);uploaded++;}else reused++;
      const delivered=await request(name+'?verify='+record.sha256);
      assert(delivered.status===200,'Staged delivery failed: '+delivered.status);
      assert(delivered.headers.get('x-nook-asset-storage')==='r2','Staged asset was not delivered from R2: '+name);
      const digest=createHash('sha256');let length=0;
      try{for await(const chunk of delivered.body){length+=chunk.length;if(length>record.size)throw Error();digest.update(chunk);}}
      catch{throw Error('Staged asset response failed or exceeded its byte bound: '+name);}
      assert(length===record.size&&digest.digest('hex')===record.sha256,'Staged asset size/hash differs: '+name);
      completed++;bytes+=length;if(completed%50===0||completed===entries.length)onProgress?.({completed,total:entries.length,bytes});
    }catch(error){failed=true;throw error;}
  }}
  const workers=await Promise.allSettled(Array.from({length:Math.min(6,entries.length)},()=>transfer()));
  for(const worker of workers)if(worker.status==='rejected')throw worker.reason;
  assert(sha(readFileSync(releasePath))===sha(releaseBytes),'Release changed during upload');
  assert(sha(readFileSync(manifestPath))===sha(manifestBytes),'Manifest changed during upload');
  assert(sha(readFileSync(sourcePath))===uploaderHash,'Uploader source changed during upload');
  for(const [name,record] of files)readAsset(name,record);
  const proof={manifest_sha256:sha(manifestBytes),completed,bytes,origin:BETA_ORIGIN,verified_at:new Date().toISOString(),release_sha256:sha(releaseBytes),uploader_sha256:uploaderHash,featureCommit:release.commit_sha,uploaded,reused};
  verifyR2Receipt(proof,manifestBytes);return proof;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv.length===4,'Usage: node scripts/catalog-realism-upload.mjs STAGING_RELEASE_DIR STAGED_ASSET_ROOT');
  const output=path.join(process.argv[2],'r2-verification.json');assert(!existsSync(output),'Verification receipt already exists; preserve the completed release evidence');
  const proof=await uploadBetaLibrary(process.argv[2],process.argv[3],{onProgress:progress=>console.log(JSON.stringify(progress))});
  writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(proof));
}
