import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as beta from '../scripts/build-catalog-realism-beta.mjs';
const app=await import('../scripts/catalog-realism-app.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const live=await import('../scripts/catalog-realism-live.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const head='a'.repeat(40),merge='b'.repeat(40),base='d'.repeat(40),catalog='c'.repeat(64);
const event={number:12,repository:{full_name:'FahadArfin/Nook-and-Nest'},pull_request:{head:{sha:head,ref:'codex/catalog-realism-overhaul',repo:{full_name:'FahadArfin/Nook-and-Nest'}},merge_commit_sha:merge,base:{ref:'master',sha:base}}};
const platformHtml=JSON.parse(readFileSync(new URL('./fixtures/catalog-realism-platform-html.json',import.meta.url),'utf8'));
const attributionHtml=JSON.parse(readFileSync(new URL('./fixtures/catalog-realism-attribution-html.json',import.meta.url),'utf8'));
test('master retention stays in Validate while Beta artifact uses exact PR HEAD after that gate',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/validate-release.yml',import.meta.url),'utf8');
  const [before,after]=workflow.split('\n  catalog-beta-artifact:');
  assert.match(before,/Retain release from master/);assert.match(before,/github\.ref == 'refs\/heads\/master'/);
  assert.doesNotMatch(after,/Retain release from master/);assert.match(after,/needs: validate/);
  assert.match(after,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);assert.match(after,/VITE_CATALOG_REALISM_VERSION/);
  assert.match(after,/include-hidden-files: true/);
});
test('feature artifact evidence distinguishes actual checkout HEAD from successful PR merge validation',()=>{
  const input={head,validatedSha:merge,validatedParents:[base,head],result:'success',runId:'42',runAttempt:'1'};
  const evidence=app.featureValidation(event,input);
  assert.equal(evidence.source_sha,head);assert.equal(evidence.validated_sha,merge);assert.equal(evidence.check,'Validate');
  assert.deepEqual(evidence.validated_parents,[base,head]);assert.equal(evidence.base_sha,base);
  assert.throws(()=>app.featureValidation(event,{...input,head:merge}),/feature HEAD/);
  assert.throws(()=>app.featureValidation(event,{...input,validatedSha:head}),/merge SHA/);
  assert.throws(()=>app.featureValidation(event,{...input,result:'failure'}),/Validate/);
  const fork=structuredClone(event);fork.pull_request.head.repo.full_name='other/repository';
  assert.throws(()=>app.featureValidation(fork,input),/same repository/);
});
test('feature delivery guards reject dirty worktrees, wrong branches and obsolete HEADs',()=>{
  beta.validateFeatureCheckout({head,branch:'codex/catalog-realism-overhaul',status:''},head);
  for(const edit of [{head:merge},{branch:'master'},{status:' M src/app.ts'}])assert.throws(()=>beta.validateFeatureCheckout({head,branch:'codex/catalog-realism-overhaul',status:'',...edit},head),/feature|clean|branch/i);
});
test('feature snapshot strips only manifest library bytes and retains other public experiments',t=>{
  const root=mkdtempSync(path.join(tmpdir(),'catalog-app-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const source=path.join(root,'dist'),output=path.join(root,'snapshot');
  for(const [name,bytes] of Object.entries({'client/index.html':'app','client/models/furniture/a.glb':'library','client/experiments/other/index.html':'keep','server/index.js':'worker','.openai/hosting.json':'{}','.openai/drizzle/a.sql':'migration'})){mkdirSync(path.dirname(path.join(source,name)),{recursive:true});writeFileSync(path.join(source,name),bytes);}
  const inventory=app.snapshotApp(source,output,{assets:{'/models/furniture/a.glb':{sha256:hash('library'),size:7}}});
  assert(!inventory.files['client/models/furniture/a.glb']);assert(inventory.files['client/experiments/other/index.html']);
  assert.equal(readFileSync(path.join(output,'client/index.html'),'utf8'),'app');
});
function liveFixture(t){
  const root=mkdtempSync(path.join(tmpdir(),'catalog-live-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const releaseDir=path.join(root,'release'),candidateRoot=path.join(root,'candidate'),activeRoot=path.join(root,'active');mkdirSync(releaseDir);
  const payloads={'/models/furniture/table.glb':'new model','/models/previews/table.webp':'new preview',['/models/furniture/shared-textures/'+hash('scan')+'.jpg']:'scan','/textures/wall.png':'old wall'};
  const assets=Object.fromEntries(Object.entries(payloads).map(([name,bytes])=>[name,{sha256:hash(bytes),size:Buffer.byteLength(bytes),type:name.endsWith('.glb')?'model/gltf-binary':name.endsWith('.webp')?'image/webp':name.endsWith('.jpg')?'image/jpeg':'image/png'}]));
  const candidates={version:1,scope:'beta-only',featureCommit:head,catalogSha256:catalog,assets:Object.fromEntries(Object.entries(assets).filter(([n])=>n!=='/textures/wall.png')),models:[{id:'table',preview:'/models/previews/table.webp',glb:'/models/furniture/table.glb'}]};
  for(const [name,bytes] of Object.entries(payloads)){const file=path.join(name==='/textures/wall.png'?activeRoot:candidateRoot,name.slice(1));mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);}
  const worker=JSON.stringify({schema:1,assets}),canonical=JSON.stringify(candidates),active=JSON.stringify({schema:1,assets:{'/textures/wall.png':assets['/textures/wall.png']}});
  const inventory=JSON.stringify({files:{'client/index.html':{sha256:hash('app'),size:3},'client/assets/app.js':{sha256:hash('js'),size:2}}});
  mkdirSync(path.join(releaseDir,'dist/client'),{recursive:true});writeFileSync(path.join(releaseDir,'dist/client/index.html'),'app');
  for(const [name,bytes] of Object.entries({'worker-library-manifest.json':worker,'candidate-manifest.json':canonical,'active-library-manifest.json':active,'artifact-inventory.json':inventory})){writeFileSync(path.join(releaseDir,name),bytes);}
  const receipt={version:1,scope:'beta-only',mode:'final',project_id:beta.BETA_PROJECT,commit_sha:head,catalogSha256:catalog,catalogCount:1,workerManifestSha256:hash(worker),reviewedManifestSha256:hash(canonical),activeManifestSha256:hash(active),artifactInventorySha256:hash(inventory),archive:{sha256:hash('archive')}};
  writeFileSync(path.join(releaseDir,'release.json'),JSON.stringify(receipt));
  const requests=[];const fetch=async url=>{const pathname=new URL(url).pathname;requests.push(pathname);if(pathname.startsWith('/api/library-upload/'))return new Response(null,{status:403});const name=pathname.replace(/^\/api\/previews\//,'/models/previews/');const bytes=pathname==='/'?'app':pathname==='/assets/app.js'?'js':payloads[name];return new Response(bytes??'missing',{status:bytes?200:404,headers:payloads[name]?{'x-nook-asset-storage':'r2'}:{}});};
  return {root,releaseDir,candidateRoot,activeRoot,requests,fetch,receipt};
}
test('final live proof verifies canonical assets, shared textures, preview aliases and exact app bytes',async t=>{
  const f=liveFixture(t);const proof=await live.verifyBetaLive(f.releaseDir,f.candidateRoot,f.activeRoot,{fetch:f.fetch});
  assert.equal(proof.completed,4);assert.equal(proof.previewAliases,1);assert.equal(proof.appFiles,2);
  assert.equal(proof.verifierSha256,hash(readFileSync(new URL('../scripts/catalog-realism-live.mjs',import.meta.url))));
  assert(f.requests.includes('/models/furniture/table.glb'));assert(f.requests.includes('/api/previews/table.webp'));
  assert(!f.requests.some(n=>n.startsWith('/experiments/catalog-realism/')));
});
test('live proof rejects stale worker bindings, missing shared files and a stale preview alias',async t=>{
  const f=liveFixture(t);writeFileSync(path.join(f.releaseDir,'worker-library-manifest.json'),'{}');
  await assert.rejects(()=>live.verifyBetaLive(f.releaseDir,f.candidateRoot,f.activeRoot,{fetch:f.fetch}),/worker.*hash/i);
  const g=liveFixture(t);rmSync(path.join(g.candidateRoot,'models/furniture/shared-textures',hash('scan')+'.jpg'));
  await assert.rejects(()=>live.verifyBetaLive(g.releaseDir,g.candidateRoot,g.activeRoot,{fetch:g.fetch}),/ENOENT|missing/);
  const h=liveFixture(t);await assert.rejects(()=>live.verifyBetaLive(h.releaseDir,h.candidateRoot,h.activeRoot,{fetch:async url=>new URL(url).pathname.startsWith('/api/previews/')?new Response('stale',{headers:{'x-nook-asset-storage':'r2'}}):h.fetch(url)}),/hash|size/i);
});

test('Beta live requests use optional owner auth without exposing it or forwarding it away',async()=>{
  const secret='fixture-owner-secret',calls=[];
  const fetch=async(url,options)=>{calls.push({url:new URL(url),options});return new Response('ok');};
  await live.requestBeta(new URL('/models/furniture/a.glb',beta.BETA_ORIGIN),{fetch,environment:{NOOK_SITES_AUTH_TOKEN:secret}});
  await live.requestBeta(new URL('/api/library-upload/'+'a'.repeat(64),beta.BETA_ORIGIN),{fetch,environment:{NOOK_SITES_AUTH_TOKEN:secret},method:'HEAD'});
  assert(calls.every(call=>call.options.headers['OAI-Sites-Authorization']==='Bearer '+secret&&call.options.redirect==='manual'));
  assert.equal(calls[1].options.method,'HEAD');
  await live.requestBeta(new URL('/',beta.BETA_ORIGIN),{fetch,environment:{}});
  assert(!Object.hasOwn(calls.at(-1).options.headers,'OAI-Sites-Authorization'));
  await assert.rejects(()=>live.requestBeta(new URL('/',beta.BETA_ORIGIN),{environment:{NOOK_SITES_AUTH_TOKEN:secret},fetch:async()=>{throw Error(secret);}}),error=>!String(error).includes(secret)&&/Live request failed/.test(String(error)));
  await assert.rejects(()=>live.requestBeta(new URL('https://other.example/'),{fetch,environment:{NOOK_SITES_AUTH_TOKEN:secret}}),/Beta origin/);
});

test('Beta live HTML follows only one same-origin index-to-directory redirect',async()=>{
  const calls=[];
  const response=await live.requestBeta(new URL('/model-lab/index.html?verify=abc',beta.BETA_ORIGIN),{
    environment:{},allowIndexRedirect:true,fetch:async(url)=>{calls.push(new URL(url));return calls.length===1?new Response(null,{status:308,headers:{location:'/model-lab/'}}):new Response('html');}});
  assert.equal(await response.text(),'html');assert.equal(calls.length,2);
  assert.equal(calls[1].pathname,'/model-lab/');assert.equal(calls[1].search,'?verify=abc');
  for(const location of ['https://other.example/model-lab/','/login','/model-lab/?unexpected=1']) {
    await assert.rejects(()=>live.requestBeta(new URL('/model-lab/index.html',beta.BETA_ORIGIN),{environment:{},allowIndexRedirect:true,fetch:async()=>new Response(null,{status:302,headers:{location}})}),/redirect/);
  }
  await assert.rejects(()=>live.requestBeta(new URL('/model-lab/index.html',beta.BETA_ORIGIN),{environment:{},allowIndexRedirect:true,fetch:async()=>new Response(null,{status:302,headers:{location:'/model-lab/'}})}),/redirect/);
  await assert.rejects(()=>live.requestBeta(new URL('/models/furniture/a.glb',beta.BETA_ORIGIN),{environment:{},fetch:async()=>new Response(null,{status:302,headers:{location:'/models/furniture/'}})}),/redirect/);
});

test('artifact HTML opts into exactly one extensionless redirect while preserving verification queries',async()=>{
  const original=new URL('/data/toronto/attribution.html?verify=abc&catalog_realism=revision',beta.BETA_ORIGIN);
  for(const query of ['',original.search]){
    const calls=[];
    const response=await live.requestBeta(original,{environment:{},allowHtmlRedirect:true,fetch:async(url)=>{
      calls.push(new URL(url));return calls.length===1?new Response(null,{status:307,headers:{location:'/data/toronto/attribution'+query}}):new Response(attributionHtml.liveHtml);
    }});
    assert.equal(await response.text(),attributionHtml.liveHtml);assert.equal(calls.length,2);
    assert.equal(calls[1].pathname,'/data/toronto/attribution');assert.equal(calls[1].search,original.search);
  }
});

test('HTML pretty redirects cannot authorize wrong origins, credentials, paths, queries, fragments, methods or another hop',async()=>{
  const original=new URL('/data/toronto/attribution.html?verify=abc',beta.BETA_ORIGIN);
  const wrong=[
    'https://other.example/data/toronto/attribution',
    beta.BETA_ORIGIN.replace('https://','https://user:pass@')+'/data/toronto/attribution',
    '/data/toronto/another','/data/toronto/attribution/','/data/toronto/attribution#fragment',
    '/data/toronto/attribution?verify=other','/data/toronto/attribution?verify=abc&extra=1',
  ];
  for(const location of wrong)await assert.rejects(()=>live.requestBeta(original,{environment:{},allowHtmlRedirect:true,fetch:async()=>new Response(null,{status:307,headers:{location}})}),/redirect/);
  const redirect=async()=>new Response(null,{status:307,headers:{location:'/data/toronto/attribution'}});
  await assert.rejects(()=>live.requestBeta(original,{environment:{},fetch:redirect}),/redirect/);
  await assert.rejects(()=>live.requestBeta(original,{environment:{},allowIndexRedirect:true,fetch:redirect}),/redirect/);
  await assert.rejects(()=>live.requestBeta(original,{environment:{},allowHtmlRedirect:true,method:'HEAD',fetch:redirect}),/redirect/);
  await assert.rejects(()=>live.requestBeta(original,{environment:{},allowHtmlRedirect:true,fetch:redirect}),/Repeated.*redirect/);
  await assert.rejects(()=>live.requestBeta(new URL('/models/furniture/a.glb',beta.BETA_ORIGIN),{environment:{},allowHtmlRedirect:true,fetch:redirect}),/redirect/);
});

test('captured legacy HTML allows only the exact known challenge appended at EOF with all original bytes retained',()=>{
  const sample=attributionHtml,original=Buffer.from(sample.artifactHtml),actual=Buffer.from(sample.liveHtml);
  assert.equal(hash(original),sample.artifactSha256);assert.equal(hash(actual),sample.liveSha256);
  assert.equal(original.indexOf('</body>'),-1);assert.equal(sample.insertionOffset,original.length);
  const proof=live.verifyHtmlPayload(actual,original);
  assert.equal(proof.platformInsertedBytes,938);assert.equal(proof.insertionOffset,2677);
  assert.equal(proof.insertionSha256,sample.insertionSha256);assert.equal(proof.originalArtifactHtmlPreserved,true);
  const inserted=actual.subarray(original.length).toString();
  const bad=[
    sample.liveHtml.replace('Toronto scenery: data & credits','Toronto scenery: fake & credits'),
    sample.artifactHtml+'<script>alert(1)</script>',
    sample.liveHtml.replace('/cdn-cgi/challenge-platform/scripts/jsd/main.js','/cdn-cgi/challenge-platform/scripts/jsd/evil.js'),
    sample.liveHtml.replace(/r:'[a-f0-9]{16}'/,"r:'not-a-valid-ray!'"),
    sample.liveHtml.replace(/t:'[A-Za-z0-9+/]{14}=='/,"t:'YXJiaXRyYXJ5IQ=='"),
    inserted+sample.artifactHtml,
    sample.artifactHtml.replace('</html>',inserted+'</html>'),
    sample.liveHtml+inserted,
  ];
  for(const candidate of bad)assert.throws(()=>live.verifyHtmlPayload(Buffer.from(candidate),original),/HTML|challenge|insertion/i);
  const withBody=Buffer.from(platformHtml.cases[0].artifactHtml);
  assert.throws(()=>live.verifyHtmlPayload(Buffer.concat([withBody,Buffer.from(inserted)]),withBody),/HTML|insertion/i);
});

test('full verifier applies pretty redirect and EOF rules only to a bound app HTML file',async t=>{
  const f=liveFixture(t),sample=attributionHtml,name='client/data/toronto/attribution.html';
  const inventoryPath=path.join(f.releaseDir,'artifact-inventory.json'),inventory=JSON.parse(readFileSync(inventoryPath));
  inventory.files[name]={sha256:sample.artifactSha256,size:Buffer.byteLength(sample.artifactHtml)};
  const bytes=JSON.stringify(inventory);writeFileSync(inventoryPath,bytes);
  mkdirSync(path.dirname(path.join(f.releaseDir,'dist',name)),{recursive:true});writeFileSync(path.join(f.releaseDir,'dist',name),sample.artifactHtml);
  f.receipt.artifactInventorySha256=hash(bytes);writeFileSync(path.join(f.releaseDir,'release.json'),JSON.stringify(f.receipt));
  const fetch=async(url,options)=>{
    const target=new URL(url);
    if(target.pathname==='/data/toronto/attribution.html')return new Response(null,{status:307,headers:{location:'/data/toronto/attribution'+target.search}});
    if(target.pathname==='/data/toronto/attribution')return new Response(sample.liveHtml,{headers:{'content-type':'text/html'}});
    return f.fetch(url,options);
  };
  const proof=await live.verifyBetaLive(f.releaseDir,f.candidateRoot,f.activeRoot,{fetch,environment:{}});
  assert.equal(proof.requests,8);assert.equal(proof.appFiles,3);
  assert.equal(proof.htmlPayloads.find(row=>row.file===name).insertionSha256,sample.insertionSha256);
});

test('live proof rejects verifier source changes during a run and before a later run',async t=>{
  const f=liveFixture(t),sourceUrl=new URL('../scripts/catalog-realism-live.mjs',import.meta.url);
  const copy=path.join(f.root,'verifier-copy.mjs'),moduleRoot=new URL('../scripts/',import.meta.url).href;
  writeFileSync(copy,readFileSync(sourceUrl,'utf8').replaceAll("from './",`from '${moduleRoot}`));
  const isolated=await import(pathToFileURL(copy).href);let requests=0;
  await assert.rejects(()=>isolated.verifyBetaLive(f.releaseDir,f.candidateRoot,f.activeRoot,{environment:{},fetch:async(url,options)=>{
    if(requests++===0)writeFileSync(copy,readFileSync(copy,'utf8')+'\n// changed during verification\n');
    return f.fetch(url,options);
  }}),/Verifier source changed/);
  requests=0;
  await assert.rejects(()=>isolated.verifyBetaLive(f.releaseDir,f.candidateRoot,f.activeRoot,{environment:{},fetch:async()=>{requests++;throw Error('must not fetch');}}),/Verifier source changed/);
  assert.equal(requests,0);
});

test('actual Beta HTML accepts only the captured Cloudflare script template and preserves exact artifact bytes',()=>{
  for(const sample of platformHtml.cases){
    const original=Buffer.from(sample.artifactHtml),actual=Buffer.from(sample.liveHtml);
    assert.equal(hash(original),sample.artifactSha256);assert.equal(hash(actual),sample.liveSha256);
    const proof=live.verifyHtmlPayload(actual,original);
    assert.equal(proof.originalArtifactSha256,sample.artifactSha256);
    assert.equal(proof.actualSha256,sample.liveSha256);assert.equal(proof.insertionSha256,sample.insertionSha256);
    assert.equal(proof.platformInsertedBytes,938);assert.equal(proof.originalArtifactHtmlPreserved,true);
    assert.equal(live.verifyHtmlPayload(original,original).platformInsertedBytes,0);
    // Fresh ray/timestamp parameters are data in this exact verified template.
    const fresh=sample.liveHtml.replace(/r:'[a-f0-9]{16}',t:'[A-Za-z0-9+/]{14}=='/,"r:'0123456789abcdef',t:'MTc5MTA0OTE5NQ=='");
    assert.equal(live.verifyHtmlPayload(Buffer.from(fresh),original).platformInsertedBytes,938);
  }
});

test('HTML verification rejects altered application bytes, unknown scripts, extra insertions and moved challenges',()=>{
  const sample=platformHtml.cases[0],original=Buffer.from(sample.artifactHtml);
  const script=sample.liveHtml.slice(sample.artifactHtml.indexOf('</body>'),sample.artifactHtml.indexOf('</body>')+938);
  const bad=[
    sample.liveHtml.replace('id="root"','id="evil"'),
    sample.liveHtml.replace('/cdn-cgi/challenge-platform/scripts/jsd/main.js','/cdn-cgi/challenge-platform/scripts/jsd/evil.js'),
    sample.liveHtml.replace('a44dba923fb8bda8',"a44dba923fb8bdxx"),
    sample.liveHtml.replace('MTc5MTA0OTE5Mw==','YXJiaXRyYXJ5IQ=='),
    sample.artifactHtml.replace('</body>','<script>alert(1)</script></body>'),
    sample.liveHtml.replace('</body>',script+'</body>'),
    script+sample.artifactHtml,
    sample.liveHtml.replace('document.body.appendChild(a)','document.head.appendChild(a)'),
  ];
  for(const html of bad)assert.throws(()=>live.verifyHtmlPayload(Buffer.from(html),original),/HTML|challenge|insertion/i);
});

test('final live proof verifies full artifact HTML around the permitted platform insertion',async t=>{
  const f=liveFixture(t),sample=platformHtml.cases[0];
  const inventoryPath=path.join(f.releaseDir,'artifact-inventory.json'),inventory=JSON.parse(readFileSync(inventoryPath,'utf8'));
  inventory.files['client/index.html']={sha256:sample.artifactSha256,size:Buffer.byteLength(sample.artifactHtml)};
  const bytes=JSON.stringify(inventory);writeFileSync(inventoryPath,bytes);writeFileSync(path.join(f.releaseDir,'dist/client/index.html'),sample.artifactHtml);
  f.receipt.artifactInventorySha256=hash(bytes);writeFileSync(path.join(f.releaseDir,'release.json'),JSON.stringify(f.receipt));
  const fetch=async(url,options)=>new URL(url).pathname==='/'?new Response(sample.liveHtml,{headers:{'content-type':'text/html'}}):f.fetch(url,options);
  const proof=await live.verifyBetaLive(f.releaseDir,f.candidateRoot,f.activeRoot,{fetch,environment:{}});
  assert.equal(proof.htmlPayloads[0].originalArtifactSha256,sample.artifactSha256);
  assert.equal(proof.htmlPayloads[0].actualSha256,sample.liveSha256);
  assert(!JSON.stringify(proof).includes('Bearer'));
  writeFileSync(path.join(f.releaseDir,'dist/client/index.html'),'stale local HTML');
  await assert.rejects(()=>live.verifyBetaLive(f.releaseDir,f.candidateRoot,f.activeRoot,{fetch,environment:{}}),/HTML.*hash|artifact.*HTML/i);
});

test('live verification bounds GET concurrency at six and reports each fifty completed requests',async t=>{
  const f=liveFixture(t),activePath=path.join(f.releaseDir,'active-library-manifest.json');
  const active=JSON.parse(readFileSync(activePath,'utf8'));
  const payload=Buffer.from('preserved fixture texture'),extra=new Set();
  for(let i=0;i<100;i++){
    const name=`/textures/progress-${i}.png`;extra.add(name);
    active.assets[name]={sha256:hash(payload),size:payload.length,type:'image/png'};
    writeFileSync(path.join(f.activeRoot,name.slice(1)),payload);
  }
  const candidates=JSON.parse(readFileSync(path.join(f.releaseDir,'candidate-manifest.json'),'utf8'));
  const activeBytes=JSON.stringify(active),workerBytes=JSON.stringify(beta.assembleBetaManifest('final',active,candidates,head));
  writeFileSync(activePath,activeBytes);writeFileSync(path.join(f.releaseDir,'worker-library-manifest.json'),workerBytes);
  f.receipt.activeManifestSha256=hash(activeBytes);f.receipt.workerManifestSha256=hash(workerBytes);
  writeFileSync(path.join(f.releaseDir,'release.json'),JSON.stringify(f.receipt));
  let inFlight=0,maximum=0,gets=0;const progress=[];
  const fetch=async(url,options)=>{
    if(options.method==='HEAD')return new Response(null,{status:403});
    gets++;maximum=Math.max(maximum,++inFlight);
    const name=new URL(url).pathname;
    const original=extra.has(name)?new Response(payload,{headers:{'x-nook-asset-storage':'r2'}}):await f.fetch(url,options);
    const bytes=new Uint8Array(await original.arrayBuffer());
    const body=new ReadableStream({async start(controller){
      await new Promise(resolve=>setTimeout(resolve,2));controller.enqueue(bytes);controller.close();inFlight--;
    }});
    return new Response(body,{status:original.status,headers:original.headers});
  };
  const proof=await live.verifyBetaLive(f.releaseDir,f.candidateRoot,f.activeRoot,{fetch,environment:{},onProgress:update=>progress.push(update)});
  assert.equal(maximum,6);assert.equal(inFlight,0);assert.equal(gets,107);assert.equal(proof.requests,gets);
  assert.deepEqual(progress.map(row=>row.completed),[50,100]);
  assert(progress.every(row=>row.total===107&&Number.isSafeInteger(row.bytes)&&row.bytes>0));
  assert(progress[1].bytes>progress[0].bytes);
  assert(progress.every(row=>Object.keys(row).sort().join(',')==='bytes,completed,total'));
});
