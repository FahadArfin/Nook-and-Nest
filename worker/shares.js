import {validatePlan,MAX_PLAN_BYTES} from '../src/planValidation.ts';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function shares(request,env){
 const url=new URL(request.url),id=url.pathname.match(/^\/api\/shares\/([a-f0-9]{32})$/)?.[1];
 if(url.pathname!=='/api/shares'&&!url.pathname.startsWith('/api/shares/'))return;
 if(!env.DB)return json({error:'Short links are temporarily unavailable.'},503);
 if(request.method==='GET'&&id){const row=await env.DB.prepare('SELECT document FROM shared_plans WHERE id = ?').bind(id).first();return row?json({plan:JSON.parse(row.document)}):json({error:'This shared link was not found.'},404);}
 if(request.method!=='POST'||url.pathname!=='/api/shares')return json({error:'Not found.'},404);
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in through Project to create a short link. Anyone can open it without signing in.'},401);
 if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Create links from this site.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON plan.'},415);
 const reader=request.body?.getReader();if(!reader)return json({error:'Missing plan.'},400);
 let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_PLAN_BYTES+100){await reader.cancel();return json({error:'Plan exceeds the 8 MB share limit.'},413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 let plan;try{plan=JSON.parse(new TextDecoder().decode(bytes)).plan;validatePlan(plan);}catch{return json({error:'Invalid plan.'},400);}
 // Unfinished studio work is private; only share the confirmed furnished home.
 const {studioDrafts,...snapshot}=plan,document=JSON.stringify(snapshot);
 if(new TextEncoder().encode(document).length>MAX_PLAN_BYTES)return json({error:'Plan exceeds the share limit.'},413);
 const key=crypto.randomUUID().replaceAll('-','');
 const result=await env.DB.prepare('INSERT INTO shared_plans (id, owner_id, created_at, document) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM shared_plans WHERE owner_id = ?) < 100').bind(key,owner,new Date().toISOString(),document,owner).run();
 if(!result.meta.changes)return json({error:'You have reached 100 saved share links. Use a project backup for another copy.'},409);
 return json({id:key},201);
}
