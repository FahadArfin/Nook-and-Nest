import {readFileSync} from 'node:fs';
import {googleTiles} from '../worker/google-tiles.js';
export function localGoogleTiles(){return {name:'local-google-tiles',configureServer(server){
  const keyPath=process.env.NOOK_GOOGLE_KEY_FILE;
  const key=keyPath?readFileSync(keyPath,'utf8').match(/AIza[0-9A-Za-z_-]+/)?.[0]:undefined;
  const counts=new Map();
  const DB={prepare(){return {bind(day,limit){return {async first(){const n=counts.get(day)??0;if(n>=limit)return null;counts.set(day,n+1);return {count:n+1};}};}};}};
  server.middlewares.use(async(req,res,next)=>{
    if(!req.url?.startsWith('/api/google-tiles/'))return next();
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){res.statusCode=403;res.end();return;}
    const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
    const abort=new AbortController();res.on('close',()=>abort.abort());
    try{
      const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,signal:abort.signal});
      const result=await googleTiles(request,{GOOGLE_MAPS_API_KEY:key,DB,GOOGLE_TILES_DAILY_LIMIT:10});
      res.statusCode=result.status;result.headers.forEach((v,k)=>res.setHeader(k,v));
      if(result.body)for await(const chunk of result.body)res.write(Buffer.from(chunk));res.end();
    }catch{res.statusCode=503;res.end('Google scenery is unavailable.');}
  });
}};}
