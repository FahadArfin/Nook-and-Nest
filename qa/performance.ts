import {SceneController} from '../src/scene/SceneController';
import {performanceScene,sceneIds,type PerformanceSceneId} from './performanceScenes';
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,status=document.querySelector<HTMLOutputElement>('#status')!,select=document.querySelector<HTMLSelectElement>('#scene')!;
for(const id of sceneIds)select.add(new Option(id,id));
const noop=()=>{};const renderer=new SceneController(canvas,{onCell:noop,onWallSegment:noop,onTileDraft:noop,onSelect:noop,onMove:noop,onDraftMove:noop,onRotate:noop,onWall:noop});
let fixture=performanceScene('small-home'),generation=0,report:unknown;
function reset(){generation++;report=undefined;fixture=performanceScene(select.value as PerformanceSceneId);renderer.update(fixture.plan,'perf-floor');renderer.showHomeShot(fixture.shot,true);status.textContent='Ready. Wait for model loading to settle. Orbit manually during the capture to exercise rendering.';}
select.onchange=reset;document.querySelector<HTMLButtonElement>('#reset')!.onclick=reset;
document.querySelector<HTMLButtonElement>('#hollow')!.onclick=()=>{if(fixture.id!=='water-edit')return;fixture.plan={...fixture.plan,environment:{...fixture.plan.environment!,terrain:[...fixture.plan.environment!.terrain!,{kind:'lower',radius:3,strength:1,points:[{x:-15,z:-10},{x:-20,z:-10}]}]}};renderer.update(fixture.plan,'perf-floor');};
document.querySelector<HTMLButtonElement>('#undo')!.onclick=()=>{if(fixture.id!=='water-edit')return;fixture.plan=performanceScene('water-edit').plan;renderer.update(fixture.plan,'perf-floor');};
document.querySelector<HTMLButtonElement>('#capture')!.onclick=()=>{const token=++generation,samples:number[]=[],telemetry:Record<string,string|undefined>[]=[];let start=performance.now(),last=start;status.textContent='5 second warmup, then 60 second capture. Keep this tab visible; use the same orbit movement for each comparison.';
 function frame(now:number){if(token!==generation)return;if(document.hidden){status.textContent='Capture aborted: tab hidden.';return;}if(now-start>5000){samples.push(now-last);if(samples.length%60===0)telemetry.push({...canvas.dataset});}last=now;if(now-start<65000){requestAnimationFrame(frame);return;}const sorted=[...samples].sort((a,b)=>a-b);report={fixture:fixture.id,version:fixture.version,date:new Date().toISOString(),device:document.querySelector<HTMLInputElement>('#device')!.value,browser:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,measurement:'requestAnimationFrame intervals; not GPU timings',p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],samples:samples.length,telemetry};status.textContent='Capture complete: '+samples.length+' frames. p50 '+sorted[Math.floor(sorted.length*.5)].toFixed(2)+' ms; p95 '+sorted[Math.floor(sorted.length*.95)].toFixed(2)+' ms. Export the full report. These are browser frame intervals, not GPU timings.';}
 requestAnimationFrame(frame);
};
document.querySelector<HTMLButtonElement>('#export')!.onclick=()=>{if(!report){status.textContent='Complete a capture first.';return;}const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='nook-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('beforeunload',()=>renderer.dispose());reset();

// Development-only access for inspecting renderer allocations in DevTools.
export {renderer};
