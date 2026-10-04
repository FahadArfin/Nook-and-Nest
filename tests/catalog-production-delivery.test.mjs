import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PUBLIC_PROJECT,PUBLIC_ORIGIN,verifyStorageProof,gatePublicPhase,requestPublic,uploadPublicCatalog,verifyPublicCatalog} from '../scripts/catalog-production-delivery.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(t){
  const root=mkdtempSync(path.join(tmpdir(),'catalog-public-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const commit='a'.repeat(40),prefix='/experiments/catalog-realism/'+commit;
  const payloads={'/models/furniture/table.glb':'new model','/models/previews/table.webp':'preview'};
  const assets=Object.fromEntries(Object.entries(payloads).map(([name,bytes])=>[name,{sha256:sha(bytes),size:bytes.length,type:name.endsWith('.glb')?'model/gltf-binary':'image/webp'}]));
  const upload={schema:1,assets:Object.fromEntries(Object.entries(assets).map(([name,record])=>[prefix+name,record]))};
  const receipt={project_id:PUBLIC_PROJECT,commit_sha:commit,archives:{},catalog_staging:{prefix,catalogRevision:'b'.repeat(64),prerequisites:'prerequisites.json',upload_manifest:'upload.json',staging_archive:'stage.tar.gz',final_archive:'final.tar.gz'}};
  const put=(name,value)=>{const file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});const bytes=typeof value==='string'?value:JSON.stringify(value);writeFileSync(file,bytes);return bytes;};
  function bind(name,value){const bytes=put(name,value);receipt.archives[name]={sha256:sha(bytes),expanded_bytes:bytes.length};}
  bind('library-manifest.json',{schema:1,assets});bind('upload.json',upload);bind('prerequisites.json',{schema:1,assets});
  bind('artifact-inventory.json',{files:{'client/index.html':{sha256:sha('<body>app</body>'),size:16}}});
  bind('stage.tar.gz','stage');bind('final.tar.gz','final');put('dist/client/index.html','<body>app</body>');
  for(const [name,bytes] of Object.entries(payloads))put('library/'+prefix.slice(1)+name,bytes);
  put('release.json',receipt);
  const proofFor=name=>({origin:PUBLIC_ORIGIN,manifest_sha256:sha(readFileSync(path.join(root,name))),completed:2,bytes:16,verified_at:new Date().toISOString(),release_sha256:sha(readFileSync(path.join(root,'release.json')))});
  put('baseline-proof.json',proofFor('prerequisites.json'));put('upload-proof.json',proofFor('upload.json'));
  return {root,receipt,payloads,prefix,put,proofFor};
}
test('public cutover requires complete public-project proof bound to this release and exact archive',t=>{
  const f=fixture(t);
  assert.equal(gatePublicPhase(f.root,'staging',path.join(f.root,'baseline-proof.json')).archive,'stage.tar.gz');
  assert.equal(gatePublicPhase(f.root,'final',path.join(f.root,'upload-proof.json')).archive,'final.tar.gz');
  const good=f.proofFor('upload.json');
  for(const delta of [{origin:'https://nook-and-nest-beta-1.fwad101.chatgpt.site'},{completed:1},{bytes:15},{release_sha256:'c'.repeat(64)}]){
    f.put('bad.json',{...good,...delta});assert.throws(()=>gatePublicPhase(f.root,'final',path.join(f.root,'bad.json')));
  }
  f.put('final.tar.gz','changed archive');assert.throws(()=>gatePublicPhase(f.root,'final',path.join(f.root,'upload-proof.json')),/Unbound release/);
});
test('storage proof never accepts a changed manifest',t=>{
  const f=fixture(t);assert.throws(()=>verifyStorageProof(f.proofFor('upload.json'),Buffer.from('{"assets":{}}')),/manifest hash/);
});
test('public HTML redirect only follows the exact same-origin pretty route',async()=>{
  let calls=0;
  const fetch=async()=>++calls===1?new Response(null,{status:307,headers:{location:'/docs/example'}}):new Response('ok');
  assert.equal(await (await requestPublic('/docs/example.html?verify=abc',{fetch,html:true})).text(),'ok');
  for(const location of ['https://other.invalid/docs/example','/other','/docs/example?changed=1']){
    await assert.rejects(requestPublic('/docs/example.html?verify=abc',{html:true,fetch:async()=>new Response(null,{status:307,headers:{location}})}),/redirect target/);
  }
  await assert.rejects(requestPublic('https://other.invalid/'),/Fixed public origin/);
});
test('resumable upload verifies every alias from R2 and binds completed receipt',async t=>{
  const f=fixture(t);let puts=0;
  const fetch=async(url,options)=>{
    if(options.method==='HEAD')return new Response(null,{status:404});
    if(options.method==='PUT'){puts++;return new Response(null,{status:204});}
    const name=new URL(url).pathname.slice(f.prefix.length);
    return new Response(f.payloads[name],{headers:{'x-nook-asset-storage':'r2'}});
  };
  const proof=await uploadPublicCatalog(f.root,path.join(f.root,'library'),{fetch,token:'x'.repeat(32)});
  assert.equal(puts,2);assert.equal(proof.completed,2);assert.equal(proof.bytes,16);
  f.put('proof.json',proof);assert.equal(gatePublicPhase(f.root,'final',path.join(f.root,'proof.json')).phase,'final');
});
test('changed local upload bytes abort before the first remote mutation',async t=>{
  const f=fixture(t);f.put('library/'+f.prefix.slice(1)+'/models/previews/table.webp','bad');let calls=0;
  await assert.rejects(uploadPublicCatalog(f.root,path.join(f.root,'library'),{token:'x'.repeat(32),fetch:async()=>{calls++;throw Error();}}),/Local size/);
  assert.equal(calls,0);
});
test('final live check covers canonical assets, preview aliases and app, rejects enabled uploads',async t=>{
  const f=fixture(t);let status=403;
  const fetch=async url=>{
    const name=new URL(url).pathname.replace('/api/previews/','/models/previews/');
    if(name.startsWith('/api/library-upload/'))return new Response(null,{status});
    return name==='/'?new Response('<body>app</body>'):new Response(f.payloads[name],{headers:{'x-nook-asset-storage':'r2'}});
  };
  const proof=await verifyPublicCatalog(f.root,path.join(f.root,'dist'),{fetch});
  assert.equal(proof.requests,4);assert(proof.uploadsDisabled);status=200;
  await assert.rejects(verifyPublicCatalog(f.root,path.join(f.root,'dist'),{fetch}),/not disabled/);
});
