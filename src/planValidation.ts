import type { PlanDocumentV1 } from "./types";

export const MAX_PLAN_BYTES = 1_000_000;
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
    str(f.name); num(f.elevationMm); num(f.heightMm, 100, 20000);
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
    for (const w of f.walls) for (const k of ["ax", "az", "bx", "bz"]) num(w[k], -10000, 10000);
    for (const o of f.openings) { if (!["door", "window"].includes(o.kind)) fail(); str(o.wallKey); num(o.offset, 0, 1); num(o.widthMm, 1, 20000); }
    for (const s of f.stairs) { if (!["straight", "l-shaped"].includes(s.kind)) fail(); for (const k of ["x", "z", "rotation"]) num(s[k]); num(s.widthMm, 1, 20000); num(s.lengthMm, 1, 30000); if (s.toFloorId && !floors.has(s.toFloorId)) fail(); }
  }
  if(p.environment!==undefined){obj(p.environment);if(!["plain","city","suburban","rural","farm","medieval"].includes(p.environment.background)||!["off","sparse","lush"].includes(p.environment.grass))fail();}
  if(p.environment?.terrain!==undefined){arr(p.environment.terrain,128);for(const s of p.environment.terrain){obj(s);if(!['raise','lower','river'].includes(s.kind))fail();num(s.radius,.5,8);num(s.strength,.1,2);arr(s.points,64);if(!s.points.length)fail();for(const pt of s.points){obj(pt);num(pt.x,-10000,10000);num(pt.z,-10000,10000);}}}
  arr(p.furniture, 2000); unique(p.furniture);
  for (const f of p.furniture) {
    str(f.catalogId); str(f.variant); if (!floors.has(f.floorId)) fail();
    for (const k of ["x", "z", "rotation"]) num(f[k]);
    for (const k of ["widthMm", "heightMm", "depthMm"]) num(f[k], 1, 50000);
    if(f.toFloorId!==undefined){str(f.toFloorId);if(!floors.has(f.toFloorId)||f.toFloorId===f.floorId)fail();} if(f.stairRiseMm!==undefined)num(f.stairRiseMm,100,20000);
    if (f.elevationMm !== undefined) num(f.elevationMm);
    if (f.materialColors !== undefined) { obj(f.materialColors); if (Object.keys(f.materialColors).length > 100) fail(); for (const [key, color] of Object.entries(f.materialColors)) { str(key); if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) fail(); } }
  }
  obj(p.camera); if (!["top", "isometric", "dollhouse"].includes(p.camera.mode)) fail();
  for (const k of ["ghostBelow", "showGrid", "showClearance"]) if (typeof p.camera[k] !== "boolean") fail();
  for (const k of ["transparentWalls", "darkMode"]) if (p.camera[k] !== undefined && typeof p.camera[k] !== "boolean") fail();
  if (p.camera.wallVisibility !== undefined && !["near-hidden", "all-hidden", "all-visible"].includes(p.camera.wallVisibility)) fail();
}
