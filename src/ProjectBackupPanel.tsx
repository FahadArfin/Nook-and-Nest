import {useRef,useState} from 'react';
import {backupNotices,buildProjectBackup,MAX_PROJECT_BACKUP_BYTES,parseProjectBackup,restoreProjectBackup,type ProjectBackup} from './projectBackup';
import type {ListingDocument} from './listingTypes';
import type {PlanDocumentV1} from './types';
import './projectBackup.css';

export interface ProjectBackupPanelProps {
  plan?:PlanDocumentV1;listing?:ListingDocument;disabled?:boolean;
  beforeRestore?():Promise<void>;
  onBusyChange?(busy:boolean):void;
  onRestored(plan:PlanDocumentV1):void|Promise<void>;
}
/** Embedded in the existing project dialog; intentionally does not create a nested dialog. */
export function ProjectBackupPanel({plan,listing,disabled=false,beforeRestore,onBusyChange,onRestored}:ProjectBackupPanelProps){
  const input=useRef<HTMLInputElement>(null),operation=useRef(false);
  const [includeReferences,setIncludeReferences]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState<ProjectBackup>();
  const [notices,setNotices]=useState<string[]>([]);
  const run=async(fn:()=>Promise<void>)=>{if(operation.current)return;operation.current=true;setBusy(true);onBusyChange?.(true);setError('');setMessage('');try{await fn()}catch(e){setError(e instanceof Error?e.message:'The backup could not be completed. Your current project is unchanged.')}finally{operation.current=false;setBusy(false);onBusyChange?.(false)}};
  const download=()=>run(async()=>{if(!plan)return;const backup=await buildProjectBackup(plan,{listing,includeReferences});const blob=new Blob([JSON.stringify(backup)],{type:'application/json'}),url=URL.createObjectURL(blob);try{const a=document.createElement('a');a.href=url;a.download=`${plan.name.replace(/[^a-z0-9-]+/gi,'-').slice(0,60)||'home'}.nook-backup.json`;a.click();setNotices(backupNotices(backup));setMessage('Backup download prepared. Keep the downloaded file somewhere safe.')}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}});
  const choose=(file:File)=>run(async()=>{setPending(undefined);setNotices([]);if(file.size>MAX_PROJECT_BACKUP_BYTES)throw new Error('Choose a complete backup smaller than 160 MB.');const backup=parseProjectBackup(await file.text());setPending(backup);setNotices(backupNotices(backup));});
  const restore=()=>run(async()=>{if(!pending)return;await beforeRestore?.();const next=await restoreProjectBackup(pending);setPending(undefined);setMessage(`“${next.name}” was saved as a new local project.`);try{await onRestored(next)}catch{setError('Your restored copy is saved on this device, but could not be opened. Find it in Your projects.');}});
  const locked=disabled||busy;
  return <section className="project-backup" aria-label="Complete local backup" aria-busy={busy}>
    <h3>Keep everything together</h3>
    <p>A portable copy of your home, saved listing photos, original images, property details and viewpoints. Saved floor-plan references can travel with it.</p>
    <p className="project-backup-note">Device files only. Save unfinished Floor plan studio work first. Temporary recovery drafts, generated-video jobs and online services are not included.</p>
    {plan&&<label className="project-backup-check"><input type="checkbox" checked={includeReferences} disabled={locked} onChange={e=>setIncludeReferences(e.target.checked)}/>Include saved floor-plan references</label>}
    <div className="project-backup-actions">{plan&&<button type="button" disabled={locked} onClick={()=>void download()}>Download complete backup</button>}<button type="button" disabled={locked} onClick={()=>input.current?.click()}>Restore complete backup</button></div>
    <input ref={input} hidden type="file" accept="application/json,.json" aria-label="Choose complete backup" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void choose(file)}}/>
    {pending&&<div className="project-backup-review"><strong>Restore “{pending.plan.name}” as a new project?</strong><p>{pending.plan.floors.length} floors · {pending.plan.furniture.length} pieces · {pending.listing?.media.length??0} photos and views · {pending.references.filter(r=>r.status==='included').length} saved references</p><p>Your existing projects will stay untouched. This file may include private photos, reference documents and contact details.</p><div className="project-backup-actions"><button type="button" className="primary" disabled={locked} onClick={()=>void restore()}>Create and open local copy</button><button type="button" disabled={locked} onClick={()=>{setPending(undefined);setNotices([])}}>Cancel restore</button></div></div>}
    {!!notices.length&&<details className="project-backup-notices"><summary>{notices.length} floor reference notices</summary><ul>{notices.map((note,index)=><li key={index}>{note}</li>)}</ul></details>}
    {busy&&<p role="status">Preparing your local backup…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="project-error">{error}</p>}
  </section>;
}
