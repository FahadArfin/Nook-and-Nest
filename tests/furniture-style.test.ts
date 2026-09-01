import { describe, expect, it } from "vitest";
import { catalog } from "../src/catalog";
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

  it("keeps the shared style low-poly, warm, and restrained", () => {
    expect(FURNITURE_STYLE.bevelRatio).toBeLessThan(.12);
    expect(FURNITURE_STYLE.defaultRoughness).toBeGreaterThan(.85);
    expect(Object.values(FURNITURE_STYLE.wood)).not.toContain("#000000");
    expect(Object.values(FURNITURE_STYLE.fabric)).not.toContain("#ffffff");
  });
});
