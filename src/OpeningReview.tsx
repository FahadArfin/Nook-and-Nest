import {DoorBoundaryRepair} from './DoorBoundaryRepair';
import {useEffect,useRef,useState} from 'react';
import {blueprintPlan,combineBlueprintRooms,roomGroups,type BlueprintDraft} from './blueprint';
import type {PlanDocumentV1} from './types';
import type {PlanReference} from './blueprintImport';
import {prepareOpeningEvidence,inspectOpening,type OpeningEvidence} from './openingEvidence';
import {spanChoices} from './openingGeometry';
import {applyReviewedOpening,splitRoomLabel} from './openingCorrections';
import type {OpeningAnswer,Span} from './openingReviewContract';

export interface ReviewOverlay {span?:Span;outline?:Span[];rect?:import('./doorBoundaryGeometry').PixelRect;filled?:boolean;number?:number;color:string;label:string}
interface Props {base:PlanDocumentV1;floorId:string;draft:BlueprintDraft;reference:PlanReference;scale:number;span?:Span;disabled:boolean;onSpan:(span:Span|undefined)=>void;onOverlay:(lines:ReviewOverlay[])=>void;onDraw:()=>void;onCommit:(draft:BlueprintDraft)=>void}
export function OpeningReview({base,floorId,draft,reference,scale,span,disabled,onSpan,onOverlay,onDraw,onCommit}:Props){
  const [evidence,setEvidence]=useState<OpeningEvidence>(),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[answer,setAnswer]=useState<OpeningAnswer>(),[choice,setChoice]=useState(0),[kind,setKind]=useState<'door'|'window'|'open'>('door');
  const [first,setFirst]=useState(''),[second,setSecond]=useState(''),[axis,setAxis]=useState<'h'|'v'>('v'),[percent,setPercent]=useState(50),[tab,setTab]=useState<'doors'|'rooms'>('doors');
  const [repairOverlay,setRepairOverlay]=useState<ReviewOverlay[]>([]);
  const abort=useRef<AbortController|undefined>(undefined),latest=useRef({draft,reference,span});latest.current={draft,reference,span};
  const groups=roomGroups(draft.rooms),choices=span?spanChoices(span,reference.width,reference.height):[],active=choices[choice]??choices[0],room=groups.find(r=>r.id===first);
  const split:Span|undefined=room?(axis==='v'?{ax:(room.x+room.width*percent/100)/scale,bx:(room.x+room.width*percent/100)/scale,ay:room.z/scale,by:(room.z+room.depth)/scale}:{ax:room.x/scale,bx:(room.x+room.width)/scale,ay:(room.z+room.depth*percent/100)/scale,by:(room.z+room.depth*percent/100)/scale}):undefined;
  useEffect(()=>{abort.current?.abort();setBusy('');setEvidence(undefined);setAnswer(undefined);setMessage('');onSpan(undefined);return()=>abort.current?.abort();},[reference]);
  useEffect(()=>{abort.current?.abort();setBusy('');setAnswer(undefined);setChoice(0);},[draft,span]);
  useEffect(()=>{onOverlay(tab==='rooms'?(split?[{span:split,color:'#16898b',label:'Label split — no wall'}]:[]):active?[{span:active,color:'#c35435',label:`Doorway candidate ${choice+1}`},...repairOverlay]:[]);},[span,choice,tab,first,axis,percent,draft,scale,repairOverlay]);
  const run=async(local:boolean)=>{
    abort.current?.abort();const controller=new AbortController();abort.current=controller;const snapshot=latest.current;
    setBusy(local?'Checking source walls…':'Luna is inspecting this close-up…');setMessage('');setAnswer(undefined);
    try{if(local){const result=await prepareOpeningEvidence(reference,controller.signal);controller.signal.throwIfAborted();setEvidence(result);setMessage(`${result.gaps.length} possible gaps found. These can include windows and gaps in print.`);}
      else {if(!choices.length)return;const result=await inspectOpening(reference,choices,controller.signal);controller.signal.throwIfAborted();if(latest.current.draft!==snapshot.draft||latest.current.reference!==snapshot.reference||latest.current.span!==snapshot.span)return;setAnswer(result);const index=choices.findIndex(c=>c.id===result.choiceId);if(index>=0)setChoice(index);if(['door','window','open'].includes(result.kind))setKind(result.kind as typeof kind);}}
    catch(e){if(!controller.signal.aborted)setMessage((e as Error).message);}finally{if(abort.current===controller)setBusy('');}
  };
  const change=(fn:()=>BlueprintDraft)=>{try{const next=fn();blueprintPlan(base,floorId,next);onCommit(next);setMessage('Correction applied to the draft. Undo restores the previous drawing.');}catch(e){setMessage((e as Error).message);}};
  const leaking=groups.filter(r=>{if(!evidence)return false;const p=r.parts.reduce((a,b)=>a.width*a.depth>b.width*b.depth?a:b),x=Math.floor((p.x+p.width/2)/scale/reference.width*evidence.width),y=Math.floor((p.z+p.depth/2)/scale/reference.height*evidence.height);return x>=0&&y>=0&&x<evidence.width&&y<evidence.height&&evidence.outside[y*evidence.width+x];});
  return <details className="bp-opening-review"><summary>Check walls & openings · experimental</summary><p>Inspect the source, then apply one correction at a time. Red is a doorway preview; teal splits labels without adding a wall.</p>
    <div className="bp-button-row"><button aria-pressed={tab==='doors'} onClick={()=>setTab('doors')}>Openings</button><button aria-pressed={tab==='rooms'} onClick={()=>setTab('rooms')}>Room labels</button></div>
    {tab==='doors'?<>
      <button disabled={!!busy||disabled} onClick={()=>void run(true)}>Check source enclosure · free</button>
      {evidence&&<><p>{leaking.length?`${leaking.length} room centers connect to the image edge: ${leaking.slice(0,8).map(r=>r.name).join(', ')}.`:'No sampled room center reaches the image edge.'} This checks the source ink only. Open entrances and thin lines can cause leaks; it does not prove the layout is correct.</p><label>Possible gap<select value={span?evidence.gaps.indexOf(span):-1} onChange={e=>{onSpan(evidence.gaps[Number(e.target.value)]);setChoice(0);}}><option value={-1}>Choose a gap or draw a span</option>{evidence.gaps.map((g,i)=><option key={i} value={i}>Gap {i+1} · {Math.round(g.ax)}, {Math.round(g.ay)}</option>)}</select></label></>}
      <button disabled={disabled||!!busy} onClick={onDraw}>Draw doorway span on image</button>
      {active&&<><label>Doorway orientation<select value={choice} onChange={e=>{setChoice(Number(e.target.value));setAnswer(undefined);}}>{choices.map((c,i)=><option key={c.id} value={i}>{i===0?'Original span':`Rotate around jamb · ${i}`}</option>)}</select></label><button disabled={disabled||!!busy} onClick={()=>void run(false)}>Inspect close-up with Luna</button><small>One bounded Luna request; counts toward the daily analysis limit. Identical close-ups are reused in this session.</small>
      {answer&&<p role="status"><strong>{answer.kind} · {answer.confidence} confidence{answer.choiceId==='none'?' · no candidate accepted':''}</strong><br/>{answer.note}</p>}
      <label>Apply as<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="door">Door</option><option value="window">Window</option><option value="open">Open entrance</option></select></label><button disabled={disabled||!!busy} onClick={()=>change(()=>applyReviewedOpening(base,floorId,draft,active,scale,kind))}>Apply selected opening</button><small>Confirm the red span against the image. A matching wall is required; uncertain suggestions are never applied automatically.</small><DoorBoundaryRepair base={base} floorId={floorId} draft={draft} reference={reference} scale={scale} span={active} evidence={evidence} disabled={disabled||!!busy} onOverlay={setRepairOverlay} onCommit={onCommit}/></>}
    </>:<>
      <label>Room<select value={first} onChange={e=>setFirst(e.target.value)}><option value="">Choose a room</option>{groups.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label>Join with<select value={second} onChange={e=>setSecond(e.target.value)}><option value="">Choose an adjoining room</option>{groups.filter(r=>r.id!==first).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button disabled={disabled||!first||!second} onClick={()=>change(()=>combineBlueprintRooms(draft,first,second,base.gridSizeMm))}>Apply join spaces</button><small>Joins region labels while preserving physical walls and openings. Use when these regions belong to one room.</small>
      <label>Label split direction<select value={axis} onChange={e=>setAxis(e.target.value as typeof axis)}><option value="v">Vertical</option><option value="h">Horizontal</option></select></label><label>Split position · {percent}%<input type="range" min={5} max={95} value={percent} onChange={e=>setPercent(Number(e.target.value))}/></label><button disabled={disabled||!room} onClick={()=>change(()=>splitRoomLabel(base,floorId,draft,first,axis,percent/100))}>Apply label split here</button><small>Keeps the floor area and adds no physical wall. Rename the new area in Edit room.</small>
    </>}
    {busy&&<div role="status">{busy}<button onClick={()=>{abort.current?.abort();setBusy('');}}>Cancel check</button></div>}{message&&<p role="status">{message}</p>}
  </details>;
}
