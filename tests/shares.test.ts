import {it,expect} from 'vitest';
// @ts-expect-error Worker is bundled as JavaScript for deployment.
import {shares} from '../worker/shares.js';
import {createSamplePlan} from '../src/domain';
it('creates an immutable short snapshot, omits private drafts, and allows anonymous reading',async()=>{
 const rows=new Map<string,any>();const DB={prepare:(sql:string)=>({bind:(...args:any[])=>({run:async()=>{rows.set(args[0],{document:args[3]});return {meta:{changes:1}};},first:async()=>rows.get(args[0])})})};
 const plan=createSamplePlan();plan.studioDrafts={[plan.floors[0].id]:{draft:{rooms:[],walls:[],fixtures:[],omittedWalls:[]},savedAt:'now',imageScale:10,calibrated:false,view:{x:0,z:0,width:1000,height:1000}}};const request=new Request('https://example.test/api/shares',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json','oai-authenticated-user-id':'owner'},body:JSON.stringify({plan})});
 const response=await shares(request,{DB});expect(response.status).toBe(201);const {id}=await response.json();expect(id).toMatch(/^[a-f0-9]{32}$/);
 plan.name='Changed later';const opened=await shares(new Request('https://example.test/api/shares/'+id),{DB});const snapshot=(await opened.json()).plan;expect(snapshot.name).not.toBe(plan.name);expect(snapshot.studioDrafts).toBeUndefined();
 const missing=await shares(new Request('https://example.test/api/shares/'+'0'.repeat(32)),{DB});expect(missing.status).toBe(404);
});
it('rejects anonymous creation, cross-origin writes, invalid and oversized plans before writing',async()=>{
 let writes=0;const DB={prepare:()=>{writes++;throw new Error('Must not write');}};
 const req=(body:string,owner=true,origin='https://example.test')=>new Request('https://example.test/api/shares',{method:'POST',headers:{'content-type':'application/json',origin,...(owner?{'oai-authenticated-user-id':'owner'}:{})},body});
 expect((await shares(req('{}',false),{DB})).status).toBe(401);
 expect((await shares(req('{}',true,'https://evil.test'),{DB})).status).toBe(403);
 expect((await shares(req('{}'),{DB})).status).toBe(400);
 expect((await shares(req('x'.repeat(8000200)),{DB})).status).toBe(413);expect(writes).toBe(0);
});
