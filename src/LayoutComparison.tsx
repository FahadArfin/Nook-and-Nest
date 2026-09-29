import {useMemo,useState} from 'react';
import {floorRects} from './floorGeometry';
import type {LayoutSnapshot} from './layoutAlternatives';
import type {FurniturePlacement} from './types';

export function comparisonBounds(layouts:LayoutSnapshot[],floorId:string):string {
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const include=(x:number,z:number)=>{left=Math.min(left,x);top=Math.min(top,z);right=Math.max(right,x);bottom=Math.max(bottom,z);};
  for(const layout of layouts){
    const floor=layout.floors.find(f=>f.id===floorId);if(!floor)continue;
    for(const rect of floorRects(floor,layout.gridSizeMm)){include(rect.x,rect.z);include(rect.x+rect.width,rect.z+rect.depth);}
    for(const item of layout.furniture.filter(p=>p.floorId===floorId)){
      const angle=item.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
      for(const dx of [-item.widthMm/2,item.widthMm/2])for(const dz of [-item.depthMm/2,item.depthMm/2])include(item.x+dx*c+dz*s,item.z-dx*s+dz*c);
    }
  }
  if(!Number.isFinite(left))return '-500 -500 4000 4000';
  const padding=Math.max(200,Math.max(right-left,bottom-top)*.06);
  return `${left-padding} ${top-padding} ${Math.max(100,right-left)+padding*2} ${Math.max(100,bottom-top)+padding*2}`;
}
function PlanView({layout,floorId,label,viewBox,other}:{layout:LayoutSnapshot;floorId:string;label:string;viewBox:string;other:LayoutSnapshot}){
  const floor=layout.floors.find(f=>f.id===floorId);
  const old=new Map(other.furniture.map(p=>[p.id,p]));
  const changed=(p:FurniturePlacement)=>{const before=old.get(p.id);return !before||['x','z','rotation','widthMm','depthMm','heightMm','variant'].some(key=>p[key as keyof FurniturePlacement]!==before[key as keyof FurniturePlacement]);};
  const path=useMemo(()=>floor?floorRects(floor,layout.gridSizeMm).map(r=>{
    const points=r.polygon??[{x:r.x,z:r.z},{x:r.x+r.width,z:r.z},{x:r.x+r.width,z:r.z+r.depth},{x:r.x,z:r.z+r.depth}];
    return points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.z}`).join(' ')+'Z';
  }).join(' '):'',[floor,layout.gridSizeMm]);
  return <figure><figcaption>{label}</figcaption>{!floor?<p>This floor is not in this layout.</p>:<svg viewBox={viewBox} role="img" aria-label={`${label}, same-scale top view`}>
    <path d={path} className="comparison-floor"/>
    {floor.walls.map(w=><line key={w.id} x1={w.ax*layout.gridSizeMm} y1={w.az*layout.gridSizeMm} x2={w.bx*layout.gridSizeMm} y2={w.bz*layout.gridSizeMm} className="comparison-wall" vectorEffect="non-scaling-stroke"/>)}
    {[false,true].map(isChanged=><path key={String(isChanged)} d={layout.furniture.filter(p=>p.floorId===floorId&&changed(p)===isChanged).map(p=>{
      const a=p.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
      return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dz],i)=>`${i?'L':'M'}${p.x+dx*p.widthMm/2*c+dz*p.depthMm/2*s} ${p.z-dx*p.widthMm/2*s+dz*p.depthMm/2*c}`).join(' ')+'Z';
    }).join(' ')} className={isChanged?'comparison-piece changed':'comparison-piece'} vectorEffect="non-scaling-stroke"/>)}
  </svg>}</figure>;
}
/** Two light top views share one physical frame; no extra Babylon scenes or saved camera changes. */
export function LayoutComparison({current,saved,name,initialFloorId}:{current:LayoutSnapshot;saved:LayoutSnapshot;name:string;initialFloorId:string}){
  const [chosen,setChosen]=useState(initialFloorId);
  const floors=useMemo(()=>[...new Map([...current.floors,...saved.floors].map(f=>[f.id,f])).values()],[current.floors,saved.floors]);
  const floorId=floors.some(f=>f.id===chosen)?chosen:floors[0].id;
  const viewBox=useMemo(()=>comparisonBounds([current,saved],floorId),[current,saved,floorId]);
  return <section className="layout-comparison" aria-label={`Compare current layout with ${name}`}>
    <div className="comparison-floors" role="group" aria-label="Comparison floor">{floors.map(f=><button key={f.id} type="button" aria-pressed={f.id===floorId} onClick={()=>setChosen(f.id)}>{f.name}</button>)}</div>
    <div className="comparison-views"><PlanView layout={current} other={saved} floorId={floorId} label="Working layout" viewBox={viewBox}/><PlanView layout={saved} other={current} floorId={floorId} label={name} viewBox={viewBox}/></div>
    <small>Same scale and position · Gold marks added or changed footprints. Your working layout is unchanged.</small>
  </section>;
}
