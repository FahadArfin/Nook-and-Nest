import {describe,expect,it} from 'vitest';
import {createSamplePlan} from '../src/domain';
import type {FurniturePlacement} from '../src/types';
import {buildMoodboardPalette,buildPersonalSurface,buildRemovePersonalSurface,resolveMoodboardTarget,saveMoodboard} from '../src/moodboardActions';
import {personalArtModels,validateSurfaceForPiece} from '../src/moodboardMaterials';
import {collectMoodboardAssetIds,parseMoodboard,parseMoodboards,parsePersonalSurface,publicMoodboardPlan,type Moodboard,type MoodboardPlan,type PersonalSurface,type SurfacePlacement} from '../src/moodboards';
import {personalSurfaceImageKey,personalSurfaceRepeat} from '../src/personalSurfaceImage';

const date='2026-09-29T00:00:00.000Z',assetId='sha256:'+'a'.repeat(64),secondAsset='sha256:'+'b'.repeat(64);
function fixture(){const base=createSamplePlan('Creative room','metric'),floorId=base.floors[0].id;const piece=(id:string,catalogId='armchair'):FurniturePlacement=>({id,catalogId,floorId,x:1000,z:1200,rotation:0,widthMm:800,depthMm:900,heightMm:1000,variant:'cream',materialColors:{'modern-brushed-aluminum':'#123456'}});base.furniture=[piece('a'),piece('b'),piece('c'),piece('d'),piece('other','books-upright')];return {base,floorId};}
const board=(floorId:string):Moodboard=>({id:'board-a',name:'Sunday living room',createdAt:date,updatedAt:date,pins:[{id:'photo',kind:'image',label:'Private family reference',assetId,sourceUrl:'https://example.com/inspiration',attribution:'My photograph'},{id:'catalog',kind:'catalog',label:'Reading chair',catalogId:'armchair'},{id:'finish',kind:'finish',label:'Warm wall',finishKind:'wall',finishId:'cream-plaster'},{id:'note',kind:'note',label:'Mood',text:'Warm and quiet'}],palette:[{id:'sage',name:'Soft sage',color:'#809578'}],bindings:[{paletteId:'sage',slotId:'upholstery-textured'}],target:{floorId,scope:'floor'}});
const surface=(extra:Partial<PersonalSurface>={}):PersonalSurface=>({version:1,kind:'art',assetId,label:'Private holiday photo',slotId:'artwork-landscape',crop:{x:.1,y:.2,width:.7,height:.6},rotation:90,fallbackColor:'#d2c9b9',frameColor:'#856242',sourceUrl:'https://example.com/my-art',attribution:'Family collection',...extra});

