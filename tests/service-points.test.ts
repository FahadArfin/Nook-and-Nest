import {describe,expect,it} from 'vitest';
import {createSamplePlan,parsePlan,rectangleCells} from '../src/domain';
import {validatePlan} from '../src/planValidation';
import {blankSiteSurvey,parseSiteSurvey,publicSurveyPlan} from '../src/siteSurvey';
import {floorQuantityGeometry} from '../src/surfaceGeometry';
import {captureLayout,snapshotAsPlan} from '../src/layoutAlternatives';
import {usePlanner} from '../src/store';

const recorded={id:'power',kind:'outlet',label:'Desk power',floorId:'ground',wallKey:'wall:1:0:0:0:4000:2500',face:'front',offsetMm:1250,heightMm:350,anchor:{ax:0,az:0,bx:4000,bz:0,heightMm:2500,floorElevationMm:0,floorFingerprint:'10-abcd',wallFingerprint:'11-abcd'}};
function plan(){const p=createSamplePlan('Site','metric');p.gridSizeMm=1000;p.furniture=[];p.floors=[{...p.floors[0],id:'ground',elevationMm:0,heightMm:2500,cells:rectangleCells(4,3),walls:[],stairs:[],openings:[]}];return p;}
describe('private service point schema',()=>{
  it('retains measured markers in the shared validated survey without requiring them on older saves',()=>{
    expect(parseSiteSurvey(blankSiteSurvey())).toEqual(blankSiteSurvey());
    const survey=parseSiteSurvey({...blankSiteSurvey(),servicePoints:[recorded]});expect(survey.servicePoints).toEqual([recorded]);
    const p={...plan(),siteSurvey:survey};validatePlan(p);expect(parsePlan(JSON.stringify(p)).siteSurvey?.servicePoints).toEqual([recorded]);
  });
  it('rejects malformed, duplicate, out-of-wall and unbounded service records',()=>{
    for(const point of [{...recorded,kind:'circuit'},{...recorded,offsetMm:4001},{...recorded,heightMm:2501},{...recorded,offsetMm:NaN},{...recorded,secret:'field'}])expect(()=>parseSiteSurvey({...blankSiteSurvey(),servicePoints:[point]})).toThrow();
    expect(()=>parseSiteSurvey({...blankSiteSurvey(),servicePoints:[recorded,recorded]})).toThrow(/Duplicate/);
    expect(()=>parseSiteSurvey({...blankSiteSurvey(),servicePoints:Array.from({length:201},(_,i)=>({...recorded,id:String(i)}))})).toThrow();
    expect(()=>parseSiteSurvey({...blankSiteSurvey(),servicePoints:[{...recorded,verification:{reviewer:'Me',checkedOn:'2026-02-30',fingerprint:'check'}}]})).toThrow();
  });
});
describe('measured service point lifecycle',()=>{
  it('uses exact continuous and angled wall distances and keeps verified measurements through harmless finishes',async()=>{
    const {saveServicePoint,servicePointPosition,servicePointStatus,verifyServicePoint}=await import('../src/servicePoints');
    const p=plan(),wall=floorQuantityGeometry(p,'ground').plates.find(w=>w.uz===0&&w.line===0)!;
    const saved=saveServicePoint(p,p,{id:'power',kind:'outlet',label:'Desk power',floorId:'ground',wallKey:wall.key,face:'front',offsetMm:1250.5,heightMm:350.25},validatePlan);
    const point=saved.siteSurvey!.servicePoints![0];expect(servicePointPosition(point)).toEqual({x:1250.5,z:0});expect(servicePointStatus(saved,point).state).toBe('unchecked');
    const checked=verifyServicePoint(saved,saved,'power',{reviewer:'Owner',checkedOn:'2026-10-03'},validatePlan);expect(servicePointStatus(checked,checked.siteSurvey!.servicePoints![0]).state).toBe('verified');
    const painted=structuredClone(checked);painted.floors[0].wallFinishId='terracotta';expect(servicePointStatus(painted,painted.siteSurvey!.servicePoints![0]).state).toBe('verified');
    const reordered=structuredClone(checked);reordered.siteSurvey!.servicePoints![0].anchor=Object.fromEntries(Object.entries(point.anchor).reverse()) as typeof point.anchor;expect(servicePointStatus(reordered,reordered.siteSurvey!.servicePoints![0]).state).toBe('verified');
    const angled=plan();angled.floors[0].walls=[{id:'angled',ax:0,az:0,bx:3,bz:4}];const diagonal=floorQuantityGeometry(angled,'ground').plates.find(w=>w.lengthMm===5000)!;
    const diagonalSaved=saveServicePoint(angled,angled,{...point,id:'data',kind:'data',wallKey:diagonal.key,offsetMm:2500},validatePlan);expect(servicePointPosition(diagonalSaved.siteSurvey!.servicePoints![0])).toEqual({x:1500,z:2000});
  });
  it('retains old anchors but requires a fresh check after floor, wall or measured-position edits and rejects stale writes',async()=>{
    const {saveServicePoint,servicePointStatus,verifyServicePoint}=await import('../src/servicePoints');const p=plan(),wall=floorQuantityGeometry(p,'ground').plates.find(w=>w.uz===0&&w.line===0)!;
    const saved=saveServicePoint(p,p,{...recorded,kind:'outlet',face:'front',wallKey:wall.key},validatePlan),checked=verifyServicePoint(saved,saved,'power',{reviewer:'Owner',checkedOn:'2026-10-03'},validatePlan),point=checked.siteSurvey!.servicePoints![0];
    const raised=structuredClone(checked);raised.floors[0].elevationMm=500;expect(servicePointStatus(raised,point).state).toBe('changed');expect(raised.siteSurvey!.servicePoints![0]).toEqual(point);expect(()=>verifyServicePoint(raised,raised,'power',{reviewer:'Me',checkedOn:'2026-10-03'},validatePlan)).toThrow(/changed/i);
    const cut=structuredClone(checked);cut.floors[0].cells.pop();expect(servicePointStatus(cut,point).state).toBe('changed');
    const missing={...checked,floors:[]};expect(servicePointStatus(missing,point).state).toBe('changed');
    const edited=saveServicePoint(checked,checked,{...point,heightMm:600},validatePlan);expect(servicePointStatus(edited,edited.siteSurvey!.servicePoints![0]).state).toBe('unchecked');
    expect(()=>saveServicePoint(p,structuredClone(p),{...point},validatePlan)).toThrow(/changed/i);
  });
  it('retains private anchors in layout snapshots and undo but strips them from public projections',async()=>{
    const {saveServicePoint}=await import('../src/servicePoints');usePlanner.getState().replacePlan(plan());const p=usePlanner.getState().plan,wall=floorQuantityGeometry(p,'ground').plates[0];
    const saved=saveServicePoint(p,p,{...recorded,kind:'outlet',face:'front',wallKey:wall.key},validatePlan);usePlanner.getState().commitDesign(p,saved);const current=usePlanner.getState().plan;
    expect(current.siteSurvey!.servicePoints).toHaveLength(1);usePlanner.getState().undo();expect(usePlanner.getState().plan.siteSurvey).toBeUndefined();usePlanner.getState().redo();expect(usePlanner.getState().plan.siteSurvey!.servicePoints).toHaveLength(1);
    const snapshot=captureLayout(saved);expect(snapshotAsPlan(saved,snapshot).siteSurvey!.servicePoints).toEqual(saved.siteSurvey!.servicePoints);expect(JSON.stringify(publicSurveyPlan(saved))).not.toContain('Desk power');
  });
  it('invalidates checks when a legacy opening on the host wall changes but preserves finish-only checks',async()=>{
    const {saveServicePoint,servicePointStatus,verifyServicePoint}=await import('../src/servicePoints');
    const p=plan(),wall=floorQuantityGeometry(p,'ground').plates.find(w=>w.uz===0&&w.line===0)!;
    const saved=saveServicePoint(p,p,{...recorded,kind:'outlet',face:'front',wallKey:wall.key},validatePlan),checked=verifyServicePoint(saved,saved,'power',{reviewer:'Owner',checkedOn:'2026-10-03'},validatePlan),point=checked.siteSurvey!.servicePoints![0];
    const opened=structuredClone(checked);opened.floors[0].openings=[{id:'legacy-door',kind:'door',wallKey:'1:0:2:0',offset:.5,widthMm:914,finishId:'oak'}];validatePlan(opened);
    expect(servicePointStatus(opened,point).state).toBe('changed');
    const remeasured=saveServicePoint(opened,opened,point,validatePlan),rechecked=verifyServicePoint(remeasured,remeasured,'power',{reviewer:'Owner',checkedOn:'2026-10-03'},validatePlan),current=rechecked.siteSurvey!.servicePoints![0];
    const painted=structuredClone(rechecked);painted.floors[0].openings[0].finishId='white';painted.floors[0].wallFinishId='terracotta';expect(servicePointStatus(painted,current).state).toBe('verified');
    for(const patch of [{offset:.25},{widthMm:1000},{kind:'window' as const}]){const changed=structuredClone(rechecked);Object.assign(changed.floors[0].openings[0],patch);expect(servicePointStatus(changed,current).state).toBe('changed');}
    const removed=structuredClone(rechecked);removed.floors[0].openings=[];expect(servicePointStatus(removed,current).state).toBe('changed');
    const unrelated=structuredClone(rechecked);unrelated.floors[0].openings.push({id:'other-door',kind:'door',wallKey:'0:3:1:3',offset:.5,widthMm:914});expect(servicePointStatus(unrelated,current).state).toBe('verified');
  });
  it('exports only the selected floor with literal measured distances, changed status and formula-safe labels',async()=>{
    const {saveServicePoint,servicePointsCsv}=await import('../src/servicePoints');const p=plan(),wall=floorQuantityGeometry(p,'ground').plates.find(w=>w.uz===0&&w.line===0)!;p.floors.push({...p.floors[0],id:'upstairs',name:'Upstairs',elevationMm:3000});
    const one=saveServicePoint(p,p,{...recorded,kind:'outlet',face:'front',label:'=PRIVATE()',wallKey:wall.key,offsetMm:1234.5},validatePlan),two=saveServicePoint(one,one,{...recorded,id:'upstairs-data',kind:'data',face:'front',label:'Upstairs data',floorId:'upstairs',wallKey:wall.key},validatePlan);const changed=structuredClone(two);changed.floors[0].elevationMm=100;
    const csv=servicePointsCsv(changed,'ground');expect(csv).toContain('"\'=PRIVATE()"');expect(csv).toContain('"1234.5","350","changed"');expect(csv).not.toContain('Upstairs data');expect(csv.split('\r\n')).toHaveLength(3);
  });
});
