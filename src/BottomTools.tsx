import {PaintBrush,Trash,Wall,X,GridFour} from '@phosphor-icons/react';
import {SurfaceBrowser} from './SurfaceBrowser';
import {WallConstructionControls} from './WallConstructionControls';
import {usePlanner} from './store';
import './bottom-tools.css';

export type BottomToolMode='paint'|'erase'|'wall';
export function BottomTools({mode,onMode,onClose}:{mode:BottomToolMode;onMode:(mode:BottomToolMode)=>void;onClose:()=>void}){
 const s=usePlanner();
 return <section className={`bottom-tools tool-browser bottom-tools-${mode}`} aria-label={mode==='paint'?'Floor finishes':mode==='erase'?'Erase tools':'Wall tools'}>
  <header><nav aria-label="Bottom editing tools">{([{id:'paint',label:'Paint tiles',icon:PaintBrush},{id:'erase',label:'Erase',icon:Trash},{id:'wall',label:'Add wall',icon:Wall}] as const).map(({id,label,icon:Icon})=><button key={id} aria-pressed={mode===id} onClick={()=>onMode(id)}><Icon size={20}/>{label}</button>)}</nav><button onClick={onClose} aria-label={mode==='paint'?'Close floor finishes':'Close bottom tools'}><X size={20}/><span>Back to floor</span></button></header>
  <div className="bottom-tools-body" key={mode}>
   {mode==='paint'?<SurfaceBrowser floorOnly/>:mode==='wall'?<><div className="bottom-tool-intro"><h2>Add a wall</h2><p>Drag between two points in your apartment. Ends snap to nearby walls.</p></div><WallConstructionControls embedded toolChoices={false}/></>:<><div className="bottom-tool-intro"><h2>What to erase?</h2><p>Choose a surface, then drag over the area in your apartment. Undo restores your changes.</p><div className="erase-targets"><button aria-pressed={s.tool==='erase'} onClick={()=>s.setTool('erase')}><GridFour size={24}/>Floor area</button><button aria-pressed={s.tool==='wall-cut'} onClick={()=>s.setTool('wall-cut')}><Wall size={24}/>Wall section</button></div></div><div className="erase-settings">{s.tool==='wall-cut'?<WallConstructionControls embedded toolChoices={false}/>:<><h3>Erase floor area</h3><p>Drag a rectangle, then use the checkmark to confirm or × to cancel.</p><p>To remove furniture, select the piece in Arrange and use its × button.</p></>}</div></>}
  </div>
 </section>;
}
