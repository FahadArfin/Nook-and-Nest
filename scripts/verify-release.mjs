import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

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
assert(raw.length < 3_000_000, 'Main bundle exceeded 3 MB');
assert(compressed.length < 800_000, 'Main compressed bundle exceeded 800 kB');
const manifest = JSON.parse(readFileSync('dist/.openai/hosting.json', 'utf8'));
assert.equal(manifest.d1, 'DB');
assert(existsSync('dist/.openai/drizzle/0000_lush_inhumans.sql'));
const { default: worker } = await import('../dist/server/index.js');
assert.equal(typeof worker.fetch, 'function');
const response = await worker.fetch(new Request('https://example.test/api/projects'), {});
assert.equal(response.status, 401);
assert.match(response.headers.get('cache-control'), /no-store/);
const totalBytes=folder=>readdirSync(folder,{withFileTypes:true}).reduce((sum,entry)=>sum+(entry.isDirectory()?totalBytes(folder+'/'+entry.name):statSync(folder+'/'+entry.name).size),0);
const expandedBytes=totalBytes('dist');assert(expandedBytes<250*1024*1024,'Expanded release approaches the 256 MiB hosting limit');
console.log(JSON.stringify({ expandedBytes, catalogPieces: catalog.length, entryBytes: raw.length, gzipBytes: compressed.length, databaseBinding: manifest.d1, anonymousAccess: response.status }));
