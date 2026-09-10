import {useEffect,useRef,useState} from 'react';
import {roomGroups,type BlueprintDraft} from './blueprint';
import type {PlanDocumentV1} from './types';
import type {PlanReference} from './blueprintImport';
import {prepareOpeningEvidence,type OpeningEvidence} from './openingEvidence';
import {traceBoundary} from './doorBoundary';
import {applyBoundaryRepair} from './doorBoundaryCorrections';
import type {PixelRect} from './doorBoundaryGeometry';
import type {Span} from './openingReviewContract';
import type {ReviewOverlay} from './OpeningReview';
interface Props {base:PlanDocumentV1;floorId:string;draft:BlueprintDraft;reference:PlanReference;scale:number;span:Span;evidence?:OpeningEvidence;disabled:boolean;onOverlay:(items:ReviewOverlay[])=>void;onCommit:(draft:BlueprintDraft)=>void}
export function DoorBoundaryRepair({base,floorId,draft,reference,scale,span,evidence,disabled,onOverlay,onCommit}:Props){
  const [room,setRoom]=useState(''),[hall,setHall]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState<{draft:BlueprintDraft;area:number}>();
  const abort=useRef<AbortController|undefined>(undefined),groups=roomGroups(draft.rooms);
  const signature=JSON.stringify([span,room,hall,confirmed,scale,disabled]);const latest=useRef({draft,reference,base,signature});latest.current={draft,reference,base,signature};
  useEffect(()=>setConfirmed(false),[span.ax,span.ay,span.bx,span.by,reference]);
  useEffect(()=>{abort.current?.abort();setBusy(false);setPreview(undefined);setMessage('');onOverlay([]);return()=>{abort.current?.abort();onOverlay([]);};},[draft,reference,base,signature,onOverlay]);
  const run=async()=>{abort.current?.abort();const controller=new AbortController();abort.current=controller;const snapshot=latest.current;setBusy(true);setMessage('');setPreview(undefined);onOverlay([]);
    try{const a=groups.find(g=>g.id===room),b=groups.find(g=>g.id===hall);if(!a||!b||!confirmed)return;const source=evidence??await prepareOpeningEvidence(reference,controller.signal);controller.signal.throwIfAborted();
      const rect=(r:{x:number;z:number;width:number;depth:number}):PixelRect=>({x:r.x/scale,y:r.z/scale,width:r.width/scale,height:r.depth/scale});
      const result=await traceBoundary({...source,sourceWidth:reference.width,sourceHeight:reference.height,room:a.parts.map(rect),hall:b.parts.map(rect),door:span},controller.signal);controller.signal.throwIfAborted();
      if(latest.current.draft!==snapshot.draft||latest.current.reference!==snapshot.reference||latest.current.base!==snapshot.base||latest.current.signature!==snapshot.signature)return;
      const next=applyBoundaryRepair(base,floorId,draft,room,hall,result.transferred,span,scale);setPreview({draft:next,area:result.pixels*scale*scale/1e6});
      const nextGroups=roomGroups(next.rooms),outlines=nextGroups.filter(g=>g.id===room||g.id===hall).flatMap(g=>g.parts.map(p=>({rect:rect(p),color:g.id===room?'#16898b':'#8759a8',label:`Preview: ${g.name}`})));
      onOverlay([...outlines,...result.transferred.map(rect=>({rect,color:'#16898b',label:'Entry area transferred to room',filled:true}))]);
    }catch(e){if(!controller.signal.aborted)setMessage((e as Error).message);}finally{if(abort.current===controller)setBusy(false);}
  };
  return <fieldset className="bp-boundary-repair"><legend>Repair room around doorway</legend><p>Trace an entry recess into its room. This changes the two selected room shapes and adds the confirmed door together. No API charge.</p>
    <label>Room beyond doorway<select aria-label="Room beyond doorway" value={room} onChange={e=>setRoom(e.target.value)}><option value="">Choose receiving room</option>{groups.filter(g=>g.enclosed&&g.id!==hall).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label>Adjacent hall or space<select aria-label="Adjacent hall or space" value={hall} onChange={e=>setHall(e.target.value)}><option value="">Choose area to take from</option>{groups.filter(g=>g.id!==room).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked the closed doorway span against both jambs</label>
    <button disabled={disabled||busy||!confirmed||!room||!hall} onClick={()=>void run()}>Preview boundary repair · free</button>
    {busy&&<p role="status">Tracing source floor… <button onClick={()=>{abort.current?.abort();setBusy(false);}}>Cancel repair</button></p>}
    {preview&&<><p role="status">Preview: move {preview.area.toFixed(2)} m² from {groups.find(g=>g.id===hall)?.name} to {groups.find(g=>g.id===room)?.name}. Teal marks the receiving room and transferred area; purple marks the remaining adjacent space. Total floor area stays the same.</p><div className="bp-button-row"><button disabled={disabled||busy} onClick={()=>{onCommit(preview.draft);setPreview(undefined);onOverlay([]);setMessage('Door and both room shapes applied. Undo restores all three together.');}}>Apply door & room repair</button><button onClick={()=>{setPreview(undefined);onOverlay([]);}}>Discard repair</button></div></>}
    {message&&<p role="status">{message}</p>}<small>Works on existing connected floor areas. Missing floor, ambiguous source walls or conflicting edits need manual correction first.</small>
  </fieldset>;
}
