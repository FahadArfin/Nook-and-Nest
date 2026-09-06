import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleTiles} from '../worker/google-tiles.js';
const origin='https://nook.example';
const path='/api/google-tiles/v1/3dtiles/';
const request=(p='root.json',headers={})=>new Request(origin+path+p,{headers});
function environment(limit=25){let count=0;return {GOOGLE_MAPS_API_KEY:'secret-test-key',GOOGLE_TILES_DAILY_LIMIT:limit,DB:{prepare(){return {bind(day,n){assert.match(day,/^\d{4}-\d{2}-\d{2}$/);return {async first(){if(count>=n)return null;return {count:++count};}};}};}}};}
test('root allowance is atomic, bounded, fail-closed, and tiles do not spend roots',async()=>{
  const env=environment(1);let calls=0;
  const fetcher=async()=>{calls++;return Response.json({root:{children:[]}});};
  assert.equal((await googleTiles(request(),env,fetcher)).status,200);
  assert.equal((await googleTiles(request(),env,fetcher)).status,429);
  assert.equal((await googleTiles(request('datasets/a.glb?session=s'),env,fetcher)).status,200);
  assert.equal(calls,2);
  assert.equal((await googleTiles(request(),{GOOGLE_MAPS_API_KEY:'key'},fetcher)).status,503);
});
test('nested URLs are confined to proxy, key removed and existing sessions retained',async()=>{
  const env=environment();
  const response=await googleTiles(request(),env,async url=>{
    assert.equal(url.searchParams.get('key'),env.GOOGLE_MAPS_API_KEY);
    return Response.json({root:{children:[{content:{uri:'/v1/3dtiles/datasets/a.json?session=one&key=secret-test-key'}}]}});
  });
  const result=await response.json();assert.equal(result.root.children[0].content.uri,origin+path+'datasets/a.json?session=one');
  assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('child JSON inherits session and refuses unrelated hosts',async()=>{
  const env=environment();
  const r=await googleTiles(request('datasets/a.json?session=one'),env,async()=>Response.json({root:{content:{uri:'b.glb'}}}));
  assert.equal((await r.json()).root.content.uri,origin+path+'datasets/b.glb?session=one');
  const bad=await googleTiles(request('datasets/a.json?session=one'),env,async()=>Response.json({content:{uri:'https://elsewhere.example/file.glb'}}));assert.equal(bad.status,502);
});
test('binary bytes and Google expiry survive, shared cache disabled, conditional GET supported',async()=>{
  const bytes=new Uint8Array([103,108,84,70]);
  const r=await googleTiles(request('datasets/a.glb?session=s'),environment(),async()=>new Response(bytes,{headers:{'content-type':'model/gltf-binary','cache-control':'public, max-age=30, must-revalidate',etag:'"a"'}}));
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);
  assert.equal(r.headers.get('cache-control'),'private, max-age=30, must-revalidate');assert.equal(r.headers.get('cdn-cache-control'),'no-store');
  const conditional=await googleTiles(request('datasets/a.glb?session=s',{'if-none-match':'"a"'}),environment(),async(url,options)=>{assert.equal(options.headers.get('if-none-match'),'"a"');return new Response(null,{status:304,headers:{etag:'"a"','cache-control':'private, max-age=30'}});});assert.equal(conditional.status,304);
});
test('invalid requests never reach Google and upstream errors cannot leak secrets',async()=>{
  let calls=0;const fetcher=async()=>{calls++;return Response.json({error:'secret-test-key'},{status:403});};
  for(const p of ['datasets/a.glb','root.json?key=anything','datasets/%2e%2e%2fa.glb?session=s','elsewhere.json'])assert.notEqual((await googleTiles(request(p),environment(),fetcher)).status,200);
  assert.equal((await googleTiles(request('root.json',{'sec-fetch-site':'cross-site'}),environment(),fetcher)).status,403);assert.equal(calls,0);
  const error=await googleTiles(request(),environment(),fetcher);assert.equal(error.status,502);assert.ok(!(await error.text()).includes('secret-test-key'));
});
