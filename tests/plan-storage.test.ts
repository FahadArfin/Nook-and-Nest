import {it,expect} from 'vitest';
// @ts-expect-error Worker JavaScript module.
import {encodeStoredPlan,decodeStoredPlan,MAX_STORED_PLAN_BYTES} from '../worker/plan-storage.js';
// @ts-expect-error Worker JavaScript module.
import {shares} from '../worker/shares.js';
import {createSamplePlan} from '../src/domain';
import {catalog} from '../src/catalog';

it('stores and shares 20,000 editable grass placements within the database row limit',async()=>{
 const plan=createSamplePlan(),c=catalog.find(c=>c.id==='grass-clump')!;
 plan.furniture=Array.from({length:20000},(_,i)=>({id:'grass-'+i,catalogId:c.id,floorId:plan.floors[0].id,x:i%140*300,z:Math.floor(i/140)*300,rotation:i%360,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'}));
 expect(JSON.stringify(plan).length).toBeGreaterThan(2_000_000);
 const document=await encodeStoredPlan(plan);expect(document.length).toBeLessThan(MAX_STORED_PLAN_BYTES);expect(await decodeStoredPlan(document)).toEqual(plan);
 let saved='';const DB={prepare:()=>({bind:()=>({run:async()=>({meta:{changes:1}}),first:async()=>({document:saved})})})};
 DB.prepare=()=>({bind:(...args:any[])=>({run:async()=>{saved=args[3];return {meta:{changes:1}};},first:async()=>({document:saved})})});
 const response=await shares(new Request('https://test.local/api/shares',{method:'POST',headers:{origin:'https://test.local','content-type':'application/json','oai-authenticated-user-id':'owner'},body:JSON.stringify({plan})}),{DB});
 expect(response.status).toBe(201);const {id}=await response.json();expect(saved.length).toBeLessThan(MAX_STORED_PLAN_BYTES);
 const opened=await shares(new Request('https://test.local/api/shares/'+id),{DB});expect((await opened.json()).plan).toEqual(plan);
});
it('reads legacy documents and bounds expanded storage',async()=>{
 const plan=createSamplePlan();expect(await decodeStoredPlan(JSON.stringify(plan))).toEqual(plan);
 await expect(encodeStoredPlan({data:'x'.repeat(8_000_001)})).rejects.toThrow(/limit/);
 const zipped=new Uint8Array(await new Response(new Blob(['x'.repeat(8_000_001)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 let binary='';for(const b of zipped)binary+=String.fromCharCode(b);
 await expect(decodeStoredPlan(JSON.stringify({storageEncoding:'gzip-v1',data:btoa(binary)}))).rejects.toThrow(/limit/);
 await expect(decodeStoredPlan('{"storageEncoding":"gzip-v1","data":"broken"}')).rejects.toThrow();
});
