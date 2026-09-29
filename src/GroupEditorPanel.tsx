import {useMemo,useState} from 'react';
import {catalog} from './catalog';
import {formatLength} from './domain';
import {LengthInput} from './LengthInput';
import {validatePlan} from './planValidation';
import {applyFurnitureGroupCommand,expandedFurnitureSelection,groupForItem,groupPieceProblem,isFurnitureLocked,MAX_GROUP_MEMBERS,type GroupCommand,type GroupPlan} from './furnitureGroups';
import './group-editor.css';

export interface GroupEditorPanelProps {
  plan:GroupPlan;
  activeFloorId:string;
  selectedIds:readonly string[];
  onSelectionChange(ids:string[]):void;
  /** Must synchronously reject a stale base and commit exactly once. */
  onCommit(base:GroupPlan,next:GroupPlan,selectedIds:string[]):void;
  disabled?:boolean;
  onClose?():void;
}
const names=new Map(catalog.map(item=>[item.id,item.name]));

/** Embedded panel: selection is transient; the host owns scene highlighting and history. */
export function GroupEditorPanel({plan,activeFloorId,selectedIds,onSelectionChange,onCommit,disabled=false,onClose}:GroupEditorPanelProps){
  const [name,setName]=useState(''),[search,setSearch]=useState(''),[distance,setDistance]=useState(250),[degrees,setDegrees]=useState(45);
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[deleting,setDeleting]=useState<{base:GroupPlan;ids:string[]}>();
  const [renaming,setRenaming]=useState<{id:string;name:string}>();
  const pieces=useMemo(()=>plan.furniture.filter(p=>p.floorId===activeFloorId),[plan.furniture,activeFloorId]);
  const selected=pieces.filter(p=>selectedIds.includes(p.id)), groups=plan.furnitureGroups?.groups.filter(g=>g.floorId===activeFloorId)??[];
  const invalid=selected.length!==selectedIds.length, locked=selected.some(p=>isFurnitureLocked(plan,p.id));
  const unsupported=selected.some(p=>!!groupPieceProblem(p)), blocked=disabled||!!deleting;
  const shown=pieces.filter(p=>`${names.get(p.catalogId)??p.catalogId} ${groupForItem(plan,p.id)?.name??''}`.toLowerCase().includes(search.toLowerCase())).slice(0,100);
  const attempt=(action:()=>void)=>{setError('');setMessage('');try{action();}catch(e){setError(e instanceof Error?e.message:'The group could not be changed.');}};
  const run=(command:GroupCommand,notice:string)=>attempt(()=>{
    if(disabled)throw new Error('Finish the current preview before editing groups.');
    const result=applyFurnitureGroupCommand(plan,plan,activeFloorId,command,validatePlan);
    if(result.plan!==plan)onCommit(plan,result.plan,result.selectedIds);
    else onSelectionChange(result.selectedIds);
    setMessage(notice);
  });
  const toggle=(id:string,checked:boolean)=>attempt(()=>{
    const ids=expandedFurnitureSelection(plan,[id]);
    const next=checked?[...new Set([...selectedIds,...ids])]:selectedIds.filter(item=>!ids.includes(item));
    if(next.length>MAX_GROUP_MEMBERS)throw new Error(`Select up to ${MAX_GROUP_MEMBERS} pieces at once.`);
    onSelectionChange(next);setDeleting(undefined);
  });
  const move=(dx:number,dz:number)=>run({type:'move',ids:selectedIds,dx,dz},'Selection moved. Undo restores the previous positions.');
  const canTransform=!blocked&&!invalid&&!!selected.length&&!locked&&!unsupported;
  return <section className="group-editor" aria-labelledby="group-editor-heading">
    <header><div><span className="eyebrow">Keep a set together</span><h2 id="group-editor-heading">Furniture groups</h2></div>{onClose&&<button onClick={onClose}>Close</button>}</header>
    <p>Check the pieces to move together. Include decorations separately; supports never add their contents automatically.</p>
    {disabled&&<p role="status">Finish or discard the current placement or preview first.</p>}
    {invalid&&<p role="alert">The selection changed. Clear it and choose pieces from this floor.</p>}
    <label>Find placed furniture<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Chair, shelf, or group name"/></label>
    <div className="group-piece-list">{shown.map(piece=>{const group=groupForItem(plan,piece.id);return <label key={piece.id}><input type="checkbox" checked={selectedIds.includes(piece.id)} disabled={blocked} onChange={e=>toggle(piece.id,e.target.checked)}/><span>{names.get(piece.catalogId)??'Unavailable furniture'}<small>{group?group.name+' · ':''}{isFurnitureLocked(plan,piece.id)?'Locked · ':''}Piece {pieces.indexOf(piece)+1} · {formatLength(piece.widthMm,plan.units)} × {formatLength(piece.depthMm,plan.units)}</small></span></label>;})}</div>
    {!pieces.length&&<p>No placed furniture on this floor yet.</p>}
    {pieces.length>100&&<p>Showing up to 100 matches. Search to find other pieces.</p>}
    <div className="group-actions"><span>{selectedIds.length} / {MAX_GROUP_MEMBERS} selected</span><button disabled={blocked||!selectedIds.length} onClick={()=>onSelectionChange([])}>Clear selection</button></div>
    {locked&&<p>Unlock the selected pieces or their group before moving, duplicating, deleting or ungrouping.</p>}
    {unsupported&&<p>Some selected pieces use their individual mounting or terrain tools. They can still be locked.</p>}
    <form onSubmit={e=>{e.preventDefault();run({type:'group',ids:selectedIds,name},'Group saved. Picking one member selects the set.');}}>
      <label>Group name<input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label>
      <button disabled={!canTransform||selected.length<2||!name.trim()||selected.some(p=>!!groupForItem(plan,p.id))}>Group selected</button>
    </form>
    <div className="group-actions"><button disabled={blocked||invalid||!selected.length} onClick={()=>run({type:'lock-items',ids:selectedIds,locked:true},'Selected pieces locked.')}>Lock pieces</button><button disabled={blocked||invalid||!selected.length} onClick={()=>run({type:'lock-items',ids:selectedIds,locked:false},'Individual locks removed. Any group lock still applies.')}>Unlock pieces</button></div>
    <fieldset disabled={!canTransform}><legend>Move selected set</legend><LengthInput label="Move distance" value={distance} units={plan.units} min={1} onChange={setDistance}/><div className="group-actions"><button onClick={()=>move(-distance,0)}>Left</button><button onClick={()=>move(distance,0)}>Right</button><button onClick={()=>move(0,-distance)}>Back</button><button onClick={()=>move(0,distance)}>Forward</button></div><label>Turn (degrees)<input type="number" min={-360} max={360} value={degrees} onChange={e=>{if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))setDegrees(e.target.valueAsNumber);}}/></label><div className="group-actions"><button onClick={()=>run({type:'rotate',ids:selectedIds,degrees},'Selection rotated around its center.')}>Rotate selected</button><button onClick={()=>run({type:'duplicate',ids:selectedIds,dx:distance,dz:distance},'Selection duplicated with independent pieces.')}>Duplicate selected</button></div></fieldset>
    <button disabled={blocked||invalid||!selected.length||locked} onClick={()=>{setDeleting({base:plan,ids:[...selectedIds]});setError('');}}>Delete selected</button>
    {deleting&&<div role="group" aria-label="Confirm deleting selection"><p>Delete these {deleting.ids.length} pieces? Undo restores them.</p><button disabled={disabled} onClick={()=>attempt(()=>{
      if(deleting.base!==plan){setDeleting(undefined);throw new Error('The project changed. Review the selection again.');}
      const result=applyFurnitureGroupCommand(plan,plan,activeFloorId,{type:'delete',ids:deleting.ids},validatePlan);onCommit(plan,result.plan,result.selectedIds);setDeleting(undefined);setMessage('Selected pieces removed.');
    })}>Confirm deletion</button><button onClick={()=>setDeleting(undefined)}>Keep pieces</button></div>}
    {!!groups.length&&<div className="group-saved"><h3>Saved groups</h3>{groups.map(group=><article key={group.id}><strong>{group.name}</strong><small>{group.memberIds.length} pieces{group.locked?' · Locked':''}</small><div className="group-actions"><button disabled={blocked} onClick={()=>onSelectionChange([...group.memberIds])}>Select {group.name}</button><button disabled={blocked} onClick={()=>run({type:'lock-group',groupId:group.id,locked:!group.locked},group.locked?'Group unlocked. Individual locks still apply.':'Group locked.')}>{group.locked?'Unlock group':'Lock group'}</button><button disabled={blocked} onClick={()=>setRenaming({id:group.id,name:group.name})}>Rename</button><button disabled={blocked||group.memberIds.some(id=>isFurnitureLocked(plan,id))} onClick={()=>run({type:'ungroup',groupId:group.id},'Pieces are independent again. Their positions are unchanged.')}>Ungroup</button></div>{renaming?.id===group.id&&<form onSubmit={e=>{e.preventDefault();run({type:'rename',groupId:group.id,name:renaming.name},'Group renamed.');}}><label>New group name<input value={renaming.name} maxLength={80} onChange={e=>setRenaming({...renaming,name:e.target.value})}/></label><button disabled={blocked||!renaming.name.trim()}>Save name</button><button type="button" onClick={()=>setRenaming(undefined)}>Cancel rename</button></form>}</article>)}</div>}
    {error&&<p role="alert">{error}</p>}<p role="status" aria-live="polite">{message}</p>
  </section>;
}
