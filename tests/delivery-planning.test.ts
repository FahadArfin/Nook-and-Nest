import {expect,it} from 'vitest';
import {createBlankPlan} from '../src/domain';
import {assessDeliveryStep,deliveryItemSourceStatus,deliveryPlanningHtml,itemFromFurniture,parseDeliveryPlanning,saveDeliveryPlanning,type DeliveryItem,type DeliveryRouteStep} from '../src/deliveryPlanning';
const item:DeliveryItem={id:'box',name:'Packed table',notes:'',widthMm:800,depthMm:1200,heightMm:600,basis:'packaged',orientation:'wdh',dimensionSource:'entered'};
const door:DeliveryRouteStep={id:'front',name:'Front door',kind:'door',notes:'',measurements:{widthMm:900,heightMm:2000}};
const planning=()=>({version:1 as const,steps:[structuredClone(door)],items:[structuredClone(item)]});
it('keeps unknown measurements unknown and rejects coercions, nonfinite dimensions and unsupported fields',()=>{
  const input=planning();input.items[0].widthMm=null;expect(parseDeliveryPlanning(input).items[0].widthMm).toBeNull();
  expect(assessDeliveryStep(input.items[0],door).state).toBe('unknown');
  for(const bad of [0,-1,Infinity,NaN,'800',100001])expect(()=>parseDeliveryPlanning({...input,items:[{...item,widthMm:bad}]})).toThrow();
  expect(()=>parseDeliveryPlanning({...input,hidden:'private'})).toThrow();
  expect(()=>parseDeliveryPlanning({...input,steps:[{...door,measurements:{...door.measurements,depthMm:20}}]})).toThrow();
});
it('bounds the register and rejects repeated identities and invalid model provenance',()=>{
  const input=planning();expect(()=>parseDeliveryPlanning({...input,steps:Array.from({length:25},(_,n)=>({...door,id:String(n)}))})).toThrow();
  expect(()=>parseDeliveryPlanning({...input,items:Array.from({length:101},(_,n)=>({...item,id:String(n)}))})).toThrow();
  expect(()=>parseDeliveryPlanning({...input,items:[item,item]})).toThrow();
  expect(()=>parseDeliveryPlanning({...input,items:[{...item,dimensionSource:'model'}]})).toThrow();
});
it('distinguishes spare clearance, exact equality, blockage and unknown packaging without silently rotating',()=>{
  expect(assessDeliveryStep(item,door)).toMatchObject({state:'clear',clearances:[{label:'Width',mm:100},{label:'Height',mm:1400}]});
  expect(assessDeliveryStep({...item,widthMm:900},door).state).toBe('tight');
  expect(assessDeliveryStep({...item,widthMm:901},door).state).toBe('blocked');
  expect(assessDeliveryStep({...item,orientation:'dwh'},door).state).toBe('blocked');
  expect(assessDeliveryStep({...item,basis:'unknown'},door).state).toBe('unknown');
  expect(assessDeliveryStep({...item,widthMm:3*25.4},{...door,measurements:{widthMm:76.2,heightMm:2000}}).state).toBe('tight');
});
it('uses the same fixed orientation for lift entry and cabin and never clears turns or stairs',()=>{
  const lift:DeliveryRouteStep={id:'lift',kind:'lift',name:'Lift',notes:'',measurements:{entryWidthMm:900,entryHeightMm:1300,widthMm:1300,depthMm:900,heightMm:700}};
  expect(assessDeliveryStep(item,lift).state).toBe('blocked');expect(assessDeliveryStep({...item,orientation:'dwh'},lift).state).toBe('blocked');
  expect(assessDeliveryStep(item,{...lift,measurements:{...lift.measurements,depthMm:1300}}).state).toBe('clear');
  expect(assessDeliveryStep(item,{id:'turn',kind:'turn',name:'Turn',notes:'',measurements:{widthMm:3000,exitWidthMm:3000,turnDepthMm:3000,heightMm:3000}}).state).toBe('manual');
  expect(assessDeliveryStep(item,{id:'stair',kind:'stair',name:'Stair',notes:'',measurements:{widthMm:null,heightMm:null,landingWidthMm:null,landingDepthMm:null}})).toMatchObject({state:'manual',missing:['Route: stair width','Route: headroom','Route: landing width','Route: landing depth']});
});
it('copies placed assembled dimensions only and invalidates model evidence after removal or resizing',()=>{
  const plan=createBlankPlan('Delivery','metric');const furniture={id:'chair',catalogId:'armchair',floorId:plan.floors[0].id,x:0,z:0,rotation:90,widthMm:800,depthMm:900,heightMm:700,variant:'sage'};plan.furniture=[furniture];
  const linked=itemFromFurniture(furniture,'Chair','transport');expect(linked).toMatchObject({basis:'assembled',dimensionSource:'model',widthMm:800,depthMm:900,heightMm:700,orientation:'wdh'});
  expect(deliveryItemSourceStatus(plan,linked).state).toBe('current');
  const changed={...plan,furniture:[{...furniture,widthMm:801}]};expect(deliveryItemSourceStatus(changed,linked).state).toBe('changed');expect(assessDeliveryStep(linked,door,changed).state).toBe('unknown');
  expect(deliveryItemSourceStatus({...plan,furniture:[]},linked).state).toBe('removed');expect(assessDeliveryStep(linked,door,{...plan,furniture:[]}).state).toBe('unknown');
});
it('rejects stale edits and validates the full immutable next plan before allowing one save',()=>{
  const plan=createBlankPlan('Delivery','metric');let seen:unknown;
  const next=saveDeliveryPlanning(plan,plan,planning(),value=>{seen=value;});expect(seen).toBe(next);expect(next.deliveryPlanning?.items[0].name).toBe('Packed table');expect(plan.deliveryPlanning).toBeUndefined();
  expect(()=>saveDeliveryPlanning(plan,{...plan,name:'Newer'},planning(),()=>{})).toThrow(/changed/);
  expect(()=>saveDeliveryPlanning(plan,plan,planning(),()=>{throw new Error('Project invalid');})).toThrow('Project invalid');
});
it('escapes every printable user field and reports missing measurements with the delivery limitation',()=>{
  const plan=createBlankPlan('<img src=x onerror=alert(1)>','metric');plan.deliveryPlanning={version:1,steps:[{...door,name:'<script>bad()</script>',notes:'a & b'}],items:[{...item,name:'<iframe>',widthMm:null,notes:'<b>private</b>'}]};
  const html=deliveryPlanningHtml(plan);expect(html).not.toContain('<script>');expect(html).not.toContain('<iframe>');expect(html).not.toContain('<img');expect(html).toContain('&lt;iframe&gt;');expect(html).toContain('Unknown');expect(html).toContain('not a moving-fit guarantee');
});
