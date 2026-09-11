import {parsePlan,decodeShare} from './domain';
import type {PlanDocumentV1} from './types';
export async function importPlan(text:string,share=false):Promise<PlanDocumentV1>{
 if(text.length>(share?8_000_000:32_000_000))throw new Error('Project exceeds the import limit.');
 if(typeof Worker==='undefined'||(!share&&text.length<256000))return share?decodeShare(text):parsePlan(text);
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./planImport.worker.ts',import.meta.url),{type:'module'});const timer=setTimeout(()=>finish(new Error('Import took too long. Try a smaller backup.')),15000);
 function finish(error?:Error,plan?:PlanDocumentV1){clearTimeout(timer);worker.terminate();if(error)reject(error);else resolve(plan!)}
 worker.onmessage=({data})=>finish(data.error?new Error(data.error):undefined,data.plan);worker.onerror=()=>finish(new Error('Could not open this backup.'));worker.postMessage({text,share});
 });
}
