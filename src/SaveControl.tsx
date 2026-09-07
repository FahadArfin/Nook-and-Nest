import {useCallback, useEffect, useRef, useState} from 'react';
import {Check, CloudArrowUp, DownloadSimple, FloppyDisk, WarningCircle} from '@phosphor-icons/react';
import {savePlan} from './store';
import {serializePlan} from './domain';
import type {PlanDocumentV1} from './types';
import './save-control.css';

export function SaveControl({plan, onProjects, enabled=true, persist=savePlan}: {plan:PlanDocumentV1; onProjects():void; enabled?:boolean; persist?:typeof savePlan}) {
  const [result,setResult]=useState<{plan:PlanDocumentV1; time:number; failed?:boolean}>();
  const [busy,setBusy]=useState(false);
  const menu=useRef<HTMLDetailsElement>(null), timer=useRef<ReturnType<typeof setTimeout>>(undefined), generation=useRef(0);
  const latest=useRef(plan); latest.current=plan;
  const save=useCallback(async()=>{
    clearTimeout(timer.current);
    const snapshot=latest.current, request=++generation.current;
    setBusy(true);
    try { await persist(snapshot); if(request===generation.current)setResult({plan:snapshot,time:Date.now()}); }
    catch { if(request===generation.current)setResult({plan:snapshot,time:Date.now(),failed:true}); }
    finally {if(request===generation.current)setBusy(false);}
  },[persist]);
  useEffect(()=>{
    if(!enabled)return;
    timer.current=setTimeout(()=>void save(),450);
    return()=>{clearTimeout(timer.current); generation.current++;};
  },[plan,enabled,save]);
  const failed=result?.plan===plan&&result.failed;
  const saved=result?.plan===plan&&!result.failed&&!busy;
  useEffect(()=>{
    if(!enabled||saved)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[saved,enabled]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))menu.current?.removeAttribute('open');};
    const shortcut=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(enabled)void save();}
      if(event.key==='Escape')menu.current?.removeAttribute('open');
    };
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',shortcut);
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',shortcut);};
  },[save,enabled]);
  const backup=()=>{
    const url=URL.createObjectURL(new Blob([serializePlan(plan)],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`${plan.name}.nook.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const label=!enabled?'Preview · not saved':failed?'Save failed · retry':saved?'Autosaved on this device':'Saving on this device…';
  return <div className={`save-control${failed?' save-failed':''}`}>
    <details ref={menu}>
      <summary><FloppyDisk size={19} weight="bold"/> Save <span aria-hidden="true">⌄</span></summary>
      <div className="save-popover">
        <strong>Keep your nest safe</strong>
        <p>Changes autosave on this device. Save an online copy to access it on another device.</p>
        <button disabled={!enabled||busy} onClick={()=>void save()}><FloppyDisk/> {failed?'Retry saving':'Save now on this device'} <kbd>⌘ / Ctrl S</kbd></button>
        <button onClick={()=>{menu.current?.removeAttribute('open');onProjects();}}><CloudArrowUp/> Save online / your projects</button>
        <button onClick={backup}><DownloadSimple/> Download backup</button>
        {saved&&<small>Last saved at {new Date(result!.time).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}. Unconfirmed placement previews are not saved.</small>}
        {failed&&<p role="alert">Device storage could not save this change. Retry or download a backup.</p>}
      </div>
    </details>
    <span className="save-status" role="status" aria-live="polite">{failed?<WarningCircle/>:saved?<Check weight="bold"/>:<FloppyDisk/>}{label}</span>
  </div>;
}
