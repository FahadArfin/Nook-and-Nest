import {canonical,collaborationLayout,encodedBytes,reverseCollaborationEdit,validateCollaborationPlan} from './collaborationProtocol';
import type {CollaborationSession} from './collaborationSession';
import type {PlanDocumentV1} from './types';
import {assertLockedFurnitureUnchanged} from './furnitureGroups';
interface HistorySnapshot {plan:PlanDocumentV1;activeFloorId:string}
export interface CollaborationStoreState {plan:PlanDocumentV1;activeFloorId:string;past:HistorySnapshot[];future:HistorySnapshot[];selectedId?:string;selectedIds:string[];turnId?:string;turnSnapshot?:HistorySnapshot;placementNotice?:string;collaborationPending?:boolean}
export interface CollaborationStoreAdapter {read():CollaborationStoreState;apply(patch:Partial<CollaborationStoreState>&Record<string,unknown>):void}
interface OwnEdit {before:PlanDocumentV1;after:PlanDocumentV1;floorId:string}
const content=(p:PlanDocumentV1)=>canonical({...p,camera:undefined,updatedAt:undefined});
const sameLayout=(a:PlanDocumentV1,b:PlanDocumentV1)=>canonical(collaborationLayout(a))===canonical(collaborationLayout(b));
function stableVisualPlan(previous:PlanDocumentV1,next:PlanDocumentV1):PlanDocumentV1 {
 const retain=<T extends{id:string}>(old:T[],fresh:T[])=>{const byId=new Map(old.map(v=>[v.id,v]));const values=fresh.map(v=>{const prior=byId.get(v.id);return prior&&canonical(prior)===canonical(v)?prior:v;});return old.length===values.length&&old.every((v,i)=>v===values[i])?old:values;};
 return {...next,camera:previous.camera,floors:retain(previous.floors,next.floors),furniture:retain(previous.furniture,next.furniture),environment:canonical(previous.environment)===canonical(next.environment)?previous.environment:next.environment};
}

