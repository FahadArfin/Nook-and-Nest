import {useEffect,useRef,useState} from 'react';
import {floorBoundaryWalls} from './floorGeometry';
import {floorFromRooms,roomGroups,type BlueprintDraft} from './blueprint';
import type {PlanDocumentV1} from './types';
import type {PlanReference} from './blueprintImport';
import {prepareOpeningEvidence,type OpeningEvidence} from './openingEvidence';
import {traceBoundary} from './doorBoundary';
import {traceMissing} from './missingFloor';
import {inspectRegions} from './regionReview';
import {applyMissingFloorRepair,applyBoundaryRepair} from './doorBoundaryCorrections';
import type {PixelRect} from './doorBoundaryGeometry';
import type {Span} from './openingReviewContract';
import type {ReviewOverlay} from './OpeningReview';
interface Props {base:PlanDocumentV1;floorId:string;draft:BlueprintDraft;reference:PlanReference;scale:number;span:Span;evidence?:OpeningEvidence;disabled:boolean;onOverlay:(items:ReviewOverlay[])=>void;onCommit:(draft:BlueprintDraft)=>void}
export function DoorBoundaryRepair({base,floorId,draft,reference,scale,span,evidence,disabled,onOverlay,onCommit}:Props){
  const [room,setRoom]=useState(''),[hall,setHall]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState<{draft:BlueprintDraft;area:number;added:number;note?:string}>();
  const abort=useRef<AbortController|undefined>(undefined),groups=roomGroups(draft.rooms);
  const signature=JSON.stringify([span,room,hall,confirmed,scale,disabled]);const latest=useRef({draft,reference,base,signature});latest.current={draft,reference,base,signature};
  useEffect(()=>setConfirmed(false),[span.ax,span.ay,span.bx,span.by,reference]);
  useEffect(()=>{abort.current?.abort();setBusy(false);setPreview(undefined);setMessage('');onOverlay([]);return()=>{abort.current?.abort();onOverlay([]);};},[draft,reference,base,signature,onOverlay]);
  const run=async(missing=false)=>{abort.current?.abort();const controller=new AbortController();abort.current=controller;const snapshot=latest.current;setBusy(true);setMessage('');setPreview(undefined);onOverlay([]);
    try{const a=groups.find(g=>g.id===room),b=groups.find(g=>g.id===hall);if(!a||!b||!confirmed)return;const source=evidence??await prepareOpeningEvidence(reference,controller.signal);controller.signal.throwIfAborted();
      const rect=(r:{x:number;z:number;width:number;depth:number}):PixelRect=>({x:r.x/scale,y:r.z/scale,width:r.width/scale,height:r.depth/scale});
      const input={...source,sourceWidth:reference.width,sourceHeight:reference.height,room:a.parts.map(rect),hall:b.parts.map(rect),door:span};
      let transferred:PixelRect[],added:PixelRect[]=[],note:string|undefined;
      if(missing){
        const candidates=await traceMissing({...input,all:draft.rooms.map(rect)},controller.signal);controller.signal.throwIfAborted();
        // Reject geometric conflicts before spending a model request; validate the selected subset again afterward.
        applyMissingFloorRepair(base,floorId,draft,room,hall,candidates.regions.filter(r=>r.added).flatMap(r=>r.rects),candidates.regions.filter(r=>!r.added).flatMap(r=>r.rects),span,scale);
        onOverlay(candidates.regions.flatMap((r,i)=>r.rects.map((rect,j)=>({rect,color:r.added?'#efa922':'#16898b',filled:true,number:j===0?i+1:undefined,label:`Candidate ${i+1}: ${r.added?'missing floor':'hall ownership'}`}))));
        setMessage('Luna is checking the numbered candidates against the original drawing…');
        const answer=await inspectRegions(reference,candidates.regions,[...input.room,...input.hall],span,a.name,b.name,controller.signal);controller.signal.throwIfAborted();
        if(answer.confidence!=='high'||!answer.selectedIds.length)throw new Error(`No repair proposed: ${answer.confidence} confidence. ${answer.note}`);
        const selected=candidates.regions.filter(r=>answer.selectedIds.includes(r.id));added=selected.filter(r=>r.added).flatMap(r=>r.rects);transferred=selected.filter(r=>!r.added).flatMap(r=>r.rects);note=answer.note;
        if(!added.length)throw new Error('Luna did not accept the missing connector. Trace it manually before changing ownership.');
      }else transferred=(await traceBoundary(input,controller.signal)).transferred;
      controller.signal.throwIfAborted();
      if(latest.current.draft!==snapshot.draft||latest.current.reference!==snapshot.reference||latest.current.base!==snapshot.base||latest.current.signature!==snapshot.signature)return;
      const next=missing?applyMissingFloorRepair(base,floorId,draft,room,hall,added,transferred,span,scale):applyBoundaryRepair(base,floorId,draft,room,hall,transferred,span,scale);
      const area=(parts:PixelRect[])=>parts.reduce((n,r)=>n+r.width*r.height,0)*scale*scale/1e6;
      setMessage('');setPreview({draft:next,area:area(transferred),added:area(added),note});
      const nextGroups=roomGroups(next.rooms),outlines=nextGroups.filter(g=>g.id===room||g.id===hall).map(g=>({outline:floorBoundaryWalls(floorFromRooms(base.floors.find(f=>f.id===floorId)!,base.gridSizeMm,g.parts),base.gridSizeMm).map(w=>({ax:w.ax*base.gridSizeMm/scale,ay:w.az*base.gridSizeMm/scale,bx:w.bx*base.gridSizeMm/scale,by:w.bz*base.gridSizeMm/scale})),color:g.id===room?'#16898b':'#8759a8',label:`Preview: ${g.name}`}));
      onOverlay([...outlines,...transferred.map(rect=>({rect,color:'#16898b',label:'Entry area transferred to room',filled:true})),...added.map(rect=>({rect,color:'#efa922',label:'New floor proposed',filled:true}))]);
    }catch(e){if(!controller.signal.aborted){setMessage((e as Error).message);onOverlay([]);}}finally{if(abort.current===controller)setBusy(false);}
  };
  return <fieldset className="bp-boundary-repair"><legend>Repair room around doorway</legend><p>Trace an entry recess into its room. Preview changes to both room shapes and the confirmed door together. The existing-floor trace is free; missing-floor review uses Luna.</p>
    <label>Room beyond doorway<select aria-label="Room beyond doorway" value={room} onChange={e=>setRoom(e.target.value)}><option value="">Choose receiving room</option>{groups.filter(g=>g.enclosed&&g.id!==hall).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label>Adjacent hall or space<select aria-label="Adjacent hall or space" value={hall} onChange={e=>setHall(e.target.value)}><option value="">Choose area to take from</option>{groups.filter(g=>g.id!==room).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked the closed doorway span against both jambs</label>
    <button disabled={disabled||busy||!confirmed||!room||!hall} onClick={()=>void run()}>Preview boundary repair · free</button>
    <button disabled={disabled||busy||!confirmed||!room||!hall} onClick={()=>void run(true)}>Find missing floor & ask Luna</button><small>One bounded Luna request, counted toward the daily limit. Identical reviews are reused in this session. Amber shows proposed new floor; nothing changes until Apply.</small>
    {busy&&<p role="status">Tracing source floor… <button onClick={()=>{abort.current?.abort();setBusy(false);setMessage('Repair canceled.');onOverlay([]);}}>Cancel repair</button></p>}
    {preview&&<><p role="status">Preview: move {preview.area.toFixed(2)} m² from {groups.find(g=>g.id===hall)?.name} to {groups.find(g=>g.id===room)?.name}. Teal marks the receiving room and transferred area; purple marks the remaining adjacent space. {preview.added?`Amber adds ${preview.added.toFixed(2)} m² of previously missing floor.`:'Total floor area stays the same.'}{preview.note&&<><br/>{preview.note}</>}</p><div className="bp-button-row"><button disabled={disabled||busy} onClick={()=>{onCommit(preview.draft);setPreview(undefined);onOverlay([]);setMessage('Door and both room shapes applied. Undo restores all three together.');}}>Apply door & room repair</button><button onClick={()=>{setPreview(undefined);onOverlay([]);}}>Discard repair</button></div></>}
    {message&&<p role="status">{message}</p>}<small>Missing-floor review considers enclosed gaps near this doorway. Ambiguous source walls, exterior-connected gaps or conflicting edits still need manual tracing.</small>
  </fieldset>;
}
