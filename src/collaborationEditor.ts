import type {CollaborationSession,CollaborationSessionState} from './collaborationSession';
import type {PlanDocumentV1} from './types';
import type {CameraShotPose} from './walkthrough';

export interface PrivateEditorReturn {
 plan:PlanDocumentV1;activeFloorId:string;view?:CameraShotPose;
 past:Array<{plan:PlanDocumentV1;activeFloorId:string}>;future:Array<{plan:PlanDocumentV1;activeFloorId:string}>;
 selectedId?:string;selectedIds:string[];
}
export interface CollaborationEditorAdapter {
 read():PrivateEditorReturn;
 save(plan:PlanDocumentV1,options?:{activate?:boolean}):Promise<void>;
 connect(session:CollaborationSession):()=>void;
 restore(snapshot:PrivateEditorReturn):void;
 copy(source:PlanDocumentV1):PlanDocumentV1;
 changed(session?:CollaborationSession):void;
}
/** Private project return point and shared queue have separate lifetimes and storage identities. */
export class CollaborationEditor {
 private entry?:{session:CollaborationSession;original:PrivateEditorReturn;detach:()=>void};
 private disposed=false;private working=false;
 constructor(private adapter:CollaborationEditorAdapter){}
 get session(){return this.entry?.session;}
 get busy(){return this.working;}
 async open(session:CollaborationSession){
  if(this.disposed||this.working||this.entry)throw new Error('Finish the current session before opening another shared room.');
  if(!session.getState().local)throw new Error('Load the shared room before opening its editor.');
  const original=this.adapter.read();this.working=true;
  try{
   await this.adapter.save(original.plan);
   if(this.disposed)throw new Error('The editor closed while saving. Your private project is safe.');
   const current=this.adapter.read();
   if(current.plan!==original.plan||current.activeFloorId!==original.activeFloorId)throw new Error('The private project changed while saving. Review it before opening the shared room.');
   const detach=this.adapter.connect(session);this.entry={session,original,detach};this.adapter.changed(session);
  }finally{this.working=false;}
 }
 private finish(next:PrivateEditorReturn,notify=true){
  const entry=this.entry;if(!entry)return;this.entry=undefined;entry.detach();this.adapter.restore(next);if(notify)this.adapter.changed();
 }
 leave(){
  if(this.working||this.entry?.session.getState().busy)throw new Error('Wait for the current shared action to finish before leaving.');
  if(this.entry)this.finish(this.entry.original);
 }
 async privateCopy(source:PlanDocumentV1){
  const entry=this.entry;if(!entry||this.disposed||this.working)throw new Error('This shared editor is not ready to make a private copy.');
  const current=this.adapter.read(),next=this.adapter.copy({...source,camera:current.plan.camera});if(next.id===entry.session.roomId||next.id===entry.original.plan.id)throw new Error('A private copy needs its own project identity.');
  this.working=true;
  try{
   // Keep the original active project during the asynchronous save. Even a forced unmount
   // leaves a recoverable independent copy without changing the user's return project.
   await this.adapter.save(next,{activate:false});
   if(this.disposed||this.entry!==entry)throw new Error('The editor closed. The private copy is saved in Your projects.');
   const activeFloorId=next.floors.some(f=>f.id===current.activeFloorId)?current.activeFloorId:next.floors[0].id;
   this.finish({plan:next,activeFloorId,view:current.view?.floorId===activeFloorId?current.view:undefined,past:[],future:[],selectedIds:[]});
  }finally{this.working=false;}
 }
 /** Unmount/navigation restoration is synchronous; queued writes cannot replace the restored project. */
 dispose(){if(this.disposed)return;this.disposed=true;if(this.entry)this.finish(this.entry.original,false);}
}
export function collaborationEditable(state:CollaborationSessionState|null):boolean {
 return !state||!!state.local&&!state.busy&&!state.snapshot?.archived&&state.snapshot?.me.role!=='viewer'&&['online','offline'].includes(state.status);
}
