// Live visualization only. Never put Google content in R2, a shared cache, or exports.
const PREFIX = '/api/google-tiles';
const error = (message, status) => Response.json({error:message}, {status, headers:{'Cache-Control':'no-store'}});
export async function googleTiles(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX + '/')) return null;
  if (request.method !== 'GET') return error('Use GET.',405);
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.get('origin') && request.headers.get('origin') !== url.origin)) return error('Open scenery in Nook & Nest.',403);
  const path = url.pathname.slice(PREFIX.length);
  if (!/^\/v1\/3dtiles\/(root\.json|datasets\/[A-Za-z0-9_./-]+)$/.test(path) || path.includes('..')) return error('Unknown tile.',404);
  for (const key of url.searchParams.keys()) if (key !== 'session') return error('Unsupported tile parameter.',400);
  if (!env.GOOGLE_MAPS_API_KEY) return error('Google scenery is not configured yet. The standard Toronto view is available.',503);
  const root = path === '/v1/3dtiles/root.json';
  if (root) {
    if (!env.DB) return error('The scenery usage guard is unavailable.',503);
    const configured = Number(env.GOOGLE_TILES_DAILY_LIMIT ?? 25);
    const limit = Number.isFinite(configured) ? Math.max(0,Math.min(1000,Math.floor(configured))) : 25;
    if (!limit) return error('Google scenery is paused for today.',429);
    try {
      const result = await env.DB.prepare(`INSERT INTO google_tiles_usage(day,count) VALUES (?,1)
        ON CONFLICT(day) DO UPDATE SET count=count+1 WHERE count<? RETURNING count`).bind(new Date().toISOString().slice(0,10),limit).first();
      if (!result) return error('Today’s Google scenery limit has been reached. Use the standard Toronto view.',429);
    } catch { return error('The scenery usage guard is unavailable.',503); }
  } else if (!url.searchParams.get('session') || url.searchParams.get('session').length > 4096) return error('A scenery session is required.',400);
  const upstream = new URL('https://tile.googleapis.com' + path);
  upstream.search = url.search;
  upstream.searchParams.set('key',env.GOOGLE_MAPS_API_KEY);
  const headers = new Headers();
  for (const name of ['if-none-match','if-modified-since']) if(request.headers.has(name))headers.set(name,request.headers.get(name));
  let response;
  try { response = await fetcher(upstream, {headers, signal:request.signal, redirect:'manual'}); }
  catch { return error('Google scenery could not connect. Try again later.',502); }
  if (!response.ok && response.status !== 304) {
    // Never forward upstream errors: they can echo credentials or project identifiers.
    return error(response.status === 429 ? 'Google’s scenery quota is reached.' : 'Google scenery could not load. Check API access or start a new session.',response.status === 429 ? 429 : 502);
  }
  const out = new Headers({'X-Content-Type-Options':'nosniff'});
  for (const name of ['content-type','cache-control','etag','last-modified','expires']) if(response.headers.has(name))out.set(name,response.headers.get(name));
  // Private browser caches may obey Google's expiry; shared edge storage is always disabled.
  const cache = out.get('cache-control');
  out.set('Cache-Control',cache ? 'private, ' + cache.replace(/\bpublic\s*,?\s*/g,'') : 'private, no-store');
  out.set('CDN-Cache-Control','no-store');
  if(response.status === 304)return new Response(null,{status:304,headers:out});
  if ((response.headers.get('content-type') ?? '').includes('json') || path.endsWith('.json')) {
    let json;
    try { json = await response.json(); } catch { return error('Google returned unreadable scenery data.',502); }
    const rewrite = value => {
      if (!value || typeof value !== 'object') return;
      for(const [name, child] of Object.entries(value)) {
        if ((name === 'uri' || name === 'url') && typeof child === 'string') {
          const target = new URL(child,upstream);
          if(target.origin !== upstream.origin || !target.pathname.startsWith('/v1/3dtiles/')) throw new Error('Unexpected tile source');
          target.searchParams.delete('key');
          if(!target.searchParams.has('session') && url.searchParams.has('session'))target.searchParams.set('session',url.searchParams.get('session'));
          value[name] = url.origin + PREFIX + target.pathname + target.search;
        } else rewrite(child);
      }
    };
    try { rewrite(json); } catch { return error('Unsupported Google tile source.',502); }
    out.set('Content-Type','application/json');
    // Rewritten JSON has a different entity tag from the upstream representation.
    out.delete('etag');out.delete('last-modified');out.set('Cache-Control','private, no-store');
    return new Response(JSON.stringify(json),{headers:out});
  }
  return new Response(response.body,{headers:out});
}
