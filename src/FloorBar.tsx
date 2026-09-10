import { useEffect, useRef, useState } from "react";
import { Plus, Trash, DotsThreeVertical, Copy, PencilSimple, Check, X } from "@phosphor-icons/react";
import { usePlanner } from "./store";
import "./floorbar.css";

export function FloorBar({ onBeforeDelete }: { onBeforeDelete(): void }) {
  const state = usePlanner();
  const [menuId,setMenuId]=useState<string>(),[dragId,setDragId]=useState<string>();
  const [renamingId,setRenamingId]=useState<string>(),[name,setName]=useState("");
  const [targetId, setTargetId] = useState<string>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const target = state.plan.floors.find(f => f.id === targetId);
  const onlyFloor = state.plan.floors.length === 1;
  const pieces = state.plan.furniture.filter(f => f.floorId === targetId).length;
  const linkedStairs = state.plan.floors.filter(f => f.id !== targetId).flatMap(f => f.stairs).filter(s => s.toFloorId === targetId).length;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (target && dialog && !dialog.open) { dialog.showModal(); cancelRef.current?.focus(); }
    if (!target && dialog?.open) dialog.close();
  }, [targetId, target]);
  const close = () => { dialogRef.current?.close(); setTargetId(undefined); triggerRef.current?.focus(); };
  const remove = () => { if (!target) return; onBeforeDelete(); state.deleteFloor(target.id); close(); };
  return <footer className="floorbar floor-manager">
    <div className="floor-tabs" aria-label="Floors">{state.plan.floors.map((floor,index)=><div key={floor.id} className={`floor-tab-group${floor.id===state.activeFloorId?' is-active':''}${dragId===floor.id?' is-dragging':''}`} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}} onDrop={e=>{e.preventDefault();if(dragId&&dragId!==floor.id){onBeforeDelete();state.reorderFloor(dragId,index)}setDragId(undefined)}}>
      <button draggable onDragStart={e=>{setDragId(floor.id);setMenuId(undefined);setRenamingId(undefined);e.dataTransfer.setData('text/plain',floor.id);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragId(undefined)} aria-pressed={floor.id===state.activeFloorId} onClick={()=>{state.setActiveFloor(floor.id);setMenuId(undefined);setRenamingId(undefined)}} onKeyDown={e=>{if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();onBeforeDelete();state.reorderFloor(floor.id,index+(e.key==='ArrowLeft'?-1:1));}}} title="Drag to reorder floors · Alt + arrow keys"><span>{index+1}</span>{floor.name}</button>
      <button className="floor-options-button" aria-label={`Options for ${floor.name}`} aria-expanded={menuId===floor.id} onClick={()=>{state.setActiveFloor(floor.id);setMenuId(menuId===floor.id?undefined:floor.id);setRenamingId(undefined)}}><DotsThreeVertical size={18}/></button>
      {menuId===floor.id&&<div className="floor-tab-menu" role="group" aria-label={`${floor.name} actions`} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){setMenuId(undefined);setRenamingId(undefined)}}}>
        {renamingId===floor.id?<form className="floor-rename" onSubmit={e=>{e.preventDefault();if(name.trim()){state.renameFloor(name.trim());setMenuId(undefined);setRenamingId(undefined)}}}>
          <input autoFocus aria-label="Floor name" maxLength={80} value={name} onFocus={e=>e.currentTarget.select()} onChange={e=>setName(e.target.value)}/>
          <button type="submit" aria-label="Save floor name" disabled={!name.trim()}><Check/></button>
          <button type="button" aria-label="Cancel rename" onClick={()=>setRenamingId(undefined)}><X/></button>
        </form>:<><button disabled={state.plan.floors.length>=20} onClick={()=>{onBeforeDelete();state.duplicateFloor(floor.id);setMenuId(undefined)}}><Copy/>Clone</button>
        <button ref={triggerRef} className="floor-delete" onClick={()=>setTargetId(floor.id)}><Trash/>Delete</button>
        <button onClick={()=>{setName(floor.name);setRenamingId(floor.id)}}><PencilSimple/>Rename</button></>}
      </div>}
    </div>)}<button className="floor-add-tab" disabled={state.plan.floors.length>=20} aria-label="Add floor" title="Add floor" onClick={()=>{onBeforeDelete();state.addFloor();setMenuId(undefined)}}><Plus size={20}/></button></div>

    <dialog className="floor-delete-dialog" ref={dialogRef} aria-labelledby="floor-delete-title" aria-describedby="floor-delete-description" onCancel={event=>{event.preventDefault();close()}} onKeyDown={event=>event.stopPropagation()}>
      <span className="eyebrow">{onlyFloor?"Start this floor fresh":"Remove a floor"}</span>
      <h2 id="floor-delete-title">{onlyFloor?"Clear":"Delete"} “{target?.name}”?</h2>
      <p id="floor-delete-description">{onlyFloor?"Your project needs one floor, so its empty layer will remain. ":"This removes the selected floor. "}Its tiles, walls, doors, windows, stairs and {pieces} furniture {pieces===1?"piece":"pieces"} will be removed.{linkedStairs>0?` ${linkedStairs} connecting ${linkedStairs===1?"staircase":"staircases"} on other floors will also be removed.`:""}</p>
      <p className="floor-undo-note">Changed your mind? Undo restores the floor and its contents.</p>
      <div className="floor-confirm-actions"><button ref={cancelRef} onClick={close}>Cancel</button><button className="confirm-floor-delete" onClick={remove}><Trash size={17}/>{onlyFloor?"Clear floor":"Delete floor"}</button></div>
    </dialog>
  </footer>;
}
