import {renderReference,type PlanReference} from '../src/blueprintImport';
import {recognizeReference,draftFromRecognition,roomsOnlyRecognition} from '../src/blueprintRecognition';
import {scaleAssessment} from '../src/recognitionContract';
import {createSamplePlan} from '../src/domain';
let ref:PlanReference|undefined;
const status=document.querySelector('#status')!,details=document.querySelector('#details')!,analyze=document.querySelector<HTMLButtonElement>('#analyze')!,cached=document.querySelector<HTMLButtonElement>('#cached')!;
document.querySelector<HTMLInputElement>('#file')!.onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;ref=await renderReference(file);analyze.disabled=false;status.textContent=`Ready: ${ref.width} × ${ref.height}`;};
async function run(force:boolean){if(!ref)return;analyze.disabled=cached.disabled=true;const start=performance.now();try{const result=await recognizeReference(ref,undefined,{force,status:text=>status.textContent=text});const assessment=scaleAssessment(result),base=createSamplePlan('Pipeline QA','metric');const converted=assessment.scale?draftFromRecognition(base,base.floors[0].id,roomsOnlyRecognition(result)):undefined;
  details.textContent=JSON.stringify({milliseconds:Math.round(performance.now()-start),parts:result.rooms.length,scale:assessment,warnings:result.warnings,convertedRooms:converted?.draft.rooms.length??'Needs scale review'},null,2);
  const svg=document.querySelector('#drawing')!,ns='http://www.w3.org/2000/svg';svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${ref.width} ${ref.height}`);const image=document.createElementNS(ns,'image');image.setAttribute('href',ref.url);image.setAttribute('width',String(ref.width));image.setAttribute('height',String(ref.height));svg.append(image);
  for(const r of result.rooms){const box=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries({x:r.x,y:r.y,width:r.width,height:r.height,fill:r.kind==='Hall'?'#ff8c0044':'#3988ff33',stroke:'#26744b','stroke-width':2}))box.setAttribute(k,String(v));const title=document.createElementNS(ns,'title');title.textContent=r.name;box.append(title);svg.append(box);}
}catch(e){status.textContent=(e as Error).message;}finally{analyze.disabled=cached.disabled=false;}}
analyze.onclick=()=>void run(true);cached.onclick=()=>void run(false);
