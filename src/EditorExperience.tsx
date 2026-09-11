import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowCounterClockwise,Check,GridFour,Info,PaintBrush,PushPin,SlidersHorizontal,SquaresFour,X} from '@phosphor-icons/react';
import {AccessibleDialog} from './AccessibleDialog';
import {ToolPopover} from './CompactToolPopovers';
import {QuickBrushControls} from './BottomTools';
import {catalog} from './catalog';
import {describeEdit} from './editorFeedback';
import {dismissEditorHint,rememberFinish,rememberModel,toggleQuickPin,useEditorPreferences,type QuickPin} from './editorPreferences';
import {retryModelFailures,useModelFailures} from './modelLoadFeedback';
import {usePlanner} from './store';
import {floorFinishes,wallFinishes} from './surfaces';
import type {PlanDocumentV1} from './types';
import './editor-experience.css';

export type EditorAction={label:string;icon:typeof GridFour;run():void;disabled?:boolean;pressed?:boolean};
export function MobileEditorActions({actions}:{actions:EditorAction[]}){
  const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const mq=window.matchMedia?.('(min-width:701px)');if(!mq)return;const resize=()=>{if(mq.matches)setOpen(false);};mq.addEventListener('change',resize);return()=>mq.removeEventListener('change',resize);},[]);
  return <div className="mobile-editor-actions"><button ref={trigger} aria-label="Editor actions" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><SquaresFour size={20}/>Actions</button>{open&&<AccessibleDialog returnFocus={trigger} label="Editor actions" onClose={()=>setOpen(false)}><div className="editor-actions-sheet"><header><div><span className="eyebrow">Your workspace</span><h2>Editor actions</h2></div><button aria-label="Close editor actions" onClick={()=>setOpen(false)}><X/></button></header><div className="editor-actions-grid">{actions.map(({label,icon:Icon,run,disabled,pressed})=><button key={label} disabled={disabled} aria-pressed={pressed} onClick={()=>{setOpen(false);requestAnimationFrame(run);}}><Icon size={24}/><span>{label}</span></button>)}</div></div></AccessibleDialog>}</div>;
}

export function EmptyCanvasHint({onBuild}:{onBuild():void}){
  const prefs=useEditorPreferences();
  if(prefs.dismissedHints.includes('empty-canvas'))return null;
  return <div className="empty-canvas-hint"><button onClick={onBuild}><GridFour size={17}/>Start with a floor</button><span>or drag in a piece</span><button className="hint-close" aria-label="Dismiss canvas tip" onClick={()=>dismissEditorHint('empty-canvas')}><X size={15}/></button></div>;
}

export function PlacementTip(){const prefs=useEditorPreferences();if(prefs.dismissedHints.includes('placement'))return null;return <div className="placement-first-tip"><Info size={16}/><span>Preview first. <kbd>Enter</kbd> places · <kbd>Esc</kbd> cancels · <kbd>R</kbd> rotates</span><button aria-label="Dismiss placement tip" onClick={()=>dismissEditorHint('placement')}><X size={15}/></button></div>;}

export function QuickPinSettings(){const prefs=useEditorPreferences();return <fieldset className="quick-pin-settings"><legend><PushPin size={15}/>Keep close</legend>{([{id:'brush',name:'Brush size & strength'},{id:'finishes',name:'Recent finishes'},{id:'grid',name:'Grid labels'}] as {id:QuickPin;name:string}[]).map(pin=><label key={pin.id}><span>{pin.name}</span><input type="checkbox" checked={prefs.pins.includes(pin.id)} onChange={()=>toggleQuickPin(pin.id)}/></label>)}</fieldset>;}

