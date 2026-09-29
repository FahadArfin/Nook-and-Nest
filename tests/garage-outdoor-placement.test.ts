import {describe,expect,it} from 'vitest';
import {catalog,defaultMountHeight,isCeilingMounted,isSurfaceMounted,isWallMounted,isWallOpening} from '../src/catalog';
import {createSamplePlan,decodeShare,encodeShare,parsePlan,rectangleCells,serializePlan} from '../src/domain';
import {garageOutdoorRows} from '../src/garageOutdoorCollection';
import {designWarnings} from '../src/agentDesign';
import {architectureWallAnchor,garageDoorAperture,garageDoorProblem,placementFromWallAnchor} from '../src/householdArchitecture';
import {furnitureType} from '../src/library';
import {outsidePlacementPoint} from '../src/outdoors';
import {restsOnShelf,shelfChoices,shelfSurfaces} from '../src/shelfSurfaces';
import {supportCenter,supportFootprint} from '../src/supportFootprint';
import {supportsDesktop,tabletopChoices,tabletopPoint} from '../src/tabletop';
import {snapWindow,windowProblem,windowWallPieces} from '../src/windows';
import {usePlanner} from '../src/store';
import type {FurniturePlacement} from '../src/types';

function home(){
  const plan=createSamplePlan('Garage and garden','metric');
  plan.gridSizeMm=1000;
  plan.floors=[{...plan.floors[0],id:'ground',elevationMm:0,heightMm:2800,cells:rectangleCells(7,7),walls:[],openings:[]}];
  plan.furniture=[];
  plan.environment={background:'plain',grass:'off'};
  return plan;
}

function item(id:string,patch:Partial<FurniturePlacement>={}):FurniturePlacement{
  const def=catalog.find(c=>c.id===id)!;
  return {id:`placed-${id}`,catalogId:id,floorId:'ground',x:3500,z:3500,rotation:0,
    widthMm:def.widthMm,depthMm:def.depthMm,heightMm:def.heightMm,variant:'sage',
    elevationMm:defaultMountHeight(id,2800),...patch};
}

const doors=['garage-door-full-view','garage-door-carriage','garage-door-slatted'];
const faces=[
  {rotation:180,x:3500,z:0,wall:{id:'front',ax:0,az:0,bx:7,bz:0}},
  {rotation:0,x:3500,z:7000,wall:{id:'back',ax:0,az:7,bx:7,bz:7}},
  {rotation:270,x:0,z:3500,wall:{id:'left',ax:0,az:0,bx:0,bz:7}},
  {rotation:90,x:7000,z:3500,wall:{id:'right',ax:7,az:0,bx:7,bz:7}},
];

