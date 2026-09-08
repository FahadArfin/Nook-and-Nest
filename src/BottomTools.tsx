import {useEffect,useState} from 'react';
import {ToolBrowser} from './ToolBrowser';
import {SunControls} from './SunControls';
import type {SunSettings} from './sunlight';
import type {CatalogItem} from './types';
import {Wall,X,GridFour} from '@phosphor-icons/react';
import {SurfaceBrowser} from './SurfaceBrowser';
import {WallConstructionControls} from './WallConstructionControls';
import {usePlanner} from './store';
import './bottom-tools.css';

export type BottomToolMode='paint'|'walls'|'erase'|'wall'|'landscape'|'sun';
const titles:Record<BottomToolMode,string>={paint:'Floor finishes',walls:'Wall finishes',erase:'Erase tools',wall:'Wall tools',landscape:'Land formation',sun:'Sunlight'};
export function BottomTools({mode,onClose,onPlace,onViewScenery,onSunPreview,onBrowseLibrary}:{mode?:BottomToolMode;onBrowseLibrary?:()=>void;onClose:()=>void;onPlace:(item:CatalogItem)=>void;onViewScenery:()=>void;onSunPreview:(s?:SunSettings)=>void}){
 const s=usePlanner(),[shown,setShown]=useState<BottomToolMode>(),[open,setOpen]=useState(false);
 useEffect(()=>{
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(mode===shown){const timer=setTimeout(()=>setOpen(!!mode),reduced?0:20);return()=>clearTimeout(timer)}
  setOpen(false);
  const timer=setTimeout(()=>setShown(mode),shown&&!reduced?650:0);
  return()=>clearTimeout(timer);
 },[mode,shown]);
 if(!shown)return null;
 return <section className={`bottom-tools tool-browser bottom-tools-${shown} ${open?'is-open':''}`} aria-label={titles[shown]} aria-hidden={!open} inert={!open}>
  <header><strong>{titles[shown]}</strong><button onClick={onClose} aria-label={shown==='paint'?'Close floor finishes':'Close bottom tools'}><X size={20}/><span>Back to floor</span></button></header>
  <div className="bottom-tools-body" key={shown}>
   {shown==='paint'?<SurfaceBrowser floorOnly/>:shown==='walls'?<SurfaceBrowser wallsOnly/>:shown==='sun'?<SunControls onPreview={onSunPreview}/>:shown==='landscape'?<ToolBrowser onBrowseLibrary={onBrowseLibrary} embedded initialDestination="Landscape" onPlace={onPlace} onViewScenery={onViewScenery}/>:shown==='wall'?<ToolBrowser onBrowseLibrary={onBrowseLibrary} embedded initialDestination="Build" onPlace={onPlace}/>:<><div className="bottom-tool-intro"><h2>What to erase?</h2><p>Choose a surface, then drag over the area in your apartment. Undo restores your changes.</p><div className="erase-targets"><button aria-pressed={s.tool==='erase'} onClick={()=>s.setTool('erase')}><GridFour size={24}/>Floor area</button><button aria-pressed={s.tool==='wall-cut'} onClick={()=>s.setTool('wall-cut')}><Wall size={24}/>Wall section</button></div></div><div className="erase-settings">{s.tool==='wall-cut'?<WallConstructionControls embedded toolChoices={false}/>:<><h3>Erase floor area</h3><p>Drag a rectangle, then use the checkmark to confirm or × to cancel.</p><p>To remove furniture, select the piece in Arrange and use its × button.</p></>}</div></>}
  </div>
 </section>;
}
