import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build,createServer,loadConfigFromFile} from 'vite';
import {catalogPublicAssets} from '../scripts/catalog-public-assets.mjs';

function fixture(t){
  const root=mkdtempSync(path.join(tmpdir(),'catalog-public-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const write=(name,data)=>{const file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,data);};
  write('index.html','<!doctype html><html><body><h1>Generated application</h1><img src="/models/previews/baseline.webp"><script type="module" src="/entry.js"></script></body></html>');
  write('entry.js','document.body.dataset.build = "generated-app";');
  write('public/models/furniture/baseline.glb','baseline model');write('public/models/previews/baseline.webp','baseline preview');
  write('public/experiments/catalog-realism/models/candidate.glb','private raw candidate');write('public/experiments/catalog-realism/nested/map.jpg','candidate map');
  write('public/experiments/realism-lab/reference.glb','other experiment');write('public/experiments/catalog-realism-other/reference.glb','similarly named experiment');
  write('public/robots.txt','User-agent: *');write('public/.well-known/example.json','{"kept":true}');
  write('public/index.html','obsolete public index');write('public/assets/app.js','obsolete public app');
  return {root,write};
}

test('Vite build omits only raw catalog candidates and retains public URLs and generated bundle files',async t=>{
  const {root}=fixture(t);let resolved;
  await build({configFile:false,root,logLevel:'silent',plugins:[catalogPublicAssets(),{name:'capture-public-config',configResolved(config){resolved=config;}}],
    build:{outDir:'dist/client',emptyOutDir:true,copyPublicDir:true,rollupOptions:{output:{entryFileNames:'assets/app.js'}}}});
  const out=path.join(root,'dist/client');
  assert.equal(resolved.publicDir,path.join(root,'public').replaceAll('\\','/'));assert.equal(resolved.build.copyPublicDir,false);
  assert.equal(existsSync(path.join(out,'experiments/catalog-realism')),false);
  for(const [name,data]of [['models/furniture/baseline.glb','baseline model'],['models/previews/baseline.webp','baseline preview'],['experiments/realism-lab/reference.glb','other experiment'],['experiments/catalog-realism-other/reference.glb','similarly named experiment'],['robots.txt','User-agent: *'],['.well-known/example.json','{"kept":true}']])assert.equal(readFileSync(path.join(out,name),'utf8'),data);
  assert.match(readFileSync(path.join(out,'index.html'),'utf8'),/Generated application/);assert.match(readFileSync(path.join(out,'index.html'),'utf8'),/\/models\/previews\/baseline.webp/);
  assert.match(readFileSync(path.join(out,'assets/app.js'),'utf8'),/generated-app/);assert.doesNotMatch(readFileSync(path.join(out,'assets/app.js'),'utf8'),/obsolete public/);
});

test('Vite development still serves raw candidate URLs and ordinary public assets',async t=>{
  const {root}=fixture(t),server=await createServer({configFile:false,root,logLevel:'silent',plugins:[catalogPublicAssets()],server:{host:'127.0.0.1',port:0,strictPort:false}});
  try{
    await server.listen();const address=server.httpServer.address(),base='http://127.0.0.1:'+address.port;
    for(const [url,expected]of [['/experiments/catalog-realism/models/candidate.glb','private raw candidate'],['/models/furniture/baseline.glb','baseline model']]){
      const response=await fetch(base+url);assert.equal(response.status,200);assert.equal(await response.text(),expected);
    }
  }finally{await server.close();}
});

test('the production app configuration installs filtered public copying without changing publicDir',async()=>{
  const {config}=await loadConfigFromFile({command:'build',mode:'production'},fileURLToPath(new URL('../vite.config.mjs',import.meta.url)),undefined,'silent');assert.equal(config.build.copyPublicDir,false);assert.notEqual(config.publicDir,false);
  assert(config.plugins.some(plugin=>plugin.name==='catalog-filtered-public-assets'));
});
