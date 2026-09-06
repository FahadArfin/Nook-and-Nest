import { describe, expect, it } from "vitest";
import { createSamplePlan, decodeShare, deriveBoundaryWalls, encodeShare, formatLength, furnitureOverlaps, parsePlan, rectangleBetweenCells, rectangleCells, serializePlan, snapMm, toggleCell, validateStair } from "../src/domain";
import { usePlanner } from "../src/store";
import { countertopFinishes, floorFinishes, supportsCountertopFinish, wallFinishes } from "../src/surfaces";

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
  it("builds drag rectangles in every direction", () => {
    expect(rectangleBetweenCells({x:4,z:3},{x:2,z:1})).toEqual([
      {x:2,z:1},{x:3,z:1},{x:4,z:1},{x:2,z:2},{x:3,z:2},{x:4,z:2},{x:2,z:3},{x:3,z:3},{x:4,z:3},
    ]);
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

describe("draft furniture confirmation", () => {
  it("adds a placement only when confirmed and keeps it undoable", () => {
    const plan = createSamplePlan("Draft test");
    const before = plan.furniture.length;
    const placement = { id: "draft-chair", catalogId: "chair", floorId: plan.floors[0].id, x: 1250, z: 1650, rotation: 15, widthMm: 880, depthMm: 820, heightMm: 900, variant: "sage" };
    usePlanner.setState({ plan, activeFloorId: plan.floors[0].id, selectedId: undefined, past: [], future: [] });
    expect(usePlanner.getState().plan.furniture).toHaveLength(before);
    usePlanner.getState().confirmFurniture(placement);
    expect(usePlanner.getState().plan.furniture).toHaveLength(before + 1);
    expect(usePlanner.getState().selectedId).toBeUndefined();
    usePlanner.getState().undo();
    expect(usePlanner.getState().plan.furniture).toHaveLength(before);
  });
});

describe("tile drag confirmation", () => {
  it("applies a rectangular tile region as one undoable edit", () => {
    const plan=createSamplePlan("Tile drag test"); const floorId=plan.floors[0].id; const before=plan.floors[0].cells.length;
    usePlanner.setState({plan,activeFloorId:floorId,selectedId:undefined,past:[],future:[]});
    usePlanner.getState().paintCells([{x:30,z:30},{x:31,z:30},{x:30,z:31},{x:31,z:31}],true);
    expect(usePlanner.getState().plan.floors[0].cells).toHaveLength(before+4);
    expect(usePlanner.getState().past).toHaveLength(1);
    usePlanner.getState().undo();
    expect(usePlanner.getState().plan.floors[0].cells).toHaveLength(before);
  });
});

describe("room finishes", () => {
  it("offers the requested wall and floor finish families", () => {
    expect(new Set(wallFinishes.map((finish)=>finish.family))).toEqual(new Set(["Paint","Masonry","Wallpaper","Stone","Paneling","Tile"]));
    expect(new Set(floorFinishes.map((finish)=>finish.family))).toEqual(new Set(["Wood","Laminate","Tile","Carpet","Large marble"]));
  });

  it("saves and undoes a floor finish change", () => {
    const plan=createSamplePlan("Finish test"); const floorId=plan.floors[0].id;
    usePlanner.setState({plan,activeFloorId:floorId,selectedId:undefined,past:[],future:[]});
    usePlanner.getState().setFloorFinish("wallFinishId","handmade-brick");
    expect(usePlanner.getState().plan.floors[0].wallFinishId).toBe("handmade-brick");
    expect(parsePlan(serializePlan(usePlanner.getState().plan)).floors[0].wallFinishId).toBe("handmade-brick");
    usePlanner.getState().undo();
    expect(usePlanner.getState().plan.floors[0].wallFinishId).toBe("cream-plaster");
  });
});

describe("kitchen worktops", () => {
  it("offers stone, laminate, and concrete finishes on counter-capable pieces", () => {
    expect(new Set(countertopFinishes.map((finish)=>finish.family))).toEqual(new Set(["Stone","Laminate","Concrete"]));
    expect(supportsCountertopFinish("kitchen-island")).toBe(true);
    expect(supportsCountertopFinish("refrigerator")).toBe(false);
  });

  it("preserves a per-placement countertop choice through project files", () => {
    const plan=createSamplePlan("Kitchen finish test");
    plan.furniture=[{id:"island",catalogId:"kitchen-island",floorId:plan.floors[0].id,x:1200,z:1400,rotation:0,widthMm:1800,depthMm:900,heightMm:940,variant:"cream",surfaceVariant:"ivory-marble"}];
    expect(parsePlan(serializePlan(plan)).furniture[0].surfaceVariant).toBe("ivory-marble");
  });
});

describe("inside walls and doors", () => {
  it("adds a measured room divider as one undoable edit", () => {
    const plan=createSamplePlan("Divider test"),floorId=plan.floors[0].id;
    usePlanner.setState({plan,activeFloorId:floorId,selectedId:undefined,past:[],future:[]});
    usePlanner.getState().addWall({ax:2,az:2,bx:7,bz:2});
    expect(usePlanner.getState().plan.floors[0].walls.at(-1)).toMatchObject({ax:2,az:2,bx:7,bz:2});
    usePlanner.getState().undo();
    expect(usePlanner.getState().plan.floors[0].walls).toHaveLength(plan.floors[0].walls.length);
  });

  it("stores the selected material on each inside door", () => {
    const plan=createSamplePlan("Door finish test"),floorId=plan.floors[0].id;
    usePlanner.setState({plan,activeFloorId:floorId,selectedId:undefined,past:[],future:[],activeDoorFinish:"door-walnut"});
    usePlanner.getState().addOpening("door","north-0");
    expect(usePlanner.getState().plan.floors[0].openings.at(-1)?.finishId).toBe("door-walnut");
  });
});
