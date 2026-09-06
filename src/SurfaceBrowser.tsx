import {useEffect,useState} from 'react';
import {Check,MagnifyingGlass,PaintRoller,Wall,GridFour} from '@phosphor-icons/react';
import {usePlanner} from './store';
import {floorFinishes,wallFinishes,findFloorFinish,findWallFinish} from './surfaces';
import {PaintPicker} from './PaintPicker';

type Scope='sections'|'brush'|'whole'|'interior'|'exterior';
export function SurfaceBrowser(){
 const s=usePlanner(),floor=s.plan.floors.find(f=>f.id===s.activeFloorId)!;
 const [target,setTarget]=useState<'Floor'|'Walls'>(s.selectedWallId?'Walls':'Floor');
 const [scope,setScope]=useState<Scope>('sections'),[family,setFamily]=useState('All'),[search,setSearch]=useState(''),[pending,setPending]=useState<string>(),[message,setMessage]=useState('');
 useEffect(()=>{if(s.selectedWallId){setTarget('Walls');setScope('sections');setPending(undefined)}},[s.selectedWallId]);
 useEffect(()=>{setPending(undefined);setMessage('')},[s.activeFloorId]);
 const finishes=target==='Floor'?floorFinishes:wallFinishes,kind=target==='Floor'?'floorFinishId':'wallFinishId';
 const current=s.tool===(target==='Floor'?'floor-finish':'wall-finish')&&!s.selectedWallId?s.activeSurfaceFinish:target==='Walls'&&s.selectedWallId?floor.wallFinishes?.[s.selectedWallId]??floor.wallFinishId:floor[kind];
 const visible=finishes.filter(f=>(family==='All'||f.family===family)&&`${f.name} ${f.family} ${f.description??''}`.toLowerCase().includes(search.toLowerCase()));
 const chosen=(target==='Floor'?findFloorFinish:findWallFinish)(pending??current);
 const changeScope=(next:Scope)=>{setScope(next);setPending(undefined);setMessage('');s.setTool('select')};
 const choose=(id:string)=>{setMessage('');if(['whole','interior','exterior'].includes(scope))setPending(id);else if(target==='Walls'&&scope==='sections'&&s.selectedWallId)s.finishWall(s.selectedWallId,id);else s.setSurfaceBrush(target==='Floor'?'floor-finish':'wall-finish',id)};
 const apply=()=>{if(!pending)return;if(scope==='interior'||scope==='exterior')s.finishWallGroup(scope,pending);else s.setFloorFinish(kind,pending);setMessage(`Applied ${chosen.name}. Undo restores the previous finishes.`);setPending(undefined)};
 return <>
  <div className="task-subtabs" aria-label="Surface">{(['Walls','Floor'] as const).map(t=><button key={t} aria-pressed={target===t} onClick={()=>{s.setTool('select');setTarget(t);setScope(t==='Walls'?'brush':'sections');setFamily(t==='Walls'?'Paint':'All');setSearch('');setPending(undefined);setMessage('')}}>{t==='Walls'?<PaintRoller/>:<GridFour/>}{t}</button>)}</div>
  <div className="finish-workflow">
   <h2>{target==='Floor'?'Flooring studio':'Paint & wall finishes'}</h2>
   <div className="scope-shortcuts" aria-label="Quick painting scope">
    <button aria-pressed={scope===(target==='Walls'?'brush':'sections')} onClick={()=>changeScope(target==='Walls'?'brush':'sections')}><PaintRoller/>{target==='Walls'?'Paint walls':'Paint tiles'}</button>
    <button aria-pressed={scope==='whole'} onClick={()=>changeScope('whole')}><Wall/>{target==='Walls'?'All walls':'Whole floor'}</button>
   </div>
   <label className="scope-control">Where to apply<select aria-label="Finish area" value={scope} onChange={e=>changeScope(e.target.value as Scope)}>
    <option value="sections">{target==='Walls'?'Selected wall':'Paint a section'}</option>
    {target==='Walls'&&<option value="brush">Paint multiple walls · click each wall</option>}
    <option value="whole">{target==='Walls'?'All walls on this floor':'Whole floor'}</option>
    {target==='Walls'&&<><option value="interior">Interior partition walls</option><option value="exterior">Outer boundary walls</option></>}
   </select></label>
   <p className="tool-hint">{scope==='brush'?'Choose once, then click each wall to paint. The brush stays active.':scope==='sections'?(target==='Floor'?'Drag over floor tiles, then confirm.':'Click a wall in your room, then choose its finish.'):'Choose a finish below, then apply. Only this floor changes.'}</p>
  </div>
  <div className="task-content finish-collection">
   <div className="tool-search"><MagnifyingGlass/><input aria-label="Search finishes" placeholder="Search color, material or size…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <div className="material-types" aria-label="Material type">{['All',...new Set(finishes.map(f=>f.family))].map(f=><button key={f} aria-pressed={family===f} onClick={()=>setFamily(f)}>{f}</button>)}</div>
   {target==='Walls'&&(family==='All'||family==='Paint')&&<PaintPicker onChoose={choose} search={search} selectedId={pending??current}/>}
   <div className="tool-visual-grid">{visible.map(f=><button key={f.id} aria-label={`${target}: ${f.name}`} aria-pressed={(pending??current)===f.id} onClick={()=>choose(f.id)}>{f.texture?<img loading="lazy" src={f.texture} alt=""/>:<span className="finish-color-preview" style={{background:f.color??'#f5f4ef'}}/>}<strong>{f.name}</strong>{f.description&&<small>{f.description}</small>}{(pending??current)===f.id&&<Check className="choice-check" weight="bold"/>}</button>)}</div>
   {!visible.length&&!(target==='Walls'&&(family==='Paint'||family==='All'))&&<p role="status">No matching materials.</p>}
  </div>
  <footer className="tool-footer finish-footer">
   <div className="finish-current">{chosen.texture?<img src={chosen.texture} alt=""/>:<span style={{background:chosen.color}}/>}<div><small>{pending?'Ready to apply':'Current finish'}</small><strong>{chosen.name}</strong></div></div>
   {pending?<div className="tool-footer-actions"><button onClick={()=>setPending(undefined)}>Cancel</button><button className="primary" onClick={apply}>Apply to {scope==='interior'?'interior walls':scope==='exterior'?'outer walls':target==='Floor'?'whole floor':'all walls'}</button></div>:(s.tool==='floor-finish'||s.tool==='wall-finish')&&<button onClick={()=>s.setTool('select')}>Done painting</button>}
   {message&&<p role="status">{message}</p>}
  </footer>
 </>;
}
