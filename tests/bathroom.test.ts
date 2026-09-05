import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { catalog, bathroomModelIds, hasModelPreview, defaultMountHeight, isSurfaceMounted, isWallMounted } from "../src/catalog";
import { createSamplePlan, serializePlan, parsePlan, encodeShare, decodeShare } from "../src/domain";
import { supportsCountertopFinish } from "../src/surfaces";
import { tabletopPoint } from "../src/tabletop";
import { usePlanner } from "../src/store";
import type { FurniturePlacement } from "../src/types";

const piece=(id:string,patch:Partial<FurniturePlacement>={}):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId:"floor",x:1500,z:1500,rotation:0,widthMm:c.widthMm,heightMm:c.heightMm,depthMm:c.depthMm,variant:"cream",...patch};};
const gltf=(id:string)=>{const b=readFileSync(`public/models/furniture/${id}.glb`);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());};

describe("bathroom collection",()=>{
  it("ships 19 original editable models and thumbnails with exact millimetre envelopes",()=>{
    expect(bathroomModelIds.size).toBe(19);
    for(const id of bathroomModelIds){
      expect(hasModelPreview(id)).toBe(true);
      expect(existsSync(`assets-source/blender/${id}.blend`)).toBe(true);
      expect(existsSync(`public/models/previews/${id}.webp`)).toBe(true);
      const c=catalog.find(c=>c.id===id)!,json=gltf(id);
      const bounds=json.meshes.flatMap((m:{primitives:{attributes:{POSITION:number}}[]})=>m.primitives.map(p=>json.accessors[p.attributes.POSITION]));
      for(let axis=0;axis<3;axis++){
        const lo=Math.min(...bounds.map((b:{min:number[]})=>b.min[axis])),hi=Math.max(...bounds.map((b:{max:number[]})=>b.max[axis]));
        expect((hi-lo)*1000).toBeCloseTo([c.widthMm,c.heightMm,c.depthMm][axis],1);
        expect((axis===1?lo:(lo+hi)/2)*1000).toBeCloseTo(0,1);
      }
      expect(json.materials.some((m:{name:string})=>m.name.includes("variant-surface"))).toBe(true);
      expect(json.accessors.filter((a:{type:string})=>a.type==="SCALAR").reduce((sum:number,a:{count:number})=>sum+a.count/3,0)).toBeLessThan(25000);
    }
  });
  it("exports transparent shower glazing, not opaque colored panels",()=>{
    for(const id of ["corner-shower","walk-in-shower","bath-shower-combo"]){
      const glass=gltf(id).materials.find((m:{name:string})=>m.name.includes("bathroom-shower-glass"));
      expect(glass.alphaMode).toBe("BLEND");expect(glass.pbrMetallicRoughness.baseColorFactor[3]).toBeLessThan(.3);
    }
  });
  it("keeps the centre of every soaking basin recessed instead of capped solid",()=>{
    for(const id of ["vessel-sink","alcove-bathtub","oval-freestanding-tub","clawfoot-bathtub"]){
      const data=readFileSync(`public/models/furniture/${id}.glb`),json=gltf(id);
      const binaryStart=28+data.readUInt32LE(12);
      const component=(accessorId:number,index:number,axis=0)=>{
        const a=json.accessors[accessorId],v=json.bufferViews[a.bufferView];
        const bytes=a.componentType===5123?2:a.componentType===5121?1:4;
        const offset=binaryStart+(v.byteOffset??0)+(a.byteOffset??0)+index*(v.byteStride??bytes*(a.type==="VEC3"?3:1))+axis*bytes;
        return a.componentType===5126?data.readFloatLE(offset):bytes===4?data.readUInt32LE(offset):bytes===2?data.readUInt16LE(offset):data.readUInt8(offset);
      };
      let highest=-Infinity;
      for(const mesh of json.meshes)for(const primitive of mesh.primitives){
        for(let i=0;i<json.accessors[primitive.indices].count;i+=3){
          const [a,b,c]=[0,1,2].map(j=>[0,1,2].map(axis=>component(primitive.attributes.POSITION,component(primitive.indices,i+j),axis)));
          const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-12)continue;
          const u=((b[2]-c[2])*-c[0]+(c[0]-b[0])*-c[2])/det;
          const v=((c[2]-a[2])*-c[0]+(a[0]-c[0])*-c[2])/det;
          if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)highest=Math.max(highest,u*a[1]+v*b[1]+(1-u-v)*c[1]);
        }
      }
      expect(highest).toBeGreaterThan(0);
      expect(highest*1000).toBeLessThan(catalog.find(c=>c.id===id)!.heightMm*.45);
    }
  });
  it("keeps vanity worktops separately finishable",()=>{
    for(const id of ["single-bath-vanity","double-bath-vanity","floating-bath-vanity"]){
      expect(supportsCountertopFinish(id)).toBe(true);
      expect(gltf(id).materials.some((m:{name:string})=>m.name.includes("countertop-surface"))).toBe(true);
    }
    expect(supportsCountertopFinish("pedestal-sink")).toBe(false);
  });
  it("uses fixture-specific mounting defaults without changing floor-standing objects",()=>{
    for(const [id,height] of [["wall-hung-sink",650],["floating-bath-vanity",350],["wall-hung-toilet",150],["bath-mirror-pill",1100]] as const){
      expect(isWallMounted(id)).toBe(true);expect(defaultMountHeight(id)).toBe(height);
    }
    expect(defaultMountHeight("alcove-bathtub")).toBeUndefined();
    expect(isSurfaceMounted("vessel-sink")).toBe(true);
  });
  it("places a vessel basin on a measured counter rather than the floor",()=>{
    const p=createSamplePlan();p.floors=[{...p.floors[0],id:"floor"}];p.furniture=[piece("kitchen-counter")];
    expect(tabletopPoint(p,piece("vessel-sink"),{x:1.5,y:3,z:1.5},{x:0,y:-1,z:0})).toEqual({x:1500,z:1500,elevationMm:930});
  });
  it("preserves fixture colors, worktops, dimensions and mounting through undo and saved shares",()=>{
    const p=createSamplePlan();p.floors=[{...p.floors[0],id:"floor"}];p.furniture=[];
    usePlanner.getState().replacePlan(p);const state=()=>usePlanner.getState();
    state().confirmFurniture(piece("floating-bath-vanity",{elevationMm:350}));
    state().updateFurniture("floating-bath-vanity",{elevationMm:400,variant:"navy",surfaceVariant:"ivory-marble",widthMm:1000});
    state().undo();expect(state().plan.furniture[0].elevationMm).toBe(350);state().redo();
    const saved=state().plan;expect(saved.furniture[0]).toMatchObject({elevationMm:400,variant:"navy",surfaceVariant:"ivory-marble",widthMm:1000});
    expect(parsePlan(serializePlan(saved)).furniture).toEqual(saved.furniture);
    expect(decodeShare(encodeShare(saved)).furniture).toEqual(saved.furniture);
  });
});
