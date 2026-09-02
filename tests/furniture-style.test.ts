import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog, variants } from "../src/catalog";
import { createSamplePlan, parsePlan, serializePlan } from "../src/domain";
import { FURNITURE_STYLE, furnitureVariation } from "../src/scene/FurnitureFactory";

describe("handcrafted furniture design system", () => {
  it("uses stable deterministic variation", () => {
    const first=Array.from({length:12},(_,index)=>furnitureVariation("saved-item-42",index,.08));
    const second=Array.from({length:12},(_,index)=>furnitureVariation("saved-item-42",index,.08));
    expect(second).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(8);
    expect(first.every((value)=>value>=.92&&value<=1.08)).toBe(true);
  });

  it("keeps the catalog identifiers unique and unchanged in serialized plans", () => {
    expect(new Set(catalog.map((item)=>item.id)).size).toBe(catalog.length);
    const plan=createSamplePlan("Compatibility study");
    plan.furniture=[{id:"existing-placement",catalogId:"bookshelf",floorId:plan.floors[0].id,x:1200,z:1400,rotation:15,widthMm:900,depthMm:350,heightMm:1800,variant:"sage"}];
    expect(parsePlan(serializePlan(plan)).furniture[0]).toEqual(plan.furniture[0]);
  });

  it("includes distinct furniture families, media pieces, and a modular kitchen", () => {
    for (const id of ["modular-sectional","sleeper-sofa","storage-platform-bed","bunk-bed","standing-desk","corner-desk","nesting-tables","c-side-table","slim-tv","tv-stand","refrigerator","range-oven","dishwasher","base-cabinet","wall-cabinet","sink-cabinet","kitchen-counter","kitchen-island"]) {
      expect(catalog.some((item)=>item.id===id), `missing catalog item ${id}`).toBe(true);
    }
    expect(catalog.filter((item)=>item.category==="Kitchen").length).toBeGreaterThanOrEqual(11);
  });

  it("includes wall decor, shelf dressing, and flexible laundry arrangements", () => {
    for (const id of ["landscape-painting","botanical-print","abstract-poster","coast-poster","round-wall-mirror","arch-wall-mirror","whiteboard","wall-shelf","floating-shelves","books-upright","books-stacked","washer","dryer","stacked-laundry"]) {
      expect(catalog.some((item)=>item.id===id), `missing catalog item ${id}`).toBe(true);
    }
    expect(catalog.find((item)=>item.id==="landscape-painting")?.mount).toBe("wall");
    expect(catalog.find((item)=>item.id==="washer")?.mount).toBe("floor");
  });

  it("keeps the shared style low-poly, warm, and restrained", () => {
    expect(FURNITURE_STYLE.bevelRatio).toBeLessThan(.12);
    expect(FURNITURE_STYLE.defaultRoughness).toBeGreaterThan(.85);
    expect(Object.values(FURNITURE_STYLE.wood)).not.toContain("#000000");
    expect(Object.values(FURNITURE_STYLE.fabric)).not.toContain("#ffffff");
    expect(Object.keys(variants)).toHaveLength(8);
  });

  it("ships an editable Blender source and a non-empty GLB for every catalog item", () => {
    for (const item of catalog) {
      const blend = resolve("assets-source", "blender", `${item.id}.blend`);
      const glb = resolve("public", "models", "furniture", `${item.id}.glb`);
      expect(existsSync(blend), `missing Blender source for ${item.id}`).toBe(true);
      expect(existsSync(glb), `missing GLB for ${item.id}`).toBe(true);
      expect(statSync(blend).size).toBeGreaterThan(10_000);
      expect(statSync(glb).size).toBeGreaterThan(10_000);
    }
  });
});
