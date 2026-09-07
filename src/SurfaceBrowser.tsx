import {useEffect,useState,useRef} from 'react';
import {Check,MagnifyingGlass,PaintRoller,Wall,GridFour,Selection,BoundingBox,Sun} from '@phosphor-icons/react';
import {usePlanner} from './store';
import {floorFinishes,wallFinishes,findFloorFinish,findWallFinish} from './surfaces';
import {materialGroups} from './materialGroups';
import {PaintPicker} from './PaintPicker';

type Scope='sections'|'brush'|'whole'|'exterior';
export function SurfaceBrowser(){
 const collectionRef=useRef<HTMLDivElement>(null);
 const s=usePlanner(),floor=s.plan.floors.find(f=>f.id===s.activeFloorId)!;
 const [target,setTarget]=useState<'Floor'|'Walls'>(s.selectedWallId?'Walls':'Floor');
 const [scope,setScope]=useState<Scope>('sections'),[family,setFamily]=useState(s.selectedWallId?'Paint':'All'),[search,setSearch]=useState(''),[pending,setPending]=useState<string>(),[message,setMessage]=useState('');
 // Lighting belongs to the editor, not the lifetime of this panel.
 useEffect(()=>()=>{if(usePlanner.getState().wallSelectionActive)usePlanner.getState().setTool('select')},[]);
 useEffect(()=>{if(s.selectedWallId){setTarget('Walls');setFamily('Paint');setScope('sections');setPending(undefined)}},[s.selectedWallId]);
 useEffect(()=>{setPending(undefined);setMessage('')},[s.activeFloorId]);
 useEffect(()=>{if(collectionRef.current)collectionRef.current.scrollTop=0},[target,family,search]);
 const finishes=target==='Floor'?floorFinishes:wallFinishes,kind=target==='Floor'?'floorFinishId':'wallFinishId';
 const current=s.tool===(target==='Floor'?'floor-finish':'wall-finish')&&!s.selectedWallId?s.activeSurfaceFinish:target==='Walls'&&s.selectedWallId?floor.wallFinishes?.[s.selectedWallId]??floor.wallFinishId:floor[kind];
 const groups=materialGroups(finishes),visible=groups.filter(g=>g.variants.some(f=>(family==='All'||f.family===family)&&`${f.name} ${f.family} ${f.description??''}`.toLowerCase().includes(search.toLowerCase())));
 const chosen=(target==='Floor'?findFloorFinish:findWallFinish)(pending??current);
 const variants=groups.find(g=>g.variants.some(f=>f.id===chosen.id))?.variants??[];
 const changeScope=(next:Scope)=>{setScope(next);setPending(undefined);setMessage('');s.setTool('select');if(target==='Walls'&&next==='sections')s.beginWallSelection()};
 const choose=(id:string)=>{setMessage('');usePlanner.setState({activeSurfaceFinish:id});if(scope==='whole'||scope==='exterior'||(target==='Walls'&&scope==='sections'))setPending(id);else s.setSurfaceBrush(target==='Floor'?'floor-finish':'wall-finish',id)};
 const count=s.wallSelectionActive?s.paintWallIds.length:s.selectedWallId?1:0;
 const action=scope==='sections'&&target==='Walls'?`Paint ${count} wall${count===1?'':'s'}`:scope==='exterior'?'Paint outer walls':target==='Floor'?'Apply to whole floor':'Paint all walls';
 const apply=()=>{if(!pending)return;if(scope==='sections'&&target==='Walls'){if(s.wallSelectionActive)s.finishSelectedWalls(pending);else if(s.selectedWallId)s.finishWall(s.selectedWallId,pending);else return;}else if(scope==='exterior')s.finishWallGroup('exterior',pending);else s.setFloorFinish(kind,pending);setMessage(`Applied ${chosen.name}. Undo restores the previous finishes.`);setPending(undefined)};
 const scopes=target==='Walls'?[{id:'brush',name:'Brush',icon:PaintRoller},{id:'sections',name:'Select walls',icon:Wall},{id:'whole',name:'All walls',icon:Selection},{id:'exterior',name:'Outer walls',icon:BoundingBox}]:[{id:'sections',name:'Paint area',icon:PaintRoller},{id:'whole',name:'Whole floor',icon:GridFour}];
 return <>
  <div className="task-subtabs" aria-label="Surface">{(['Walls','Floor'] as const).map(t=><button key={t} aria-pressed={target===t} onClick={()=>{s.setTool('select');setTarget(t);setScope(t==='Walls'?'brush':'sections');setFamily(t==='Walls'?'Paint':'All');setSearch('');setPending(undefined);setMessage('')}}>{t==='Walls'?<PaintRoller/>:<GridFour/>}{t}</button>)}</div>
  <div className="finish-workflow guided-workflow">
   <h2>Make it yours</h2>
   <h3 className="finish-step"><span>1</span>Select surfaces</h3>
   <div className="scope-cards" aria-label="Painting scope">{scopes.map(({id,name,icon:Icon})=><button key={id} aria-pressed={scope===id} onClick={()=>changeScope(id as Scope)}><Icon size={30} weight="light"/>{name}</button>)}</div>
   {target==='Walls'&&scope==='sections'?<div className="selection-summary"><span aria-live="polite">{count} wall{count===1?'':'s'} selected</span><button onClick={()=>{s.clearWallSelection();if(s.selectedWallId){s.setTool('select');s.beginWallSelection()}}}>Clear</button></div>:<p className="tool-hint">{scope==='brush'?'Choose a color, then click walls to paint.':scope==='sections'?'Drag over floor tiles, then confirm.':'Applies on this floor only.'}</p>}
  </div>
  <div ref={collectionRef} className="task-content finish-collection guided-collection">
   <h3 className="finish-step"><span>2</span>{target==='Walls'?'Choose a color or finish':'Choose a material'}</h3>
   <div className="tool-search"><MagnifyingGlass/><input aria-label="Search finishes" placeholder={target==='Walls'?'Search colors or finishes':'Search materials'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
   {target==='Floor'?<div className="material-types" aria-label="Material type">{['All',...new Set(finishes.map(f=>f.family))].map(f=><button key={f} aria-pressed={family===f} onClick={()=>setFamily(f)}>{f}</button>)}</div>:<details className="wall-material-types"><summary>Paint & other finishes</summary><div className="material-types" aria-label="Material type">{['All',...new Set(finishes.map(f=>f.family))].map(f=><button key={f} aria-pressed={family===f} onClick={()=>setFamily(f)}>{f}</button>)}</div></details>}
   {target==='Walls'&&(family==='All'||family==='Paint')&&<PaintPicker onChoose={choose} search={search} selectedId={pending??current}/>}
   <div className="tool-visual-grid">{visible.map(g=>{const f=g.variants.find(v=>v.id===(pending??current))??g.variants[0],selected=g.variants.some(v=>v.id===(pending??current));return <button key={g.name} aria-label={`${target}: ${g.name}`} aria-pressed={selected} onClick={()=>choose(f.id)}>{f.texture?<img loading="lazy" src={f.texture} alt=""/>:<span className="finish-color-preview" style={{background:f.color??'#f5f4ef'}}/>}<strong>{g.name}</strong><small>{g.variants.length>1?`${g.variants.length} tile sizes`:f.description}</small>{selected&&<Check className="choice-check" weight="bold"/>}</button>})}</div>
   {!visible.length&&!(target==='Walls'&&(family==='Paint'||family==='All'))&&<p role="status">No matching materials.</p>}
  </div>
  <footer className="tool-footer finish-footer">
   <div className="finish-current">{chosen.texture?<img src={chosen.texture} alt=""/>:<span style={{background:chosen.color}}/>}<div><small>{pending?'Ready to apply':'Current finish'}</small><strong>{chosen.name}</strong></div></div>
   {variants.length>1&&<div className="tile-formats" aria-label="Tile size">{variants.map(v=><button key={v.id} aria-pressed={chosen.id===v.id} onClick={()=>choose(v.id)}>{v.name.split('\u00b7').at(-1)?.trim()}</button>)}</div>}
   <label className="neutral-preview"><Sun size={20}/><span>Neutral preview lighting</span><input type="checkbox" role="switch" checked={s.neutralPreview} onChange={e=>s.setNeutralPreview(e.target.checked)}/></label>
   {pending?<div className="tool-footer-actions"><button className="primary" disabled={target==='Walls'&&scope==='sections'&&!count} onClick={apply}>{action}</button><button onClick={()=>setPending(undefined)}>Cancel</button></div>:(s.tool==='floor-finish'||s.tool==='wall-finish')&&<button onClick={()=>s.setTool('select')}>Done painting</button>}
   {message&&<p role="status">{message}</p>}
  </footer>
 </>;
}
