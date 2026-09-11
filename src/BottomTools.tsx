import {readableLength} from './measurement';
import {useEffect,useState,useRef,useLayoutEffect} from 'react';
import {usePlanner} from './store';
import {Surroundings} from './ToolBrowser';
import {TerrainSettings} from './TerrainSettings';
import {PlantingSettings} from './PlantingSettings';
import type {CatalogItem} from './types';
import {X,SlidersHorizontal,Check} from '@phosphor-icons/react';
import {SurfaceBrowser} from './SurfaceBrowser';
import './bottom-tools.css';

export type BottomToolMode='paint'|'walls'|'erase'|'wall'|'landscape';
const titles:Record<BottomToolMode,string>={paint:'Paint surfaces',walls:'Wall finishes',erase:'Erase tools',wall:'Build tools',landscape:'Outdoors'};
export function BottomTools({mode,onClose,onPlace,onViewScenery,onBrowseLibrary,onResetDraft}:{onResetDraft?:()=>void;mode?:BottomToolMode;onBrowseLibrary?:()=>void;onClose:()=>void;onPlace:(item:CatalogItem)=>void;onViewScenery:()=>void}){
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
 useLayoutEffect(()=>{const el=panel.current;if(!el||!shown)return;const host=el.parentElement!;const labels={paint:'Paint',walls:'Paint',wall:'Build',landscape:'Outdoors',erase:'Erase'};const place=()=>{const button=Array.from(host.querySelectorAll<HTMLButtonElement>('.tool-dock button')).find(b=>b.textContent?.trim()===labels[shown]);if(!button)return;const h=host.getBoundingClientRect(),b=button.getBoundingClientRect(),width=el.offsetWidth;const center=h.width/2;el.style.left=center+'px';el.style.bottom=(h.bottom-b.top+12)+'px';el.style.transformOrigin=`${b.left+b.width/2-h.left-center+width/2}px bottom`};place();const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(place);observer?.observe(el);observer?.observe(host);window.addEventListener('resize',place);return()=>{observer?.disconnect();window.removeEventListener('resize',place)}},[shown]);
 if(!shown)return null;
 return <section ref={panel} className={`bottom-tools tool-browser bottom-tools-${shown} ${open?'is-open':''} ${compact?'is-compact':''}`} aria-label={titles[shown]} aria-hidden={!open} inert={!open}>
  <header><strong>{titles[shown]}</strong><button onClick={onClose} aria-label={shown==='paint'?'Close paint surfaces':'Close bottom tools'}><X size={20}/><span>Back to floor</span></button></header>
  <div className="bottom-tools-body" key={shown}>
   {shown==='paint'?<SurfaceBrowser onCompactChange={setCompact}/>:shown==='walls'?<SurfaceBrowser wallsOnly onCompactChange={setCompact}/>:shown==='landscape'?<LandscapeMenus onCompactChange={setCompact} onPlace={onPlace} onView={onViewScenery} onBrowseLibrary={onBrowseLibrary}/>:shown==='wall'?<BuildControls onResetDraft={onResetDraft}/>:null}

  </div>
 </section>;
}

function BuildControls({onResetDraft}:{onResetDraft?:()=>void}){
 const s=usePlanner();const target:'Walls'|'Floors'=s.tool==='paint'||s.tool==='erase'?'Floors':'Walls',remove=s.tool==='wall-cut'||s.tool==='erase';
 const choose=(next:typeof target,cut:boolean)=>{onResetDraft?.();s.setTool(next==='Walls'?(cut?'wall-cut':'wall'):(cut?'erase':'paint'))};
 return <div className="build-controls"><div role="group" aria-label="Build surface">{(['Walls','Floors'] as const).map(value=><button key={value} aria-pressed={target===value} onClick={()=>choose(value,remove)}>{value}</button>)}</div><div role="group" aria-label="Build action"><button aria-pressed={!remove} onClick={()=>choose(target,false)}>Add</button><button className="build-remove" aria-pressed={remove} onClick={()=>choose(target,true)}>Remove</button></div>{target==='Walls'&&!remove&&<WallHeightChoices/>}<small>{target==='Walls'&&!remove?'Drag to draw a wall.':'Drag an area, then confirm. Undo is available.'}</small></div>
}

