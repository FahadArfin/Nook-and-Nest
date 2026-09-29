import {describe,it,expect} from 'vitest';
import {catalog,defaultMountHeight,isWallOpening} from '../src/catalog';
import {createSamplePlan,parsePlan,serializePlan,encodeShare,decodeShare} from '../src/domain';
import {shelfChoices,shelfSurfaces,restsOnShelf} from '../src/shelfSurfaces';
import {tabletopPoint,tabletopChoices} from '../src/tabletop';
import {buildDesign} from '../src/agentDesign';
import {supportFootprint,supportCenter} from '../src/supportFootprint';
import {snapWindow,windowProblem} from '../src/windows';
import {usePlanner} from '../src/store';
import type {FurniturePlacement} from '../src/types';

const item=(id:string,floorId:string):FurniturePlacement=>{
 const c=catalog.find(c=>c.id===id)!;
 return {id:'test-'+id,catalogId:id,floorId,x:1500,z:1500,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage',elevationMm:defaultMountHeight(id)};
};

describe('authored household support and mounting',()=>{
 it('fits the independent microwave inside the actual open cabinet bay',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id,host=item('kitchen-microwave-drawer-cabinet',floor),appliance=item('kitchen-microwave-drawer',floor);
  const choices=shelfChoices({...plan,furniture:[host]},appliance),bay=choices.find(c=>c.surface.id==='appliance-bay');
  expect(bay).toBeDefined();expect(bay!.placement.elevationMm).toBe(443);
  expect(restsOnShelf({...appliance,...bay!.placement},host)).toBe(true);
  expect(shelfChoices({...plan,furniture:[host]},{...appliance,heightMm:430}).some(c=>c.surface.id==='appliance-bay')).toBe(false);
 });
 it('rests a trailing pot on its contact base while keeping the hanging geometry below the shelf',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id;
  const host=item('tiered-plant-stand',floor),plant=item('trailing-pothos-in-shelf-pot',floor);
  plan.furniture=[host];
  const choices=shelfChoices(plan,plant);
  expect(choices.every(c=>c.placement.elevationMm>=0)).toBe(true);
  expect(plant.widthMm).toBeGreaterThan(shelfSurfaces(host)[0].width);
  expect(choices).toHaveLength(1);expect(choices[0].surface.id).toBe('high');
  const chosen=choices.find(c=>c.surface.height>500)!;
  const placed={...plant,...chosen.placement};
  expect(placed.elevationMm+supportFootprint(placed).offset).toBeCloseTo(chosen.surface.height,0);
  expect(restsOnShelf(placed,host)).toBe(true);
  expect(shelfChoices({...plan,furniture:[{...host,widthMm:100}]},plant)).toHaveLength(0);
  expect(shelfChoices({...plan,furniture:[item('cube-display-shelf',floor)]},plant)).toHaveLength(0);
  expect(tabletopChoices({...plan,furniture:[item('bar-cart',floor),item('desk',floor)]},plant)).toHaveLength(0);
  expect(restsOnShelf({...placed,x:placed.x+30},host)).toBe(false);
  expect(shelfChoices({...plan,furniture:[{...host,widthMm:1200,depthMm:1200}]},plant)).toHaveLength(0);
 });

 it('uses the clear worktop instead of the raised mirror or cart handle',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id;
  const dresser=item('dressing-table',floor),cup=item('bath-toothbrush-cup',floor);
  plan.furniture=[dresser];
  const choices=shelfChoices(plan,cup);
  expect(choices).toHaveLength(1);
  expect(choices[0].placement.elevationMm).toBeGreaterThan(700);
  expect(choices[0].placement.elevationMm).toBeLessThan(800);
  expect(choices[0].placement.x).not.toBe(dresser.x);
  expect(tabletopChoices(plan,cup)[0].placement).toEqual(choices[0].placement);
  expect(shelfChoices(plan,{...cup,widthMm:600})).toHaveLength(0);
  const cart=item('bar-cart',floor);
  expect(shelfSurfaces(cart)).toHaveLength(2);
  expect(Math.max(...shelfSurfaces(cart).map(s=>s.height))).toBeLessThan(cart.heightMm-80);
 });

 it('places the monitor clamp at a desk back edge using the top pad contact plane',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id;
  const desk=item('desk',floor),arm=item('desk-monitor-arm',floor);plan.furniture=[desk];
  const point=tabletopPoint(plan,arm,{x:1.5,y:3,z:1.5},{x:0,y:-1,z:0})!;
  expect(point).toBeDefined();
  const placed={...arm,...point};
  expect(placed.elevationMm!+supportFootprint(placed).offset).toBeCloseTo(desk.heightMm,4);
  const contact=supportCenter(placed),fp=supportFootprint(placed);
  expect(contact.z-desk.z-fp.depth/2).toBeCloseTo(-desk.depthMm/2+4,4);
  expect(shelfChoices({...plan,furniture:[item('cube-display-shelf',floor)]},arm)).toHaveLength(0);
 });

 it('preserves independent material edits, contact elevations and history through save/share',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id,host=item('bar-cart',floor),cup=item('bath-toothbrush-cup',floor);
  plan.furniture=[host];const choice=shelfChoices(plan,cup)[1];const placed={...cup,...choice.placement};
  const store=usePlanner.getState();store.replacePlan(plan);store.confirmFurniture(placed);
  store.updateFurniture(placed.id,{materialColors:{'slate-blue-glaze':'#375966'}});
  const saved=structuredClone(usePlanner.getState().plan);
  expect(saved.furniture[0]).toEqual(host);
  store.undo();expect(usePlanner.getState().plan.furniture[1].materialColors).toBeUndefined();
  store.redo();expect(usePlanner.getState().plan).toEqual(saved);
  expect(parsePlan(serializePlan(saved))).toEqual(saved);
  expect(decodeShare(encodeShare(saved)).furniture).toEqual(saved.furniture);
 });

 it('keeps fixtures on solid wall faces and ceiling defaults relative to the room height',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0];
  const accessory=item('bath-towel-bar',floor.id);
  const mounted=snapWindow(plan,{...accessory,x:1400,z:0});
  expect(windowProblem(plan,mounted)).toBeUndefined();
  expect(isWallOpening(accessory.catalogId)).toBe(false);
  expect(defaultMountHeight('bath-folding-shower-seat')).toBe(350);
  expect(defaultMountHeight('safety-smoke-co-alarm',3000)).toBe(2905);
  expect(defaultMountHeight('bath-exhaust-fan',2400)).toBe(2315);
  const tall={...plan,floors:plan.floors.map(f=>({...f,heightMm:3000}))};
  const designed=buildDesign(tall,[{action:'place',catalogId:'safety-smoke-co-alarm',floorId:floor.id,x:1500,z:1500}]);
  expect(designed.plan.furniture.find(f=>f.catalogId==='safety-smoke-co-alarm')?.elevationMm).toBe(2905);
  expect(isWallOpening('vertical-patio-door-blinds')).toBe(false);
 });
});
