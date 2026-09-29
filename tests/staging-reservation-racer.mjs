import {parentPort,workerData} from 'node:worker_threads';
import {SQLiteD1} from './staging-d1-adapter.mjs';
const {stagingInventoryApi}=await import(workerData.moduleUrl);
const db=new SQLiteD1(workerData.dbPath),barrier=new Int32Array(workerData.barrier);
db.beforeBatch=()=>{parentPort.postMessage({ready:true});Atomics.wait(barrier,0,0,10000);};
const request=new Request(`https://example.test/api/staging/${workerData.workspace}/reservations`,{method:'POST',headers:{'oai-authenticated-user-id':'owner','origin':'https://example.test','content-type':'application/json'},body:JSON.stringify(workerData.booking)});
const response=await stagingInventoryApi(request,{DB:db,STAGING_PILOT_ENABLED:'true'},workerData.catalog,()=>new Date('2026-10-01T12:00:00Z'));
parentPort.postMessage({status:response.status,data:await response.json()});db.close();
