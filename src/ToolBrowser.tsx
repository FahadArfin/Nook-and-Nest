import {modelAssetPath} from './modelAssetPath';
import {GoogleSceneryControls} from './GoogleSceneryControls';
import {useEffect,useState} from 'react';
import {Armchair,Wall,Plant,Door,FrameCorners,GridFour,Trash} from '@phosphor-icons/react';
import {usePlanner} from './store';
import {SurfaceBrowser} from './SurfaceBrowser';
import {WallConstructionControls} from './WallConstructionControls';
import {MeasuredRoom} from './MeasuredRoom';
import {TerrainSettings} from './TerrainSettings';
import {PlantingSettings} from './PlantingSettings';
import {sceneryOptions} from './outdoorCatalog';
import type {CatalogItem} from './types';
import './tool-browser.css';

type Destination='Decorate'|'Build'|'Landscape';
export function ToolBrowser({onPlace,onViewScenery,embedded=false,initialDestination='Decorate',onBrowseLibrary}:{onPlace(item:CatalogItem):void;onViewScenery?:()=>void;embedded?:boolean;initialDestination?:Destination;onBrowseLibrary?:()=>void}){
 const s=usePlanner();
 const [destination,setDestination]=useState<Destination>(initialDestination);
 const [landscape,setLandscape]=useState(initialDestination==='Landscape'?'Terrain':'Plants');
 const [build,setBuild]=useState('Walls');
 useEffect(()=>{
  if(embedded)return;
  if(s.tool.startsWith('terrain-')){setDestination('Landscape');setLandscape('Terrain')}
  else if(s.tool==='planting'){setDestination('Landscape');setLandscape('Plants')}
  else if(['wall','wall-cut','measured-room','paint','erase'].includes(s.tool)){setDestination('Build');setBuild(old=>s.tool==='wall-cut'&&old==='Openings'?'Openings':s.tool==='wall'||s.tool==='wall-cut'?'Walls':'Floor area')}
  else if(s.tool==='floor-finish'||s.tool==='wall-finish')setDestination('Decorate');
 },[s.tool]);
 useEffect(()=>{if(s.selectedWallId&&destination!=='Build')setDestination('Decorate')},[s.selectedWallId]);
 const navigate=(next:Destination)=>{if(s.tool!=='select')s.setTool('select');setDestination(next)};
 return <aside className={embedded?"embedded-tools tool-browser":"inspector-panel tool-browser"} aria-label="Home tools">
  {!embedded&&<nav className="task-tabs" aria-label="Editing tasks">{([{name:'Decorate',icon:Armchair},{name:'Build',icon:Wall},{name:'Landscape',icon:Plant}] as const).map(({name,icon:Icon})=><button key={name} aria-pressed={destination===name} onClick={()=>navigate(name)}><Icon size={21}/>{name}</button>)}</nav>}
  {destination==='Decorate'&&<SurfaceBrowser/>}
  {destination==='Build'&&<><div className="task-subtabs" aria-label="Building tools">{['Walls','Openings','Floor area'].map(t=><button key={t} aria-pressed={build===t} onClick={()=>{s.setTool(embedded&&t==='Walls'?'wall':'select');setBuild(t)}}>{t}</button>)}</div><div className="task-content"><h2>{build==='Walls'?'Shape your walls':build==='Openings'?'Doors & windows':'Shape your floor'}</h2>{build==='Walls'?<WallConstructionControls embedded toolChoices={!embedded}/>:build==='Openings'?<><div className="build-choices">{([{name:'Doors',icon:Door},{name:'Windows',icon:FrameCorners},{name:'Stairs',icon:GridFour}] as const).map(({name,icon:Icon})=><button key={name} onClick={()=>{s.setCategory(name);s.setSearch('');s.setTool('select');onBrowseLibrary?.()}}><Icon size={32}/><strong>{name}</strong><small>Browse the library</small></button>)}</div><div className="build-choices"><button onClick={()=>{s.setTool('wall-cut');setBuild('Openings')}}><Trash size={32}/><strong>Remove wall segment</strong><small>Drag the span to open</small></button></div>{s.tool==='wall-cut'&&<p className="tool-hint">Drag along a wall to make an open entrance. Undo restores it.</p>}</>:<><div className="task-subtabs"><button aria-pressed={s.tool==='paint'} onClick={()=>s.setTool('paint')}><GridFour/> Add floor</button><button aria-pressed={s.tool==='erase'} onClick={()=>s.setTool('erase')}><Trash/> Erase floor</button></div><p className="tool-hint">Drag a rectangle, then confirm.</p><MeasuredRoom/></>}</div></>}
  {destination==='Landscape'&&<><div className="task-subtabs" aria-label="Landscape tools">{['Terrain','Plants','Surroundings'].map(t=><button key={t} aria-pressed={landscape===t} onClick={()=>{s.setTool('select');setLandscape(t)}}>{t}</button>)}</div>{landscape==='Plants'?<PlantingSettings onPlace={onPlace}/>:<div className="task-content">{landscape==='Terrain'?<TerrainSettings/>:<Surroundings onView={onViewScenery} onBrowseLibrary={onBrowseLibrary}/>}</div>}</>}
 </aside>;
}

