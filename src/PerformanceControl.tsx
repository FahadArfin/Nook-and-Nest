import {GearSix,Info,Sparkle,BatteryCharging,Lightning} from '@phosphor-icons/react';
import {useEffect,useRef,useState} from 'react';
import type {SceneController} from './scene/SceneController';
import {ToolPopover} from './CompactToolPopovers';
import {usePlanner} from './store';
export type RenderQuality='auto'|'battery'|'high';
export function PerformanceControl({controller}:{controller?:SceneController}){
 const s=usePlanner(),anchor=useRef<HTMLButtonElement>(null),[open,setOpen]=useState(false),[info,setInfo]=useState(false);
 const [quality,setQuality]=useState<RenderQuality>(()=>{try{const q=localStorage.getItem('nook-render-quality');return q==='high'||q==='battery'?q:'auto'}catch{return 'auto'}});
 useEffect(()=>{controller?.setRenderQuality(quality);try{localStorage.setItem('nook-render-quality',quality)}catch{}},[quality,controller]);
 const close=()=>{setOpen(false);setInfo(false)};
 return <><button ref={anchor} aria-label="Settings" title="Settings" aria-expanded={open} className={open?'active':''} onClick={()=>{setOpen(!open);setInfo(false)}}><GearSix size={21}/></button>
 <ToolPopover anchor={anchor} open={open} side="left" label="Settings" onClose={close}><div className="settings-heading"><strong>Settings</strong><div className="settings-info"><button aria-label="About display settings" aria-expanded={info} aria-describedby="display-settings-help" onClick={()=>setInfo(!info)}><Info size={19}/></button><p id="display-settings-help" role="tooltip" className={info?'show':''}>Auto adjusts resolution as the scene gets busy. Battery lowers resolution to save power. High keeps it sharp. Distant plants use less detail in every mode. Ghost floor below shows the level beneath your active floor.</p></div></div>
 <div className="quality-choices" role="group" aria-label="Display quality">{([{id:'auto',label:'Auto',icon:Sparkle},{id:'battery',label:'Battery',icon:BatteryCharging},{id:'high',label:'High',icon:Lightning}] as const).map(({id,label,icon:Icon})=><button key={id} aria-pressed={quality===id} onClick={()=>setQuality(id)}><Icon size={21}/>{label}</button>)}</div>
 <label className="ghost-setting"><span>Ghost floor below</span><input type="checkbox" role="switch" checked={s.plan.camera.ghostBelow} onChange={()=>s.toggleCameraSetting('ghostBelow')}/></label></ToolPopover></>;
}
