import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {deleteDB} from 'idb';
import {catalog} from '../src/catalog';
import {createSamplePlan} from '../src/domain';
import {usePlanner} from '../src/store';
import {validatePlan} from '../src/planValidation';
import {applyLayoutAlternative,publicLayoutPlan,saveLayoutAlternative} from '../src/layoutAlternatives';
import {loadFloorReference,saveReferenceVersion,saveStudioReference,versionLayoutReferences} from '../src/studioReference';
import {buildProjectBackup,restoreProjectBackup,validateProjectBackup} from '../src/projectBackup';
import {importPersonalAssets,loadPersonalPhoto,PERSONAL_DATABASE} from '../src/personalStorage';
import {agentTools,useAgent} from '../src/webmcp';
import {defaultSpecification} from '../src/selectionSchedule';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQJ8AAAAASUVORK5CYII=';
function fixture(){const plan=createSamplePlan('Reference home','metric'),item=catalog.find(p=>p.id==='side-table')!;plan.furniture=['table-a','table-b'].map((id,i)=>({id,catalogId:item.id,floorId:plan.floors[0].id,x:1000+i*1000,z:2000,widthMm:item.widthMm,depthMm:item.depthMm,heightMm:item.heightMm,rotation:0,variant:'sage'}));return plan;}
afterEach(async()=>{vi.restoreAllMocks();for(const name of ['nook-and-nest','nook-listing-studio','nook-studio-references',PERSONAL_DATABASE])await deleteDB(name);});

