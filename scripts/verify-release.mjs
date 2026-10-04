import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import {execFileSync} from 'node:child_process';
import {assertReleaseSizes,assertPromotedClient} from './build-catalog-production-staging.mjs';

const output = await build({ entryPoints: ['src/catalog.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { catalog } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
for (const item of catalog) {
  for (const path of [`assets-source/blender/${item.id}.blend`, `dist/client/models/furniture/${item.id}.glb`, `dist/client/models/previews/${item.id}.webp`]) assert(existsSync(path), `Missing ${path}`);
  const data = readFileSync(`dist/client/models/furniture/${item.id}.glb`);
  assert.equal(data.toString('ascii', 0, 4), 'glTF');
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  const model=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
  for(const image of model.images??[])if(image.uri){assert.match(image.uri,/^shared-textures\/[a-f0-9]{64}\.(png|jpg)$/);assert(existsSync('dist/client/models/furniture/'+image.uri),'Missing shared model image');}
}
const assets = 'dist/client/assets/';
// Older immutable assets can coexist with the current entry. Check the module
// actually referenced by this build, not the first filename alphabetically.
const entry = readFileSync('dist/client/index.html','utf8').match(/src="\/assets\/(index-[^"/]+\.js)"/)?.[1];
assert(entry, 'Missing client entry');
const raw = readFileSync(assets + entry), compressed = gzipSync(raw);
assert(raw.length < 700_000, 'Welcome entry exceeded the 700 kB budget');
assert(compressed.length < 220_000, 'Welcome entry gzip exceeded the 220 kB budget');
const manifest = JSON.parse(readFileSync('dist/.openai/hosting.json', 'utf8'));
assert.equal(manifest.d1, 'DB');
assert(existsSync('dist/.openai/drizzle/0000_lush_inhumans.sql'));
// D1's import splitter can mistake an unparenthesized CASE END for the
// enclosing trigger's END, although SQLite accepts the same script locally.
// https://github.com/cloudflare/workers-sdk/issues/4727
for (const file of readdirSync('dist/.openai/drizzle').filter(name => name.endsWith('.sql'))) {
  const sql = readFileSync(`dist/.openai/drizzle/${file}`, 'utf8');
  if (/CREATE\s+TRIGGER/i.test(sql)) {
    assert(!sql.includes('\r'), `${file}: D1 trigger migrations require LF endings`);
    assert(!/\bSELECT\s+CASE\b/i.test(sql), `${file}: parenthesize CASE expressions inside D1 triggers`);
  }
}
const { default: worker } = await import('../dist/server/index.js');
assert.equal(typeof worker.fetch, 'function');
const previewResponse=await worker.fetch(new Request('https://example.test/api/previews/sofa.webp'),{ASSETS:{fetch:async()=>new Response('image-bytes',{headers:{'content-type':'application/octet-stream',etag:'preview-hash'}})}});
assert.equal(previewResponse.headers.get('content-type'),'image/webp');assert.equal(previewResponse.headers.get('etag'),'preview-hash');assert.equal(await previewResponse.text(),'image-bytes');
const missingPreview=await worker.fetch(new Request('https://example.test/api/previews/missing.webp'),{ASSETS:{fetch:async()=>new Response('missing',{status:404})}});assert.equal(missingPreview.status,404);

const response = await worker.fetch(new Request('https://example.test/api/projects'), {});
assert.equal(response.status, 401);
assert.match(response.headers.get('cache-control'), /no-store/);
if(existsSync('.generated/catalog-realism-promotion.json')){
  const upload=await worker.fetch(new Request('https://example.test/api/library-upload/'+'a'.repeat(64),{method:'PUT'}),{LIBRARY_UPLOAD_TOKEN:'must-not-enable-final-uploads'});
  assert.equal(upload.status,403,'Promoted final app must disable uploads independently of deployment secrets');
}
const totalBytes=folder=>readdirSync(folder,{withFileTypes:true}).reduce((sum,entry)=>sum+(entry.isDirectory()?totalBytes(folder+'/'+entry.name):statSync(folder+'/'+entry.name).size),0);
const expandedBytes=totalBytes('dist');
const library=JSON.parse(readFileSync('.generated/library-manifest.json','utf8'));
const baseline=JSON.parse(readFileSync('docs/r2-baseline.json','utf8'));
let libraryBytes=0,reusedBytes=0;
for(const [path,asset] of Object.entries(library.assets)){
  const size=statSync('dist/client'+path).size;libraryBytes+=size;
  if(JSON.stringify(baseline.assets[path])===JSON.stringify(asset))reusedBytes+=size;
}
const slimBytes=expandedBytes-libraryBytes,incrementalBytes=expandedBytes-reusedBytes;
let staging;
if(process.env.NOOK_CATALOG_RELEASE_MODE==='production-staging'){
  assertPromotedClient(readdirSync(assets).filter(name=>name.endsWith('.js')).map(name=>readFileSync(assets+name,'utf8')),JSON.parse(readFileSync('.generated/catalog-realism-promotion.json','utf8')));
  staging=JSON.parse(execFileSync(process.env.PYTHON??(process.platform==='win32'?'python':'python3'),['scripts/catalog_production_staging.py','preflight'],{encoding:'utf8'}));
}
assertReleaseSizes({slimBytes,incrementalBytes},staging);
console.log(JSON.stringify({ expandedBytes,slimBytes,incrementalBytes,fullBridgeSitesEligible:expandedBytes<250*1024*1024,catalogPieces: catalog.length, entryBytes: raw.length, gzipBytes: compressed.length, databaseBinding: manifest.d1, anonymousAccess: response.status }));