export function PinnedControls({onOpen}:{onOpen?:()=>void}={}){
  const prefs=useEditorPreferences(),s=usePlanner(),anchor=useRef<HTMLButtonElement>(null),[open,setOpen]=useState<'brush'|'finishes'>();
  const brushing=s.tool==='planting'||s.tool.startsWith('terrain-');
  const finishes=prefs.recentFinishes.map(id=>floorFinishes.find(f=>f.id===id)??wallFinishes.find(f=>f.id===id)).filter(f=>!!f);
  useEffect(()=>{if(open==='brush'&&!brushing)setOpen(undefined);},[brushing,open]);
  useEffect(()=>{const changeSize=(event:KeyboardEvent)=>{
    if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||!['[',']'].includes(event.key)||(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable=true],dialog')))return;
    const state=usePlanner.getState(),delta=event.key==='['?-.5:.5;
    if(state.tool==='planting'){const b=state.plantingBrush;state.setPlantingBrush({...b,radius:Math.max(b.field?2:.5,Math.min(b.field?32:4,b.radius+delta))});event.preventDefault();}
    else if(state.tool.startsWith('terrain-')){state.setTerrainBrush(Math.max(.5,Math.min(8,state.terrainRadius+delta)),state.terrainStrength);event.preventDefault();}
  };window.addEventListener('keydown',changeSize);return()=>window.removeEventListener('keydown',changeSize);},[]);
  if(!prefs.pins.length)return null;
  const toggle=(value:'brush'|'finishes',button:HTMLButtonElement)=>{anchor.current=button;if(open!==value)onOpen?.();setOpen(open===value?undefined:value);};
  return <div className="pinned-controls" role="group" aria-label="Pinned controls">
    {prefs.pins.includes('grid')&&<button title="Grid labels" aria-label="Pinned grid labels" aria-pressed={s.plan.camera.showGrid} onClick={()=>s.toggleCameraSetting('showGrid')}><GridFour size={19}/></button>}
    {prefs.pins.includes('brush')&&brushing&&<button title="Brush controls" aria-label="Pinned brush controls" aria-expanded={open==='brush'} onClick={e=>toggle('brush',e.currentTarget)}><SlidersHorizontal size={19}/></button>}
    {prefs.pins.includes('finishes')&&<button title="Recent finishes" aria-label="Pinned recent finishes" aria-expanded={open==='finishes'} onClick={e=>toggle('finishes',e.currentTarget)}><PaintBrush size={19}/></button>}
    <ToolPopover anchor={anchor} open={!!open} side="above" label="Pinned options" onClose={()=>setOpen(undefined)}>{open==='brush'?<div className="pinned-brush"><QuickBrushControls/></div>:<div className="pinned-finishes"><strong>Recent finishes</strong>{finishes.length?<div className="quick-finishes">{finishes.map(f=><button key={f.id} aria-label={`Paint with ${f.name}`} title={f.name} style={{backgroundColor:f.color??'#e4d7bd',backgroundImage:f.texture?`url(${f.texture})`:undefined}} onClick={()=>{s.setSurfaceBrush(floorFinishes.some(v=>v.id===f.id)?'floor-finish':'wall-finish',f.id);rememberFinish(f.id);setOpen(undefined);}}/>)}</div>:<p>Choose a finish in Paint to keep it here.</p>}</div>}</ToolPopover>
  </div>;
}

export function EditorFeedback({draftCatalogId}:{draftCatalogId?:string}){
  const [notice,setNotice]=useState<{text:string;plan:PlanDocumentV1}>();
  const plan=usePlanner(s=>s.plan),failures=useModelFailures();
  const modelIds=useMemo(()=>new Set(plan.furniture.map(p=>p.catalogId)),[plan.furniture]);
  const visibleFailures=failures.filter(f=>modelIds.has(f.id)||f.id===draftCatalogId);
  useEffect(()=>usePlanner.subscribe((next,previous)=>{
    if(next.plan===previous.plan)return;
    // A toast only describes a newly committed edit, never undo, navigation or a draft.
    if(next.past.at(-1)?.plan!==previous.plan)return;
    const text=describeEdit(previous.plan,next.plan);
    if(text)setNotice({text,plan:next.plan});
    if(next.plan.furniture.length===previous.plan.furniture.length+1){const item=next.plan.furniture.at(-1);if(item&&catalog.some(c=>c.id===item.catalogId))rememberModel(item.catalogId);}
  }),[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(undefined),7000);return()=>clearTimeout(timer);},[notice]);
  const current=!draftCatalogId&&notice?.plan===plan;
  return <div className="editor-feedback">
    {visibleFailures.length>0&&<div className="model-recovery" role="status"><Info size={18}/><span>{visibleFailures.length===1?'A detailed model is':'Some detailed models are'} unavailable. Simplified previews are shown.</span><button disabled={visibleFailures.every(f=>f.retrying)} onClick={()=>retryModelFailures(visibleFailures.map(f=>f.id))}>{visibleFailures.every(f=>f.retrying)?'Retrying…':'Retry models'}</button></div>}
    {current&&notice&&<div className="edit-toast"><span role="status"><Check size={18}/>{notice.text}</span><button aria-label={`Undo: ${notice.text}`} onClick={()=>{if(usePlanner.getState().plan===notice.plan)usePlanner.getState().undo();setNotice(undefined);}}><ArrowCounterClockwise size={16}/>Undo</button><button aria-label="Dismiss edit confirmation" onClick={()=>setNotice(undefined)}><X size={16}/></button></div>}
  </div>;
}