describe('integrated creative planning',()=>{
  it('uses one history entry per rigid move/held turn, clones floor groups, and prevents locked deletion and agent edits',()=>{
    usePlanner.getState().replacePlan(fixture());const get=usePlanner.getState;
    get().groupCommand({type:'group',ids:['table-a','table-b'],name:'Pair'});get().select('table-a');expect(get().selectedIds).toEqual(['table-a','table-b']);
    const before=get().plan,count=get().past.length;get().updateFurniture('table-a',{x:1500,z:1800});expect(get().past.length).toBe(count+1);expect(get().plan.furniture[1]).toMatchObject({x:2500,z:1800});get().undo();expect(get().plan).toEqual(before);
    get().select('table-a');get().beginTurn('table-a');for(let i=0;i<6;i++)get().turnFurniture('table-a',15);get().finishTurn();expect(get().past.length).toBe(count+1);expect(get().plan.furniture[1].x).toBeCloseTo(1000);expect(get().plan.furniture[1].z).toBeCloseTo(1000);
    get().groupCommand({type:'lock-group',groupId:get().plan.furnitureGroups!.groups[0].id,locked:true});const locked=get().plan,lockedFloor=get().activeFloorId,history=get().past.length;
    get().updateFurniture('table-a',{x:9});get().deleteSelected();get().deleteFloor();expect(get().plan).toBe(locked);expect(get().activeFloorId).toBe(lockedFloor);expect(get().past.length).toBe(history);
    useAgent.setState({busy:false,paused:false});const stage=agentTools.find(t=>t.name==='nook_stage_design')!.execute({expectedRevision:useAgent.getState().revision,label:'Move a protected piece',operations:[{action:'update',id:'table-a',x:3000}]});expect(stage).toMatchObject({ok:false,error:expect.stringContaining('Unlock')});
    get().duplicateFloor(lockedFloor);validatePlan(get().plan);expect(get().plan.furnitureGroups!.groups).toHaveLength(2);expect(get().plan.furnitureGroups!.groups[1].memberIds.every(id=>!locked.furniture.some(p=>p.id===id))).toBe(true);expect(get().plan.furnitureGroups!.groups[1].locked).toBe(true);
  });
  it('preserves immutable source references in alternatives and restores versions for floors absent from the working layout',async()=>{
    let plan=fixture();const floor=plan.floors[0];
    const first={page:1,rotation:0,reference:{url:image,width:1,height:1,pages:1,name:'Original drawing'}};
    await saveStudioReference(plan.id,floor.id,first);plan=await versionLayoutReferences(plan);const firstId=plan.floors[0].referenceId!;
    expect(await saveReferenceVersion(plan.id,first)).toBe(firstId);plan=saveLayoutAlternative(plan,'Before renovation',floor.id,validatePlan);
    const nextRef={...first,rotation:90,reference:{...first.reference,name:'Revised drawing'}},secondId=await saveReferenceVersion(plan.id,nextRef);
    plan={...plan,floors:plan.floors.map(f=>f.id===floor.id?{...f,referenceId:secondId}:f)};
    const applied=applyLayoutAlternative(plan,plan.layoutAlternatives!.options[0].id,floor.id,validatePlan).plan;
    expect((await loadFloorReference(applied.id,applied.floors[0]))?.reference?.name).toBe('Original drawing');
    expect((await loadFloorReference(plan.id,plan.floors[0]))?.reference?.name).toBe('Revised drawing');
    plan={...plan,floors:plan.floors.slice(1),furniture:[]};const backup=await buildProjectBackup(plan);const restored=await restoreProjectBackup(backup);
    const restoredIdea=applyLayoutAlternative(restored,restored.layoutAlternatives!.options[0].id,restored.floors[0].id,validatePlan).plan;
    expect((await loadFloorReference(restored.id,restoredIdea.floors[0]))?.reference?.name).toBe('Original drawing');
    expect(JSON.stringify(publicLayoutPlan(applied))).not.toContain(firstId);
  });
  it('backs up referenced private photos, verifies hashes before writes, and strips photos and notes from shares and agent reads',async()=>{
    const bytes=Uint8Array.from(atob(image.split(',')[1]),c=>c.charCodeAt(0)),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''),id='sha256:'+hash;
    const asset={version:1 as const,id,original:image,preview:image,width:1,height:1,createdAt:new Date().toISOString()};await importPersonalAssets({version:1,assets:[asset],missing:[]});
    const plan=fixture();plan.furniture[0].personalItem={version:1,itemId:'family-table',name:'Family table',status:'keep',representation:'catalog-proxy',notes:'Private provenance',photoAssetId:id};
    plan.furniture[0].specification={...defaultSpecification(),vendor:'Private vendor',productUrl:'https://example.com/private-quote',currency:'CAD',checkedOn:'2026-09-29',unitPriceMinor:12345};plan.selectionBudgets={version:1,targets:[{scope:'project',currency:'CAD',amountMinor:50000}]};
    const backup=await buildProjectBackup(plan);expect(backup.personalAssets?.assets).toEqual([asset]);await deleteDB(PERSONAL_DATABASE);
    const malformed=structuredClone(backup);malformed.personalAssets!.assets[0].id='sha256:'+'0'.repeat(64);expect(()=>validateProjectBackup(malformed)).toThrow('unrelated');
    const damaged=structuredClone(backup);damaged.personalAssets!.assets[0].original=image.replace('ORK5','ORK6');const add=vi.spyOn(IDBObjectStore.prototype,'add');await expect(restoreProjectBackup(damaged)).rejects.toThrow();expect(add).not.toHaveBeenCalled();add.mockRestore();
    const restored=await restoreProjectBackup(backup);expect(await loadPersonalPhoto(id)).toEqual(asset);expect(restored.furniture[0].personalItem?.notes).toBe('Private provenance');
    expect(JSON.stringify(publicLayoutPlan(restored))).not.toMatch(/Private provenance|sha256:|Private vendor|private-quote|selectionBudgets/);usePlanner.getState().replacePlan(restored);useAgent.setState({busy:false,paused:false});const response=agentTools.find(t=>t.name==='nook_get_apartment')!.execute({});expect(JSON.stringify(response)).not.toMatch(/Private provenance|sha256:|Private vendor|private-quote|selectionBudgets/);
  });
});

