import {afterEach,expect,it,vi} from 'vitest';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {PBRMaterial} from '@babylonjs/core/Materials/PBR/pbrMaterial';
import {createBlankPlan} from '../src/domain';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {VertexBuffer} from '@babylonjs/core/Buffers/buffer';
import {projectPersonalArtUV} from '../src/scene/PersonalArtUV';
import type {FurniturePlacement} from '../src/types';
const io=vi.hoisted(()=>({load:vi.fn(),render:vi.fn(),textures:[] as any[]}));
vi.mock('../src/personalStorage',()=>({loadPersonalPhoto:io.load}));
vi.mock('../src/personalSurfaceImage',async original=>({...await original<typeof import('../src/personalSurfaceImage')>(),renderPersonalSurfaceImage:io.render}));
vi.mock('@babylonjs/core/Materials/Textures/dynamicTexture',()=>({DynamicTexture:class {dispose=vi.fn();update=vi.fn();constructor(){io.textures.push(this)}}}));
import {PersonalSurfaceTextures,personalTextureCandidates,PERSONAL_TEXTURE_LIMIT} from '../src/scene/PersonalSurfaceTextures';
const item=(id:string):FurniturePlacement=>({id,catalogId:'landscape-painting',floorId:'floor',x:0,z:0,rotation:0,widthMm:900,depthMm:35,heightMm:600,variant:'oat',personalSurface:{version:1,kind:'art',assetId:'sha256:'+id.padStart(64,'a'),label:'Private',slotId:'artwork-landscape',crop:{x:0,y:0,width:1,height:1},rotation:0,fallbackColor:'#889977'}});
let dispose=()=>{};
afterEach(()=>{dispose();io.load.mockReset();io.render.mockReset();io.textures.length=0});
function setup(){const engine=new NullEngine(),scene=new Scene(engine),renderer=new PersonalSurfaceTextures(scene,vi.fn());dispose=()=>{renderer.dispose();scene.dispose();engine.dispose()};return {scene,renderer};}
it('maps private framed art upright while retaining the source geometry and UVs',()=>{
 const {scene}=setup(),source=MeshBuilder.CreatePlane('authored',{width:2,height:1},scene);source.material=new PBRMaterial('artwork-landscape',scene);const saved=Array.from(source.getVerticesData(VertexBuffer.UVKind)!);const clone=source.clone('private')!;
 projectPersonalArtUV(clone,'artwork-landscape');expect(clone.geometry).not.toBe(source.geometry);expect(Array.from(source.getVerticesData(VertexBuffer.UVKind)!)).toEqual(saved);
 const pos=clone.getVerticesData(VertexBuffer.PositionKind)!,uv=clone.getVerticesData(VertexBuffer.UVKind)!;for(let i=0;i<pos.length/3;i++){expect(uv[i*2]).toBeCloseTo(1-(pos[i*3]+1)/2);expect(uv[i*2+1]).toBeCloseTo(.5-pos[i*3+1])}
});
it('limits GPU images and concurrent decodes, with selected/current-floor priority and no saved reordering',async()=>{
 const {renderer}=setup(),plan=createBlankPlan('Test','metric');plan.furniture=Array.from({length:20},(_,i)=>item(i.toString(16)));
 const before=plan.furniture.map(p=>p.id);plan.furniture[18].floorId='upstairs';
 const ordered=personalTextureCandidates(plan,'upstairs','f');expect(ordered[0].id).toBe('f');expect(ordered[1].id).toBe('12');expect(plan.furniture.map(p=>p.id)).toEqual(before);
 let release!:()=>void;const pending=new Promise<void>(r=>{release=r});io.load.mockImplementation(async()=>{await pending;return undefined});io.render.mockResolvedValue({canvas:{},missing:false});
 renderer.configure(plan.id,ordered);expect(io.load).toHaveBeenCalledTimes(2);release();
 await vi.waitFor(()=>expect(io.textures).toHaveLength(PERSONAL_TEXTURE_LIMIT));expect(io.load).toHaveBeenCalledTimes(PERSONAL_TEXTURE_LIMIT);
 expect(io.render.mock.calls.every(c=>c[2]===512&&c[3]===true)).toBe(true);
});
it('never loads hidden images and aborts stale project work before assigning textures',async()=>{
 const {scene,renderer}=setup(),privateItem=item('1'),hidden={...item('2'),personalSurface:{...item('2').personalSurface!,assetId:undefined,hidden:true as const}};
 const material=new PBRMaterial('private clone',scene);io.load.mockResolvedValue({});let finish!:(value:any)=>void;io.render.mockImplementation(()=>new Promise(r=>{finish=r}));
 renderer.configure('first',[privateItem,hidden]);renderer.bind(material,privateItem);await vi.waitFor(()=>expect(io.render).toHaveBeenCalledOnce());
 renderer.configure('second',[hidden]);expect(io.render.mock.calls[0][4].aborted).toBe(true);finish({canvas:{},missing:false});
 await Promise.resolve();await Promise.resolve();expect(io.textures).toHaveLength(0);expect(material.albedoTexture).toBeNull();expect(io.load).toHaveBeenCalledOnce();
});
it('shares ready textures, releases old images, and returns materials to placeholders on disposal',async()=>{
 const {scene,renderer}=setup(),piece=item('3');io.load.mockResolvedValue({});io.render.mockResolvedValue({canvas:{},missing:false});renderer.configure('project',[piece]);
 const first=new PBRMaterial('first',scene),second=new PBRMaterial('second',scene);renderer.bind(first,piece);renderer.bind(second,piece);
 await vi.waitFor(()=>expect(first.metadata.personalImageState).toBe('ready'));expect(first.albedoTexture).toBe(second.albedoTexture);expect(io.textures).toHaveLength(1);
 renderer.configure('project',[]);expect(first.albedoTexture).toBeNull();expect(second.albedoTexture).toBeNull();expect(io.textures[0].dispose).toHaveBeenCalledOnce();
});
