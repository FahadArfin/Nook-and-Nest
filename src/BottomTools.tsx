import {useEffect,useState,useRef,useLayoutEffect} from 'react';
import {usePlanner} from './store';
import {Surroundings} from './ToolBrowser';
import {TerrainSettings} from './TerrainSettings';
import {PlantingSettings} from './PlantingSettings';
import type {CatalogItem} from './types';
import {X} from '@phosphor-icons/react';
import {SurfaceBrowser} from './SurfaceBrowser';
import './bottom-tools.css';

export type BottomToolMode='paint'|'walls'|'erase'|'wall'|'landscape';
const titles:Record<BottomToolMode,string>={paint:'Paint surfaces',walls:'Wall finishes',erase:'Erase tools',wall:'Wall tools',landscape:'Land formation'};
export function BottomTools({mode,onClose,onPlace,onViewScenery,onBrowseLibrary}:{mode?:BottomToolMode;onBrowseLibrary?:()=>void;onClose:()=>void;onPlace:(item:CatalogItem)=>void;onViewScenery:()=>void}){
 const panel=useRef<HTMLElement>(null);
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
 useLayoutEffect(()=>{const el=panel.current;if(!el||!shown)return;const host=el.parentElement!;const labels={paint:'Paint',walls:'Paint',wall:'Add wall',landscape:'Land formation',erase:'Erase'};const place=()=>{const button=Array.from(host.querySelectorAll<HTMLButtonElement>('.tool-dock button')).find(b=>b.textContent?.trim()===labels[shown]);if(!button)return;const h=host.getBoundingClientRect(),b=button.getBoundingClientRect(),width=el.offsetWidth;const center=Math.max(width/2+10,Math.min(b.left+b.width/2-h.left,h.width-width/2-10));el.style.left=center+'px';el.style.bottom=(h.bottom-b.top+12)+'px';el.style.transformOrigin=`${b.left+b.width/2-h.left-center+width/2}px bottom`};place();const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(place);observer?.observe(el);observer?.observe(host);window.addEventListener('resize',place);return()=>{observer?.disconnect();window.removeEventListener('resize',place)}},[shown]);
 if(!shown)return null;
 return <section ref={panel} className={`bottom-tools tool-browser bottom-tools-${shown} ${open?'is-open':''}`} aria-label={titles[shown]} aria-hidden={!open} inert={!open}>
  <header><strong>{titles[shown]}</strong><button onClick={onClose} aria-label={shown==='paint'?'Close paint surfaces':'Close bottom tools'}><X size={20}/><span>Back to floor</span></button></header>
  <div className="bottom-tools-body" key={shown}>
   {shown==='paint'?<SurfaceBrowser/>:shown==='walls'?<SurfaceBrowser wallsOnly/>:shown==='landscape'?<LandscapeMenus onPlace={onPlace} onView={onViewScenery} onBrowseLibrary={onBrowseLibrary}/>:shown==='wall'?<WallHeightChoices/>:null}

  </div>
 </section>;
}

function WallHeightChoices(){const s=usePlanner(),floor=s.plan.floors.find(f=>f.id===s.activeFloorId)!;return <div className="wall-height-choices" aria-label="New wall height">{[{name:'Full height',value:0},{name:'Half height',value:Math.round(floor.heightMm/2)}].map(p=><button key={p.name} aria-pressed={s.wallDrawHeight===p.value} onClick={()=>{s.setWallDrawHeight(p.value);s.setTool('wall')}}><span className={p.value?'half-wall-icon':'full-wall-icon'}/>{p.name}<small>{Math.round((p.value||floor.heightMm)/25.4)} in</small></button>)}</div>}

function LandscapeMenus({onPlace,onView,onBrowseLibrary}:{onPlace:(item:CatalogItem)=>void;onView:()=>void;onBrowseLibrary?:()=>void}){
 const [choice,setChoice]=useState<string>(),[shown,setShown]=useState<string>(),[open,setOpen]=useState(false);
 useEffect(()=>{const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(choice===shown){const id=setTimeout(()=>setOpen(!!choice),20);return()=>clearTimeout(id)}setOpen(false);const id=setTimeout(()=>setShown(choice),shown&&!reduced?300:0);return()=>clearTimeout(id)},[choice,shown]);
 return <div className="landscape-menus">{shown&&<div className={`landscape-detail ${open?'is-open':''}`} aria-label={shown+' options'} aria-hidden={!open} inert={!open}><strong>{shown}</strong>{shown==='Terrain'?<TerrainSettings/>:shown==='Plants'?<PlantingSettings onPlace={onPlace}/>:<Surroundings onView={onView} onBrowseLibrary={onBrowseLibrary}/>}</div>}<nav aria-label="Landscape tools">{['Terrain','Plants','Landscape'].map(label=><button key={label} aria-pressed={choice===label} onClick={()=>{usePlanner.getState().setTool('select');setChoice(choice===label?undefined:label)}}>{label}</button>)}</nav></div>
}