/** Store-bound arbitration. All ordinary editor writes pass through intercept; remote projections bypass it once. */
export class CollaborationStoreBridge {
 private interactionBlocked=false;
 setInteractionBlocked(value:boolean){this.interactionBlocked=value;}
 private closed=false;private pending=false;private owned:OwnEdit[]=[];private redoEdits:OwnEdit[]=[];private unsubscribe:()=>void;private lastLocal:PlanDocumentV1|null=null;private desiredFloor?:string;
 constructor(readonly session:CollaborationSession,private adapter:CollaborationStoreAdapter){
  if(!session.getState().local)throw new Error('Load the shared room before opening its editor.');
  this.unsubscribe=session.subscribe(()=>this.receive());this.receive(true);
 }
 private notice(error:unknown){if(!this.closed)this.adapter.apply({placementNotice:error instanceof Error?error.message:String(error)});}
 private canEdit(){const s=this.session.getState();if(this.closed||this.pending||s.busy||this.interactionBlocked)throw new Error('Finish the pending shared action before editing again.');if(s.snapshot?.archived||s.snapshot?.me.role==='viewer'||!s.local||!['online','offline'].includes(s.status))throw new Error('Editing is paused. Reconnect, resolve the conflict or continue as a private copy.');}
 assertProposal(before:PlanDocumentV1,next:PlanDocumentV1,options:{allowUnlock?:boolean}={}){this.canEdit();const current=this.session.getState().local!;if(before.id!==current.id||!sameLayout(before,current))throw new Error('Another editor changed the room during this action. Review the latest layout and try again.');validateCollaborationPlan(next);assertLockedFurnitureUnchanged(before,next,options);if(next.id!==current.id||next.name!==current.name||next.units!==current.units)throw new Error('Change project identity or units in a private copy.');
  const arch=(p:PlanDocumentV1)=>canonical({...collaborationLayout(p),furniture:undefined});if(arch(before)===arch(next)){const old=new Map(before.furniture.map(p=>[p.id,p])),now=new Map(next.furniture.map(p=>[p.id,p]));const changes=[...new Set([...old.keys(),...now.keys()])].filter(id=>canonical(old.get(id))!==canonical(now.get(id))).length;if(changes>32)throw new Error('A shared edit supports up to 32 changed pieces. Arrange fewer pieces or continue as a private copy.');}}
 private history(){return {past:this.owned.map(h=>({plan:h.before,activeFloorId:h.floorId})),future:this.redoEdits.map(h=>({plan:h.after,activeFloorId:h.floorId}))};}
 private receive(force=false){if(this.closed)return;const s=this.session.getState(),store=this.adapter.read();if(!s.local)return;
  if(store.turnId&&!force)return; // A held turn remains a local draft; finish rejects it if its base moved remotely.
  if(!force&&this.lastLocal===s.local)return;this.lastLocal=s.local;
  const floorId=s.local.floors.some(f=>f.id===this.desiredFloor)?this.desiredFloor!:s.local.floors.some(f=>f.id===store.activeFloorId)?store.activeFloorId:s.local.floors[0].id;
  const selectedIds=store.selectedIds.filter(id=>s.local!.furniture.some(p=>p.id===id&&p.floorId===floorId));
  this.adapter.apply({plan:stableVisualPlan(store.plan,s.local),activeFloorId:floorId,selectedIds,selectedId:selectedIds.includes(store.selectedId??'')?store.selectedId:selectedIds[0],selectedWallId:undefined,paintWallIds:[],plantingDraft:undefined,...this.history()});
 }
 /** Returns true when this bridge consumed a store patch; UI-only and camera changes return false. */
 intercept(patch:Partial<CollaborationStoreState>&Record<string,unknown>):boolean {
  const state=this.adapter.read();if(this.closed)return false;
  try{
   if(patch.turnId&&patch.turnId!==state.turnId){this.canEdit();return false;}
   const finishing=state.turnId&&Object.prototype.hasOwnProperty.call(patch,'turnId')&&patch.turnId===undefined;
   if(finishing){const base=state.turnSnapshot?.plan;this.adapter.apply({turnId:undefined,turnSnapshot:undefined});if(base&&content(base)!==content(state.plan))this.schedule(base,state.plan,{...patch,plan:state.plan},false);else this.receive();return true;}
   if(!patch.plan||patch.plan===state.plan)return false;
   if(patch.plan.id!==state.plan.id)throw new Error('Leave collaboration before opening another project. Your queued work will be retained.');
   if(content(patch.plan)===content(state.plan)){
    // Camera changes are personal and do not create remote operations or undo snapshots.
    this.adapter.apply({...patch,past:state.past,future:state.future});return true;
   }
   this.canEdit();
   if(state.turnId){validateCollaborationPlan(patch.plan);return false;}
   this.schedule(state.plan,patch.plan,patch,!!patch.collaborationAllowUnlock);return true;
  }catch(error){if(state.turnId||Object.prototype.hasOwnProperty.call(patch,'turnId')){this.adapter.apply({turnId:undefined,turnSnapshot:undefined});this.receive(true);}this.notice(error);return true;}
 }
 private schedule(before:PlanDocumentV1,next:PlanDocumentV1,patch:Partial<CollaborationStoreState>&Record<string,unknown>,allowUnlock:boolean,historyMode:'edit'|'undo'|'redo'='edit',record?:OwnEdit){
  this.assertProposal(before,next,{allowUnlock});const current=this.session.getState().local!;
  // No private fields are silently stripped. Unsupported features explain the private-copy path.
  validateCollaborationPlan(next);if(next.name!==current.name||next.units!==current.units)throw new Error('Rename or change display units in a private copy.');
  this.pending=true;this.desiredFloor=patch.activeFloorId??this.adapter.read().activeFloorId;this.adapter.apply({collaborationPending:true,placementNotice:'Saving this shared edit on this device…'});
  const authored={before:current,after:{...next,camera:current.camera},floorId:this.desiredFloor};
  void this.session.edit(current,authored.after,historyMode==='edit'?'Arrange shared layout':historyMode==='undo'?'Undo my edit':'Redo my edit',{allowUnlock}).then(()=>{
   if(this.closed)return;if(historyMode==='edit'){this.owned.push(authored);this.redoEdits=[];}else if(historyMode==='undo'){this.owned.pop();this.redoEdits.unshift(record!);}else{this.redoEdits.shift();this.owned.push(record!);}
   while(this.owned.length>10||encodedBytes(this.owned)>4_000_000)this.owned.shift();while(this.redoEdits.length>10||encodedBytes(this.redoEdits)>4_000_000)this.redoEdits.pop();
   const latest=this.adapter.read(),ui:Record<string,unknown>={};for(const key of ['tool','selectedWallId','wallSelectionActive','paintWallIds','wallBrushActive','plantingDraft'])if(key in patch)ui[key]=patch[key];
   if('selectedId' in patch){const selected=patch.selectedId&&latest.plan.furniture.some(p=>p.id===patch.selectedId)?patch.selectedId:undefined;ui.selectedId=selected;ui.selectedIds=selected?(patch.selectedIds??[selected]).filter(id=>latest.plan.furniture.some(p=>p.id===id)):[];}
   this.adapter.apply({...ui,...this.history(),placementNotice:this.session.getState().error||undefined});
  }).catch(error=>{if(!this.closed){this.receive(true);this.notice(error);}}).finally(()=>{if(!this.closed){this.pending=false;this.desiredFloor=undefined;this.adapter.apply({collaborationPending:false});this.receive();}});
 }
 undo(redo=false){try{this.canEdit();const entry=redo?this.redoEdits[0]:this.owned.at(-1);if(!entry)return;const base=this.session.getState().local!;this.pending=true;this.adapter.apply({collaborationPending:true});
  void reverseCollaborationEdit(redo?entry.after:entry.before,redo?entry.before:entry.after,base).then(next=>{this.pending=false;if(this.closed)return;if(this.session.getState().local!==base)throw new Error('The shared room changed while preparing Undo. Try again.');this.schedule(base,next,{activeFloorId:entry.floorId},true,redo?'redo':'undo',entry);}).catch(e=>{this.pending=false;if(!this.closed){this.adapter.apply({collaborationPending:false});this.notice(e);}});
 }catch(e){this.notice(e);}}
 close(){if(this.closed)return;this.closed=true;this.unsubscribe();this.session.dispose();this.adapter.apply({collaborationPending:false,turnId:undefined,turnSnapshot:undefined,past:[],future:[]});}
}
