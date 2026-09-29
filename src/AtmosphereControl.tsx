import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Sun} from '@phosphor-icons/react';
import {AccessibleDialog} from './AccessibleDialog';
import {usePlanner} from './store';
import {type SceneAtmosphereV1} from './sceneAtmosphere';
import {catalog} from './catalog';
const SceneAtmospherePanel=lazy(()=>import('./SceneAtmospherePanel').then(m=>({default:m.SceneAtmospherePanel})));

export function AtmosphereControl({blocked,onOpenChange,onPreview,soundEnabled,onSoundEnabledChange,soundError}:{blocked:boolean;onOpenChange(open:boolean):void;onPreview(value?:SceneAtmosphereV1):void;soundEnabled:boolean;onSoundEnabledChange(value:boolean):void;soundError?:string}){
 const plan=usePlanner(s=>s.plan),floorId=usePlanner(s=>s.activeFloorId),[open,setOpen]=useState(false),base=useRef(plan),preview=useRef(onPreview);preview.current=onPreview;
 const close=()=>{preview.current(undefined);setOpen(false);onOpenChange(false)};
 useEffect(()=>()=>preview.current(undefined),[]);
 useEffect(()=>{if(open&&plan.id!==base.current.id)close()},[plan.id]);
 return <><button aria-label="Scene moods and sunlight" title="Scene moods & sunlight" disabled={blocked&&!open} aria-expanded={open} aria-pressed={plan.environment?.atmosphere?.mode!==undefined&&plan.environment.atmosphere.mode!=='off'} onClick={()=>{base.current=plan;setOpen(true);onOpenChange(true)}}><Sun/></button>{open&&<AccessibleDialog label="Scene moods and sunlight" className="atmosphere-dialog" onClose={close}><Suspense fallback={<p role="status">Opening scene moods…</p>}><SceneAtmospherePanel value={plan.environment?.atmosphere} onPreview={onPreview} onChange={value=>{const current=usePlanner.getState();current.commitDesign(base.current,{...base.current,environment:{background:'plain',grass:'off',...base.current.environment,atmosphere:value}});close()}} onClose={close} fixtures={plan.furniture.filter(p=>p.floorId===floorId&&catalog.some(c=>c.id===p.catalogId&&c.category==='Lighting')).map(p=>({id:p.id,name:catalog.find(c=>c.id===p.catalogId)?.name??p.catalogId}))} soundEnabled={soundEnabled} onSoundEnabledChange={onSoundEnabledChange} soundError={soundError}/></Suspense></AccessibleDialog>}</>;
}
