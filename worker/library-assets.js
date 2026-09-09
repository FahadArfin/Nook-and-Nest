/** Public, allowlisted collection assets. Uploads require a separate deployment secret. */
export function createLibraryHandler(manifest) {
  const assets=manifest.assets,byHash=new Map(Object.values(assets).map(a=>[a.sha256,a]));
  const reply=(error,status)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
  return async function library(request,env) {
    const url=new URL(request.url),upload=url.pathname.match(/^\/api\/library-upload\/([a-f0-9]{64})$/);
    if(url.pathname==='/api/beta-library-bootstrap'){
      if(env.BETA_LIBRARY_BOOTSTRAP!=='1'||!env.LIBRARY)return reply('Not found',404);
      if(request.method!=='GET')return reply('Method not allowed',405);
      const batch=Number(url.searchParams.get('batch')??0),names=Object.keys(assets);if(!Number.isInteger(batch)||batch<0||batch>=Math.ceil(names.length/32))return reply('Invalid batch',400);
      const selected=names.slice(batch*32,(batch+1)*32),results=[];
      for(const name of selected){const target=new URL(request.url);target.pathname='/api/library-assets'+name;target.search='';const response=await library(new Request(target),env);if(response.body)await response.body.cancel();results.push({name,ready:response.headers.get('X-Nook-Asset-Storage')==='r2'});}
      return Response.json({batch,batches:Math.ceil(names.length/32),results},{headers:{'Cache-Control':'no-store'}});
    }
    if(url.pathname.startsWith('/api/library-upload/')) {
      if(!env.LIBRARY_UPLOAD_TOKEN||request.headers.get('authorization')!=='Bearer '+env.LIBRARY_UPLOAD_TOKEN)return reply('Unauthorized',401);
      if(!upload||!byHash.has(upload[1]))return reply('Unknown release asset',404);
      if(!env.LIBRARY)return reply('File storage unavailable',503);
      const hash=upload[1],asset=byHash.get(hash),key='library/'+hash;
      if(request.method==='HEAD') {
        const object=await env.LIBRARY.head(key);
        return new Response(null,{status:object?.size===asset.size?200:404,headers:{'Cache-Control':'no-store'}});
      }
      if(request.method!=='PUT')return reply('Method not allowed',405);
      if(Number(request.headers.get('content-length'))!==asset.size||!request.body)return reply('Invalid asset length',400);
      // R2 validates SHA-256 while consuming the stream; no whole-file buffering in the Worker.
      try {
        await env.LIBRARY.put(key,request.body,{sha256:hash,httpMetadata:{contentType:asset.type},customMetadata:{sha256:hash}});
        return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
      } catch {return reply('Asset upload failed integrity validation',400);}
    }
    // The explicit API route bypasses Sites' static-first delivery during the bridge.
    const name=url.pathname.replace(/^\/api\/library-assets(?=\/)/,'').replace(/^\/api\/previews\//,'/models/previews/'),asset=assets[name];
    if(!asset)return null;
    if(!['GET','HEAD'].includes(request.method))return reply('Method not allowed',405);
    const etag='"'+asset.sha256+'"',headers=new Headers({'Content-Type':asset.type,'ETag':etag,'Cache-Control':'public, max-age=3600, must-revalidate','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'});
    let range;
    const rangeHeader=request.headers.get('range');
    if(rangeHeader&&(!request.headers.get('if-range')||request.headers.get('if-range')===etag)) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+asset.size}});
      const start=match[1]?Number(match[1]):Math.max(0,asset.size-Number(match[2]));
      const end=match[1]?(match[2]?Math.min(Number(match[2]),asset.size-1):asset.size-1):asset.size-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=asset.size)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+asset.size}});
      range={offset:start,length:end-start+1};
    }
    let object;
    try {object=env.LIBRARY?(request.method==='HEAD'?await env.LIBRARY.head('library/'+asset.sha256):await env.LIBRARY.get('library/'+asset.sha256,range?{range}:undefined)):null;}catch{}
    if(!object) {
      // Bridge release keeps packaged copies until every R2 object is verified.
      const fallbackUrl=new URL(request.url);fallbackUrl.pathname=name;
      const response=await env.ASSETS.fetch(new Request(fallbackUrl,request));
      if(response.status===404&&env.BETA_LIBRARY_BOOTSTRAP==='1'&&env.LIBRARY){
        // Copy only manifest-listed PUBLIC assets; never proxy user data or credentials.
        // R2 verifies the immutable expected digest before the asset is served.
        try{const upstream=await fetch('https://nook-and-nest.fwad101.chatgpt.site/api/library-assets'+name,{redirect:'error'});
          if(upstream.ok&&Number(upstream.headers.get('content-length'))===asset.size){await env.LIBRARY.put('library/'+asset.sha256,upstream.body,{sha256:asset.sha256,httpMetadata:{contentType:asset.type},customMetadata:{sha256:asset.sha256}});return library(request,{...env,BETA_LIBRARY_BOOTSTRAP:'0'});}
        }catch{}
      }
      if(response.status===404)return reply('Collection asset temporarily unavailable',503);
      if(response.ok&&env.BETA_LIBRARY_BOOTSTRAP==='1'&&env.LIBRARY){try{await env.LIBRARY.put('library/'+asset.sha256,response.body,{sha256:asset.sha256,httpMetadata:{contentType:asset.type},customMetadata:{sha256:asset.sha256}});return library(request,{...env,BETA_LIBRARY_BOOTSTRAP:'0'});}catch{return reply('Asset integrity check failed',503);}}
      const fallback=new Response(response.body,response);fallback.headers.set('Content-Type',asset.type);return fallback;
    }
    if(request.headers.get('if-none-match')?.split(/\s*,\s*/).some(value=>value===etag||value==='W/'+etag||value==='*'))return new Response(null,{status:304,headers});
    headers.set('X-Nook-Asset-Storage','r2');
    headers.set('Content-Length',String(range?.length??asset.size));
    if(range)headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${asset.size}`);
    return new Response(request.method==='HEAD'?null:object.body,{status:range?206:200,headers});
  };
}
