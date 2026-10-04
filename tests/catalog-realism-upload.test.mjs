import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {BETA_ORIGIN,BETA_PROJECT,verifyR2Receipt} from '../scripts/build-catalog-realism-beta.mjs';
const uploader=await import('../scripts/catalog-realism-upload.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const sha=b=>createHash('sha256').update(b).digest('hex'),head='a'.repeat(40);
function fixture(t,count=2){
  const root=mkdtempSync(path.join(tmpdir(),'catalog-upload-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const releaseDir=path.join(root,'release'),assetRoot=path.join(root,'library');mkdirSync(releaseDir);
  const payloads=Object.fromEntries(Array.from({length:count},(_,i)=>[`/experiments/catalog-realism/${head}/models/furniture/model-${i}.glb`,Buffer.from('model '+i)]));
  const assets=Object.fromEntries(Object.entries(payloads).map(([name,b])=>[name,{sha256:sha(b),size:b.length,type:'model/gltf-binary'}]));
  for(const [name,b] of Object.entries(payloads)){const p=path.join(assetRoot,name.slice(1));mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,b);}
  const manifest=JSON.stringify({schema:1,assets});writeFileSync(path.join(releaseDir,'library-manifest.json'),manifest);
  const release={version:1,scope:'beta-only',mode:'staging',project_id:BETA_PROJECT,commit_sha:head,catalogCount:902,candidateManifestSha256:sha(manifest)};
  writeFileSync(path.join(releaseDir,'release.json'),JSON.stringify(release));
  const calls=[],stored=new Set([Object.values(assets)[0].sha256]),environment={NOOK_LIBRARY_UPLOAD_TOKEN:'upload-secret',NOOK_SITES_AUTH_TOKEN:'owner-secret'};
  const fetch=async (url,o={})=>{const u=new URL(url);calls.push({url:u,options:o});assert.equal(u.origin,BETA_ORIGIN);assert.equal(o.redirect,'error');
    if(u.pathname.startsWith('/api/library-upload/')){const hash=u.pathname.split('/').at(-1);assert(Object.values(assets).some(a=>a.sha256===hash));assert.equal(o.headers.Authorization,'Bearer upload-secret');
      if(o.method==='HEAD')return new Response(null,{status:stored.has(hash)?200:404});
      assert.equal(o.method,'PUT');assert.equal(sha(o.body),hash);stored.add(hash);return new Response(null,{status:204});}
    assert(!o.headers.Authorization);return new Response(payloads[u.pathname],{headers:{'x-nook-asset-storage':'r2'}});
  };
  return {root,releaseDir,assetRoot,manifest,release,assets,payloads,environment,fetch,calls};
}
test('Beta upload resumes objects and verifies every staged alias with separate owner and upload auth',async t=>{
  const f=fixture(t);const proof=await uploader.uploadBetaLibrary(f.releaseDir,f.assetRoot,{fetch:f.fetch,environment:f.environment});
  verifyR2Receipt(proof,Buffer.from(f.manifest));assert.equal(proof.completed,2);assert.equal(f.calls.filter(c=>c.options.method==='PUT').length,1);
  assert(f.calls.every(c=>c.options.headers['OAI-Sites-Authorization']==='Bearer owner-secret'));
  assert.equal(f.calls.filter(c=>!c.options.method||c.options.method==='GET').length,2);assert(!JSON.stringify(proof).includes('secret'));
});
test('all local files and release identity are checked before the first request',async t=>{
  for(const changed of ['missing','hash','final','project','manifest','escape','size']){
    const f=fixture(t);let requests=0;const first=Object.keys(f.assets)[0];
    if(changed==='missing')rmSync(path.join(f.assetRoot,Object.keys(f.assets)[1].slice(1)));
    if(changed==='hash')writeFileSync(path.join(f.assetRoot,first.slice(1)),'wrong');
    if(changed==='final')f.release.mode='final';if(changed==='project')f.release.project_id='production';
    if(changed==='manifest')writeFileSync(path.join(f.releaseDir,'library-manifest.json'),'{}');
    if(changed==='escape'||changed==='size'){
      const a=structuredClone(f.assets);if(changed==='escape'){a[first.replace('model-0.glb','../model.glb')]=a[first];delete a[first];}else a[first].size=32*1024*1024+1;
      const b=JSON.stringify({schema:1,assets:a});writeFileSync(path.join(f.releaseDir,'library-manifest.json'),b);f.release.candidateManifestSha256=sha(b);
    }
    writeFileSync(path.join(f.releaseDir,'release.json'),JSON.stringify(f.release));
    await assert.rejects(()=>uploader.uploadBetaLibrary(f.releaseDir,f.assetRoot,{environment:f.environment,fetch:async()=>{requests++;throw Error('unexpected');}}));assert.equal(requests,0,changed);
  }
});
test('delivery failures, redirects and fetch errors cannot produce success or expose credentials',async t=>{
  for(const failure of ['wrong-hash','wrong-size','not-r2','redirect','put','throw']){
    const f=fixture(t);const fetch=async (url,o)=>{
      const u=new URL(url);
      if(failure==='throw')throw Error('upload-secret owner-secret');
      if(failure==='redirect')return new Response(null,{status:302,headers:{location:'https://elsewhere.example'}});
      if(failure==='put'&&o.method==='PUT')return new Response('owner-secret',{status:500});
      if(!u.pathname.startsWith('/api/library-upload/'))return new Response(failure==='wrong-size'?'too large!':failure==='wrong-hash'?'WRONG!!':f.payloads[u.pathname],{headers:failure==='not-r2'?{}:{'x-nook-asset-storage':'r2'}});
      return f.fetch(url,o);
    };
    await assert.rejects(()=>uploader.uploadBetaLibrary(f.releaseDir,f.assetRoot,{environment:f.environment,fetch}),e=>!String(e).includes('secret'));
    assert(!existsSync(path.join(f.releaseDir,'r2-verification.json')));
  }
});
test('post-transfer changes invalidate the receipt and maximum six requests run concurrently',async t=>{
  const f=fixture(t,14);let running=0,peak=0;
  const fetch=async(...args)=>{running++;peak=Math.max(peak,running);await new Promise(r=>setTimeout(r,2));try{return await f.fetch(...args);}finally{running--;}};
  await uploader.uploadBetaLibrary(f.releaseDir,f.assetRoot,{environment:f.environment,fetch});assert.equal(peak,6);
  for(const change of ['source','manifest','release']){
    const g=fixture(t,1);const fetch=async(...args)=>{const response=await g.fetch(...args);if(!new URL(args[0]).pathname.startsWith('/api/library-upload/')){const file=change==='source'?path.join(g.assetRoot,Object.keys(g.assets)[0].slice(1)):path.join(g.releaseDir,change==='manifest'?'library-manifest.json':'release.json');writeFileSync(file,'changed');}return response;};
    await assert.rejects(()=>uploader.uploadBetaLibrary(g.releaseDir,g.assetRoot,{environment:g.environment,fetch}),/changed|hash|integrity/i);
  }
});
