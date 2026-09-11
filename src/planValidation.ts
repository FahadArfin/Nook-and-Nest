import {validateVegetationField} from './vegetationField';
import {isVegetation,vegetationLimit} from './vegetation';
import {showerIds} from './apartmentCollection';
import {isDoor} from './catalog';
import type { PlanDocumentV1 } from "./types";

export const MAX_PLAN_BYTES = 8_000_000;
/** Shared import/API guard: malformed plans must never replace a working build. */
export function validatePlan(value: unknown): asserts value is PlanDocumentV1 {
  const fail = () => { throw new Error("This is not a valid Nook & Nest project, or it contains unsupported data."); };
  const obj = (v: any) => { if (!v || typeof v !== "object" || Array.isArray(v)) fail(); };
  const str = (v: any, max = 160) => { if (typeof v !== "string" || !v.length || v.length > max) fail(); };
  const num = (v: any, min = -10_000_000, max = 10_000_000) => { if (!Number.isFinite(v) || v < min || v > max) fail(); };
  const arr = (v: any, max: number) => { if (!Array.isArray(v) || v.length > max) fail(); };
  const unique = (items: any[]) => { const ids = new Set(); for (const i of items) { obj(i); str(i.id); if (ids.has(i.id)) fail(); ids.add(i.id); } };
  const p = value as any; obj(p);
  if (p.schemaVersion !== 1 || !["imperial", "metric"].includes(p.units)) fail();
  str(p.id); str(p.name); str(p.createdAt); str(p.updatedAt); num(p.gridSizeMm, 10, 10000);
  arr(p.floors, 20); if (!p.floors.length) fail(); unique(p.floors);
  const floors = new Set(p.floors.map((f: any) => f.id));
  for (const f of p.floors) {
    if(f.wallCuts!==undefined){arr(f.wallCuts,4000);for(const w of f.wallCuts){obj(w);str(w.id,160);for(const k of ["ax","az","bx","bz"])num(w[k],-10000,10000);if(w.ax!==w.bx&&w.az!==w.bz)fail();}}
    str(f.name); num(f.elevationMm); num(f.heightMm, 100, 20000);
    if(f.blueprint!==undefined){obj(f.blueprint);str(f.blueprint.geometryKey,900000);if(f.blueprint.wallCuts!==undefined){arr(f.blueprint.wallCuts,4000);for(const w of f.blueprint.wallCuts){obj(w);str(w.id,160);for(const k of ['ax','az','bx','bz'])num(w[k],-10000,10000);if(w.ax!==w.bx&&w.az!==w.bz)fail();}}for(const key of ['generatedWallIds','omittedWalls'])if(f.blueprint[key]!==undefined){arr(f.blueprint[key],4000);for(const id of f.blueprint[key])str(id,160);}arr(f.blueprint.rooms,100);unique(f.blueprint.rooms);for(const r of f.blueprint.rooms){str(r.name,100);if(r.groupId!==undefined)str(r.groupId,160);if(!['Living','Bedroom','Dining','Office','Kitchen','Bathroom','Laundry','Hall','Outdoor','Closet'].includes(r.kind)||typeof r.enclosed!=='boolean')fail();num(r.x,-100000,100000);num(r.z,-100000,100000);num(r.width,10,60000);num(r.depth,10,60000);}}
    for (const k of ["cellFinishes", "wallFinishes"]) if (f[k] !== undefined) { obj(f[k]); if (Object.keys(f[k]).length > 20000) fail(); for (const [key, finish] of Object.entries(f[k])) { str(key); str(finish); } }
    arr(f.cells, 20000); arr(f.walls, 4000); arr(f.openings, 2000); arr(f.stairs, 100);
    for (const c of f.cells) { obj(c); num(c.x, -10000, 10000); num(c.z, -10000, 10000); if (!Number.isInteger(c.x) || !Number.isInteger(c.z)) fail(); }
    if(f.cellRects!==undefined){
      obj(f.cellRects);if(Object.keys(f.cellRects).length>20000)fail();
      const cells=new Set(f.cells.map((c:any)=>`${c.x},${c.z}`));
      for(const [key,rects] of Object.entries(f.cellRects)){
        if(!/^-?\d+,-?\d+$/.test(key)||!cells.has(key))fail();arr(rects,64);if(!(rects as any[]).length)fail();
        const [cx,cz]=key.split(",").map(Number),x=cx*p.gridSizeMm,z=cz*p.gridSizeMm;
        for(const r of rects as any[]){obj(r);num(r.x);num(r.z);num(r.width,.001,p.gridSizeMm+.1);num(r.depth,.001,p.gridSizeMm+.1);if(r.x<x-.001||r.z<z-.001||r.x+r.width>x+p.gridSizeMm+.001||r.z+r.depth>z+p.gridSizeMm+.001)fail();}
      }
    }
    unique(f.walls); unique(f.openings); unique(f.stairs);
    for(const w of f.walls)if(w.heightMm!==undefined)num(w.heightMm,100,20000);
    for (const w of f.walls) for (const k of ["ax", "az", "bx", "bz"]) num(w[k], -10000, 10000);
    for (const o of f.openings) { if (!["door", "window"].includes(o.kind)) fail(); str(o.wallKey); num(o.offset, 0, 1); num(o.widthMm, 1, 20000); }
    for (const s of f.stairs) { if (!["straight", "l-shaped"].includes(s.kind)) fail(); for (const k of ["x", "z", "rotation"]) num(s[k]); num(s.widthMm, 1, 20000); num(s.lengthMm, 1, 30000); if (s.toFloorId && !floors.has(s.toFloorId)) fail(); }
  }
  if(p.studioDrafts!==undefined){
    obj(p.studioDrafts);if(Object.keys(p.studioDrafts).length>20)fail();
    for(const [id,s] of Object.entries(p.studioDrafts) as [string,any][]){
      if(!floors.has(id))fail();obj(s);str(s.savedAt);num(s.imageScale,.001,100000);if(typeof s.calibrated!=='boolean')fail();obj(s.view);num(s.view.x);num(s.view.z);num(s.view.width,1,1000000);num(s.view.height,1,1000000);
      obj(s.draft);arr(s.draft.omittedWalls,4000);for(const id of s.draft.omittedWalls)str(id);
      const host=p.floors.find((f:any)=>f.id===id);
      validatePlan({...p,studioDrafts:undefined,floors:[{...host,walls:s.draft.walls,wallCuts:s.draft.wallCuts,blueprint:{rooms:s.draft.rooms,geometryKey:'draft'},stairs:[]}],furniture:s.draft.fixtures});
    }
  }
  if(p.environment!==undefined){obj(p.environment);if(!["plain","city","suburban","rural","farm","medieval"].includes(p.environment.background)||!["off","sparse","lush"].includes(p.environment.grass))fail();}
  if(p.environment?.vegetationField!==undefined)validateVegetationField(p.environment.vegetationField);
  if(p.environment?.grassCoverage!==undefined){obj(p.environment.grassCoverage);const entries=Object.entries(p.environment.grassCoverage);if(entries.length>160000)fail();for(const [key,density] of entries){if(!/^-?\d{1,3}:-?\d{1,3}$/.test(key))fail();const [x,z]=key.split(':').map(Number);num(x,-200,199);num(z,-200,199);num(density,1,9);if(!Number.isInteger(density))fail();}}
  if(p.environment?.sun!==undefined){const s=p.environment.sun;obj(s);if(typeof s.enabled!=='boolean'||(s.night!==undefined&&typeof s.night!=='boolean'))fail();num(s.azimuth,0,360);num(s.elevation,5,85);}
  if(p.environment?.citySource!==undefined&&!['standard','google'].includes(p.environment.citySource))fail();
  if(p.environment?.cityHeight!==undefined)num(p.environment.cityHeight,100,400);
  if(p.environment?.backdropRotation!==undefined)num(p.environment.backdropRotation,0,360);
  if(p.environment?.terrain!==undefined){arr(p.environment.terrain,128);for(const s of p.environment.terrain){obj(s);if(!['raise','lower','river'].includes(s.kind))fail();if(s.carve!==undefined&&typeof s.carve!=='boolean')fail();num(s.radius,.5,8);num(s.strength,.1,2);arr(s.points,64);if(!s.points.length)fail();for(const pt of s.points){obj(pt);num(pt.x,-10000,10000);num(pt.z,-10000,10000);}}}
  arr(p.furniture, 24000); unique(p.furniture); if(p.furniture.filter((f:any)=>isVegetation(f.catalogId)).length>vegetationLimit||p.furniture.filter((f:any)=>!isVegetation(f.catalogId)).length>2000)fail();
  for (const f of p.furniture) {
    str(f.catalogId); str(f.variant); if(f.showerMirrored!==undefined&&(typeof f.showerMirrored!=="boolean"||!showerIds.has(f.catalogId)))fail(); if(f.moduleRun!==undefined&&typeof f.moduleRun!=="boolean")fail(); if(f.doorless!==undefined&&(typeof f.doorless!=='boolean'||!isDoor(f.catalogId)))fail(); if(f.openFraction!==undefined)num(f.openFraction,0,1); if (!floors.has(f.floorId)) fail();
    for (const k of ["x", "z", "rotation"]) num(f[k]);
    for (const k of ["widthMm", "heightMm", "depthMm"]) num(f[k], 1, 50000);
    if(f.toFloorId!==undefined){str(f.toFloorId);if(!floors.has(f.toFloorId)||f.toFloorId===f.floorId)fail();} if(f.stairRiseMm!==undefined)num(f.stairRiseMm,100,20000);
    if (f.elevationMm !== undefined) num(f.elevationMm);
    if (f.terrainAnchored !== undefined && typeof f.terrainAnchored !== "boolean") throw new Error("Invalid terrain anchor");
    if (f.materialColors !== undefined) { obj(f.materialColors); if (Object.keys(f.materialColors).length > 100) fail(); for (const [key, color] of Object.entries(f.materialColors)) { str(key); if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) fail(); } }
  }
  obj(p.camera); if (!["top", "isometric", "dollhouse"].includes(p.camera.mode)) fail();
  for (const k of ["ghostBelow", "showGrid", "showClearance"]) if (typeof p.camera[k] !== "boolean") fail();
  for (const k of ["transparentWalls", "darkMode"]) if (p.camera[k] !== undefined && typeof p.camera[k] !== "boolean") fail();
  if (p.camera.wallVisibility !== undefined && !["near-hidden", "all-hidden", "all-visible"].includes(p.camera.wallVisibility)) fail();
}
