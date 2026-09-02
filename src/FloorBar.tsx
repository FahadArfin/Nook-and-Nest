import { useEffect, useRef, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { usePlanner } from "./store";
import "./floorbar.css";

export function FloorBar({ onBeforeDelete }: { onBeforeDelete(): void }) {
  const state = usePlanner();
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
    <div className="floor-tabs" aria-label="Floors">{state.plan.floors.map((floor,index) => <button key={floor.id} aria-pressed={floor.id===state.activeFloorId} className={floor.id===state.activeFloorId?"active":""} onClick={()=>state.setActiveFloor(floor.id)} title={floor.name}><span>{index+1}</span>{floor.name}</button>)}</div>
    <div className="floor-manager-actions">
      <button className="floor-action" onClick={state.addFloor}><Plus size={17}/> Add floor</button>
      <button ref={triggerRef} className="floor-action floor-delete" onClick={()=>setTargetId(state.activeFloorId)}><Trash size={17}/>{onlyFloor?"Clear floor":"Delete floor"}</button>
    </div>
    <div className="floor-options"><label><input type="checkbox" checked={state.plan.camera.ghostBelow} onChange={()=>state.toggleCameraSetting("ghostBelow")}/><span/> Ghost floor below</label></div>
    <dialog className="floor-delete-dialog" ref={dialogRef} aria-labelledby="floor-delete-title" aria-describedby="floor-delete-description" onCancel={event=>{event.preventDefault();close()}} onKeyDown={event=>event.stopPropagation()}>
      <span className="eyebrow">{onlyFloor?"Start this floor fresh":"Remove a floor"}</span>
      <h2 id="floor-delete-title">{onlyFloor?"Clear":"Delete"} “{target?.name}”?</h2>
      <p id="floor-delete-description">{onlyFloor?"Your project needs one floor, so its empty layer will remain. ":"This removes the selected floor. "}Its tiles, walls, doors, windows, stairs and {pieces} furniture {pieces===1?"piece":"pieces"} will be removed.{linkedStairs>0?` ${linkedStairs} connecting ${linkedStairs===1?"staircase":"staircases"} on other floors will also be removed.`:""}</p>
      <p className="floor-undo-note">Changed your mind? Undo restores the floor and its contents.</p>
      <div className="floor-confirm-actions"><button ref={cancelRef} onClick={close}>Cancel</button><button className="confirm-floor-delete" onClick={remove}><Trash size={17}/>{onlyFloor?"Clear floor":"Delete floor"}</button></div>
    </dialog>
  </footer>;
}
