import {describe,expect,it,vi} from 'vitest';
import {catalog} from '../src/catalog';
import {createSamplePlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
import {restsOnShelf} from '../src/shelfSurfaces';
import {applyFurnitureGroupCommand,assertLockedFurnitureUnchanged,expandedFurnitureSelection,reconcileFurnitureGroups,transformFurnitureSelection,transformSelectedPlacements,validateFurnitureGroups,type GroupCommand,type GroupPlan} from '../src/furnitureGroups';
import type {FurniturePlacement} from '../src/types';

function fixture():GroupPlan {
  const plan=createSamplePlan('Grouped shelf','metric'),floorId=plan.floors[0].id;
  const piece=(id:string,catalogId:string,extra:Partial<FurniturePlacement>={}):FurniturePlacement=>{
    const item=catalog.find(c=>c.id===catalogId)!;
    return {id,catalogId,floorId,x:2000.25,z:2500.5,rotation:0,widthMm:item.widthMm,depthMm:item.depthMm,heightMm:item.heightMm,variant:'sage',...extra};
  };
  plan.furniture=[piece('shelf','display-bookcase',{materialColors:{wood:'#aabbcc'}}),piece('books','books-stacked',{z:2520.5,elevationMm:740}),piece('other','side-table',{x:4500}),piece('upstairs','side-table',{floorId:plan.floors[1].id})];
  return plan;
}
function execute(plan:GroupPlan,command:GroupCommand){let i=0;return applyFurnitureGroupCommand(plan,plan,plan.floors[0].id,command,validatePlan,()=>`fresh-${i++}`).plan;}
const group=(plan:GroupPlan)=>execute(plan,{type:'group',ids:['shelf','books'],name:'Reading shelf'});

describe('persistent explicit furniture groups',()=>{
  it('keeps held movement free of serialization and validates a combined final transform only once',()=>{
    const plan=group(fixture()),floorId=plan.floors[0].id,delta={deltaX:30,deltaZ:-10,degrees:45};
    const serialization=vi.spyOn(JSON,'stringify');
    try{const preview=transformSelectedPlacements(plan,floorId,['shelf','books'],delta);expect(preview.plan.furniture[0]).not.toBe(plan.furniture[0]);expect(serialization).not.toHaveBeenCalled();}finally{serialization.mockRestore();}
    const validate=vi.fn(validatePlan);transformFurnitureSelection(plan,plan,floorId,['shelf','books'],delta,validate);expect(validate).toHaveBeenCalledOnce();
    expect(()=>transformSelectedPlacements(plan,floorId,['shelf','books'],{...delta,deltaX:10_000_000})).toThrow('planning limits');
  });
  it('rotates and moves authored shelf contents rigidly, retaining support, finishes, untouched references and independent ungrouping',()=>{
    const original=fixture(),base=group(original),before=structuredClone(base);
    expect(restsOnShelf(base.furniture[1],base.furniture[0])).toBe(true);
    const ids=expandedFurnitureSelection(base,['books']);expect(ids.sort()).toEqual(['books','shelf']);
    const {plan:moved}=transformFurnitureSelection(base,base,base.floors[0].id,ids,{deltaX:333.125,deltaZ:-20.5,degrees:90,pivot:{x:base.furniture[0].x,z:base.furniture[0].z}},validatePlan);
    expect(moved.furniture[0]).toMatchObject({x:2333.375,z:2480,rotation:90,materialColors:{wood:'#aabbcc'}});
    expect(moved.furniture[1].x).toBeCloseTo(2353.375,7);expect(moved.furniture[1].z).toBeCloseTo(2480,7);
    expect(moved.furniture[1].elevationMm).toBe(740);expect(restsOnShelf(moved.furniture[1],moved.furniture[0])).toBe(true);
    expect(moved.floors).toBe(base.floors);expect(moved.camera).toBe(base.camera);expect(moved.furniture[2]).toBe(base.furniture[2]);expect(base).toEqual(before);
    for(let i=0;i<2;i++)for(const k of ['widthMm','depthMm','heightMm'] as const)expect(moved.furniture[i][k]).toBe(base.furniture[i][k]);
    const ungrouped=execute(moved,{type:'ungroup',groupId:moved.furnitureGroups!.groups[0].id});
    expect(ungrouped.furniture).toBe(moved.furniture);expect(expandedFurnitureSelection(ungrouped,['books'])).toEqual(['books']);
  });
  it('duplicates full groups with new identities and independent colors while keeping originals and plan metadata',()=>{
    const base=group(fixture());let id=0;
    const result=applyFurnitureGroupCommand(base,base,base.floors[0].id,{type:'duplicate',ids:['shelf','books'],dx:800,dz:300},validatePlan,()=>`copy-${id++}`);
    const copy=result.plan.furnitureGroups!.groups[1];expect(copy.memberIds).toEqual(result.selectedIds);expect(copy.id).not.toBe(base.furnitureGroups!.groups[0].id);
    expect(new Set(result.plan.furniture.map(p=>p.id)).size).toBe(6);expect(result.plan.id).toBe(base.id);
    const copiedShelf=result.plan.furniture.find(p=>p.id===copy.memberIds[0])!;copiedShelf.materialColors!.wood='#000000';expect(base.furniture[0].materialColors!.wood).toBe('#aabbcc');
    expect(restsOnShelf(result.plan.furniture[5],result.plan.furniture[4])).toBe(true);
  });
  it('rejects partial groups, crossed floors, stale bases, unknown members and colliding IDs without mutation',()=>{
    const base=group(fixture()),before=structuredClone(base),floor=base.floors[0].id;
    for(const ids of [['shelf'],['shelf','upstairs'],['missing'],['shelf','shelf']])expect(()=>execute(base,{type:'move',ids,dx:20,dz:0})).toThrow();
    expect(()=>applyFurnitureGroupCommand(base,{...base},floor,{type:'move',ids:['shelf','books'],dx:20,dz:0},validatePlan)).toThrow('changed');
    expect(()=>applyFurnitureGroupCommand(base,base,floor,{type:'duplicate',ids:['shelf','books'],dx:20,dz:0},validatePlan,()=> 'shelf')).toThrow('unique');
    expect(()=>execute(base,{type:'move',ids:['shelf','books'],dx:Infinity,dz:0})).toThrow();
    expect(()=>execute(base,{type:'rotate',ids:['shelf','books'],degrees:45,pivot:{x:NaN,z:0}})).toThrow();expect(base).toEqual(before);
  });
  it('enforces independent and group locks for transforms, deletion and ungrouping, with a commit guard for inspector/proposal bypasses',()=>{
    const base=group(fixture()),id=base.furnitureGroups!.groups[0].id,locked=execute(base,{type:'lock-group',groupId:id,locked:true});
    for(const command of [{type:'move',ids:['shelf','books'],dx:20,dz:0},{type:'duplicate',ids:['shelf','books'],dx:20,dz:0},{type:'delete',ids:['shelf','books']},{type:'ungroup',groupId:id}] as GroupCommand[])expect(()=>execute(locked,command)).toThrow('Unlock');
    expect(()=>assertLockedFurnitureUnchanged(locked,{...locked,furniture:locked.furniture.map(p=>p.id==='books'?{...p,elevationMm:0}:p)})).toThrow('Unlock');
    const unlocked=execute(locked,{type:'lock-group',groupId:id,locked:false}),independent=execute(unlocked,{type:'lock-items',ids:['books'],locked:true});
    expect(()=>assertLockedFurnitureUnchanged(locked,unlocked)).toThrow('Unlock explicitly');
    expect(()=>assertLockedFurnitureUnchanged(locked,unlocked,{allowUnlock:true})).not.toThrow();
    expect(()=>execute(independent,{type:'move',ids:['shelf','books'],dx:20,dz:0})).toThrow('Unlock');
    expect(()=>execute(execute(independent,{type:'lock-items',ids:['books'],locked:false}),{type:'move',ids:['shelf','books'],dx:20,dz:0})).not.toThrow();
  });
  it('cleans deleted members and dissolved/floor-removed groups without changing unrelated metadata',()=>{
    const base=group(fixture()),next=reconcileFurnitureGroups(base,{...base,furniture:base.furniture.filter(p=>p.id!=='books')});
    expect(next.furnitureGroups?.groups).toEqual([]);expect(next.name).toBe(base.name);expect(next.camera).toBe(base.camera);
    const deleted=execute(base,{type:'delete',ids:['shelf','books']});expect(deleted.furniture.map(p=>p.id)).toEqual(['other','upstairs']);expect(deleted.furnitureGroups?.groups).toEqual([]);
    const onlyUpper={...base,floors:base.floors.slice(1),furniture:base.furniture.filter(p=>p.id==='upstairs')};expect(reconcileFurnitureGroups(onlyUpper).furnitureGroups?.groups).toEqual([]);
  });
  it('validates bounded imported membership and rejects malformed/unsupported operations',()=>{
    const base=group(fixture()),data=base.furnitureGroups!,one=data.groups[0];
    expect(()=>validateFurnitureGroups(undefined,base)).not.toThrow();
    for(const value of [{...data,version:2},{...data,extra:true},{...data,groups:[{...one,memberIds:['books']}]},{...data,groups:[one,{...one,id:'another'}]},{...data,groups:[{...one,memberIds:['books','upstairs']}]},{...data,lockedItemIds:['books','books']},{...data,groups:[{...one,locked:'yes'}]}])expect(()=>validateFurnitureGroups(value,base)).toThrow();
    const plan=fixture();plan.furniture[0]={...plan.furniture[0],terrainAnchored:true};expect(()=>group(plan)).toThrow('individual placement');
    expect(()=>execute(base,{type:'lock-items',ids:['books'],locked:'yes'} as unknown as GroupCommand)).toThrow('Lock or Unlock');
  });
});
