import {useEffect,useState} from 'react';
import {usePlanner} from './store';
import {ToolBrowser} from './ToolBrowser';
import type {CatalogItem} from './types';
import {X} from '@phosphor-icons/react';
import {SurfaceBrowser} from './SurfaceBrowser';
import './bottom-tools.css';

export type BottomToolMode='paint'|'walls'|'erase'|'wall'|'landscape';
const titles:Record<BottomToolMode,string>={paint:'Floor finishes',walls:'Wall finishes',erase:'Erase tools',wall:'Wall tools',landscape:'Land formation'};
export function BottomTools({mode,onClose,onPlace,onViewScenery,onBrowseLibrary}:{mode?:BottomToolMode;onBrowseLibrary?:()=>void;onClose:()=>void;onPlace:(item:CatalogItem)=>void;onViewScenery:()=>void}){
 const [shown,setShown]=useState<BottomToolMode>(),[open,setOpen]=useState(false);
 const drawerMode=mode==='erase'?undefined:mode;
 useEffect(()=>{
  const mode=drawerMode;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(mode===shown){const timer=setTimeout(()=>setOpen(!!mode),reduced?0:20);return()=>clearTimeout(timer)}
  setOpen(false);
  const timer=setTimeout(()=>setShown(mode),shown&&!reduced?650:0);
  return()=>clearTimeout(timer);
 },[drawerMode,shown]);
 if(!shown)return null;
 return <section className={`bottom-tools tool-browser bottom-tools-${shown} ${open?'is-open':''}`} aria-label={titles[shown]} aria-hidden={!open} inert={!open}>
  <header><strong>{titles[shown]}</strong><button onClick={onClose} aria-label={shown==='paint'?'Close floor finishes':'Close bottom tools'}><X size={20}/><span>Back to floor</span></button></header>
  <div className="bottom-tools-body" key={shown}>
   {shown==='paint'?<SurfaceBrowser floorOnly/>:shown==='walls'?<SurfaceBrowser wallsOnly/>:shown==='landscape'?<ToolBrowser onBrowseLibrary={onBrowseLibrary} embedded initialDestination="Landscape" onPlace={onPlace} onViewScenery={onViewScenery}/>:shown==='wall'?<WallHeightChoices/>:null}

  </div>
 </section>;
}

function WallHeightChoices(){const s=usePlanner(),floor=s.plan.floors.find(f=>f.id===s.activeFloorId)!;return <div className="wall-height-choices" aria-label="New wall height">{[{name:'Full height',value:0},{name:'Half height',value:Math.round(floor.heightMm/2)}].map(p=><button key={p.name} aria-pressed={s.wallDrawHeight===p.value} onClick={()=>{s.setWallDrawHeight(p.value);s.setTool('wall')}}><span className={p.value?'half-wall-icon':'full-wall-icon'}/>{p.name}<small>{Math.round((p.value||floor.heightMm)/25.4)} in</small></button>)}</div>}
