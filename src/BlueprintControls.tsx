import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, GridFour, Sparkle, X } from '@phosphor-icons/react';
import { BlueprintStudio } from './BlueprintStudio';
import { autoFurnish, draftFromFloor } from './blueprint';
import { usePlanner } from './store';
import type { PlanDocumentV1 } from './types';

export function BlueprintControls({busy,onPreview,onBusy,onCreated}:{busy:boolean;onPreview:(plan?:PlanDocumentV1)=>void;onBusy:(busy:boolean)=>void;onCreated?:()=>void}) {
  const state=usePlanner(),[open,setOpen]=useState(false),[error,setError]=useState('');
  const [proposal,setProposal]=useState<ReturnType<typeof autoFurnish>&{base:PlanDocumentV1;floorId:string}>();
  useEffect(()=>{onBusy(open||!!proposal);return()=>onBusy(false);},[open,proposal,onBusy]);
  useEffect(()=>{if(proposal&&(state.plan!==proposal.base||state.activeFloorId!==proposal.floorId)){setProposal(undefined);onPreview(undefined);setError('The floor changed. Generate a fresh furnishing preview.');}},[state.plan,state.activeFloorId,proposal,onPreview]);
  const cancel=()=>{setProposal(undefined);onPreview(undefined);};
  const generate=()=>{
    setError('');
    try {
      const rooms=draftFromFloor(state.plan,state.activeFloorId).rooms;
      if(!rooms.some(r=>['Living','Bedroom','Dining','Office','Kitchen','Bathroom','Laundry','Outdoor'].includes(r.kind))){setError('Open Floor plan and choose room types first.');return;}
      const result=autoFurnish(state.plan,state.activeFloorId,rooms);
      if(!result.added.length){setError(result.skipped.length?'No furniture fits the available clear space. Adjust room types or move existing pieces.':'These rooms already have their suggested furniture.');return;}
      setProposal({...result,base:state.plan,floorId:state.activeFloorId});onPreview(result.plan);
    }catch(e){setError((e as Error).message);}
  };
  return <>
    <button disabled={busy||!!proposal} onClick={()=>{setError('');setOpen(true);}}><GridFour/> Floor plan</button>
    <button disabled={busy||open||!!proposal} onClick={generate}><Sparkle/> Auto furnish</button>
    {open&&createPortal(<BlueprintStudio onClose={()=>setOpen(false)} onCreated={onCreated}/>,document.body)}
    {proposal&&createPortal(<div className="bp-arrangement-shield"><section className="bp-arrangement" role="dialog" aria-label="Review automatic furnishing" onKeyDown={e=>e.stopPropagation()}><div><span className="eyebrow">Unsaved 3D preview</span><h2>{proposal.added.length} library pieces, ready to review</h2></div>{proposal.skipped.length>0&&<details><summary>{proposal.skipped.length} pieces left out because of limited space</summary><ul>{proposal.skipped.map((s,i)=><li key={i}>{s}</li>)}</ul></details>}<div className="bp-button-row"><button className="primary" onClick={()=>{try{usePlanner.getState().commitDesign(proposal.base,proposal.plan);cancel();}catch(e){setError((e as Error).message);}}}><Check/> Apply furnishing · one undo</button><button onClick={cancel}><X/> Discard preview</button></div></section></div>,document.body)}
    {error&&createPortal(<div className="bp-controls-notice" role="alert">{error}<button aria-label="Dismiss floor plan notice" onClick={()=>setError('')}><X/></button></div>,document.body)}
  </>;
}
