import { describe, expect, it } from "vitest";
import { createSamplePlan, decodeShare, deriveBoundaryWalls, encodeShare, formatLength, furnitureOverlaps, parsePlan, rectangleCells, serializePlan, snapMm, toggleCell, validateStair } from "../src/domain";

describe("floor geometry", () => {
  it("creates and edits tile rectangles without duplicates", () => {
    const cells = rectangleCells(3, 2);
    expect(cells).toHaveLength(6);
    expect(toggleCell(cells, { x: 2, z: 1 }, true)).toHaveLength(6);
    expect(toggleCell(cells, { x: 2, z: 1 }, false)).toHaveLength(5);
  });
  it("derives only exposed boundary walls", () => {
    expect(deriveBoundaryWalls(rectangleCells(1, 1))).toHaveLength(4);
    expect(deriveBoundaryWalls(rectangleCells(2, 1))).toHaveLength(6);
    expect(deriveBoundaryWalls(rectangleCells(2, 2))).toHaveLength(8);
  });
});

describe("measurements and fit", () => {
  it("formats both measurement systems and snaps precisely", () => {
    expect(formatLength(304.8, "imperial")).toBe("1′ 0″");
    expect(formatLength(2500, "metric")).toBe("2.50 m");
    expect(snapMm(127, 50)).toBe(150);
    expect(snapMm(127, 50, true)).toBe(127);
  });
  it("detects furniture overlap on the same floor only", () => {
    const base = { id: "a", catalogId: "sofa", floorId: "one", x: 1000, z: 1000, rotation: 0, widthMm: 1000, depthMm: 800, heightMm: 700, variant: "sage" };
    expect(furnitureOverlaps([base, { ...base, id: "b", x: 1400 }], base)).toBe(true);
    expect(furnitureOverlaps([base, { ...base, id: "b", floorId: "two" }], base)).toBe(false);
  });
  it("warns about implausibly small stairs", () => {
    expect(validateStair(700, 1800, 2500)).toHaveLength(2);
    expect(validateStair(950, 3200, 2500)).toHaveLength(0);
  });
});

describe("project portability", () => {
  it("round-trips project files", () => {
    const plan = createSamplePlan("Test home");
    expect(parsePlan(serializePlan(plan)).name).toBe("Test home");
    expect(() => parsePlan("{}")) .toThrow(/valid Nook/);
  });
  it("round-trips compressed share links as an independent copy", () => {
    const plan = createSamplePlan("Shared home");
    const copy = decodeShare(encodeShare(plan));
    expect(copy.name).toBe("Shared home copy");
    expect(copy.id).not.toBe(plan.id);
    expect(copy.floors).toHaveLength(2);
  });
});
