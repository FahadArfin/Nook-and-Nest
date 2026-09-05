import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowCounterClockwise, ArrowClockwise, Check, FileArrowUp, GridFour, Hand, Minus, Plus, Ruler, Trash, X } from '@phosphor-icons/react';
import { catalog, isWallOpening } from './catalog';
import { uid } from './domain';
import { floorBoundaryWalls } from './floorGeometry';
import { blueprintPlan, blueprintProblems, draftFromFloor, fixtureAt, isFixedPiece, roomKinds, roomGroups, type BlueprintDraft, type BlueprintRoom, type RoomKind } from './blueprint';
import { renderReference, type PlanReference } from './blueprintImport';
import {recognizeReference,draftFromRecognition} from './blueprintRecognition';
import { snapWindow } from './windows';
import { usePlanner } from './store';
import type { PlanDocumentV1 } from './types';
import './blueprint.css';

type Point={x:number;z:number};
type Mode='select'|'room'|'wall'|'fixture'|'scale'|'pan';
const emptyDraft=():BlueprintDraft=>({rooms:[],walls:[],omittedWalls:[],fixtures:[]});
const colors:Record<RoomKind,string>={Living:'#d8dfc5',Bedroom:'#e6d4ce',Dining:'#eadab4',Office:'#c9dddd',Kitchen:'#ead5ad',Bathroom:'#bfdae3',Laundry:'#d1cce4',Hall:'#e5e1d6',Outdoor:'#bcd2ae',Closet:'#ddd2bd'};
function LengthField({label,value,factor,onChange}:{label:string;value:number;factor:number;onChange:(v:number)=>void}) {
  const [text,setText]=useState('');useEffect(()=>setText((value/factor).toFixed(factor===1?0:3)),[value,factor]);
  return <label>{label}<input type="number" step="any" value={text} onChange={e=>setText(e.target.value)} onBlur={()=>{const n=Number(text);if(text.trim()&&Number.isFinite(n))onChange(Math.round(n*factor));else setText((value/factor).toFixed(3));}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
export function BlueprintStudio({onClose,onCreated}:{onClose:()=>void;onCreated?:()=>void}) {
  const [base]=useState(()=>usePlanner.getState().plan),[floorId]=useState(()=>usePlanner.getState().activeFloorId);
  const [initial]=useState(()=>draftFromFloor(base,floorId));
  const [draft,setDraft]=useState<BlueprintDraft>(initial),[past,setPast]=useState<BlueprintDraft[]>([]),[future,setFuture]=useState<BlueprintDraft[]>([]);
  const [mode,setMode]=useState<Mode>('select'),[kind,setKind]=useState<RoomKind>('Living'),[selected,setSelected]=useState<string>(),[review,setReview]=useState(false),[checked,setChecked]=useState(false);
  const [reference,setReference]=useState<PlanReference>(),[file,setFile]=useState<File>(),[page,setPage]=useState(1),[rotation,setRotation]=useState(0),[loading,setLoading]=useState(false),[opacity,setOpacity]=useState(.65),[imageScale,setImageScale]=useState(10),[calibrated,setCalibrated]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[unit,setUnit]=useState<'m'|'ft'|'mm'>(base.units==='imperial'?'ft':'m');
  const [analysisNotes,setAnalysisNotes]=useState<string[]>([]),[printedDimensions,setPrintedDimensions]=useState<string[]>([]);
  const analysisAbort=useRef<AbortController | undefined>(undefined);
  const [scaleLine,setScaleLine]=useState<{a:Point;b:Point}>(),[knownLength,setKnownLength]=useState(''),[fixtureId,setFixtureId]=useState('washer');
  const [view,setView]=useState({x:-500,z:-500,width:14000,height:11000}),[cursor,setCursor]=useState<Point>();
  const [gesture,setGesture]=useState<{a:Point;b:Point;before:BlueprintDraft;selected?:string;mode:Mode;view:typeof view}>();
  const svgRef=useRef<SVGSVGElement>(null),dialogRef=useRef<HTMLDialogElement>(null),loadGeneration=useRef(0),uploadRef=useRef<HTMLInputElement>(null);
  const factor=unit==='m'?1000:unit==='ft'?304.8:1;
  const floorName=base.floors.find(f=>f.id===floorId)!.name;
  const currentPlan=usePlanner(s=>s.plan);
  const stale=currentPlan!==base;
  useEffect(()=>{dialogRef.current?.showModal();return()=>{loadGeneration.current++;analysisAbort.current?.abort();};},[]);
  const computed=useMemo(()=>{try{return {plan:blueprintPlan(base,floorId,draft),error:''};}catch(e){return {plan:undefined,error:(e as Error).message};}},[base,floorId,draft]);
  const plan=computed.plan,floor=plan?.floors.find(f=>f.id===floorId);
  const walls=useMemo(()=>floor?[...floorBoundaryWalls(floor,base.gridSizeMm),...floor.walls]:[],[floor,base.gridSizeMm]);
  const problems=useMemo(()=>plan?blueprintProblems(plan,floorId):[],[plan,floorId]);
  const groupedRooms=useMemo(()=>roomGroups(draft.rooms),[draft.rooms]);
  const spaces=groupedRooms.filter(r=>r.kind!=='Hall'&&r.kind!=='Closet'),auxiliary=groupedRooms.filter(r=>r.kind==='Hall'||r.kind==='Closet');
  const room=groupedRooms.find(r=>r.parts.some(p=>p.id===selected)),fixture=draft.fixtures.find(f=>f.id===selected);
  const fixedCatalog=useMemo(()=>catalog.filter(c=>isFixedPiece(c.id)&&(!c.mount||c.mount==='floor'||isWallOpening(c.id))),[]);
  const commit=(next:BlueprintDraft)=>{setPast(p=>[...p.slice(-39),draft]);setFuture([]);setDraft(next);setChecked(false);setError('');};
  const fit=(rooms=draft.rooms,ref=reference,scale=imageScale)=>{
    const xs=rooms.flatMap(r=>[r.x,r.x+r.width]),zs=rooms.flatMap(r=>[r.z,r.z+r.depth]);
    if(ref){xs.push(0,ref.width*scale);zs.push(0,ref.height*scale);}
    if(!xs.length){setView({x:-500,z:-500,width:14000,height:11000});return;}
    const x=Math.min(...xs)-500,z=Math.min(...zs)-500;setView({x,z,width:Math.max(2000,Math.max(...xs)-x+500),height:Math.max(2000,Math.max(...zs)-z+500)});
  };
  useEffect(()=>{fit();},[]);
  const close=()=>{if((past.length||reference)&&!window.confirm('Discard this unconfirmed floor-plan draft? Your 3D home has not changed.'))return;onClose();};
  async function load(nextFile:File,nextPage=1,nextRotation=0,clear=false) {
    void clear;
    analysisAbort.current?.abort();const controller=new AbortController();analysisAbort.current=controller;
    const generation=++loadGeneration.current;setLoading(true);setError('');setNotice('Reading rooms, printed measurements, windows and fixed fixtures…');
    try {
      const result=await renderReference(nextFile,nextPage,nextRotation);if(generation!==loadGeneration.current)return;
      const detection=await recognizeReference(result,controller.signal);if(generation!==loadGeneration.current)return;
      const recognized=draftFromRecognition(base,floorId,detection);
      setReference(result);setFile(nextFile);setPage(nextPage);setRotation(nextRotation);setCalibrated(true);setScaleLine(undefined);setMode('select');setImageScale(recognized.scale);
      commit(recognized.draft);setSelected(recognized.draft.rooms[0]?.id);setReview(false);fit(recognized.draft.rooms,result,recognized.scale);
      setAnalysisNotes(recognized.notes);setPrintedDimensions(recognized.dimensions);
      setNotice(`Detected ${roomGroups(recognized.draft.rooms).filter(r=>r.kind!=='Hall'&&r.kind!=='Closet').length} rooms / spaces and ${recognized.draft.fixtures.length} fixtures / openings. Scale comes from the printed dimensions. Review names and geometry, then create your 3D home.`);
    }catch(e){if(generation===loadGeneration.current)setError((e as Error).message||'This file could not be opened.');}finally{if(generation===loadGeneration.current)setLoading(false);}
  }
  const point=(event:ReactPointerEvent<SVGSVGElement>):Point=>{const svg=svgRef.current!,matrix=svg.getScreenCTM();if(!matrix)return {x:0,z:0};const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:Math.round(p.x),z:Math.round(p.y)};};
  const snap=(p:Point):Point=>{
    const xPoints=draft.rooms.flatMap(r=>[r.x,r.x+r.width]),zPoints=draft.rooms.flatMap(r=>[r.z,r.z+r.depth]);
    for(const w of draft.walls){xPoints.push(w.ax*base.gridSizeMm,w.bx*base.gridSizeMm);zPoints.push(w.az*base.gridSizeMm,w.bz*base.gridSizeMm);}
    const closest=(n:number,values:number[])=>{let best=Math.round(n/10)*10,dist=Math.min(120,view.width/100);for(const v of values)if(Math.abs(v-n)<dist){best=v;dist=Math.abs(v-n);}return best;};
    return {x:closest(p.x,xPoints),z:closest(p.z,zPoints)};
  };
  function down(e:ReactPointerEvent<SVGSVGElement>) {
    if(e.button!==0||review||loading)return;e.currentTarget.setPointerCapture(e.pointerId);setError('');
    const raw=point(e),p=mode==='scale'||mode==='pan'?raw:snap(raw);
    if(mode==='fixture') {if(!plan){setError('Draw a room area first.');return;}try{const item=fixtureAt(plan,floorId,fixtureId,p.x,p.z);commit({...draft,fixtures:[...draft.fixtures,item]});setSelected(item.id);setMode('select');}catch(e){setError((e as Error).message);}return;}
    const id=(e.target as Element).closest('[data-object]')?.getAttribute('data-object')??undefined;
    if(mode==='select')setSelected(id);
    setGesture({a:p,b:p,before:draft,selected:id,mode,view});
  }
  function move(e:ReactPointerEvent<SVGSVGElement>) {
    const raw=point(e);setCursor(mode==='scale'||mode==='pan'?raw:snap(raw));if(!gesture)return;
    const p=gesture.mode==='scale'||gesture.mode==='pan'?raw:snap(raw);setGesture(g=>g?{...g,b:p}:g);
    if(gesture.mode==='pan'){setView(v=>({...v,x:v.x+gesture.a.x-raw.x,z:v.z+gesture.a.z-raw.z}));return;}
    if(gesture.mode!=='select'||!gesture.selected)return;
    const dx=p.x-gesture.a.x,dz=p.z-gesture.a.z,id=gesture.selected;
    const old=gesture.before.fixtures.find(f=>f.id===id);
    const moved=old&&plan?snapWindow(plan,{...old,x:old.x+dx,z:old.z+dz}):undefined;
    setDraft({...gesture.before,rooms:gesture.before.rooms.map(r=>roomGroups(gesture.before.rooms).find(g=>g.parts.some(p=>p.id===id))?.parts.some(p=>p.id===r.id)?{...r,x:r.x+dx,z:r.z+dz}:r),fixtures:gesture.before.fixtures.map(f=>f.id===id&&moved?moved:f)});
  }
  function up(e:ReactPointerEvent<SVGSVGElement>) {
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(!gesture)return;const {a,b,mode:active,before}=gesture;setGesture(undefined);
    if(active==='scale'){if(Math.hypot(b.x-a.x,b.z-a.z)>50)setScaleLine({a,b});return;}
    if(active==='select'){if(JSON.stringify(before)!==JSON.stringify(draft)){setPast(p=>[...p.slice(-39),before]);setFuture([]);setChecked(false);}return;}
    if(active==='room') {
      const width=Math.abs(a.x-b.x),depth=Math.abs(a.z-b.z);if(width<100||depth<100)return;
      const r:BlueprintRoom={id:uid(),name:`${kind} ${draft.rooms.filter(r=>r.kind===kind).length+1}`,kind,x:Math.min(a.x,b.x),z:Math.min(a.z,b.z),width,depth,enclosed:!['Hall','Outdoor','Living','Dining'].includes(kind)};
      commit({...draft,rooms:[...draft.rooms,r]});setSelected(r.id);setMode('select');
    }
    if(active==='wall') {
      const end=Math.abs(b.x-a.x)>Math.abs(b.z-a.z)?{x:b.x,z:a.z}:{x:a.x,z:b.z};if(Math.hypot(end.x-a.x,end.z-a.z)<100)return;
      const grid=base.gridSizeMm,id=uid();commit({...draft,walls:[...draft.walls,{id,ax:a.x/grid,az:a.z/grid,bx:end.x/grid,bz:end.z/grid}]});setSelected(id);setMode('select');
    }
  }
  const remove=()=>{if(!selected)return;commit({...draft,rooms:draft.rooms.filter(r=>!room?.parts.some(p=>p.id===r.id)&&r.id!==selected),fixtures:draft.fixtures.filter(f=>f.id!==selected),walls:draft.walls.filter(w=>w.id!==selected),omittedWalls:[...draft.omittedWalls,selected]});setSelected(undefined);};
  const updateRoom=(patch:Partial<BlueprintRoom>)=>{if(room)commit({...draft,rooms:draft.rooms.map(r=>room.parts.some(p=>p.id===r.id)?{...r,...patch,x:Math.round((patch.x??room.x)+(r.x-room.x)*(patch.width??room.width)/room.width),z:Math.round((patch.z??room.z)+(r.z-room.z)*(patch.depth??room.depth)/room.depth),width:Math.round(r.width*(patch.width??room.width)/room.width),depth:Math.round(r.depth*(patch.depth??room.depth)/room.depth)}:r)});};
  const updateFixture=(patch:Partial<NonNullable<typeof fixture>>)=>{if(fixture&&plan)commit({...draft,fixtures:draft.fixtures.map(f=>f.id===fixture.id?snapWindow(plan,{...f,...patch}):f)});};
  const zoom=(amount:number)=>setView(v=>{const width=Math.max(1500,Math.min(150000,v.width*amount)),height=v.height*width/v.width;return {x:v.x+(v.width-width)/2,z:v.z+(v.height-height)/2,width,height};});
  const apply=()=>{if(!plan||!checked||stale||problems.length)return;try{usePlanner.getState().commitDesign(base,plan);onCreated?.();onClose();}catch(e){setError((e as Error).message);}};
  return <dialog ref={dialogRef} className="blueprint-dialog" aria-labelledby="blueprint-title" onCancel={e=>{e.preventDefault();close();}} onKeyDown={e=>e.stopPropagation()}>
    <header className="bp-header"><div><span className="eyebrow">{floorName} · unsaved draft</span><h1 id="blueprint-title">Floor plan studio</h1></div><div className="bp-steps"><span className={reference?'complete':''}>1 Upload & analyze</span><span className={!review?'active':''}>2 Check & edit</span><span className={review?'active':''}>3 Review → 3D</span></div><button onClick={close} aria-label="Close floor plan studio"><X size={22}/></button></header>
    {loading&&<div className="bp-analysis-status" role="status"><strong>Reading your floor plan…</strong><p>Finding rooms, printed dimensions and fixtures. Detailed scans can take a few minutes.</p><button onClick={()=>{analysisAbort.current?.abort();loadGeneration.current++;setLoading(false);setNotice('Analysis canceled. Your drawing is unchanged.');}}>Cancel analysis</button></div>}<div className="bp-workspace" inert={loading} aria-busy={loading}><aside className="bp-sidebar">
      {!review&&<>
        <section><h2>Start with your floor plan</h2><p>Upload a PDF or image. AI reads the rooms and printed dimensions for you. The selected page is sent to OpenAI for analysis; your 3D home changes only after confirmation.</p><button className="bp-upload" disabled={loading} onClick={()=>uploadRef.current?.click()}><FileArrowUp size={22}/>{loading?'Analyzing floor plan…':'Upload PDF or image'}</button><input hidden ref={uploadRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" aria-label="Upload floor plan reference" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(draft.rooms.length&&!window.confirm('Analyze a new floor plan from this file? This replaces only the unconfirmed drawing; your 3D home is unchanged.'))return;void load(f,1,0,true);}}/>
        <div className="bp-button-row"><button onClick={()=>{if(draft.rooms.length&&!window.confirm('Clear this unconfirmed drawing?'))return;commit(emptyDraft());setSelected(undefined);setReview(false);fit([]);}}>Blank drawing</button><button onClick={()=>{if(past.length&&!window.confirm('Replace the draft with the current 3D floor?'))return;commit(draftFromFloor(base,floorId));setReference(undefined);setSelected(undefined);fit(initial.rooms,undefined);}}>Use current floor</button></div>
        {reference&&<div className="bp-reference-controls"><strong title={reference.name}>{reference.name}</strong><div className="bp-button-row"><label>PDF page<select aria-label="PDF page" disabled={loading} value={page} onChange={e=>file&&void load(file,Number(e.target.value),rotation)}>{Array.from({length:reference.pages},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label><button disabled={loading} onClick={()=>file&&void load(file,page,(rotation+90)%360)}><ArrowClockwise/> Rotate scan</button></div><label>Reference opacity<input type="range" min="0" max="1" step="0.05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label><small>Changing the page or orientation analyzes it again and replaces this draft.</small></div>}
        <label>Measurement units<select value={unit} onChange={e=>setUnit(e.target.value as typeof unit)}><option value="m">Metres</option><option value="ft">Feet (decimal)</option><option value="mm">Millimetres</option></select></label>
        {reference&&<div className="bp-calibration"><button disabled={draft.rooms.length>0} className={mode==='scale'?'active':''} onClick={()=>setMode('scale')}><Ruler/> {calibrated?'Scale set · recalibrate':'Set image scale'}</button>{mode==='scale'&&<><p>Drag between the ends of a printed dimension. Enter its real length below.</p><label>Known length ({unit})<input type="number" min="0" step="any" value={knownLength} onChange={e=>setKnownLength(e.target.value)}/></label><button disabled={!scaleLine||draft.rooms.length>0} onClick={()=>{if(!scaleLine)return;const length=Number(knownLength)*factor,distance=Math.hypot(scaleLine.b.x-scaleLine.a.x,scaleLine.b.z-scaleLine.a.z),next=imageScale*length/distance;if(!Number.isFinite(next)||length<100||length>60000||next<.1||next>200){setError('Use a known length from 0.1 to 60 metres and a longer reference line.');return;}setImageScale(next);setCalibrated(true);setScaleLine(undefined);setError('');setMode('room');fit([],reference,next);}}>Apply scale</button></>}{calibrated&&<small><Check/> Scale calibrated. Check each room’s exact size before conversion.</small>}</div>}
        </section>
        <section><h2>Adjust the detected plan</h2><label>New room type<select value={kind} onChange={e=>setKind(e.target.value as RoomKind)}>{roomKinds.map(k=><option key={k}>{k}</option>)}</select></label><p>Select a detected room to correct its name or measurements. Add a missing area only if needed.</p><div className="bp-button-row"><button disabled={!!reference&&!calibrated} className={mode==='room'?'active':''} onClick={()=>setMode('room')}>Draw room area</button><button disabled={!draft.rooms.length} className={mode==='wall'?'active':''} onClick={()=>setMode('wall')}>Inside wall</button></div>
        <label>Kitchen / bath / laundry / openings<select value={fixtureId} onChange={e=>setFixtureId(e.target.value)}>{fixedCatalog.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button disabled={!plan} className={mode==='fixture'?'active':''} onClick={()=>setMode('fixture')}>Place selected fixture</button><small>Correct any missed fixtures here. Doors and windows snap to walls.</small></section>
        {room&&<section className="bp-selection"><h2>Edit room</h2><label>Room name<input maxLength={100} value={room.name} onChange={e=>updateRoom({name:e.target.value})}/></label><label>Room type<select value={room.kind} onChange={e=>updateRoom({kind:e.target.value as RoomKind})}>{roomKinds.map(k=><option key={k}>{k}</option>)}</select></label><div className="bp-fields">{(['x','z','width','depth'] as const).map(key=><LengthField key={key} label={`${key==='x'?'Left':key==='z'?'Top':key} (${unit})`} value={room[key]} factor={factor} onChange={v=>updateRoom({[key]:v})}/>)}</div><label className="bp-check"><input type="checkbox" checked={room.enclosed} onChange={e=>updateRoom({enclosed:e.target.checked})}/> Add room dividers</label><small>Turn dividers off for open-plan rooms. Add doors to enclosed rooms.</small><button onClick={remove}><Trash/> Remove area</button></section>}
        {fixture&&<section className="bp-selection"><h2>{catalog.find(c=>c.id===fixture.catalogId)?.name}</h2><div className="bp-fields">{(['x','z','widthMm','depthMm','heightMm'] as const).map(key=><LengthField key={key} label={`${key==='x'?'Left':key==='z'?'Top':key.replace('Mm','')} (${unit})`} value={fixture[key]} factor={factor} onChange={v=>updateFixture({[key]:v})}/>)}</div><div className="bp-button-row"><button onClick={()=>updateFixture({rotation:(fixture.rotation+(isWallOpening(fixture.catalogId)?180:90))%360})}><ArrowClockwise/> Rotate</button><button onClick={remove}><Trash/> Remove</button></div></section>}
        {selected&&!room&&!fixture&&<section><h2>Inside wall</h2><button onClick={remove}><Trash/> Remove divider</button></section>}
        {printedDimensions.length>0&&<section><h2>Measurements read from the plan</h2><ul>{printedDimensions.map((d,i)=><li key={i}>{d}</li>)}</ul><small>Printed measurements establish scale. Check inferred sizes against the reference.</small></section>}
        {analysisNotes.length>0&&<section><h2>Please check</h2><ul>{analysisNotes.map((n,i)=><li key={i}>{n}</li>)}</ul></section>}
        <section><h2>Rooms & spaces · {spaces.length}</h2><div className="bp-room-list">{spaces.map(r=><button key={r.id} className={r.id===room?.id?'active':''} onClick={()=>{setSelected(r.id);setMode('select');}}><span style={{background:colors[r.kind]}}/>{r.name}<small>{(r.width/factor).toFixed(2)} × {(r.depth/factor).toFixed(2)} {unit}</small></button>)}</div></section>
        {auxiliary.length>0&&<section><h2>Closets & circulation</h2><div className="bp-room-list">{auxiliary.map(r=><button key={r.id} className={r.id===room?.id?'active':''} onClick={()=>{setSelected(r.id);setMode('select');}}>{r.name}</button>)}</div></section>}
      </>}
      {review&&<section className="bp-review"><span className="eyebrow">Ready for your walkthrough</span><h2>Check the empty home</h2><p>Review room sizes, wall connections, doors, windows and fixture locations.</p><dl><dt>Rooms / spaces</dt><dd>{spaces.length}</dd><dt>Closets / circulation areas</dt><dd>{auxiliary.length}</dd><dt>Kitchen / bath / laundry & openings</dt><dd>{draft.fixtures.length}</dd><dt>Loose furniture</dt><dd>None</dd></dl><p>This replaces <strong>{floorName}</strong> and its contents. Other floors stay in place. Stair connections to this floor are removed. Undo restores the previous floor.</p><p>After conversion, use <strong>Auto furnish</strong> to preview an arrangement from your library. Room types guide the choices.</p>{analysisNotes.length>0&&<ul>{analysisNotes.map((n,i)=><li key={i}>{n}</li>)}</ul>}{reference&&!calibrated&&<p className="bp-error">Calibrate the reference before converting.</p>}{problems.length>0&&<div role="alert" className="bp-error"><strong>Fix these before converting:</strong><ul>{problems.slice(0,10).map((p,i)=><li key={i}>{p}</li>)}</ul></div>}<label className="bp-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> I checked the dimensions, openings and fixtures.</label><button className="primary" disabled={!checked||!plan||stale||!!problems.length||!!reference&&!calibrated} onClick={apply}><Check/> Confirm & create 3D home</button><button onClick={()=>{setReview(false);setChecked(false);}}>Back to editing</button></section>}
    </aside><section className="bp-drawing"><div className="bp-toolbar"><div className="bp-button-row"><button className={mode==='select'?'active':''} disabled={review} onClick={()=>setMode('select')}><GridFour/> Select / move</button><button className={mode==='pan'?'active':''} disabled={review} onClick={()=>setMode('pan')}><Hand/> Pan</button><button aria-label="Undo drawing" disabled={!past.length||review} onClick={()=>{const previous=past.at(-1)!;setFuture(f=>[draft,...f]);setPast(p=>p.slice(0,-1));setDraft(previous);setSelected(undefined);}}><ArrowCounterClockwise/></button><button aria-label="Redo drawing" disabled={!future.length||review} onClick={()=>{setPast(p=>[...p,draft]);setDraft(future[0]);setFuture(f=>f.slice(1));setSelected(undefined);}}><ArrowClockwise/></button></div><div className="bp-button-row"><button onClick={()=>zoom(.8)} aria-label="Zoom drawing in"><Plus/></button><button onClick={()=>zoom(1.25)} aria-label="Zoom drawing out"><Minus/></button><button onClick={()=>fit()}>Fit plan</button></div></div>
      <div className="bp-instruction" role="status">{loading?'Analyzing rooms, labels, dimensions and fixtures…':review?'Review your floor plan before creating the 3D home.':mode==='room'?'Drag from one room corner to the opposite corner.':mode==='wall'?'Drag a straight inside wall; gold points show snapped ends.':mode==='fixture'?'Click to place the selected fixture, then drag or edit its dimensions.':mode==='scale'?'Drag along a known measurement on the reference.':mode==='pan'?'Drag to move around the drawing.':'Select a room or fixture to move it or edit exact dimensions.'}</div>
      <svg ref={svgRef} className={`bp-canvas mode-${mode}`} role="img" aria-label="Top-down floor plan drawing" viewBox={`${view.x} ${view.z} ${view.width} ${view.height}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{if(gesture)setDraft(gesture.before);setGesture(undefined);}}>
        <defs><pattern id="bp-grid" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#657b8520" strokeWidth="1" vectorEffect="non-scaling-stroke"/></pattern></defs><rect x={view.x} y={view.z} width={view.width} height={view.height} fill="#f9f8f3"/><rect x={view.x} y={view.z} width={view.width} height={view.height} fill="url(#bp-grid)"/>
        {reference&&<image href={reference.url} x="0" y="0" width={reference.width*imageScale} height={reference.height*imageScale} opacity={opacity} pointerEvents="none"/>}
        {groupedRooms.map(r=>{const label=r.parts.reduce((a,b)=>a.width*a.depth>b.width*b.depth?a:b);return <g key={r.id} data-object={r.id} className="bp-object">{r.parts.map(part=><rect key={part.id} x={part.x} y={part.z} width={Math.max(0,part.width)} height={Math.max(0,part.depth)} fill={colors[r.kind]} fillOpacity={reference?'.38':'.7'} stroke={r.id===room?.id?'#be8226':'none'} strokeWidth={r.id===room?.id?3:0} vectorEffect="non-scaling-stroke"/>)}<text x={label.x+label.width/2} y={label.z+label.depth/2} textAnchor="middle" fontSize={Math.min(view.width/65,label.width/9)} fill="#34483c" fontWeight="800">{r.name}</text><text x={label.x+label.width/2} y={label.z+label.depth/2+Math.min(view.width/60,label.width/8)} textAnchor="middle" fontSize={Math.min(view.width/85,label.width/12)} fill="#455d50">{(r.width/factor).toFixed(2)} × {(r.depth/factor).toFixed(2)} {unit}</text></g>;})}
        {walls.map(w=><line key={w.id} data-object={floor?.walls.some(f=>f.id===w.id)?w.id:undefined} x1={w.ax*base.gridSizeMm} y1={w.az*base.gridSizeMm} x2={w.bx*base.gridSizeMm} y2={w.bz*base.gridSizeMm} stroke={selected===w.id?'#be8226':'#42584d'} strokeWidth={selected===w.id?7:4} vectorEffect="non-scaling-stroke"/>)}
        {draft.fixtures.map(f=><g key={f.id} data-object={f.id} transform={`translate(${f.x},${f.z}) rotate(${f.rotation})`} className="bp-object"><rect x={-f.widthMm/2} y={-f.depthMm/2} width={f.widthMm} height={f.depthMm} rx="30" fill={isWallOpening(f.catalogId)?'#e3f2f6':'#f7e4b9'} stroke={selected===f.id?'#b7771e':'#627b84'} strokeWidth={selected===f.id?3:1.5} vectorEffect="non-scaling-stroke"/><text y="0" textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(110,f.widthMm/7)} fill="#384d4e">{catalog.find(c=>c.id===f.catalogId)?.name}</text></g>)}
        {gesture?.mode==='room'&&<rect x={Math.min(gesture.a.x,gesture.b.x)} y={Math.min(gesture.a.z,gesture.b.z)} width={Math.abs(gesture.a.x-gesture.b.x)} height={Math.abs(gesture.a.z-gesture.b.z)} fill="#be822630" stroke="#be8226" strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/>}
        {(gesture?.mode==='scale'||gesture?.mode==='wall'||scaleLine)&&(()=>{const line=gesture??scaleLine!;let b=line.b;if(gesture?.mode==='wall')b=Math.abs(b.x-line.a.x)>Math.abs(b.z-line.a.z)?{x:b.x,z:line.a.z}:{x:line.a.x,z:b.z};return <g pointerEvents="none"><line x1={line.a.x} y1={line.a.z} x2={b.x} y2={b.z} stroke="#bd8225" strokeWidth="3" vectorEffect="non-scaling-stroke"/>{[line.a,b].map((p,i)=><circle key={i} cx={p.x} cy={p.z} r={view.width/180} fill="#bd8225"/>)}</g>;})()}
        {!draft.rooms.length&&!reference&&<text x={view.x+view.width/2} y={view.z+view.height/2} textAnchor="middle" fontSize={view.width/45} fill="#7d8c84">Upload a plan or draw your first room</text>}
      </svg>
      <footer className="bp-footer"><span>{cursor?`${(cursor.x/factor).toFixed(2)}, ${(cursor.z/factor).toFixed(2)} ${unit}`:'500 mm grid'} · {spaces.length} rooms / spaces · {draft.fixtures.length} fixtures</span>{!review&&<button className="primary" disabled={!plan||loading||stale||!!reference&&!calibrated} onClick={()=>{setReview(true);setSelected(undefined);setChecked(false);}}>Review & create 3D →</button>}</footer>
      {(error||computed.error||stale)&&<div className="bp-error bp-message" role="alert">{stale?'The home changed while this draft was open. Close and reopen the studio to use the latest version.':error||computed.error}</div>}
      {error.includes('Sign in')&&<a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a>}{notice&&!error&&<div className="bp-note">{notice}</div>}
    </section></div>
  </dialog>;
}
