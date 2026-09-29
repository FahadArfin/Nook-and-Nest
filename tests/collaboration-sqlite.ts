import {Worker} from 'node:worker_threads';
/** Real separate SQLite connections on worker threads, not an in-memory fake or serialized JS mock. */
export class ParallelSqliteD1 {
 private worker:Worker;private next=0;private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 beforeRun?: (sql:string)=>Promise<void>;
 constructor(filename:string){this.worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(workerData);db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');const perform=q=>{const s=db.prepare(q.sql);if(q.method==='first')return s.get(...q.args)||null;if(q.method==='all')return {results:s.all(...q.args)};return {meta:{changes:Number(s.run(...q.args).changes)}};};parentPort.on('message',m=>{try{let result;if(m.batch){db.exec('BEGIN IMMEDIATE');try{result=m.batch.map(perform);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}else result=perform(m.query);parentPort.postMessage({id:m.id,result});}catch(e){parentPort.postMessage({id:m.id,error:e.message});}});`,{eval:true,workerData:filename});this.worker.on('message',m=>{const promise=this.pending.get(m.id);this.pending.delete(m.id);if(m.error)promise?.reject(new Error(m.error));else promise?.resolve(m.result);});this.worker.on('error',error=>{for(const p of this.pending.values())p.reject(error instanceof Error?error:new Error(String(error)));this.pending.clear();});}
 private send(value:unknown){return new Promise<any>((resolve,reject)=>{const id=++this.next;this.pending.set(id,{resolve,reject});this.worker.postMessage({id,...value as object});});}
 prepare(sql:string){const db=this;return {bind(...args:any[]){return {sql,args,first:()=>db.send({query:{sql,args,method:'first'}}),all:()=>db.send({query:{sql,args,method:'all'}}),async run(){await db.beforeRun?.(sql);return db.send({query:{sql,args,method:'run'}});}};}};}
 batch(statements:Array<{sql:string;args:unknown[]}>){return this.send({batch:statements.map(q=>({sql:q.sql,args:q.args,method:'run'}))});}
 async close(){await this.worker.terminate();}
}
