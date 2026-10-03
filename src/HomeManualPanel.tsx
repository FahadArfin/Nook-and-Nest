import {useMemo,useState} from 'react';
import {catalog} from './catalog';
import {ChoiceButtons} from './ChoiceButtons';
import {validatePlan} from './planValidation';
import {completeHomeMaintenance,downloadHomeManual,filterHomeManualRecords,homeRecordStatus,localCalendarDay,MAX_HOME_HISTORY,MAX_HOME_RECORDS,printHomeManual,removeHomeManualRecord,resolveHomeFurniture,saveHomeManualRecord,type HomeManualFilter,type HomeManualRecord} from './homeManual';
import type {PlanDocumentV1} from './types';
import './home-manual.css';

export interface HomeManualPanelProps {plan:PlanDocumentV1;disabled?:boolean;onCommit(base:PlanDocumentV1,next:PlanDocumentV1):void}
type RecordEdit={base:PlanDocumentV1;record:HomeManualRecord};
type ServiceEdit={base:PlanDocumentV1;id:string;task:string;completedOn:string;notes:string;nextMaintenanceOn:string};
const catalogNames=new Map(catalog.map(item=>[item.id,item.name]));
const filterOptions:ReadonlyArray<{value:HomeManualFilter;label:string}>=[{value:'all',label:'All records'},{value:'due',label:'Due now'},{value:'overdue',label:'Overdue'},{value:'upcoming',label:'Upcoming'},{value:'warranty',label:'Warranty current'},{value:'warranty-expired',label:'Warranty ended'}];

