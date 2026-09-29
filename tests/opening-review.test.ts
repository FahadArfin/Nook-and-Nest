import {expect,it,vi} from 'vitest';
import {exteriorMask,gapCandidates,spanChoices} from '../src/openingGeometry';
import {OPENING_REVIEW_VERSION,validateOpeningRequest,validateOpeningAnswer} from '../src/openingReviewContract';
import {applyReviewedOpening,splitRoomLabel} from '../src/openingCorrections';
import {blueprintPlan,draftFromFloor,type BlueprintDraft} from '../src/blueprint';
import {createSamplePlan,parsePlan,serializePlan} from '../src/domain';
import {wallRuns} from '../src/windows';
// @ts-expect-error Worker entry is JavaScript.
import {analyzeOpening} from '../worker/opening-review.js';
const setup=()=>{const base=createSamplePlan();base.furniture=[];base.floors=base.floors.slice(0,1);const draft:BlueprintDraft={rooms:[{id:'r',name:'Living',kind:'Living',x:0,z:0,width:4000,depth:4000,enclosed:false}],walls:[],omittedWalls:[],fixtures:[]};return {base,draft,id:base.floors[0].id};};
const choices=spanChoices({ax:30,ay:50,bx:60,by:50},100,100),review={version:OPENING_REVIEW_VERSION,choices};
const answer={choiceId:'span-0',kind:'door',confidence:'high',note:'Both jambs visible.'};
const envelope=(value:unknown)=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
it('finds a collinear gap without inventing a bridge between parallel offset walls',()=>{
  expect(gapCandidates([{axis:'h',x:0,y:20,width:40,height:10},{axis:'h',x:50,y:20,width:40,height:10}],200,200)).toEqual([{ax:40,ay:25,bx:50,by:25}]);
  expect(gapCandidates([{axis:'h',x:0,y:20,width:40,height:10},{axis:'h',x:50,y:40,width:40,height:10}],200,200)).toEqual([]);
});
it('distinguishes an enclosed room from a one-pixel exterior leak',()=>{
  const mask=new Uint8ClampedArray(20*20*4).fill(255);for(let i=5;i<=14;i++)for(const [x,y] of [[i,5],[i,14],[5,i],[14,i]])mask[(y*20+x)*4]=0;
  expect(exteriorMask(mask,20,20)[10*20+10]).toBe(0);mask[(5*20+10)*4]=255;expect(exteriorMask(mask,20,20)[10*20+10]).toBe(1);
});
it('retains original span first and bounds alternatives to the image',()=>{expect(choices[0]).toEqual({id:'span-0',ax:30,ay:50,bx:60,by:50});expect(choices).toHaveLength(5);expect(()=>validateOpeningRequest(review,100,100)).not.toThrow();expect(spanChoices({ax:0,ay:0,bx:30,by:0},100,100).length).toBeLessThan(5);});
it('rejects invented choices, nonfinite/diagonal inputs and unsupported output classes',()=>{for(const change of [{ax:NaN},{by:80},{id:'injected'}])expect(()=>validateOpeningRequest({...review,choices:[{...choices[0],...change}]},100,100)).toThrow();expect(()=>validateOpeningAnswer({...answer,choiceId:'span-9'},choices)).toThrow();expect(()=>validateOpeningAnswer({...answer,kind:'stairs'},choices)).toThrow();});
it('adds a supported door with unchanged floor geometry and rejects a misplaced or duplicate opening',()=>{const {base,id,draft}=setup(),before=JSON.stringify(draft),s={ax:100,ay:0,bx:190,by:0};const next=applyReviewedOpening(base,id,draft,s,10,'door');expect(next.fixtures).toHaveLength(1);expect(next.rooms).toEqual(draft.rooms);expect(JSON.stringify(draft)).toBe(before);expect(()=>applyReviewedOpening(base,id,next,s,10,'door')).toThrow();expect(()=>applyReviewedOpening(base,id,draft,{...s,ay:150,by:150},10,'door')).toThrow();expect(blueprintPlan(base,id,next).furniture[0].widthMm).toBe(900);});
it('supports windows and open entrances through the same wall validator',()=>{const {base,id,draft}=setup();for(const kind of ['window','open'] as const){const next=applyReviewedOpening(base,id,draft,{ax:100,ay:0,bx:190,by:0},10,kind);expect(next.fixtures[0].catalogId).toBe(kind==='window'?'window-picture':'door-flush');if(kind==='open')expect(next.fixtures[0].doorless).toBe(true);}});
it('keeps a virtual label split wall-free through save and reimport, preserving adjacent walls',()=>{
  const {base,id,draft}=setup();draft.rooms[0].enclosed=true;draft.rooms.push({id:'bed',name:'Bedroom',kind:'Bedroom',x:4000,z:0,width:3000,depth:4000,enclosed:true});const before=blueprintPlan(base,id,draft),next=splitRoomLabel(base,id,draft,'r','v',.5),plan=blueprintPlan(base,id,next);
  expect(next.rooms.reduce((a,r)=>a+r.width*r.depth,0)).toBe(28_000_000);expect(wallRuns(plan.floors[0],base.gridSizeMm)).toEqual(wallRuns(before.floors[0],base.gridSizeMm));
  const restored=parsePlan(serializePlan(plan)),again=blueprintPlan(restored,id,draftFromFloor(restored,id));expect(wallRuns(again.floors[0],base.gridSizeMm)).toEqual(wallRuns(before.floors[0],base.gridSizeMm));expect(draft.rooms).toHaveLength(2);
});
it('rejects a label split through an existing physical wall',()=>{const {base,id,draft}=setup();draft.walls.push({id:'edited:wall',ax:2000/base.gridSizeMm,bx:2000/base.gridSizeMm,az:0,bz:4000/base.gridSizeMm});expect(()=>splitRoomLabel(base,id,draft,'r','v',.5)).toThrow(/physical wall/);});
it('uses one bounded Luna request with no storage and rejects model-invented coordinates',async()=>{
  const fetcher=vi.fn(async(_url:string,_init:RequestInit)=>envelope(answer));expect(await analyzeOpening('data:image/jpeg;base64,YQ==',100,100,review,'test',fetcher)).toEqual(answer);expect(fetcher).toHaveBeenCalledOnce();const body=JSON.parse(fetcher.mock.calls[0][1].body as string);expect(body.model).toBe('gpt-6-luna');expect(body.store).toBe(false);expect(body.max_output_tokens).toBe(2200);
  await expect(analyzeOpening('image',100,100,review,'test',async()=>envelope({...answer,choiceId:'invented'}))).rejects.toThrow();
});
