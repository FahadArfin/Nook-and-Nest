import {getWallVisibility} from './wallVisibility';
import {useEffect,useState} from 'react';
import {usePlanner} from './store';
import {floorBoundaryWalls} from './floorGeometry';
import {wallRuns} from './windows';

export function WallConstructionControls({embedded=false}:{embedded?:boolean}={}){
 const s=usePlanner(),floor=s.plan.floors.find(f=>f.id===s.activeFloorId)!,grid=s.plan.gridSizeMm;
 const wall=[...floorBoundaryWalls(floor,grid),...floor.walls].find(w=>w.id===s.selectedWallId);
 const run=wall&&wallRuns(floor,grid).find(r=>r.horizontal===(wall.az===wall.bz)&&Math.abs(r.line-(r.horizontal?wall.az:wall.ax)*grid)<1&&r.start<=Math.min(r.horizontal?wall.ax:wall.az,r.horizontal?wall.bx:wall.bz)*grid&&r.end>=Math.max(r.horizontal?wall.ax:wall.az,r.horizontal?wall.bx:wall.bz)*grid);
 const [start,setStart]=useState(0),[length,setLength]=useState(1000),[railing,setRailing]=useState('');
 useEffect(()=>{setStart(0);setLength(run?Math.round(run.end-run.start):1000)},[s.selectedWallId]);
 const valid=run&&start>=0&&length>0&&start+length<=run.end-run.start+.1;
 return <details className="wall-construction" open={embedded||s.tool==='wall-cut'||!!wall}><summary hidden={embedded}>Walls & balcony rails</summary>{getWallVisibility(s.plan.camera)!=='all-visible'&&<button onClick={()=>s.toggleCameraSetting('transparentWalls')}>Show walls for editing</button>}<div className="bp-button-row"><button onClick={()=>s.setTool('wall')}>Draw wall</button><button className={s.tool==='wall-cut'?'active':''} onClick={()=>s.setTool('wall-cut')}>Remove wall section</button></div>{s.tool==='wall-cut'&&<p>Drag along a wall to remove that span. Undo restores it.</p>}{run?<><label>Start along wall (mm)<input type="number" min="0" value={start} onChange={e=>setStart(Number(e.target.value))}/></label><label>Section length (mm)<input type="number" min="10" max={run.end-run.start} value={length} onChange={e=>setLength(Number(e.target.value))}/></label><label>Replace with<select value={railing} onChange={e=>setRailing(e.target.value)}><option value="">Open space</option><option value="balcony-rail-glass">Glass railing</option><option value="balcony-rail-concrete">Concrete railing</option><option value="balcony-rail-hybrid">Concrete + glass railing</option></select></label><button disabled={!valid} onClick={()=>{if(!run)return;const a=(run.start+start)/grid,b=(run.start+start+length)/grid,line=run.line/grid;s.cutWalls([{ax:run.horizontal?a:line,az:run.horizontal?line:a,bx:run.horizontal?b:line,bz:run.horizontal?line:b}],railing||undefined)}}>{railing?'Replace section with railing':'Remove selected section'}</button></>:<p>Select a visible wall for exact section lengths or railing replacement.</p>}</details>
}