describe('linked moodboards and private surfaces',()=>{
  it('round-trips all pin kinds, attribution and named material bindings while enforcing finite bounds and safe source links',()=>{
    const {base,floorId}=fixture(),input=board(floorId),next=saveMoodboard(base,input);expect((next as MoodboardPlan).moodboards?.boards[0]).toMatchObject({...input,updatedAt:expect.any(String)});expect((base as MoodboardPlan).moodboards).toBeUndefined();
    expect(parseMoodboards(JSON.parse(JSON.stringify(next.moodboards)))).toEqual(next.moodboards);
    for(const bad of [{...input,pins:[{...input.pins[0],sourceUrl:'javascript:alert(1)'}]},{...input,pins:[{...input.pins[0],sourceUrl:'https://user:password@example.com'}]},{...input,palette:Array.from({length:9},(_,i)=>({id:String(i),name:'Color',color:'#334455'}))},{...input,bindings:[{paletteId:'missing',slotId:'upholstery-textured'}]},{...input,pins:[input.pins[0],input.pins[0]]}])expect(()=>parseMoodboard(bad)).toThrow();
    expect(()=>parseMoodboards({version:1,boards:Array.from({length:9},(_,i)=>({...input,id:String(i)}))})).toThrow('8');
  });
  it('previews only explicitly linked material parts and preserves locked groups, locked pieces and unrelated geometry',()=>{
    const {base,floorId}=fixture();base.furnitureGroups={version:1,groups:[{id:'group',name:'Keep this pair',floorId,memberIds:['a','b'],locked:true}],lockedItemIds:['c']};
    const before=JSON.stringify(base),result=buildMoodboardPalette(base,board(floorId));expect(result.base).toBe(base);expect(result.changedIds).toEqual(['d']);expect(result.skippedLockedIds).toEqual(['a','b','c']);expect(result.unmatchedIds).toEqual(['other']);expect(JSON.stringify(base)).toBe(before);
    for(const id of ['a','b','c','other'])expect(result.plan.furniture.find(p=>p.id===id)).toBe(base.furniture.find(p=>p.id===id));expect(result.plan.floors).toBe(base.floors);
    expect(result.plan.furniture.find(p=>p.id==='d')?.materialColors).toEqual({'modern-brushed-aluminum':'#123456','upholstery-textured':'#809578'});
    expect(()=>buildMoodboardPalette(base,{...board(floorId),target:{scope:'group',floorId,id:'group'}})).toThrow('Locked');
  });
  it('resolves a named room by piece centers and fails clearly for deleted targets instead of changing another floor',()=>{
    const {base,floorId}=fixture();base.floors[0].blueprint={geometryKey:'fixture',rooms:[{id:'room',name:'Reading room',kind:'Living',enclosed:true,x:0,z:0,width:2000,depth:2000}]};base.furniture[4]={...base.furniture[4],x:5000};
    expect(resolveMoodboardTarget(base,{scope:'room',floorId,id:'room'}).map(p=>p.id)).toEqual(['a','b','c','d']);expect(()=>resolveMoodboardTarget(base,{scope:'group',floorId,id:'gone'})).toThrow('no longer');expect(()=>resolveMoodboardTarget(base,{scope:'floor',floorId:'gone'})).toThrow('no longer');
  });
  it('retains immutable crop/repeat recipes, rejects unsupported materials, and applies frame color only to verified authored slots',()=>{
    const {base,floorId}=fixture();base.furniture[0]={...base.furniture[0],catalogId:'landscape-painting'};const input=surface(),before=JSON.stringify(input),result=buildPersonalSurface(base,floorId,'a',input),placed=result.plan.furniture[0] as SurfacePlacement;
    expect(placed.personalSurface).toEqual(input);expect(placed.materialColors?.[personalArtModels['landscape-painting'].frameSlot]).toBe(input.frameColor);expect(base.furniture[0]).not.toHaveProperty('personalSurface');expect(JSON.stringify(input)).toBe(before);expect(placed.widthMm).toBe(800);const restored=buildRemovePersonalSurface(result.plan,floorId,'a');expect(restored.plan.furniture[0]).not.toHaveProperty('personalSurface');expect(restored.plan.furniture[0].materialColors).toEqual(base.furniture[0].materialColors);
    const swatch=surface({kind:'swatch',slotId:'upholstery-textured',repeatWidthMm:200,repeatHeightMm:150,frameColor:undefined});expect(personalSurfaceRepeat(swatch,800,900)).toEqual({uScale:4,vScale:6});expect(personalSurfaceImageKey(swatch)).toBe(personalSurfaceImageKey(JSON.parse(JSON.stringify(swatch))));
    expect(()=>validateSurfaceForPiece({...input,slotId:'wood-dark'},base.furniture[0])).toThrow('authored');expect(()=>parsePersonalSurface({...input,crop:{x:.8,y:0,width:.5,height:1}})).toThrow('inside');expect(()=>parsePersonalSurface({...swatch,repeatWidthMm:0})).toThrow('10');expect(()=>parsePersonalSurface({...input,assetId:undefined})).toThrow('private image');expect(()=>parsePersonalSurface({...input,hidden:true})).toThrow('Hidden');
    base.furnitureGroups={version:1,groups:[],lockedItemIds:['a']};expect(()=>buildPersonalSurface(base,floorId,'a',input)).toThrow('Unlock');
  });
  it('collects working and saved-idea image IDs once and publishes valid neutral placeholders without boards or private identifiers',()=>{
    const {base,floorId}=fixture(),current=surface(),saved=surface({assetId:secondAsset});const withMedia={...base,moodboards:{version:1 as const,boards:[board(floorId)]},furniture:[{...base.furniture[0],catalogId:'landscape-painting',personalSurface:current}],layoutAlternatives:{version:1 as const,options:[{id:'idea',name:'Previous room',createdAt:date,activeFloorId:floorId,snapshot:{gridSizeMm:base.gridSizeMm,floors:base.floors,furniture:[{...base.furniture[1],personalSurface:saved}],moodboards:{version:1 as const,boards:[board(floorId)]}}}]}};
    expect(collectMoodboardAssetIds(withMedia)).toEqual([assetId,secondAsset]);const published=publicMoodboardPlan(withMedia),text=JSON.stringify(published);for(const secret of [assetId,secondAsset,'Private holiday photo','Family collection','https://example.com','moodboards'])expect(text).not.toContain(secret);
    const hidden=(published.furniture[0] as SurfacePlacement).personalSurface!;expect(parsePersonalSurface(hidden)).toMatchObject({hidden:true,label:'Private artwork',fallbackColor:'#d2c9b9'});expect(withMedia.furniture[0].personalSurface.assetId).toBe(assetId);
  });
});
