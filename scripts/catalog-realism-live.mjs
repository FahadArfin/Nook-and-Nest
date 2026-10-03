/** Read-only final Beta verification: canonical objects, preview aliases and app bytes. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {BETA_PROJECT,BETA_ORIGIN,assembleBetaManifest,catalogCacheRevision} from './build-catalog-realism-beta.mjs';
import {canonicalJson} from './lib/catalog-realism-inventory.mjs';
import {resolveRepoPath} from './lib/model-pipeline-inspect.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const verifierPath=fileURLToPath(import.meta.url),verifierSha256=sha(readFileSync(verifierPath));

// Exact 938-byte Cloudflare JSD insertion captured from both existing Beta HTML
// routes on 2026-10-03. Only the 16-hex ray ID and base64 decimal epoch vary.
// The recorded response/artifact hashes are in the platform-html test fixture.
const CHALLENGE_TEMPLATE=`<script>(function(){function c(){var b=a.contentDocument||(a.contentWindow&&a.contentWindow.document);if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'{{RAY}}',t:'{{TIME}}'};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script>`;
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const [challengeBefore,challengeRest]=CHALLENGE_TEMPLATE.split('{{RAY}}'),[challengeMiddle,challengeAfter]=challengeRest.split('{{TIME}}');
const CHALLENGE_RE=new RegExp('^'+escapeRegex(challengeBefore)+'([a-f0-9]{16})'+escapeRegex(challengeMiddle)+'([A-Za-z0-9+/]{14}==)'+escapeRegex(challengeAfter)+'$');
const CHALLENGE_BYTES=Buffer.byteLength(CHALLENGE_TEMPLATE.replace('{{RAY}}','0'.repeat(16)).replace('{{TIME}}','0'.repeat(16)));

export function verifyHtmlPayload(actual,expected) {
  const proof={actualSha256:sha(actual),originalArtifactSha256:sha(expected),originalArtifactHtmlPreserved:true,platformInsertedBytes:0};
  if(actual.equals(expected))return proof;
  const added=actual.length-expected.length,bodyEnd=expected.indexOf('</body>');
  // Captured legacy attribution HTML omits </body>; Sites appends the same
  // exact challenge at EOF without rewriting even one original byte.
  const at=bodyEnd<0?expected.length:bodyEnd;
  assert(added===CHALLENGE_BYTES&&(bodyEnd<0?!/<\/body\s*>/i.test(expected.toString('utf8')):expected.indexOf('</body>',at+1)<0),'Unexpected HTML insertion size or body boundary');
  assert(actual.subarray(0,at).equals(expected.subarray(0,at))&&actual.subarray(at+added).equals(expected.subarray(at)),'Original artifact HTML changed around the platform insertion');
  const inserted=actual.subarray(at,at+added),match=CHALLENGE_RE.exec(inserted.toString('utf8'));
  assert(match,'Unrecognized HTML challenge insertion');
  const timestamp=Buffer.from(match[2],'base64').toString('ascii');
  assert(/^\d{10}$/.test(timestamp)&&Buffer.from(timestamp).toString('base64')===match[2],'Invalid HTML challenge timestamp');
  const exact=Buffer.from(CHALLENGE_TEMPLATE.replace('{{RAY}}',match[1]).replace('{{TIME}}',match[2]));
  assert(inserted.equals(exact),'HTML challenge bytes differ');
  return {...proof,platformInsertedBytes:added,insertionSha256:sha(inserted),platformTemplate:'cloudflare-jsd-2026-10-03',templateSha256:sha(CHALLENGE_TEMPLATE),insertionOffset:at};
}

/** Credentials stay in the request headers and are never returned or logged. */
export async function requestBeta(url,{fetch=globalThis.fetch,environment=process.env,method='GET',allowIndexRedirect=false,allowHtmlRedirect=false}={}) {
  url=new URL(url);
  assert(url.origin===BETA_ORIGIN&&!url.username&&!url.password,'Live requests require the fixed Beta origin');
  const headers={'Cache-Control':'no-cache'},token=environment.NOOK_SITES_AUTH_TOKEN;
  if(token){assert(typeof token==='string'&&token.length<=8192&&/^[\x21-\x7e]+$/.test(token),'Invalid optional Sites authentication value');headers['OAI-Sites-Authorization']='Bearer '+token;}
  const options={method,headers,redirect:'manual',signal:AbortSignal.timeout(method==='HEAD'?60000:120000)};
  const send=async target=>{try{return await fetch(target,options);}catch{throw Error('Live request failed: '+url.pathname);}};
  let response=await send(url);
  if([301,302,303,307,308].includes(response.status)) {
    const index=(allowIndexRedirect||allowHtmlRedirect)&&url.pathname.endsWith('/index.html');
    const pretty=allowHtmlRedirect&&url.pathname.endsWith('.html')&&!url.pathname.endsWith('/index.html');
    assert(method==='GET'&&(index||pretty),'Unexpected live redirect');
    const location=response.headers.get('location');assert(location,'Missing live redirect location');
    const next=new URL(location,url);
    const target=index?url.pathname.slice(0,-'index.html'.length):url.pathname.slice(0,-'.html'.length);
    assert(next.origin===BETA_ORIGIN&&!next.username&&!next.password&&next.pathname===target&&!next.hash&&(!next.search||next.search===url.search),'Unexpected live redirect');
    next.search=url.search;response=await send(next);
    assert(![301,302,303,307,308].includes(response.status),'Repeated live redirect');
  }
  return response;
}

