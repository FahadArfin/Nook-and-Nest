import {readableLength} from './measurement';
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
const titles:Record<BottomToolMode,string>={paint:'Paint surfaces',walls:'Wall finishes',erase:'Erase tools',wall:'Wall tools',landscape:'Outdoors'};
export function BottomTools({mode,onClose,onPlace,onViewScenery,onBrowseLibrary}:{mode?:BottomToolMode;onBrowseLibrary?:()=>void;onClose:()=>void;onPlace:(item:CatalogItem)=>void;onViewScenery:()=>void}){
 const panel=useRef<HTMLElement>(null);
 const [compact,setCompact]=useState(false);
 const [shown,setShown]=useState<BottomToolMode>(),[open,setOpen]=useState(false);
 useEffect(()=>setCompact(false),[mode]);
 const drawerMode=mode==='erase'?undefined:mode;
 useEffect(()=>{
  const mode=drawerMode;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(mode===shown){const timer=setTimeout(()=>setOpen(!!mode),reduced?0:20);return()=>clearTimeout(timer)}
  setOpen(false);
  const timer=setTimeout(()=>setShown(mode),shown&&!reduced?650:0);
  return()=>clearTimeout(timer);
 },[drawerMode,shown]);
 useLayoutEffect(()=>{const el=panel.current;if(!el||!shown)return;const host=el.parentElement!;const labels={paint:'Paint',walls:'Paint',wall:'Add wall',landscape:'Outdoors',erase:'Erase'};const place=()=>{const button=Array.from(host.querySelectorAll<HTMLButtonElement>('.tool-dock button')).find(b=>b.textContent?.trim()===labels[shown]);if(!button)return;const h=host.getBoundingClientRect(),b=button.getBoundingClientRect(),width=el.offsetWidth;const center=Math.max(width/2+10,Math.min(b.left+b.width/2-h.left,h.width-width/2-10));el.style.left=center+'px';el.style.bottom=(h.bottom-b.top+12)+'px';el.style.transformOrigin=`${b.left+b.width/2-h.left-center+width/2}px bottom`};place();const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(place);observer?.observe(el);observer?.observe(host);window.addEventListener('resize',place);return()=>{observer?.disconnect();window.removeEventListener('resize',place)}},[shown]);
 if(!shown)return null;
 return <section ref={panel} className={`bottom-tools tool-browser bottom-tools-${shown} ${open?'is-open':''} ${compact?'is-compact':''}`} aria-label={titles[shown]} aria-hidden={!open} inert={!open}>
  <header><strong>{titles[shown]}</strong><button onClick={onClose} aria-label={shown==='paint'?'Close paint surfaces':'Close bottom tools'}><X size={20}/><span>Back to floor</span></button></header>
  <div className="bottom-tools-body" key={shown}>
   {shown==='paint'?<SurfaceBrowser onCompactChange={setCompact}/>:shown==='walls'?<SurfaceBrowser wallsOnly onCompactChange={setCompact}/>:shown==='landscape'?<LandscapeMenus onCompactChange={setCompact} onPlace={onPlace} onView={onViewScenery} onBrowseLibrary={onBrowseLibrary}/>:shown==='wall'?<WallHeightChoices/>:null}

  </div>
 </section>;
}

function WallHeightChoices(){const s=usePlanner(),floor=s.plan.floors.find(f=>f.id===s.activeFloorId)!;return <div className="wall-height-choices" aria-label="New wall height">{[{name:'Full height',value:0},{name:'Half height',value:Math.round(floor.heightMm/2)}].map(p=><button key={p.name} aria-pressed={s.wallDrawHeight===p.value} onClick={()=>{s.setWallDrawHeight(p.value);s.setTool('wall')}}><span className={p.value?'half-wall-icon':'full-wall-icon'}/>{p.name}<small>{readableLength(p.value||floor.heightMm,s.plan.units)}</small></button>)}</div>}

function LandscapeMenus({onPlace,onView,onBrowseLibrary,onCompactChange}:{onPlace:(item:CatalogItem)=>void;onView:()=>void;onBrowseLibrary?:()=>void;onCompactChange:(compact:boolean)=>void}){
 const [choice,setChoice]=useState('Terrain'),[compact,setCompact]=useState(false);
 const collapse=()=>{setCompact(true);onCompactChange(true)};
 const expand=()=>{setCompact(false);onCompactChange(false)};
 const s=usePlanner();
 const label=s.tool==='planting'?'Plant brush':s.tool==='terrain-raise'?'Hill brush':s.tool==='terrain-lower'?'Hollow brush':s.tool==='terrain-river'?'River brush':'Surroundings';
 return <div className="landscape-menus">
 {compact&&<div className="active-tool-strip"><strong>{label}</strong><button onClick={expand}>Change outdoor options</button><button onClick={()=>s.setTool('select')}>Done</button></div>}
 <div hidden={compact} className="outdoor-palette"><nav className="task-subtabs" aria-label="Landscape tools">{['Terrain','Plants','Surroundings'].map(label=><button key={label} aria-pressed={choice===label} onClick={()=>{s.setTool('select');setChoice(label)}}>{label}</button>)}</nav>
 <div className="landscape-detail is-open" aria-label={choice+' options'}>{choice==='Terrain'?<TerrainSettings onChoose={collapse}/>:choice==='Plants'?<PlantingSettings onPlace={onPlace} onChoose={collapse}/>:<Surroundings onView={onView} onBrowseLibrary={onBrowseLibrary} onChoose={collapse}/>}</div></div></div>;
}
