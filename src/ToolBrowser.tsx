import {useEffect,useState} from 'react';
import {Armchair,Wall,Plant,Check,MagnifyingGlass,Door,FrameCorners,GridFour,Trash} from '@phosphor-icons/react';
import {usePlanner} from './store';
import {floorFinishes,wallFinishes} from './surfaces';
import {WallConstructionControls} from './WallConstructionControls';
import {MeasuredRoom} from './MeasuredRoom';
import {PaintPicker} from './PaintPicker';
import {TerrainSettings} from './TerrainSettings';
import {PlantingSettings} from './PlantingSettings';
import {sceneryOptions} from './outdoorCatalog';
import type {CatalogItem} from './types';
import './tool-browser.css';

type Destination='Decorate'|'Build'|'Landscape';
export function ToolBrowser({onPlace,onViewScenery}:{onPlace(item:CatalogItem):void;onViewScenery?:()=>void}){
 const s=usePlanner();
 const [destination,setDestination]=useState<Destination>('Decorate');
 const [landscape,setLandscape]=useState('Plants');
 const [build,setBuild]=useState('Walls');
 useEffect(()=>{
  if(s.tool.startsWith('terrain-')){setDestination('Landscape');setLandscape('Terrain')}
  else if(s.tool==='planting'){setDestination('Landscape');setLandscape('Plants')}
  else if(['wall','wall-cut','measured-room','paint','erase'].includes(s.tool)){setDestination('Build');setBuild(old=>s.tool==='wall-cut'&&old==='Openings'?'Openings':s.tool==='wall'||s.tool==='wall-cut'?'Walls':'Floor area')}
  else if(s.tool==='floor-finish'||s.tool==='wall-finish')setDestination('Decorate');
 },[s.tool]);
 useEffect(()=>{if(s.selectedWallId&&destination!=='Build')setDestination('Decorate')},[s.selectedWallId]);
 const navigate=(next:Destination)=>{if(s.tool!=='select')s.setTool('select');setDestination(next)};
 return <aside className="inspector-panel tool-browser" aria-label="Home tools">
  <nav className="task-tabs" aria-label="Editing tasks">{([{name:'Decorate',icon:Armchair},{name:'Build',icon:Wall},{name:'Landscape',icon:Plant}] as const).map(({name,icon:Icon})=><button key={name} aria-pressed={destination===name} onClick={()=>navigate(name)}><Icon size={21}/>{name}</button>)}</nav>
  {destination==='Decorate'&&<SurfaceBrowser/>}
  {destination==='Build'&&<><div className="task-subtabs" aria-label="Building tools">{['Walls','Openings','Floor area'].map(t=><button key={t} aria-pressed={build===t} onClick={()=>{s.setTool('select');setBuild(t)}}>{t}</button>)}</div><div className="task-content"><h2>{build==='Walls'?'Shape your walls':build==='Openings'?'Doors & windows':'Shape your floor'}</h2>{build==='Walls'?<WallConstructionControls embedded/>:build==='Openings'?<><div className="build-choices">{([{name:'Doors',icon:Door},{name:'Windows',icon:FrameCorners},{name:'Stairs',icon:GridFour}] as const).map(({name,icon:Icon})=><button key={name} onClick={()=>{s.setCategory(name);s.setSearch('');s.setTool('select')}}><Icon size={32}/><strong>{name}</strong><small>Browse the library</small></button>)}</div><div className="build-choices"><button onClick={()=>{s.setTool('wall-cut');setBuild('Openings')}}><Trash size={32}/><strong>Remove wall segment</strong><small>Drag the span to open</small></button></div>{s.tool==='wall-cut'&&<p className="tool-hint">Drag along a wall to make an open entrance. Undo restores it.</p>}</>:<><div className="task-subtabs"><button aria-pressed={s.tool==='paint'} onClick={()=>s.setTool('paint')}><GridFour/> Add floor</button><button aria-pressed={s.tool==='erase'} onClick={()=>s.setTool('erase')}><Trash/> Erase floor</button></div><p className="tool-hint">Drag a rectangle, then confirm.</p><MeasuredRoom/></>}</div></>}
  {destination==='Landscape'&&<><div className="task-subtabs" aria-label="Landscape tools">{['Terrain','Plants','Surroundings'].map(t=><button key={t} aria-pressed={landscape===t} onClick={()=>{s.setTool('select');setLandscape(t)}}>{t}</button>)}</div>{landscape==='Plants'?<PlantingSettings onPlace={onPlace}/>:<div className="task-content">{landscape==='Terrain'?<TerrainSettings/>:<Surroundings onView={onViewScenery}/>}</div>}</>}
 </aside>;
}

