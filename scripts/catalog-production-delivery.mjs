/** Exact public release gates, resumable content-addressed upload, and live proof. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {verifyHtmlPayload} from './catalog-realism-live.mjs';
import {resolveRepoPath} from './lib/model-pipeline-inspect.mjs';

export const PUBLIC_PROJECT='appgprj_6a96455b69c08191bac4a9aa7cdd7e43';
export const PUBLIC_ORIGIN='https://nook-and-nest.fwad101.chatgpt.site';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=fileURLToPath(import.meta.url),sourceHash=sha(readFileSync(source));
export function verifyStorageProof(proof,manifestBytes) {
  const manifest=JSON.parse(manifestBytes);
  assert.equal(proof.origin,PUBLIC_ORIGIN,'Storage proof must belong to the public project');
  assert.equal(proof.manifest_sha256,sha(manifestBytes),'Storage manifest hash differs');
  assert.equal(proof.completed,Object.keys(manifest.assets).length,'Storage proof is incomplete');
  assert.equal(proof.bytes,Object.values(manifest.assets).reduce((n,a)=>n+a.size,0),'Storage byte total differs');
  assert(Number.isFinite(Date.parse(proof.verified_at)),'Storage proof timestamp missing');
  return proof;
}
export function loadPublicRelease(directory) {
  const bytes=readFileSync(path.join(directory,'release.json')),receipt=JSON.parse(bytes);
  assert.equal(receipt.project_id,PUBLIC_PROJECT,'Wrong production project');
  assert(/^[a-f0-9]{40}$/.test(receipt.commit_sha),'Exact source commit required');
  assert(receipt.catalog_staging,'Catalog staging receipt missing');
  const inputs=[];
  function bound(name) {
    const file=resolveRepoPath(directory,name),data=readFileSync(file);
    assert.equal(sha(data),receipt.archives[name]?.sha256,'Unbound release input: '+name);
    inputs.push({file,hash:sha(data)});return data;
  }
  function unchanged(){assert.equal(sha(readFileSync(path.join(directory,'release.json'))),sha(bytes),'Release changed');for(const {file,hash} of inputs)assert.equal(sha(readFileSync(file)),hash,'Release input changed');assert.equal(sha(readFileSync(source)),sourceHash,'Delivery verifier changed');}
  return {receipt,releaseHash:sha(bytes),bound,unchanged};
}
export function gatePublicPhase(directory,phase,proofPath) {
  assert(['staging','final'].includes(phase),'Use staging or final');
  const release=loadPublicRelease(directory),stage=release.receipt.catalog_staging;
  const name=phase==='staging'?stage.prerequisites:stage.upload_manifest;
  const proof=verifyStorageProof(JSON.parse(readFileSync(proofPath,'utf8')),release.bound(name));
  if(phase==='final')assert.equal(proof.release_sha256,release.releaseHash,'Upload proof belongs to another release');
  const archive=phase==='staging'?stage.staging_archive:stage.final_archive;
  release.bound(archive);
  assert(release.receipt.archives[archive].expanded_bytes<250*1024*1024,'Archive exceeds Sites size guard');
  release.unchanged();
  return {project_id:PUBLIC_PROJECT,github_commit:release.receipt.commit_sha,phase,archive,
    archive_sha256:release.receipt.archives[archive].sha256,release_sha256:release.releaseHash,
    storage_proof_sha256:sha(readFileSync(proofPath)),storage_manifest_sha256:proof.manifest_sha256};
}
export async function requestPublic(url,{fetch=globalThis.fetch,method='GET',headers={},body,html=false}={}) {
  url=new URL(url,PUBLIC_ORIGIN);assert(url.origin===PUBLIC_ORIGIN&&!url.username&&!url.password,'Fixed public origin required');
  const send=async target=>{try{return await fetch(target,{method,headers:{'Cache-Control':'no-cache',...headers},body,redirect:'manual',signal:AbortSignal.timeout(120000)});}catch{throw Error('Public request failed: '+url.pathname);}};
  let response=await send(url);
  if([301,302,303,307,308].includes(response.status)){
    assert(html&&method==='GET'&&url.pathname.endsWith('.html'),'Unexpected redirect');
    const target=url.pathname.endsWith('/index.html')?url.pathname.slice(0,-10):url.pathname.slice(0,-5);
    const next=new URL(response.headers.get('location'),url);
    assert(next.origin===PUBLIC_ORIGIN&&!next.username&&!next.password&&!next.hash&&next.pathname===target&&(!next.search||next.search===url.search),'Unexpected redirect target');
    next.search=url.search;response=await send(next);
  }
  return response;
}
async function verifyResponse(response,record,label,{r2=false,html}={}) {
  assert.equal(response.status,200,'Response failed: '+label);
  if(r2)assert.equal(response.headers.get('x-nook-asset-storage'),'r2','Asset is not in R2: '+label);
  const digest=createHash('sha256'),chunks=[];let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.length;assert(bytes<=record.size+(html?938:0),'Response exceeds byte bound: '+label);digest.update(chunk);if(html)chunks.push(chunk);}
  if(html)return {bytes,html:verifyHtmlPayload(Buffer.concat(chunks),html)};
  assert.equal(bytes,record.size,'Response size differs: '+label);assert.equal(digest.digest('hex'),record.sha256,'Response hash differs: '+label);return {bytes};
}
function checkLocal(root,name,record) {
  assert(/^\/[a-zA-Z0-9_./-]+$/.test(name)&&!name.includes('//'),'Invalid asset path');
  assert(/^[a-f0-9]{64}$/.test(record.sha256)&&Number.isSafeInteger(record.size)&&record.size>0&&record.size<=32*1024*1024,'Invalid asset bounds');
  const bytes=readFileSync(resolveRepoPath(root,name.slice(1)));
  assert.equal(bytes.length,record.size,'Local size differs: '+name);assert.equal(sha(bytes),record.sha256,'Local hash differs: '+name);return bytes;
}
async function workers(entries,run) {
  let cursor=0,failed=false;
  const results=await Promise.allSettled(Array.from({length:6},async()=>{for(;;){if(failed)return;const entry=entries[cursor++];if(!entry)return;try{await run(entry);}catch(error){failed=true;throw error;}}}));
  for(const result of results)if(result.status==='rejected')throw result.reason;
}
export async function uploadPublicCatalog(directory,assetRoot,{fetch=globalThis.fetch,token=process.env.NOOK_LIBRARY_UPLOAD_TOKEN,onProgress}={}) {
  assert(typeof token==='string'&&token.length>=32,'Upload token required');
  const release=loadPublicRelease(directory),stage=release.receipt.catalog_staging;
  const bytes=release.bound(stage.upload_manifest),manifest=JSON.parse(bytes),entries=Object.entries(manifest.assets);
  assert.equal(stage.prefix,`/experiments/catalog-realism/${release.receipt.commit_sha}`,'Staged prefix differs');
  assert(entries.length>0,'Empty upload');
  for(const [name,record] of entries){assert(name.startsWith(stage.prefix+'/'),'Upload outside release prefix');checkLocal(assetRoot,name,record);}
  let completed=0,totalBytes=0,uploaded=0,reused=0;
  await workers(entries,async([name,record])=>{
    const endpoint='/api/library-upload/'+record.sha256,headers={Authorization:'Bearer '+token};
    const head=await requestPublic(endpoint,{fetch,method:'HEAD',headers});
    assert(head.status===200||head.status===404,'Storage HEAD failed: '+head.status);
    if(head.status===404){const data=checkLocal(assetRoot,name,record);const response=await requestPublic(endpoint,{fetch,method:'PUT',headers:{...headers,'Content-Length':String(data.length)},body:data});assert.equal(response.status,204,'Storage PUT failed');uploaded++;}else reused++;
    const delivered=await requestPublic(name+'?verify='+record.sha256,{fetch});
    await verifyResponse(delivered,record,name,{r2:true});completed++;totalBytes+=record.size;
    if(completed%50===0||completed===entries.length)onProgress?.({completed,total:entries.length,bytes:totalBytes});
  });
  release.unchanged();for(const [name,record] of entries)checkLocal(assetRoot,name,record);
  return verifyStorageProof({origin:PUBLIC_ORIGIN,manifest_sha256:sha(bytes),release_sha256:release.releaseHash,completed,bytes:totalBytes,uploaded,reused,verifier_sha256:sourceHash,verified_at:new Date().toISOString()},bytes);
}
export async function verifyPublicCatalog(directory,dist,{fetch=globalThis.fetch,onProgress}={}) {
  const release=loadPublicRelease(directory),manifestBytes=release.bound('library-manifest.json'),manifest=JSON.parse(manifestBytes);
  const inventory=JSON.parse(release.bound('artifact-inventory.json'));
  const requests=Object.entries(manifest.assets).map(([name,record])=>({name,record,r2:true}));
  const previews=Object.entries(manifest.assets).filter(([name])=>/^\/models\/previews\/[a-z0-9-]+\.webp$/.test(name));
  for(const [name,record] of previews)requests.push({name:name.replace('/models/previews/','/api/previews/'),record,r2:true});
  const app=Object.entries(inventory.files).filter(([name])=>name.startsWith('client/'));
  for(const [name,record] of app){const file=resolveRepoPath(dist,name),bytes=readFileSync(file);assert.equal(sha(bytes),record.sha256,'App file changed');requests.push({name:name==='client/index.html'?'/':'/'+name.slice(7),record,r2:false,html:name.endsWith('.html')?bytes:undefined});}
  let completed=0,totalBytes=0;const htmlPayloads=[];
  await workers(requests,async({name,record,r2,html})=>{
    const url=new URL(name,PUBLIC_ORIGIN);url.searchParams.set('verify',record.sha256);url.searchParams.set('catalog_realism',release.receipt.catalog_staging.catalogRevision);
    const response=await requestPublic(url,{fetch,html:Boolean(html)});
    const result=await verifyResponse(response,record,name,{r2,html});if(result.html)htmlPayloads.push({path:name,...result.html});
    completed++;totalBytes+=result.bytes;if(completed%50===0||completed===requests.length)onProgress?.({completed,total:requests.length,bytes:totalBytes});
  });
  const upload=await requestPublic('/api/library-upload/'+Object.values(manifest.assets)[0].sha256,{fetch,method:'HEAD'});
  assert.equal(upload.status,403,'Final upload endpoint is not disabled');release.unchanged();
  return {origin:PUBLIC_ORIGIN,commit_sha:release.receipt.commit_sha,release_sha256:release.releaseHash,manifest_sha256:sha(manifestBytes),completed:Object.keys(manifest.assets).length,previewAliases:previews.length,appFiles:app.length,requests:completed,bytes:totalBytes,htmlPayloads,uploadsDisabled:true,verifier_sha256:sourceHash,verified_at:new Date().toISOString()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [command,directory,input,output]=process.argv.slice(2);
  assert(['gate-staging','gate-final','upload','verify'].includes(command)&&directory&&input&&output,'Usage: catalog-production-delivery.mjs COMMAND RELEASE_DIR INPUT OUTPUT_JSON');
  assert(!existsSync(output),'Preserve completed evidence; use a fresh output path');
  const onProgress=progress=>console.log(JSON.stringify(progress));
  const result=command.startsWith('gate-')?gatePublicPhase(directory,command.slice(5),input):await (command==='upload'?uploadPublicCatalog:verifyPublicCatalog)(directory,input,{onProgress});
  writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}
