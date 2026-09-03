import { useState } from "react";
import { Ruler } from "@phosphor-icons/react";
import { parseRoomLength } from "./floorGeometry";
import { usePlanner } from "./store";
import "./building.css";

export function MeasuredRoom() {
  const state=usePlanner(),[unit,setUnit]=useState<"ft"|"m">(state.plan.units==="imperial"?"ft":"m"),[width,setWidth]=useState(state.plan.units==="imperial"?"12' 6\"":"3.8"),[depth,setDepth]=useState(state.plan.units==="imperial"?"10":"3"),[error,setError]=useState("");
  return <details className="measured-room"><summary><Ruler size={17}/> Exact room size</summary><p>Enter the floor footprint. Edge tiles are trimmed to your dimensions—not rounded to whole tiles. Accuracy: nearest millimetre.</p><form onSubmit={e=>{e.preventDefault();try{const widthMm=parseRoomLength(width,unit),depthMm=parseRoomLength(depth,unit);state.setRoomSize({widthMm,depthMm});setError("");}catch(e){setError((e as Error).message)}}} onKeyDown={e=>e.stopPropagation()}>
    <label>Room measurement units<select value={unit} onChange={e=>{try{const w=parseRoomLength(width,unit),d=parseRoomLength(depth,unit),next=e.target.value as "ft"|"m";setWidth((w/(next==="ft"?304.8:1000)).toFixed(4));setDepth((d/(next==="ft"?304.8:1000)).toFixed(4));}catch{}setUnit(e.target.value as "ft"|"m")}}><option value="ft">Feet / feet and inches</option><option value="m">Metres</option></select></label>
    <div className="building-fields"><label>Room width<input value={width} onChange={e=>setWidth(e.target.value)} placeholder={unit==="ft"?"12' 6\"":"3.8"}/></label><label>Room depth<input value={depth} onChange={e=>setDepth(e.target.value)}/></label></div><button className="primary">Place measured room</button>
    {error&&<p role="alert">{error}</p>}{state.tool==="measured-room"&&<p role="status">Click the floor to choose the starting corner. Click again to move the preview, then ✓ to add it. Use Inside wall to divide an existing open space.</p>}
  </form></details>;
}
