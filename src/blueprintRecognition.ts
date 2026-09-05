import {blueprintPlan,fixtureAt,coveredByFloor,footprint,type BlueprintDraft} from './blueprint';
import {recognizedScale,validateRecognition,type Recognition} from './recognitionContract';
import type {PlanReference} from './blueprintImport';
import type {PlanDocumentV1} from './types';
import {snapWindow,wallRuns,windowProblem} from './windows';
import {catalog,isWallOpening} from './catalog';
import {recognitionKey,cachedRecognition,saveRecognition,type ScanModel} from './recognitionCache';

export async function recognizeReference(reference:PlanReference,signal?:AbortSignal,options:{model?:ScanModel;confirmPremium?:()=>boolean;status?:(text:string)=>void}={}):Promise<Recognition> {
  const model=options.model??'gpt-5.6-luna',key=await recognitionKey(reference,model);
  signal?.throwIfAborted();
  const cached=cachedRecognition(key,reference);
  if(cached){options.status?.('Reused saved analysis — no API charge.');return cached;}
  const premiumConfirmed=model==='gpt-6-astra'&&options.confirmPremium?.()===true;
  if(model==='gpt-6-astra'&&!premiumConfirmed)throw new Error('Astra analysis canceled. No API request was made.');
  signal?.throwIfAborted();
  const response=await fetch('/api/floor-plan/recognize',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal,body:JSON.stringify({image:reference.url,width:reference.width,height:reference.height,model,premiumConfirmed})});
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.error)throw new Error(body?.error??'Automatic analysis could not be reached. Please try again.');
  signal?.throwIfAborted();
  const result=validateRecognition(body,reference.width,reference.height);recognizedScale(result);
  const saved=saveRecognition(key,result);
  options.status?.(`${model==='gpt-5.6-luna'?'Luna':'Astra'} analysis complete. ${saved?'Saved on this browser for free reuse.':'Browser cache unavailable; uploading again may incur another charge.'}`);
  return result;
}
export function draftFromRecognition(base:PlanDocumentV1,floorId:string,result:Recognition) {
  const scale=recognizedScale(result),mm=(n:number)=>Math.round(n*scale);
  const draft:BlueprintDraft={rooms:result.rooms.map((r,i)=>{const name=r.name.split(/\s+[—–]\s+/)[0];return {id:`scan-room-${i}`,groupId:`scan-group-${r.roomId??name.toLowerCase()}`,name,kind:r.kind,x:mm(r.x),z:mm(r.y),width:Math.max(10,mm(r.x+r.width)-mm(r.x)),depth:Math.max(10,mm(r.y+r.height)-mm(r.y)),enclosed:r.enclosed};}),walls:[],omittedWalls:[],fixtures:[]};
  const grid=base.gridSizeMm;
  const plan=blueprintPlan(base,floorId,draft);
  const placementNotes:string[]=[];
  result.fixtures.forEach((f,i)=>{
    const item={...fixtureAt(plan,floorId,f.catalogId,mm(f.x),mm(f.y)),id:`scan-fixture-${i}`,x:mm(f.x),z:mm(f.y),rotation:f.rotation,widthMm:Math.max(100,mm(f.width)),depthMm:isWallOpening(f.catalogId)?180:Math.max(100,mm(f.depth))};
    const runs=isWallOpening(f.catalogId)?wallRuns(plan.floors.find(f=>f.id===floorId)!,grid).filter(r=>r.horizontal===(f.rotation%180===0)):undefined;
    let snapped=snapWindow(plan,item,runs);
    if(isWallOpening(f.catalogId)){
      if(Math.hypot(snapped.x-item.x,snapped.z-item.z)>500){placementNotes.push(`Opening ${i+1}: the sloping or short wall could not support this detection. It was left out rather than moved to a different room. Add or correct it in the editor.`);return;}
      const working={...plan,furniture:[...plan.furniture,...draft.fixtures]};
      if(windowProblem(working,snapped)){
        const horizontal=f.rotation%180===0;
        const candidates=[0,50,-50,100,-100,150,-150].flatMap(offset=>[0,40,80].map(trim=>snapWindow(plan,{...item,widthMm:Math.max(100,item.widthMm-trim),x:item.x+(horizontal?offset:0),z:item.z+(horizontal?0:offset)},runs)));
        const valid=candidates.find(c=>Math.hypot(c.x-item.x,c.z-item.z)<=500&&!windowProblem(working,c));
        if(valid){snapped=valid;placementNotes.push(`Opening ${i+1}: estimated position/width adjusted slightly to separate neighboring openings. Check against the scan.`);}
      }
    }else if(!coveredByFloor(footprint(snapped),plan.floors.find(f=>f.id===floorId)!,grid)){
      const offsets=[];for(let x=-250;x<=250;x+=50)for(let z=-250;z<=250;z+=50)offsets.push({x,z});
      offsets.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
      const fit=offsets.map(o=>({...snapped,x:snapped.x+o.x,z:snapped.z+o.z})).find(c=>coveredByFloor(footprint(c),plan.floors.find(f=>f.id===floorId)!,grid));
      const name=catalog.find(c=>c.id===f.catalogId)?.name??'Fixture';
      if(!fit){placementNotes.push(`${name}: its detected footprint did not fit the room and was left out. Check its location against the scan.`);return;}
      snapped=fit;placementNotes.push(`${name}: moved slightly inside the inferred room boundary. Check its location against the scan.`);
    }
    draft.fixtures.push(snapped);
  });
  blueprintPlan(base,floorId,draft);
  return {draft,scale,notes:[...placementNotes,...result.warnings,...result.rooms.filter(r=>r.note).map(r=>`${r.name}: ${r.note}`)],dimensions:result.dimensions.map(d=>`${d.text} = ${(d.millimetres/1000).toFixed(3)} m`)};
}