export async function verifyBetaLive(releaseDir,candidateRoot,activeRoot,{fetch=globalThis.fetch,environment=process.env,onProgress}={}) {
  assert(onProgress===undefined||typeof onProgress==='function','Optional progress callback must be a function');
  assert.equal(sha(readFileSync(verifierPath)),verifierSha256,'Verifier source changed before verification');
  const receiptBytes=readFileSync(path.join(releaseDir,'release.json')),receipt=JSON.parse(receiptBytes);
  assert(receipt.version===1&&receipt.scope==='beta-only'&&receipt.mode==='final'&&receipt.project_id===BETA_PROJECT,'Final Beta 1 release required');
  const inputs=[];
  function bound(name,expected,label) {
    const file=path.join(releaseDir,name),bytes=readFileSync(file);assert.equal(sha(bytes),expected,label+' hash differs');inputs.push({file,sha256:expected});return JSON.parse(bytes);
  }
  const worker=bound('worker-library-manifest.json',receipt.workerManifestSha256,'Worker manifest');
  const candidates=bound('candidate-manifest.json',receipt.reviewedManifestSha256,'Candidate manifest');
  const active=bound('active-library-manifest.json',receipt.activeManifestSha256,'Active manifest');
  const inventory=bound('artifact-inventory.json',receipt.artifactInventorySha256,'App inventory');
  assert(candidates.featureCommit===receipt.commit_sha&&candidates.catalogSha256===receipt.catalogSha256&&candidates.models.length===receipt.catalogCount,'Candidate release identity differs');
  assert.equal(canonicalJson(worker),canonicalJson(assembleBetaManifest('final',active,candidates,receipt.commit_sha)),'Final worker canonical overlay differs');
  const revision=catalogCacheRevision(receipt.catalogSha256,receipt.commit_sha),requests=[];
  function local(name,record) {
    const root=Object.hasOwn(candidates.assets,name)?candidateRoot:activeRoot,file=resolveRepoPath(root,name.slice(1)),bytes=readFileSync(file);
    assert(bytes.length===record.size&&sha(bytes)===record.sha256,'Local canonical asset hash/size differs: '+name);
    inputs.push({file,sha256:record.sha256});
  }
  for(const [name,record] of Object.entries(worker.assets)){local(name,record);requests.push({name,record,r2:true});}
  for(const row of candidates.models){assert(row.preview===`/models/previews/${row.id}.webp`&&candidates.assets[row.preview],'Canonical preview mapping missing');requests.push({name:`/api/previews/${row.id}.webp`,record:candidates.assets[row.preview],r2:true});}
  const appFiles=Object.entries(inventory.files).filter(([name])=>name.startsWith('client/'));
  assert(appFiles.some(([name])=>name==='client/index.html'),'Final app index missing');
  for(const [name,record] of appFiles){
    let expectedHtml;
    if(name.endsWith('.html')){
      const file=resolveRepoPath(path.join(releaseDir,'dist'),name);expectedHtml=readFileSync(file);
      assert(expectedHtml.length===record.size&&sha(expectedHtml)===record.sha256,'Artifact HTML hash/size differs: '+name);
      inputs.push({file,sha256:record.sha256});
    }
    requests.push({name:name==='client/index.html'?'/':'/'+name.slice(7),record,r2:false,expectedHtml,htmlFile:expectedHtml?name:undefined});
  }
  let cursor=0,verified=0,totalBytes=0;const htmlPayloads=[];
  async function check() {
    for(;;) {
      const request=requests[cursor++];if(!request)return;
      const {name,record,r2,expectedHtml,htmlFile}=request,url=new URL(name,BETA_ORIGIN);
      assert(/^[a-f0-9]{64}$/.test(record.sha256)&&Number.isSafeInteger(record.size)&&record.size>0&&record.size<=32*1024*1024,'Invalid live object bound: '+name);
      url.searchParams.set('catalog_realism',revision);url.searchParams.set('verify',record.sha256);
      const response=await requestBeta(url,{fetch,environment,allowHtmlRedirect:!r2&&Boolean(expectedHtml)});
      assert.equal(response.status,200,'Live response failed: '+name);
      if(r2)assert.equal(response.headers.get('x-nook-asset-storage'),'r2','Canonical asset was not served from R2: '+name);
      const hash=createHash('sha256'),chunks=[];let bytes=0;
      for await(const chunk of response.body){bytes+=chunk.length;assert(bytes<=record.size+(expectedHtml?CHALLENGE_BYTES:0),'Live asset exceeds bound size: '+name);hash.update(chunk);if(expectedHtml)chunks.push(chunk);}
      if(expectedHtml){
        const payload=Buffer.concat(chunks);
        if(!payload.equals(expectedHtml))assert(/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??''),'Platform insertion requires an HTML response');
        htmlPayloads.push({file:htmlFile,...verifyHtmlPayload(payload,expectedHtml)});
      }else{assert.equal(bytes,record.size,'Live asset size differs: '+name);assert.equal(hash.digest('hex'),record.sha256,'Live asset hash differs: '+name);}
      verified++;totalBytes+=bytes;
      if(onProgress&&verified%50===0)await onProgress({completed:verified,total:requests.length,bytes:totalBytes});
    }
  }
  const results=await Promise.allSettled(Array.from({length:6},()=>check()));for(const result of results)if(result.status==='rejected')throw result.reason;
  const model=Object.values(candidates.assets)[0];assert(model,'Candidate manifest is empty');
  const upload=await requestBeta(new URL('/api/library-upload/'+model.sha256,BETA_ORIGIN),{fetch,environment,method:'HEAD'});
  assert.equal(upload.status,403,'Final Beta upload endpoint must be disabled');
  assert.equal(sha(readFileSync(path.join(releaseDir,'release.json'))),sha(receiptBytes),'Release changed during live verification');
  for(const input of inputs)assert.equal(sha(readFileSync(input.file)),input.sha256,'Local verification input changed: '+input.file);
  assert.equal(sha(readFileSync(verifierPath)),verifierSha256,'Verifier source changed during verification');
  return {version:1,scope:'beta-only',mode:'final',origin:BETA_ORIGIN,commit_sha:receipt.commit_sha,catalogRevision:revision,releaseSha256:sha(receiptBytes),manifest_sha256:receipt.workerManifestSha256,artifactSha256:receipt.archive.sha256,verifierSha256,completed:Object.keys(worker.assets).length,previewAliases:candidates.models.length,appFiles:appFiles.length,htmlPayloads:htmlPayloads.sort((a,b)=>a.file.localeCompare(b.file)),requests:verified,bytes:totalBytes,uploadsDisabled:true,verified_at:new Date().toISOString()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  assert(process.argv.length===6,'Usage: node scripts/catalog-realism-live.mjs RELEASE_DIR OPTIMIZED_ASSET_ROOT ACTIVE_ASSET_ROOT OUTPUT_JSON');
  const proof=await verifyBetaLive(...process.argv.slice(2,5),{onProgress:progress=>console.log(JSON.stringify({phase:'verify',...progress}))});writeFileSync(process.argv[5],JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(proof,null,2));
}
