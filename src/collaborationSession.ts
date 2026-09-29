import {openDB} from 'idb';
import {applyCollaborationBatch,canonical,COLLAB_LIMITS,collaborationRecovery,encodedBytes,makeCollaborationBatch,parseCollaborationBatch,validateCollaborationPlan,type CollaborationBatch,type CollaborationSnapshot} from './collaborationProtocol';
import {CollaborationApiError,collaborationApiForAccount,type CollaborationTransport} from './collaborationApi';
import type {PlanDocumentV1} from './types';
export interface CollaborationQueue {version:1;accountId:string;roomId:string;clientId:string;snapshot:CollaborationSnapshot;local:PlanDocumentV1;queue:CollaborationBatch[];savedAt:string}
export interface CollaborationQueueStore {load(key:string):Promise<CollaborationQueue|undefined>;save(key:string,value:CollaborationQueue):Promise<void>;remove(key:string):Promise<void>}
const queueDB=()=>openDB('nook-collaboration-queue',1,{upgrade(db){db.createObjectStore('queues');}});
export const collaborationQueueStore:CollaborationQueueStore={async load(key){return (await queueDB()).get('queues',key);},async save(key,value){const db=await queueDB(),tx=db.transaction('queues','readwrite'),keys=await tx.store.getAllKeys();if(!keys.includes(key)&&keys.length>=10){tx.abort();throw new Error('Recovery storage holds 10 sessions. Export an old recovery before removing it.');}await tx.store.put(structuredClone(value),key);await tx.done;},async remove(key){await (await queueDB()).delete('queues',key);}};
/** Explicit account-scoped recovery after a tab/session ID is gone. No network or account enumeration. */
export async function listCollaborationRecoveries(accountId:string):Promise<CollaborationQueue[]>{const docs=await (await queueDB()).getAll('queues') as CollaborationQueue[];return docs.filter(d=>d.version===1&&d.accountId===accountId).slice(0,10);}
export async function removeCollaborationRecovery(value:CollaborationQueue){await collaborationQueueStore.remove(JSON.stringify([value.accountId,value.roomId,value.clientId]));}
export type CollaborationConnection='connecting'|'online'|'offline'|'conflict'|'access-ended'|'storage-error'|'closed';
export interface CollaborationSessionState {status:CollaborationConnection;snapshot:CollaborationSnapshot|null;local:PlanDocumentV1|null;queued:number;error:string;busy:boolean}
export function collaborationClientId():string {const key='nook-collaboration-client';try{let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id);}return id;}catch{throw new Error('Session storage is unavailable. Download a private copy instead of starting a recoverable session.');}}
/** Account + room + tab identity prevent one account or concurrent tab from overwriting another queue. */
export class CollaborationSession {
 private key:string;private queue:CollaborationBatch[]=[];private serial:Promise<unknown>=Promise.resolve();private controller=new AbortController();private timer:ReturnType<typeof setTimeout>|undefined;private disposed=false;private listeners=new Set<()=>void>();private presence:{floorId?:string;selectionId?:string}={};
 private state:CollaborationSessionState={status:'connecting',snapshot:null,local:null,queued:0,error:'',busy:false};private consumers=0;private releaseTimer:ReturnType<typeof setTimeout>|undefined;
 constructor(readonly accountId:string,readonly roomId:string,readonly clientId:string,private transport:CollaborationTransport=collaborationApiForAccount(accountId),private storage:CollaborationQueueStore=collaborationQueueStore){this.key=JSON.stringify([accountId,roomId,clientId]);}
 getState=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private update(patch:Partial<CollaborationSessionState>){if(this.disposed)return;this.state={...this.state,...patch,queued:this.queue.length};this.listeners.forEach(f=>f());}
 private run<T>(action:()=>Promise<T>):Promise<T>{const result=this.serial.then(async()=>{if(this.disposed)throw new Error('This collaboration session is closed.');this.update({busy:true});try{return await action();}finally{this.update({busy:false});}});this.serial=result.catch(()=>{});return result;}
 private document(snapshot=this.state.snapshot,local=this.state.local,queue=this.queue):CollaborationQueue {if(!snapshot||!local)throw new Error('Room not loaded.');return {version:1,accountId:this.accountId,roomId:this.roomId,clientId:this.clientId,snapshot:{...snapshot,presence:[]},local,queue,savedAt:new Date().toISOString()};}
 private async persist(snapshot=this.state.snapshot,local=this.state.local,queue=this.queue){const doc=this.document(snapshot,local,queue);if(encodedBytes(doc)>COLLAB_LIMITS.queueBytes)throw new Error('This offline recovery exceeds 4 MB. Export a local copy.');try{await this.storage.save(this.key,doc);}catch{this.update({status:'storage-error',error:'Could not save the recovery queue on this device. Download a local copy before continuing.'});throw new Error(this.state.error);}}
 async start(){return this.run(async()=>{const cached=await this.storage.load(this.key);if(cached){if(cached.version!==1||cached.accountId!==this.accountId||cached.roomId!==this.roomId||cached.clientId!==this.clientId||cached.queue.length>COLLAB_LIMITS.queue||encodedBytes(cached)>COLLAB_LIMITS.queueBytes)throw new Error('Invalid local collaboration recovery.');validateCollaborationPlan(cached.local);validateCollaborationPlan(cached.snapshot.plan);this.queue=cached.queue.map(parseCollaborationBatch);this.update({snapshot:cached.snapshot,local:cached.local,status:'offline'});}await this.refreshInside(false);});}
 private report(error:unknown){if(this.disposed||this.controller.signal.aborted||this.state.status==='storage-error')return;const status=error instanceof CollaborationApiError?(error.status===409?'conflict':[401,403,404,410].includes(error.status)?'access-ended':'offline'):error instanceof Error&&error.name==='CollaborationConflict'?'conflict':'offline';this.update({status,error:error instanceof Error?error.message:'Connection interrupted. Your queued changes are retained.'});}
 private async refreshInside(send:boolean){try{
   const snapshot=await this.transport.snapshot(this.roomId,this.controller.signal,undefined,this.state.snapshot??undefined);if(this.disposed)return;
   if(this.state.snapshot?.revision===snapshot.revision&&canonical(this.state.snapshot.plan)===canonical(snapshot.plan))snapshot.plan=this.state.snapshot.plan;
   if(this.queue.length&&(snapshot.me.role==='viewer'||this.queue.some(b=>b.memberEpoch!==snapshot.me.epoch))){await this.persist(snapshot,this.state.local,this.queue);this.update({snapshot,status:'access-ended',error:'Your editing rights changed. Queued work is retained for a private recovery copy; it will not be sent under new permissions.'});return;}
   // Reconciliation never alters the recovery draft when any queued operation conflicts.
   let local=snapshot.plan;
   try{for(let i=0;i<this.queue.length;i++)local=await applyCollaborationBatch(local,snapshot.revision+i,this.queue[i]);}
   catch(error){await this.persist(snapshot,this.state.local,this.queue);this.update({snapshot,status:'conflict',error:error instanceof Error?error.message:'Review conflicting changes.'});return;}
   if(this.state.local&&canonical(this.state.local)===canonical(local))local=this.state.local;
   if(local!==this.state.local||!this.state.snapshot||snapshot.revision!==this.state.snapshot.revision||canonical(snapshot.me)!==canonical(this.state.snapshot.me)||snapshot.archived!==this.state.snapshot.archived)await this.persist(snapshot,local,this.queue);
   this.update({snapshot,local,status:snapshot.archived?'access-ended':'online',error:snapshot.archived?'This room is archived. Recover a local copy to keep working.':''});
   if(send&&this.queue.length&&!snapshot.archived&&snapshot.me.role!=='viewer')await this.flushInside();
  }catch(error){this.report(error);}}
 async refresh(){return this.run(()=>this.refreshInside(false));}
 async reconnect(){return this.run(async()=>{if(this.queue.length)await this.flushInside();else await this.refreshInside(false);});}
 async edit(base:PlanDocumentV1,next:PlanDocumentV1,label:string,options:{allowUnlock?:boolean}={}){return this.run(async()=>{
   const snapshot=this.state.snapshot;if(!snapshot||!this.state.local||canonical(base)!==canonical(this.state.local))throw new Error('The working layout changed. Review your edit again.');
   if(snapshot.archived||snapshot.me.role==='viewer'||['conflict','access-ended','storage-error'].includes(this.state.status))throw new Error('This session cannot accept edits. Export a local copy or resolve the conflict.');
   if(this.queue.length>=COLLAB_LIMITS.queue)throw new Error('The 10-edit offline queue is full. Reconnect or export a recovery copy.');
   const batch=await makeCollaborationBatch(base,next,snapshot.revision+this.queue.length,snapshot.me.epoch,label,undefined,options);if(!batch)return;
   const queue=[...this.queue,batch];await this.persist(snapshot,next,queue);if(this.disposed)return;this.queue=queue;this.update({local:structuredClone(next)});
   if(this.state.status==='online')await this.flushInside();
  });}
 private async flushInside(){while(this.queue.length&&!this.disposed){const batch=this.queue[0];try{
   await this.transport.submit(this.roomId,batch,this.controller.signal);if(this.disposed)return;
   // Acknowledged operations are removed durably before a new one is sent. A failed storage write leaves the idempotent retry in the queue.
   const rest=this.queue.slice(1);await this.persist(this.state.snapshot,this.state.local,rest);this.queue=rest;this.update({});
   await this.refreshInside(false);if(this.state.status!=='online')break;
  }catch(error){this.report(error);break;}}}
 /** Explicit loss acknowledgement is provided by the panel; remote state is never accepted implicitly on conflict. */
 async acceptLatest(){return this.run(async()=>{const snapshot=await this.transport.snapshot(this.roomId,this.controller.signal);await this.persist(snapshot,snapshot.plan,[]);this.queue=[];this.update({snapshot,local:snapshot.plan,status:snapshot.archived?'access-ended':'online',error:''});});}
 recovery(){if(!this.state.local)throw new Error('No local recovery is available.');return collaborationRecovery(this.roomId,this.state.snapshot,this.state.local,this.queue);}
 setPresence(value:{floorId?:string;selectionId?:string}){this.presence=value;}
 /** React Strict Mode can release and immediately reacquire the same mounted session. */
 retain(){this.consumers++;if(this.releaseTimer)clearTimeout(this.releaseTimer);this.startPolling();return()=>{this.consumers--;if(this.timer){clearTimeout(this.timer);this.timer=undefined;}this.releaseTimer=setTimeout(()=>{if(!this.consumers)this.dispose();},0);};}
 startPolling(interval=5000){if(this.timer||this.disposed)return;const tick=async()=>{this.timer=undefined;if(this.disposed)return;if(typeof document==='undefined'||document.visibilityState!=='hidden'){await this.refresh();if(this.state.status==='online')try{await this.transport.presence(this.roomId,this.presence,this.controller.signal);}catch{/* Presence is ephemeral; it must not turn a persisted edit into a failure. */}}if(!this.disposed)this.timer=setTimeout(tick,Math.max(3000,interval));};this.timer=setTimeout(tick,Math.max(3000,interval));}
 dispose(){if(this.disposed)return;this.disposed=true;if(this.timer)clearTimeout(this.timer);if(this.releaseTimer)clearTimeout(this.releaseTimer);this.controller.abort();this.listeners.clear();this.state={...this.state,status:'closed',busy:false};/* Finite TTL handles abrupt close; no unload network write. */}
}