function SurfaceBrowser(){
 const s=usePlanner(),floor=s.plan.floors.find(f=>f.id===s.activeFloorId)!;
 const [target,setTarget]=useState<'Floor'|'Walls'>(s.selectedWallId?'Walls':'Floor'),[scope,setScope]=useState('sections'),[family,setFamily]=useState('All'),[search,setSearch]=useState(''),[pending,setPending]=useState<string>();
 useEffect(()=>{if(s.selectedWallId){setTarget('Walls');setScope('sections');setFamily('All');setSearch('');setPending(undefined)}},[s.selectedWallId]);
 useEffect(()=>{setPending(undefined)},[s.activeFloorId]);
 const finishes=target==='Floor'?floorFinishes:wallFinishes,kind=target==='Floor'?'floorFinishId':'wallFinishId';
 const current=scope==='sections'&&s.tool===(target==='Floor'?'floor-finish':'wall-finish')?s.activeSurfaceFinish:target==='Walls'&&s.selectedWallId?floor.wallFinishes?.[s.selectedWallId]:floor[kind];
 const visible=finishes.filter(f=>(family==='All'||f.family===family)&&`${f.name} ${f.family}`.toLowerCase().includes(search.toLowerCase()));
 return <><div className="task-subtabs" aria-label="Surface">{(['Floor','Walls'] as const).map(t=><button key={t} aria-pressed={target===t} onClick={()=>{s.setTool('select');setTarget(t);setFamily('All');setSearch('');setPending(undefined)}}>{t}</button>)}</div><div className="task-content"><h2>{target==='Floor'?'Finish your floor':'Color your walls'}</h2><label className="scope-control">Apply to<select aria-label="Finish area" value={scope} onChange={e=>{setScope(e.target.value);setPending(undefined);s.setTool('select')}}><option value="sections">{target==='Floor'?'Paint a section':'Selected wall'}</option><option value="whole">{target==='Floor'?'Whole floor':'All walls on this floor'}</option></select></label><div className="tool-search"><MagnifyingGlass/><input aria-label="Search finishes" placeholder="Search materials…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="material-types" aria-label="Material type">{['All',...new Set(finishes.map(f=>f.family))].map(f=><button key={f} aria-pressed={family===f} onClick={()=>setFamily(f)}>{f}</button>)}</div><>{target==='Walls'&&(family==='All'||family==='Paint')&&<PaintPicker onChoose={id=>{if(scope==='whole')setPending(id);else if(s.selectedWallId)s.finishWall(s.selectedWallId,id);else s.setSurfaceBrush('wall-finish',id)}}/>}</><div className="tool-visual-grid">{visible.map(f=><button key={f.id} aria-label={`${target}: ${f.name}`} aria-pressed={(pending??current)===f.id} onClick={()=>{if(scope==='whole')setPending(f.id);else if(target==='Walls'&&s.selectedWallId)s.finishWall(s.selectedWallId,f.id);else s.setSurfaceBrush(target==='Floor'?'floor-finish':'wall-finish',f.id)}}><img src={f.texture} alt=""/><strong>{f.name}</strong>{(pending??current)===f.id&&<Check className="choice-check" weight="bold"/>}</button>)}</div>{!visible.length&&<p role="status">No matching materials.</p>}</div><footer className="tool-footer">{pending?<button className="primary" onClick={()=>{s.setFloorFinish(kind,pending);setPending(undefined)}}>Apply to {target==='Floor'?'whole floor':'all walls'}</button>:<p>{scope==='whole'?'Choose a material to preview your choice.':target==='Floor'?'Choose a finish. Drag a section, then confirm.':'Select a wall, then choose its finish.'}</p>}{(s.tool==='floor-finish'||s.tool==='wall-finish')&&<button onClick={()=>s.setTool('select')}>Done editing</button>}</footer></>;
}

function Surroundings({onView}:{onView?:()=>void}){
 const s=usePlanner(),e=s.plan.environment??{background:'plain',grass:'off'};const [direction,setDirection]=useState(e.backdropRotation??0);useEffect(()=>setDirection(e.backdropRotation??0),[e.backdropRotation]);
 return <><h2>Your surroundings</h2><label>Backdrop<select aria-label="Surroundings" value={e.background} onChange={event=>s.setEnvironment({background:event.target.value as typeof e.background})}>{sceneryOptions.map(v=><option key={v} value={v}>{({plain:'Plain ground',city:'Toronto downtown & harbour',suburban:'Tree-lined neighborhood',rural:'Woodland & river',farm:'Country farms',medieval:'Fantasy medieval'})[v]}</option>)}</select></label><label>View direction<input aria-label="Scenery direction" type="range" min="0" max="360" step="15" value={direction} onChange={event=>setDirection(+event.target.value)} onPointerUp={()=>s.setEnvironment({backdropRotation:direction})} onKeyUp={()=>s.setEnvironment({backdropRotation:direction})}/><span>{direction}°</span></label><label>Ground grass<select aria-label="Ground grass" value={e.grass} onChange={event=>s.setEnvironment({grass:event.target.value as typeof e.grass})}><option value="off">Off</option><option value="sparse">Light grass</option><option value="lush">Fuller grass</option></select></label><p className="tool-hint">{e.background==='city'?'Real Toronto footprints and available heights. Missing heights and facade details are estimated. Windows light up in night mode.':e.background==='plain'?'A clear canvas around your home.':'Modeled scenery surrounds your editable garden.'}</p>{e.background==='city'&&<p className="tool-hint"><a href="/data/toronto/attribution.html" target="_blank" rel="noreferrer">© OpenStreetMap contributors · Overture Maps Foundation · Data & credits</a></p>}{e.background!=='plain'&&onView&&<button className="primary" onClick={onView}>View surroundings</button>}<button onClick={()=>{s.setCategory('Outdoor');s.setSearch('');s.setTool('select')}}>Browse outdoor furniture</button></>;
}
