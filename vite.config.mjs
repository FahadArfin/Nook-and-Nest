import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {readFileSync} from 'node:fs';
import {recognitionApi} from './worker/recognition.js';

// Optional loopback-only development adapter. Production uses Sites identity and D1.
function localRecognition(){return {name:'local-floor-plan-recognition',configureServer(server){
  const keyPath=process.env.NOOK_OPENAI_KEY_FILE;
  if(!keyPath)return;
  const key=readFileSync(keyPath,'utf8').trim(),counts=new Map();
  const DB={prepare(sql){return {bind(owner,day){return {async first(){const id=owner+day,n=counts.get(id)||0,max=sql.includes('count<10 ')?10:100;if(n>=max)return null;counts.set(id,n+1);return {count:n+1};}};}};}};
  server.middlewares.use('/api/floor-plan/recognize',async(req,res)=>{
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){res.statusCode=403;res.end();return;}
    try{
      const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
      headers.set('oai-authenticated-user-id','local-development');
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>9*1024*1024){res.statusCode=413;res.end();return;}chunks.push(chunk);}
      const request=new Request(`http://${req.headers.host}/api/floor-plan/recognize`,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
      const result=await recognitionApi(request,{OPENAI_API_KEY:key,DB});res.statusCode=result.status;result.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await result.text());
    }catch{res.statusCode=503;res.end(JSON.stringify({error:'Local image analysis is unavailable.'}));}
  });
}};}

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(),localRecognition()],
});
