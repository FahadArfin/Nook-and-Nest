import {Suspense,lazy,useEffect,useState} from 'react';
import {floorRects} from './floorGeometry';
import {mediaLabels} from './listingTypes';
import type {ReviewSnapshot,ReviewMedia} from './clientReview';
import './clientReview.css';
const ReviewScene=lazy(()=>import('./ReviewScene'));
export function ReviewTour({snapshot,media,images,onStopChange}:{snapshot:ReviewSnapshot;media:Array<Pick<ReviewMedia,'id'|'kind'>>;images:Record<string,string>;onStopChange?:(id:string)=>void}){
 const [index,setIndex]=useState(0),[threeD,setThreeD]=useState(false),stop=snapshot.stops[Math.min(index,snapshot.stops.length-1)];
 useEffect(()=>{setIndex(0);setThreeD(false);},[snapshot]);
 useEffect(()=>{onStopChange?.(stop.id);},[stop.id,onStopChange]);
 const floor=snapshot.plan.floors.find(f=>f.id===stop.floorId)!,rects=floorRects(floor,snapshot.plan.gridSizeMm),markers=snapshot.stops.filter(s=>s.floorId===stop.floorId);
 const bounds=rects.reduce((b,r)=>({minX:Math.min(b.minX,r.x),minZ:Math.min(b.minZ,r.z),maxX:Math.max(b.maxX,r.x+r.width),maxZ:Math.max(b.maxZ,r.z+r.depth)}),{minX:0,minZ:0,maxX:0,maxZ:0});for(const s of markers){bounds.minX=Math.min(bounds.minX,s.marker.xMm);bounds.minZ=Math.min(bounds.minZ,s.marker.zMm);bounds.maxX=Math.max(bounds.maxX,s.marker.xMm);bounds.maxZ=Math.max(bounds.maxZ,s.marker.zMm);}
 const margin=Math.max(500,Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ)*.08),minX=bounds.minX-margin,minZ=bounds.minZ-margin,width=Math.max(1000,bounds.maxX-minX+margin),depth=Math.max(1000,bounds.maxZ-minZ+margin),radius=Math.max(width,depth)*.025,simplified=rects.length>3000;
 const selected=media.find(m=>m.id===stop.mediaId),image=stop.mediaId?images[stop.mediaId]:undefined;
 const move=(delta:number)=>setIndex(i=>Math.max(0,Math.min(snapshot.stops.length-1,i+delta)));
 return <section className="review-tour" aria-label="Story tour" onKeyDown={e=>{if((e.target as HTMLElement).closest('input,textarea,select,button'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}}} tabIndex={0}>
  <div className="review-stage">{threeD?<Suspense fallback={<p>Opening 3D design…</p>}><ReviewScene plan={snapshot.plan} stop={stop}/></Suspense>:image?<img src={image} alt={stop.title}/>:<div className="review-still-empty"><p>{selected?'Photo preview unavailable.':'No property photo is included for this stop.'}</p><p>The floor marker remains available.</p></div>}<span className="review-media-label">{threeD?'Authored 3D design':selected?mediaLabels[selected.kind]:'Design tour'}</span></div>
  <div className="review-tour-controls"><button onClick={()=>move(-1)} disabled={index===0}>Previous</button><span>Stop {index+1} of {snapshot.stops.length} · {floor.name}</span><button onClick={()=>move(1)} disabled={index===snapshot.stops.length-1}>Next</button><button aria-pressed={threeD} onClick={()=>setThreeD(!threeD)}>{threeD?'Show saved photo':'Show 3D design'}</button></div>
  <h2>{stop.title}</h2><p>{stop.caption}</p>{stop.narration&&<details><summary>Read the story</summary><p className="review-narration">{stop.narration}</p></details>}
  <svg className="review-map" viewBox={`${minX} ${minZ} ${width} ${depth}`} role="group" aria-label={`${floor.name}: tour markers and facing arrows`}>
   {simplified?<rect x={bounds.minX} y={bounds.minZ} width={bounds.maxX-bounds.minX} height={bounds.maxZ-bounds.minZ} fill="#e7e9dc"/>:rects.map((r,i)=>r.polygon?<polygon key={i} points={r.polygon.map(p=>`${p.x},${p.z}`).join(' ')} fill="#e7e9dc" stroke="#708069" strokeWidth={radius*.05}/>:<rect key={i} x={r.x} y={r.z} width={r.width} height={r.depth} fill="#e7e9dc" stroke="#708069" strokeWidth={radius*.05}/>)}
   {markers.map(s=><g key={s.id} role="button" tabIndex={0} aria-label={`Go to ${s.title}`} onClick={()=>setIndex(snapshot.stops.indexOf(s))} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setIndex(snapshot.stops.indexOf(s));}}} transform={`translate(${s.marker.xMm} ${s.marker.zMm})`} style={{cursor:'pointer'}}><circle r={radius*1.6} fill="transparent"/><circle r={radius} fill={s.id===stop.id?'#375746':'#6c7762'}/><path transform={`rotate(${s.marker.facingDeg})`} d={`M ${-radius*.45} ${-radius*1.4} L 0 ${-radius*2} L ${radius*.45} ${-radius*1.4}`} fill="none" stroke="#375746" strokeWidth={radius*.18}/><text textAnchor="middle" dominantBaseline="central" fill="white" fontSize={radius}>{snapshot.stops.indexOf(s)+1}</text></g>)}
  </svg>{simplified&&<p>Large floor: this map shows a simplified extent with exact tour-marker positions.</p>}<nav className="review-stops" aria-label="Tour stops">{snapshot.stops.map((s,i)=><button key={s.id} aria-current={s.id===stop.id?'step':undefined} onClick={()=>setIndex(i)}>{i+1}. {s.title} · {snapshot.plan.floors.find(f=>f.id===s.floorId)?.name}</button>)}</nav>
 </section>;
}
