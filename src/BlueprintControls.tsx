import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GridFour, Sparkle, X } from '@phosphor-icons/react';
import { BlueprintStudio } from './BlueprintStudio';
import { autoFurnish, draftFromFloor } from './blueprint';
import { usePlanner } from './store';
import type { PlanDocumentV1 } from './types';

export function BlueprintControls({busy,onPreview,onBusy,onCreated,onHome}:{onHome?:()=>void;busy:boolean;onPreview:(plan?:PlanDocumentV1)=>void;onBusy:(busy:boolean)=>void;onCreated?:()=>void}) {
  const state=usePlanner(),[open,setOpen]=useState(false),[error,setError]=useState('');
  useEffect(()=>{onBusy(open);return()=>onBusy(false);},[open,onBusy]);
  const generate=()=>{
    setError('');
    try {
      const rooms=draftFromFloor(state.plan,state.activeFloorId).rooms;
      if(!rooms.some(r=>['Living','Bedroom','Dining','Office','Kitchen','Bathroom','Laundry','Outdoor'].includes(r.kind))){setError('Open Floor plan and choose room types first.');return;}
      const result=autoFurnish(state.plan,state.activeFloorId,rooms);
      if(!result.added.length){setError(result.skipped.length?'No furniture fits the available clear space. Adjust room types or move existing pieces.':'These rooms already have their suggested furniture.');return;}
      usePlanner.getState().commitDesign(state.plan,result.plan);onPreview(undefined);
    }catch(e){setError((e as Error).message);}
  };
  return <>
    <button disabled={busy} onClick={()=>{setError('');setOpen(true);}}><GridFour/> Floor plan</button>
    <button disabled={busy||open} onClick={generate}><Sparkle/> Quick layout</button>
    {open&&createPortal(<BlueprintStudio onHome={onHome} onClose={()=>setOpen(false)} onCreated={onCreated}/>,document.body)}
    {error&&createPortal(<div className="bp-controls-notice" role="alert">{error}<button aria-label="Dismiss floor plan notice" onClick={()=>setError('')}><X/></button></div>,document.body)}
  </>;
}