export function Surroundings({onView,onBrowseLibrary,onChoose}:{onChoose?:()=>void;onView?:()=>void;onBrowseLibrary?:()=>void}){
 const s=usePlanner(),e=s.plan.environment??{background:'plain',grass:'off'};const [direction,setDirection]=useState(e.backdropRotation??0);useEffect(()=>setDirection(e.backdropRotation??0),[e.backdropRotation]);
 return <><h2>Your surroundings</h2><div className="scenery-previews">{sceneryOptions.filter(v=>v!=="plain").map(v=><button key={v} aria-label={`Preview ${v} surroundings`} aria-pressed={e.background===v} onClick={()=>{s.setEnvironment({background:v});onChoose?.()}}><img loading="lazy" src={modelAssetPath(`backdrop-${v}`,true)} alt=""/>{v==='city'?'Toronto':v}</button>)}</div><label>Backdrop<select aria-label="Surroundings" value={e.background} onChange={event=>{s.setEnvironment({background:event.target.value as typeof e.background});onChoose?.()}}>{sceneryOptions.map(v=><option key={v} value={v}>{({plain:'Plain ground',city:'Toronto downtown & harbour',suburban:'Tree-lined neighborhood',rural:'Woodland & river',farm:'Country farms',medieval:'Fantasy medieval'})[v]}</option>)}</select></label>{e.background==='city'&&<><label>City detail<select aria-label="City detail" value={e.citySource??'standard'} onChange={event=>s.setEnvironment({citySource:event.target.value as 'standard'|'google'})}><option value="standard">Standard - no Google requests</option><option value="google">Google Maps - photorealistic 3D</option></select></label>{e.citySource==='google'&&<><GoogleSceneryControls/><label>Apartment elevation (metres)<input type="number" min="100" max="400" step="10" value={e.cityHeight??180} onChange={event=>{const height=+event.target.value;if(height>=100&&height<=400)s.setEnvironment({cityHeight:height});}}/></label><p className="tool-hint">Photographic daytime scenery. Your apartment stays editable.</p></>}</>}<label>View direction<input aria-label="Scenery direction" type="range" min="0" max="360" step="15" value={direction} onChange={event=>setDirection(+event.target.value)} onPointerUp={()=>s.setEnvironment({backdropRotation:direction})} onKeyUp={()=>s.setEnvironment({backdropRotation:direction})}/><span>{direction}°</span></label><label>Ground grass<select aria-label="Ground grass" value={e.grass} onChange={event=>s.setEnvironment({grass:event.target.value as typeof e.grass})}><option value="off">Off</option><option value="sparse">Light grass</option><option value="lush">Fuller grass</option></select></label><p className="tool-hint">{e.background==='city'&&e.citySource==='google'?'Google Maps city imagery streams only as needed. Pause loading to keep the current detail.':e.background==='city'?'Toronto building shapes, aerial roofs and streets, and a rippling lake. Facade finishes are illustrative; windows light up at night.':e.background==='plain'?'A clear canvas around your home.':'Modeled scenery surrounds your editable garden.'}</p>{e.background==='city'&&e.citySource!=='google'&&<p className="tool-hint"><a href="/data/toronto/attribution.html" target="_blank" rel="noreferrer">City of Toronto · © OpenStreetMap contributors · Data & credits</a></p>}{e.background!=='plain'&&onView&&<button className="primary" onClick={onView}>View surroundings</button>}<button onClick={()=>{s.setCategory('Outdoor');s.setSearch('');s.setTool('select');onBrowseLibrary?.()}}>Browse outdoor furniture</button></>;
}

