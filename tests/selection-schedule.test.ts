import {describe,expect,it} from 'vitest';
import {createSamplePlan} from '../src/domain';
import {geometryKey} from '../src/blueprint';
import {validatePlan} from '../src/planValidation';
import {buildSelectionSchedule,classifySelectionRoom,defaultSpecification,parseMoneyInput,parsePlacementSpecification,selectionScheduleCsv,selectionScheduleHtml,stripSelectionSpecifications,updatePlacementSpecification,type PlacementSpecification,type SelectionPlan} from '../src/selectionSchedule';

function fixture():SelectionPlan {const plan=createSamplePlan('Selections','metric');plan.furniture=[];return plan;}
const spec=(price:number|null,currency:string|null='USD',extra:Partial<PlacementSpecification>={}):PlacementSpecification=>({...defaultSpecification(),currency,unitPriceMinor:price,checkedOn:price===null?null:'2026-09-29',...extra});
function add(plan:SelectionPlan,id:string,specification?:PlacementSpecification,floorId=plan.floors[0].id){plan.furniture.push({id,floorId,catalogId:'side-table',x:1000,z:1000,rotation:0,widthMm:500,depthMm:450,heightMm:600,variant:'sage',...(specification?{specification}:{})});}

describe('manual selections and portable schedules',()=>{
  it('keeps unknown and free prices distinct, separates currencies and owned values, and applies discounts to explicit pack lines once',()=>{
    const plan=fixture();add(plan,'usd',spec(10001,'USD',{discount:{kind:'percent',value:1250}}));add(plan,'missing',spec(null));add(plan,'owned',spec(2500,'USD',{status:'owned'}));add(plan,'cad',spec(1500,'CAD',{purchase:{unit:'pack',quantity:2,unitsPerPack:4},discount:{kind:'fixed',value:250}}));add(plan,'free',spec(0));add(plan,'unspecified');
    const schedule=buildSelectionSchedule(plan,'2026-09-29T12:00:00Z');
    expect(schedule.rows.find(r=>r.id==='usd')?.netMinor).toBe(8751);expect(schedule.rows.find(r=>r.id==='cad')?.netMinor).toBe(2750);
    expect(schedule.totals.find(t=>t.currency==='USD')).toMatchObject({knownMinor:8751,unknown:1,ownedKnownMinor:2500,ownedUnknown:0});
    expect(schedule.totals.find(t=>t.currency==='CAD')).toMatchObject({knownMinor:2750,unknown:0,purchaseUnits:2});expect(schedule.totals.find(t=>t.currency===null)?.unknown).toBe(1);
    expect(schedule.rows.find(r=>r.id==='free')?.netMinor).toBe(0);expect(schedule.rows.find(r=>r.id==='missing')?.netMinor).toBeNull();
  });
  it('labels personal proxies in printable and CSV schedules while keeping owned belongings out of buy totals',()=>{
    const plan=fixture();add(plan,'personal');plan.furniture[0].personalItem={version:1,itemId:'my-table',name:'Family table',representation:'catalog-proxy',status:'keep'};
    const schedule=buildSelectionSchedule(plan);expect(schedule.rows[0].catalogName).toContain('Approximate visual');expect(schedule.rows[0].specification.match).toBe('visual-substitute');
    expect(schedule.totals[0]).toMatchObject({unknown:0,ownedUnknown:1});expect(selectionScheduleCsv(schedule)).toContain('Approximate visual');expect(selectionScheduleHtml(schedule)).toContain('Approximate visual');
  });
  it('validates money precision, real dates, quantity and source URLs without fetching anything',()=>{
    expect(parseMoneyInput('10.05','USD')).toBe(1005);expect(parseMoneyInput('10.125','KWD')).toBe(10125);expect(parseMoneyInput('100','JPY')).toBe(100);expect(parseMoneyInput('','USD')).toBeNull();
    for(const value of ['1.234','1,000','-1','NaN','Infinity'])expect(()=>parseMoneyInput(value,'USD')).toThrow();expect(()=>parseMoneyInput('10.5','JPY')).toThrow();
    for(const value of [{...spec(100),checkedOn:'2026-02-30'},{...spec(100),currency:null},{...spec(100),purchase:{unit:'item',quantity:2}},{...spec(100),discount:{kind:'fixed',value:101}},{...spec(100),discount:{kind:'percent',value:10001}},{...spec(100),productUrl:'javascript:alert(1)'},{...spec(100),productUrl:'https://user:secret@example.com'},{...spec(100),untrusted:true}])expect(()=>parsePlacementSpecification(value)).toThrow();
    expect(parsePlacementSpecification({...spec(null),productUrl:'https://example.com/product?size=large&finish=oak'}).productUrl).toContain('https://');
  });
  it('assigns exact polygon centers, keeps combined-room parts together and warns about overlap or stale geometry',()=>{
    const plan=fixture(),floor=plan.floors[0];floor.blueprint={geometryKey:geometryKey(floor),rooms:[{id:'triangle',name:'Angled room',kind:'Living',enclosed:true,x:0,z:0,width:3000,depth:3000,polygon:[{x:0,z:0},{x:3000,z:0},{x:0,z:3000}]}]};
    expect(classifySelectionRoom(floor,{x:500,z:500}).name).toBe('Angled room');expect(classifySelectionRoom(floor,{x:2500,z:2500}).name).toBe('Unassigned');
    floor.blueprint.rooms.push({id:'overlap',name:'Other room',kind:'Office',enclosed:true,x:0,z:0,width:1000,depth:1000});expect(classifySelectionRoom(floor,{x:500,z:500}).warning).toContain('multiple rooms');
    floor.blueprint.rooms[1].groupId='same';floor.blueprint.rooms[0].groupId='same';expect(classifySelectionRoom(floor,{x:500,z:500}).key).toBe('same');
    floor.cells=[...floor.cells,{x:99,z:99}];expect(classifySelectionRoom(floor,{x:500,z:500}).warning).toContain('out of date');
  });
  it('updates only the requested placement with a stale-base guard and preserves geometry and other placement metadata',()=>{
    const plan=fixture();add(plan,'one');add(plan,'two');const before=structuredClone(plan),next=updatePlacementSpecification(plan,plan,'one',spec(500),validatePlan);
    expect(next.floors).toBe(plan.floors);expect(next.furniture[1]).toBe(plan.furniture[1]);expect(next.furniture[0]).toMatchObject({...plan.furniture[0],specification:spec(500)});expect(plan).toEqual(before);
    expect(()=>updatePlacementSpecification(plan,{...plan},'one',spec(500),validatePlan)).toThrow('changed');expect(()=>updatePlacementSpecification(plan,plan,'foreign-project-item',spec(500),validatePlan)).toThrow('no longer');
    expect(updatePlacementSpecification(next,next,'one',undefined,validatePlan).furniture[0]).not.toHaveProperty('specification');
  });
  it('strips private specifications from active, alternate and Studio placements without mutating private saves',()=>{
    const plan=fixture();add(plan,'one',{...spec(700),productUrl:'https://private.example.com/secret',vendor:'Private vendor'});
    plan.layoutAlternatives={version:1,options:[{id:'option',name:'Other',createdAt:plan.createdAt,activeFloorId:plan.floors[0].id,snapshot:{gridSizeMm:plan.gridSizeMm,floors:plan.floors,furniture:plan.furniture}}]};
    plan.studioDrafts={[plan.floors[0].id]:{draft:{rooms:[],walls:[],fixtures:plan.furniture,omittedWalls:[]},savedAt:plan.updatedAt,imageScale:1,calibrated:false,view:{x:0,z:0,width:100,height:100}}};
    const publicPlan=stripSelectionSpecifications(plan);expect(JSON.stringify(publicPlan)).not.toContain('private.example');expect(JSON.stringify(publicPlan)).not.toContain('unitPriceMinor');expect(publicPlan.furniture[0].widthMm).toBe(500);expect(plan.furniture[0].specification?.unitPriceMinor).toBe(700);
  });
  it('makes escaped, formula-safe exports with source, checked date, dimensions, match, unknowns and a snapshot reference',()=>{
    const plan=fixture();plan.name='=HYPERLINK("https://bad.example")';add(plan,'one',{...spec(2500),productName:'<script>alert(1)</script>',vendor:'+SUM(1,2)',productUrl:'https://example.com/item?x=1&y=2',match:'visual-substitute'});add(plan,'unknown');
    const schedule=buildSelectionSchedule(plan),csv=selectionScheduleCsv(schedule),html=selectionScheduleHtml(schedule);
    expect(csv).toContain('"\'=HYPERLINK');expect(csv).toContain('"\'+SUM(1,2)"');expect(csv).toContain('Visual substitute');expect(csv).toContain('2026-09-29');expect(csv).toContain('Unknown');expect(csv).toContain(schedule.revision);
    expect(html).not.toContain('<script>alert');expect(html).toContain('&lt;script&gt;');expect(html).toContain('x=1&amp;y=2');expect(html).toContain('500 × 450 × 600');expect(html).toContain('Owned items are excluded');expect(html).toContain('Snapshot revision');
  });
});