export function HomeManualPanel({plan,disabled=false,onCommit}:HomeManualPanelProps){
  const [query,setQuery]=useState(''),[filter,setFilter]=useState<HomeManualFilter>('all'),[edit,setEdit]=useState<RecordEdit>(),[service,setService]=useState<ServiceEdit>(),[removing,setRemoving]=useState<{base:PlanDocumentV1;id:string}>(),[furnitureQuery,setFurnitureQuery]=useState(''),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[message,setMessage]=useState('');
  const records=plan.homeManual?.records??[],today=localCalendarDay(),rows=filterHomeManualRecords(records,query,filter,today),selectedIds=selected.filter(id=>records.some(record=>record.id===id)),editing=!!(edit||service||removing);
  const furniture=useMemo(()=>plan.furniture.map((item,index)=>({id:item.id,name:item.personalItem?.name??catalogNames.get(item.catalogId)??'Furniture',floor:plan.floors.find(f=>f.id===item.floorId)?.name??'Unknown floor',index:index+1})),[plan]);
  const furnitureMatches=furniture.filter(item=>`${item.name} ${item.floor} ${item.index}`.toLocaleLowerCase().includes(furnitureQuery.trim().toLocaleLowerCase()));
  const attempt=(action:()=>void)=>{setError('');setMessage('');try{action();}catch(cause){setError(cause instanceof Error?cause.message:'The home record could not be saved.');}};
  const start=(record?:HomeManualRecord)=>{setEdit({base:plan,record:record?structuredClone(record):{id:crypto.randomUUID(),name:'',notes:'',history:[]}});setFurnitureQuery('');setError('');setMessage('');};
  const patch=(value:Partial<HomeManualRecord>)=>setEdit(current=>current?{...current,record:{...current.record,...value}}:current);
  const save=()=>attempt(()=>{if(!edit||disabled)return;const next=saveHomeManualRecord(edit.base,plan,edit.record,validatePlan);onCommit(edit.base,next);setEdit(undefined);setMessage('Home record saved. Undo restores the previous record.');});
  const saveService=()=>attempt(()=>{if(!service||disabled)return;const next=completeHomeMaintenance(service.base,plan,service.id,service,validatePlan);onCommit(service.base,next);setService(undefined);setMessage('Maintenance recorded. Undo restores the previous history and due date.');});
  const remove=()=>attempt(()=>{if(!removing||disabled)return;const next=removeHomeManualRecord(removing.base,plan,removing.id,validatePlan);onCommit(removing.base,next);setSelected(ids=>ids.filter(id=>id!==removing.id));setRemoving(undefined);setMessage('Home record removed. Undo restores it with its service history.');});
  return <section className="home-manual" aria-labelledby="home-manual-heading">
    <header><div><span className="eyebrow">A little care, kept together</span><h2 id="home-manual-heading">Home manual</h2></div><button disabled={disabled||editing||records.length>=MAX_HOME_RECORDS} onClick={()=>start()}>Add home record</button></header>
    <p>Keep product links, warranty dates and a record of care for your home. These private records stay with this project. Blank dates mean unknown; reminders are not sent.</p>
    {disabled&&<p role="status">Finish the active placement or preview before editing home records.</p>}
    <div className="home-manual-summary"><strong>{records.length} / {MAX_HOME_RECORDS} records</strong><span>{records.filter(record=>homeRecordStatus(record,today).maintenance==='overdue').length} overdue</span><span>Today · {today}</span></div>
    <label className="home-manual-search">Find a home record<input type="search" value={query} maxLength={200} placeholder="Name, task or notes" onChange={event=>setQuery(event.target.value)}/></label>
    <ChoiceButtons<HomeManualFilter> label="Home record filter" value={filter} options={filterOptions} onChange={setFilter}/>

    {edit&&<form className="home-manual-form" aria-label="Home record editor" onSubmit={event=>{event.preventDefault();save();}}>
      <h3>{records.some(record=>record.id===edit.record.id)?'Edit home record':'New home record'}</h3>
      {edit.base!==plan&&<p role="alert">The project changed. Your draft is still here. Cancel and reopen the record before saving.</p>}
      <div className="home-manual-fields">
        <label className="home-manual-wide">Record name<input required maxLength={160} value={edit.record.name} onChange={event=>patch({name:event.target.value})} placeholder="e.g. Kitchen dishwasher"/></label>
        <label>Product link<input type="url" maxLength={2048} value={edit.record.productUrl??''} onChange={event=>patch({productUrl:event.target.value||undefined})} placeholder="https://…"/></label>
        <label>Manual link<input type="url" maxLength={2048} value={edit.record.manualUrl??''} onChange={event=>patch({manualUrl:event.target.value||undefined})} placeholder="https://…"/></label>
        <label>Purchase date<input type="date" value={edit.record.purchasedOn??''} onChange={event=>patch({purchasedOn:event.target.value||undefined})}/></label>
        <label>Warranty end date<input type="date" min={edit.record.purchasedOn} value={edit.record.warrantyEndsOn??''} onChange={event=>patch({warrantyEndsOn:event.target.value||undefined})}/></label>
        <label>Maintenance task<input maxLength={240} value={edit.record.maintenanceTask??''} onChange={event=>patch({maintenanceTask:event.target.value||undefined})} placeholder="e.g. Clean the filter"/></label>
        <label>Next maintenance date<input type="date" value={edit.record.nextMaintenanceOn??''} onChange={event=>patch({nextMaintenanceOn:event.target.value||undefined})}/></label>
        <label className="home-manual-wide">Private record notes<textarea maxLength={2000} rows={3} value={edit.record.notes} onChange={event=>patch({notes:event.target.value})} placeholder="Model number, care instructions or useful details"/></label>
      </div>
      <details className="home-manual-linker"><summary>Link placed furniture (optional)</summary><p>{resolveHomeFurniture(plan,edit.record).label}</p>
        <button type="button" aria-pressed={!edit.record.furnitureId} onClick={()=>patch({furnitureId:undefined})}>Keep as a standalone record</button>
        <label>Find placed furniture<input type="search" maxLength={200} value={furnitureQuery} onChange={event=>setFurnitureQuery(event.target.value)} placeholder="Furniture name or floor"/></label>
        <div className="home-manual-furniture" role="group" aria-label="Linked furniture">{furnitureMatches.slice(0,30).map(item=><button key={item.id} type="button" aria-pressed={edit.record.furnitureId===item.id} onClick={()=>patch({furnitureId:item.id,...(!edit.record.name.trim()?{name:item.name}:{})})}>{item.name}<small>{item.floor} · item {item.index}</small></button>)}</div>
        {!furnitureMatches.length&&<small>No matching placed furniture. A standalone record works for any home item.</small>}{furnitureMatches.length>30&&<small>Showing the first 30 matches. Refine your search to find another item.</small>}
      </details>
      <small>Leave dates blank when unknown. Links open on their source websites; attachments are not stored here.</small>
      <div className="home-manual-actions"><button type="submit" disabled={disabled||edit.base!==plan}>Save home record</button><button type="button" onClick={()=>{setEdit(undefined);setError('');}}>Cancel edit</button></div>
    </form>}

    {service&&<form className="home-manual-form" aria-label="Maintenance completion" onSubmit={event=>{event.preventDefault();saveService();}}>
      <h3>Record service · {records.find(record=>record.id===service.id)?.name??'Earlier record'}</h3>
      {service.base!==plan&&<p role="alert">The project changed. Cancel and reopen this maintenance form before saving.</p>}
      <div className="home-manual-fields">
        <label>Service task<input required maxLength={240} value={service.task} onChange={event=>setService({...service,task:event.target.value})}/></label>
        <label>Completed on<input type="date" required max={today} value={service.completedOn} onChange={event=>setService({...service,completedOn:event.target.value})}/></label>
        <label className="home-manual-wide">Service notes<textarea maxLength={1000} rows={3} value={service.notes} onChange={event=>setService({...service,notes:event.target.value})}/></label>
        <label>Next maintenance date (optional)<input type="date" value={service.nextMaintenanceOn} onChange={event=>setService({...service,nextMaintenanceOn:event.target.value})}/></label>
      </div>
      <p>Saving adds one dated service entry and clears the previous due date. Enter a new date only if you know when the next service is needed.</p>
      <div className="home-manual-actions"><button type="submit" disabled={disabled||service.base!==plan}>Save completed maintenance</button><button type="button" onClick={()=>{setService(undefined);setError('');}}>Cancel service</button></div>
    </form>}

    <div className="home-manual-records">
      {!rows.length&&<p className="home-manual-empty">{records.length?'No records match this search and filter.':'Start with an appliance, a finish or a piece of furniture you want to care for.'}</p>}
      {rows.map(record=>{const status=homeRecordStatus(record,today),link=resolveHomeFurniture(plan,record),confirming=removing?.id===record.id;return <article key={record.id} className="home-manual-record">
        <div className="home-manual-record-heading"><h3>{record.name}</h3><label className="home-manual-include"><input type="checkbox" aria-label={`Include ${record.name} in handover`} checked={selected.includes(record.id)} onChange={event=>setSelected(ids=>event.target.checked?[...ids,record.id]:ids.filter(id=>id!==record.id))}/>Include in handover</label></div>
        <small className={link.state==='missing'?'home-manual-warning':undefined}>{link.label}</small>
        <dl><div><dt>Maintenance</dt><dd className={status.maintenance==='overdue'?'home-manual-warning':undefined}>{record.nextMaintenanceOn?`${status.maintenance==='overdue'?'Overdue':status.maintenance==='due'?'Due today':'Upcoming'} · ${record.nextMaintenanceOn}`:'Date unknown'}</dd></div><div><dt>Warranty end</dt><dd>{record.warrantyEndsOn?`${record.warrantyEndsOn}${status.warranty==='expired'?' · date passed':''}`:'Date unknown'}</dd></div></dl>
        {record.maintenanceTask&&<p>{record.maintenanceTask}</p>}
        {(record.productUrl||record.manualUrl)&&<div className="home-manual-actions">{record.productUrl&&<a href={record.productUrl} target="_blank" rel="noopener noreferrer">Product ↗</a>}{record.manualUrl&&<a href={record.manualUrl} target="_blank" rel="noopener noreferrer">Manual ↗</a>}</div>}
        {record.notes&&<p className="home-manual-notes">{record.notes}</p>}
        {!!record.history.length&&<details><summary>Service history ({record.history.length}/{MAX_HOME_HISTORY})</summary><ol className="home-manual-history">{[...record.history].sort((a,b)=>b.completedOn.localeCompare(a.completedOn)).map(entry=><li key={entry.id}><strong>{entry.completedOn} · {entry.task}</strong>{entry.notes&&<p>{entry.notes}</p>}</li>)}</ol></details>}
        <div className="home-manual-actions"><button disabled={disabled||editing} aria-label={`Edit ${record.name}`} onClick={()=>start(record)}>Edit record</button><button disabled={disabled||editing||record.history.length>=MAX_HOME_HISTORY} aria-label={`Record service for ${record.name}`} onClick={()=>{setService({base:plan,id:record.id,task:record.maintenanceTask??'',completedOn:today,notes:'',nextMaintenanceOn:''});setError('');setMessage('');}}>Record service</button><button disabled={disabled||editing} aria-label={`Remove ${record.name}`} onClick={()=>{setRemoving({base:plan,id:record.id});setError('');setMessage('');}}>Remove</button></div>
        {record.history.length>=MAX_HOME_HISTORY&&<small>This record has reached its 40-entry service history limit.</small>}
        {confirming&&<div className="home-manual-removal" role="group" aria-label={`Remove ${record.name} confirmation`}><p>Remove {record.name} and its {record.history.length} service entries? Its furniture stays in the layout. Undo can restore this record.</p>{removing.base!==plan&&<p role="alert">The project changed. Keep this record, then reopen the removal action.</p>}<div className="home-manual-actions"><button disabled={disabled||removing.base!==plan} onClick={remove}>Confirm removal</button><button onClick={()=>setRemoving(undefined)}>Keep record</button></div></div>}
      </article>;})}
    </div>

    <section className="home-manual-handover" aria-labelledby="home-handover-heading"><h3 id="home-handover-heading">A handover you choose</h3><p>{selectedIds.length} saved record{selectedIds.length===1?'':'s'} selected across all filters. The copy includes their links, private notes and service history. Unselected records stay private.</p><div className="home-manual-actions"><button disabled={!selectedIds.length} onClick={()=>attempt(()=>printHomeManual(plan,selectedIds))}>Print selected handover</button><button disabled={!selectedIds.length} onClick={()=>attempt(()=>downloadHomeManual(plan,selectedIds))}>Download selected copy</button>{selectedIds.length>0&&<button onClick={()=>setSelected([])}>Clear handover selection</button>}</div><small>Warranty dates are your notes; check the supplier's terms for actual coverage.</small></section>
    {error&&<p role="alert">{error}</p>}<p role="status" aria-live="polite">{message}</p>
  </section>;
}