function WallHeightChoices(){const s=usePlanner(),floor=s.plan.floors.find(f=>f.id===s.activeFloorId)!;return <div className="wall-height-choices" aria-label="New wall height">{[{name:'Full height',value:0},{name:'Half height',value:Math.round(floor.heightMm/2)}].map(p=><button key={p.name} aria-pressed={s.wallDrawHeight===p.value} onClick={()=>{s.setWallDrawHeight(p.value);s.setTool('wall')}}><span className={p.value?'half-wall-icon':'full-wall-icon'}/>{p.name}<small>{readableLength(p.value||floor.heightMm,s.plan.units)}</small></button>)}</div>}

function LandscapeMenus({onPlace,onView,onBrowseLibrary,onCompactChange}:{onPlace:(item:CatalogItem)=>void;onView:()=>void;onBrowseLibrary?:()=>void;onCompactChange:(compact:boolean)=>void}){
 const [choice,setChoice]=useState('Terrain'),[compact,setCompact]=useState(false);
 const collapse=()=>{setCompact(true);onCompactChange(true)};
 const expand=()=>{setCompact(false);onCompactChange(false)};
 const s=usePlanner();
 const label=s.tool==='planting'?'Plant brush':s.tool==='terrain-raise'?'Hill brush':s.tool==='terrain-lower'?'Hollow brush':s.tool==='terrain-river'?'River brush':'Surroundings';
 return <div className="landscape-menus">
 {compact&&<div className="active-tool-strip"><strong>{label}</strong><QuickBrushControls/><button className="compact-action" aria-label="Change outdoor options" title="Outdoor options" onClick={expand}><SlidersHorizontal size={20}/></button><button className="compact-action" aria-label="Done sculpting or planting" title="Done" onClick={()=>s.setTool('select')}><Check size={20}/></button></div>}
 <div hidden={compact} className="outdoor-palette"><nav className="task-subtabs" aria-label="Landscape tools">{['Terrain','Plants','Surroundings'].map(label=><button key={label} aria-pressed={choice===label} onClick={()=>{s.setTool('select');setChoice(label)}}>{label}</button>)}</nav>
 <div className="landscape-detail is-open" aria-label={choice+' options'}>{choice==='Terrain'?<TerrainSettings onChoose={collapse}/>:choice==='Plants'?<PlantingSettings onPlace={onPlace} onChoose={collapse}/>:<Surroundings onView={onView} onBrowseLibrary={onBrowseLibrary} onChoose={collapse}/>}</div></div></div>;
}

export function QuickBrushControls(){const s=usePlanner(),b=s.plantingBrush;
 if(s.tool==='planting')return <><label className="quick-range">Size <small>{readableLength(b.radius*1000,s.plan.units)}</small><input aria-label="Quick plant brush size" type="range" min={b.field?2:.5} max={b.field?32:4} step=".5" value={b.radius} onChange={e=>s.setPlantingBrush({...b,radius:+e.target.value})}/></label><label className="quick-range">Density <small>{b.density??1}×</small><input aria-label="Quick plant density" type="range" min="1" max="9" step="1" value={b.density??1} onChange={e=>s.setPlantingBrush({...b,density:+e.target.value})}/></label></>;
 if(s.tool.startsWith('terrain-'))return <><label className="quick-range">Size <small>{readableLength(s.terrainRadius*1000,s.plan.units)}</small><input aria-label="Quick terrain brush size" type="range" min=".5" max="8" step=".5" value={s.terrainRadius} onChange={e=>s.setTerrainBrush(+e.target.value,s.terrainStrength)}/></label><label className="quick-range">{s.tool==='terrain-river'?'Depth':'Strength'}<input aria-label="Quick terrain strength" type="range" min=".1" max="2" step=".1" value={s.terrainStrength} onChange={e=>s.setTerrainBrush(s.terrainRadius,+e.target.value)}/></label></>;
 return null;
}