describe('garage and outdoor placement contract',()=>{
  it('registers the complete collection with its intended mounting and useful library type',()=>{
    expect(garageOutdoorRows).toHaveLength(103);
    expect(new Set(garageOutdoorRows.map(r=>r[0])).size).toBe(103);
    for(const row of garageOutdoorRows){
      const id=String(row[0]),matches=catalog.filter(c=>c.id===id);
      expect(matches,id).toHaveLength(1);
      const def=matches[0];
      expect(def,id).toMatchObject({category:row[2],widthMm:row[3],depthMm:row[4],heightMm:row[5],mount:row[8]});
      expect(furnitureType(def),id).not.toBe('Other pieces');
      expect(isWallMounted(id),id).toBe(row[8]==='wall');
      expect(isSurfaceMounted(id),id).toBe(row[8]==='surface');
      expect(isCeilingMounted(id),id).toBe(row[8]==='ceiling');
      expect(isWallOpening(id),id).toBe(doors.includes(id));
    }
  });

  it('mounts storage and opener hardware on solid walls and makes ceiling heights room-relative',()=>{
    const plan=home();
    for(const id of ['garage-wall-cabinet','garage-pegboard-tools','garage-wall-opener','garage-door-keypad']){
      const mounted=snapWindow(plan,item(id,{x:3500,z:0}));
      expect(windowProblem(plan,mounted),id).toBeUndefined();
      expect(isWallOpening(id),id).toBe(false);
      expect(Math.abs(mounted.z),id).toBeCloseTo(mounted.depthMm/2+51);
      expect(windowWallPieces(faces[0].wall,1000,2800,[mounted]),id)
        .toEqual(windowWallPieces(faces[0].wall,1000,2800,[]));
    }
    expect(defaultMountHeight('garage-folding-wall-bench',2800)).toBe(470);
    expect(defaultMountHeight('garage-ceiling-rack',3000)).toBe(2250);
    expect(defaultMountHeight('garage-shop-heater',2400)).toBe(1870);
  });

  it.each(doors)('keeps %s leaf, aperture and overhead tracks aligned on all four wall faces',id=>{
    const plan=home();
    for(const face of faces){
      const anchor=item(id,{x:face.x,z:face.z,rotation:face.rotation,elevationMm:0});
      const placed=snapWindow(plan,placementFromWallAnchor(anchor));
      const actual=architectureWallAnchor(placed);
      expect(actual.x).toBeCloseTo(face.x);expect(actual.z).toBeCloseTo(face.z);
      expect(Math.hypot(placed.x-actual.x,placed.z-actual.z)).toBeCloseTo(1259);
      expect(garageDoorAperture(placed)).toEqual({width:2700,height:2130,offset:0});
      expect(windowProblem(plan,placed)).toBeUndefined();
      const spans=windowWallPieces(face.wall,1000,2800,[placed]);
      const header=spans.find(s=>s.start<3500&&s.end>3500);
      // The 25 mm trim overlap belongs to the frame, so the visible cut is 2650 mm.
      expect(header).toMatchObject({start:2175,end:4825,bottom:2105});
      expect(spans.some(s=>s.start<3500&&s.end>3500&&s.bottom===0)).toBe(false);
      const outward=placementFromWallAnchor({...anchor,rotation:(face.rotation+180)%360});
      expect(garageDoorProblem(plan,outward)).toMatch(/tracks/);
    }
    const resized=placementFromWallAnchor(item(id,{x:3500,z:0,rotation:180,depthMm:2160,widthMm:2280,heightMm:1920}));
    expect(resized.z).toBeCloseTo(1007.2);
    expect(garageDoorAperture(resized)).toEqual({width:2160,height:1704,offset:0});
  });

  it('uses the clear bench top below the hutch and rejects its narrow upper shelf for a charger',()=>{
    const plan=home(),host=item('garage-hutch-workbench'),charger=item('garage-charger-dock');
    plan.furniture=[host];
    const surfaces=shelfSurfaces(host),choices=shelfChoices(plan,charger);
    expect(surfaces.map(s=>s.id).sort()).toEqual(['hutch','lower','worktop']);
    const choice=choices.find(c=>c.surface.id==='worktop')!;
    expect(choice).toBeDefined();expect(choice.surface.height).toBeGreaterThan(850);expect(choice.surface.height).toBeLessThan(950);
    expect(choices.some(c=>c.surface.id==='hutch')).toBe(false);
    expect(tabletopChoices(plan,charger)[0].placement).toEqual(choice.placement);
    const placed={...charger,...choice.placement};
    expect(restsOnShelf(placed,host)).toBe(true);
    const hit=tabletopPoint(plan,placed,{x:placed.x/1000,y:3,z:placed.z/1000},{x:0,y:-1,z:0});
    expect(hit?.elevationMm).toBe(choice.placement.elevationMm);
    expect(shelfChoices(plan,{...charger,depthMm:700})).toEqual([]);
  });

  it('uses the drill battery contact base on rotated storage and keeps color, placement and history independent',()=>{
    const plan=home(),host=item('garage-drawer-base',{rotation:90}),drill=item('garage-cordless-drill');
    plan.furniture=[host];
    const fp=supportFootprint(drill);
    expect(fp.width).toBeLessThan(drill.widthMm*.65);
    expect(fp.depth).toBeLessThanOrEqual(drill.depthMm);
    const choice=shelfChoices(plan,drill)[0];expect(choice).toBeDefined();
    const placed={...drill,...choice.placement},center=supportCenter(placed);
    expect(placed.rotation).toBe(90);
    expect(center.x).toBeCloseTo(host.x+choice.surface.z,0);
    expect(center.z).toBeCloseTo(host.z-choice.surface.x,0);
    expect(placed.elevationMm+fp.offset).toBeCloseTo(choice.surface.height,0);
    expect(restsOnShelf(placed,host)).toBe(true);
    expect(restsOnShelf({...placed,x:placed.x+host.depthMm},host)).toBe(false);
    const store=usePlanner.getState();store.replacePlan(plan);store.confirmFurniture(placed);
    store.updateFurniture(placed.id,{materialColors:{'garage-ochre-tool-polymer':'#ad772d'}});
    const saved=structuredClone(usePlanner.getState().plan);
    expect(saved.furniture[0]).toEqual(host);
    expect(saved.floors).toEqual(plan.floors);
    store.undo();expect(usePlanner.getState().plan.furniture[1].materialColors).toBeUndefined();
    store.redo();expect(usePlanner.getState().plan).toEqual(saved);
    expect(parsePlan(serializePlan(saved))).toEqual(saved);
    expect(decodeShare(encodeShare(saved)).furniture).toEqual(saved.furniture);
  });

  it('rests all new floor outdoor pieces on lowest-floor ground and only uses paving that supports the footprint',()=>{
    const plan=home();plan.floors.push({...plan.floors[0],id:'upper',elevationMm:3000});
    for(const row of garageOutdoorRows.filter(r=>r[2]==='Outdoor'&&r[8]==='floor')){
      const piece=item(String(row[0]),{x:-12000,z:-12000});
      expect(outsidePlacementPoint(plan,piece,{x:-12,y:10,z:-12},{x:0,y:-1,z:0}),piece.catalogId)
        .toEqual({x:-12000,z:-12000,elevationMm:-200});
      expect(outsidePlacementPoint(plan,{...piece,floorId:'upper'},{x:-12,y:10,z:-12},{x:0,y:-1,z:0}),piece.catalogId)
        .toBeUndefined();
    }
    plan.furniture=[item('cobble-patio',{x:-12000,z:-12000,elevationMm:-200})];
    expect(outsidePlacementPoint(plan,item('outdoor-rope-dining-chair'),{x:-12,y:10,z:-12},{x:0,y:-1,z:0})?.elevationMm).toBe(-130);
    expect(outsidePlacementPoint(plan,item('pool-rectangular-frame'),{x:-12,y:10,z:-12},{x:0,y:-1,z:0})?.elevationMm).toBe(-200);
  });

  it('does not offer canopy roofs or pool water as tabletops and permits furnishing an open pergola',()=>{
    const plan=home(),lantern=item('outdoor-caged-lantern');
    for(const id of ['outdoor-louvered-pergola','outdoor-timber-gazebo','pool-rectangular-frame','pool-round-frame','pool-timber-plunge','outdoor-square-hot-tub']){
      const host=item(id);plan.furniture=[host];
      expect(supportsDesktop(host),id).toBe(false);
      expect(shelfSurfaces(host),id).toEqual([]);
      expect(tabletopChoices(plan,lantern),id).toEqual([]);
      expect(tabletopPoint(plan,lantern,{x:3.5,y:6,z:3.5},{x:0,y:-1,z:0}),id).toBeUndefined();
    }
    const pergola=item('outdoor-louvered-pergola',{x:-12000,z:-12000,elevationMm:-200});
    const chair=item('outdoor-rope-dining-chair',{x:-12000,z:-12000,elevationMm:-200});
    plan.furniture=[pergola];
    const store=usePlanner.getState();store.replacePlan(plan);store.confirmFurniture(chair);
    const furnished=usePlanner.getState().plan;
    expect(furnished.furniture).toEqual([pergola,chair]);expect(furnished.floors).toEqual(plan.floors);
    // General footprint warnings remain informational: an open structure is not a solid collision volume.
    expect(designWarnings(furnished).some(w=>w.kind==='overlap'&&w.ids.includes(pergola.id)&&w.ids.includes(chair.id))).toBe(true);
    store.undo();expect(usePlanner.getState().plan.furniture).toEqual([pergola]);
    store.redo();expect(usePlanner.getState().plan.furniture).toEqual([pergola,chair]);
  });

  it('supports outdoor lanterns and the offset watering-can base on a measured stone table',()=>{
    const plan=home(),table=item('outdoor-round-conversation-table',{rotation:90}),lantern=item('outdoor-caged-lantern');
    plan.furniture=[table];
    const top=shelfSurfaces(table).find(s=>s.id==='top')!;expect(top).toBeDefined();
    const lanternChoice=shelfChoices(plan,lantern)[0];expect(lanternChoice).toBeDefined();
    const placedLantern={...lantern,...lanternChoice.placement};
    expect(restsOnShelf(placedLantern,table)).toBe(true);
    expect(placedLantern.elevationMm+supportFootprint(placedLantern).offset).toBeCloseTo(top.height,0);
    expect(tabletopChoices(plan,lantern)[0].placement).toEqual(lanternChoice.placement);

    const can=item('outdoor-watering-can'),contact=supportFootprint(can);
    expect(can.widthMm).toBeGreaterThan(top.width);
    expect(contact.width).toBeLessThan(can.widthMm/2);
    expect(Math.abs(contact.x)).toBeGreaterThan(50);
    const canChoice=shelfChoices(plan,can)[0];expect(canChoice).toBeDefined();
    const placedCan={...can,...canChoice.placement},base=supportCenter(placedCan);
    expect(placedCan.rotation).toBe(90);expect(placedCan.z).not.toBe(table.z);
    expect(base.x).toBeCloseTo(table.x+top.z,0);expect(base.z).toBeCloseTo(table.z-top.x,0);
    expect(restsOnShelf(placedCan,table)).toBe(true);
    expect(shelfChoices({...plan,furniture:[{...table,widthMm:100,depthMm:100}]},can)).toEqual([]);
    plan.furniture.push(placedCan);
    expect(parsePlan(serializePlan(plan)).furniture).toEqual(plan.furniture);
    expect(decodeShare(encodeShare(plan)).furniture).toEqual(plan.furniture);
  });
});
