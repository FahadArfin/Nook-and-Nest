import { afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { cameraUpdatePolicy, comfortableCamera } from "../src/cameraPolicy";
import { createSamplePlan, parsePlan, serializePlan } from "../src/domain";
import { catalog, hasModelPreview } from "../src/catalog";
import { usePlanner } from "../src/store";
import { tabletopPoint } from "../src/tabletop";
import { runInNewContext } from "node:vm";
// @ts-expect-error Worker entry is JavaScript, bundled with the shared TS validator.
import worker from "../worker/projects.js";

describe("editor regressions", () => {
  it("paints only occupied floor regions and restores per-section finishes with undo", () => {
    const s = usePlanner.getState(), initial=createSamplePlan();initial.floors[0].walls=[{id:"wall-1",ax:1,az:2,bx:4,bz:2}];s.replacePlan(initial);
    s.finishCells([{x:0,z:0},{x:1,z:0},{x:100,z:100}],"light-oak");
    let floor = usePlanner.getState().plan.floors[0]; expect(floor.cellFinishes).toEqual({"0,0":"light-oak","1,0":"light-oak"});
    s.finishWall("wall-1", "sage-plaster"); expect(usePlanner.getState().plan.floors[0].wallFinishes).toEqual({"wall-1":"sage-plaster"});
    s.setFloorFinish("floorFinishId", "honey-oak"); expect(usePlanner.getState().plan.floors[0].cellFinishes).toEqual({});
    s.undo(); expect(usePlanner.getState().plan.floors[0].cellFinishes).toEqual(floor.cellFinishes);
    const plan = usePlanner.getState().plan; expect(parsePlan(serializePlan(plan))).toEqual(plan);
  });
  it("retains framing and orbit on object edits and only orients explicit view changes", () => {
    const p = createSamplePlan(), floor = p.floors[0].id;
    expect(cameraUpdatePolicy(p, { ...p, name: "Changed" }, floor, floor)).toEqual({ reframe: false, orient: false });
    expect(cameraUpdatePolicy(p, { ...p, camera: { ...p.camera, mode: "top" } }, floor, floor)).toEqual({ reframe: false, orient: true });
    expect(cameraUpdatePolicy(p, p, floor, p.floors[1].id).reframe).toBe(true);
    expect(cameraUpdatePolicy(undefined, p, floor, floor).reframe).toBe(true);
    expect(comfortableCamera.panningSensibility).toBeGreaterThan(100);
  });
  it("round-trips independently colored material slots and explicit wall/night controls", () => {
    const s = usePlanner.getState(); s.replacePlan(createSamplePlan()); s.placeFurniture("refrigerator");
    const id = usePlanner.getState().plan.furniture[0].id;
    s.updateFurniture(id, { materialColors: { "variant-surface": "#123456", "brushed-steel": "#fedcba" } });
    s.toggleCameraSetting("transparentWalls"); s.toggleCameraSetting("darkMode");
    const p = usePlanner.getState().plan; expect(parsePlan(serializePlan(p))).toEqual(p);
    s.undo(); expect(usePlanner.getState().plan.camera.darkMode).toBeUndefined();
  });
  it("has a real rendered thumbnail for every catalog item", () => {
    for (const item of catalog) { expect(hasModelPreview(item.id), item.id).toBe(true); expect(existsSync(`public/models/previews/${item.id}.png`), item.id).toBe(true); }
  });
  it("exports the new media models at their catalog dimensions with bounded geometry", () => {
    const ids=["tv-55","tv-65","tv-75","compact-speaker","bookshelf-speaker","tower-speaker","soundbar","subwoofer","slatted-tv-stand","open-media-bench","cane-tv-stand"];
    for(const id of ids){
      const c=catalog.find(i=>i.id===id)!; const buffer=readFileSync(`public/models/furniture/${id}.glb`);
      const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
      const bounds=gltf.meshes.flatMap((m:any)=>m.primitives.map((p:any)=>gltf.accessors[p.attributes.POSITION]));
      for(let a=0;a<3;a++)expect((Math.max(...bounds.map((b:any)=>b.max[a]))-Math.min(...bounds.map((b:any)=>b.min[a])))*1000,id).toBeCloseTo([c.widthMm,c.heightMm,c.depthMm][a],1);
      expect(gltf.accessors.filter((a:any)=>a.type==="SCALAR").reduce((sum:number,a:any)=>sum+a.count/3,0)).toBeLessThan(25000);
    }
  });
  it("rests a large TV on a wide media bench but rejects a narrower bench", () => {
    const plan=createSamplePlan(),floorId=plan.floors[0].id;
    const piece=(id:string)=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId,x:1500,z:1500,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:"sage"};};
    plan.furniture=[piece("open-media-bench")];
    expect(tabletopPoint(plan,piece("tv-75"),{x:1.5,y:3,z:1.5},{x:0,y:-1,z:0})?.elevationMm).toBe(380);
    plan.furniture=[piece("cane-tv-stand")];
    expect(tabletopPoint(plan,piece("tv-75"),{x:1.5,y:3,z:1.5},{x:0,y:-1,z:0})).toBeUndefined();
  });
  it("rejects malformed imports instead of casting them into a working plan", () => {
    for (const p of [null, {}, { schemaVersion: 1, floors: [], furniture: [] }, { ...createSamplePlan(), gridSizeMm: 0 }, { ...createSamplePlan(), camera: null }]) expect(() => parsePlan(JSON.stringify(p))).toThrow();
    const p = createSamplePlan(); p.floors[0].cells[0].x = Infinity; expect(() => parsePlan(JSON.stringify(p))).toThrow();
    expect(() => parsePlan(" ".repeat(1_000_001))).toThrow(/limit/);
  });
});

const databases: DatabaseSync[] = [];
function database() {
  const sql = new DatabaseSync(":memory:"); databases.push(sql); sql.exec(readFileSync("drizzle/0000_lush_inhumans.sql", "utf8"));
  return { prepare(query: string) { const statement = sql.prepare(query); return { bind(...args: any[]) { return {
    async first() { return statement.get(...args) ?? null; }, async all() { return { results: statement.all(...args) }; }, async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
  }; } }; } };
}
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const call = (db: unknown, path: string, owner = "alice", body?: unknown, headers: Record<string, string> = {}) => worker.fetch(new Request("https://nest.test" + path, { method: body === undefined ? "GET" : "POST", headers: { ...(owner ? { "oai-authenticated-user-id": owner } : {}), origin: "https://nest.test", "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { DB: db });

describe("private cloud project API against SQLite", () => {
  it("never lets the offline worker intercept private API or sign-in requests", () => {
    const handlers:Record<string,Function>={};
    runInNewContext(readFileSync("public/sw.js","utf8"),{URL,self:{location:{origin:"https://nest.test"},addEventListener:(event:string,handler:Function)=>handlers[event]=handler}});
    for(const path of ["/api/session","/api/projects","/signin-with-chatgpt","/signout-with-chatgpt","/callback"]){
      let intercepted=false;handlers.fetch({request:{method:"GET",url:"https://nest.test"+path,mode:"navigate"},respondWith:()=>intercepted=true});expect(intercepted).toBe(false);
    }
  });
  it("requires authentication and rejects cross-origin writes", async () => {
    const db = database(), plan = createSamplePlan(), body = { plan, expectedRevision: 0 };
    expect((await call(db, "/api/projects", "")).status).toBe(401);
    expect((await call(db, `/api/projects/${plan.id}`, "alice", body, { origin: "https://other.test" })).status).toBe(403);
    expect((await call(db, `/api/projects/${plan.id}`, "alice", body, { "content-type": "text/plain" })).status).toBe(415);
  });
  it("isolates users even for identical project IDs and refuses guessed version access", async () => {
    const db = database(), plan = createSamplePlan(), path = `/api/projects/${plan.id}`;
    expect((await call(db, path, "alice", { plan, expectedRevision: 0 })).status).toBe(200);
    expect((await call(db, path, "bob")).status).toBe(404);
    expect((await call(db, path + "?revision=1", "bob")).status).toBe(404);
    expect((await (await call(db, "/api/projects", "bob")).json()).projects).toEqual([]);
    const b = { ...plan, name: "Bob's different home" };
    expect((await call(db, path, "bob", { plan: b, expectedRevision: 0 })).status).toBe(200);
    expect((await (await call(db, path, "alice")).json()).plan).toEqual(plan);
    expect((await (await call(db, path, "bob")).json()).plan).toEqual(b);
    const response = await call(db, path); expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("preserves snapshots, rejects stale saves, lists latest and retains the last 20", async () => {
    const db = database(), plan = createSamplePlan(), path = `/api/projects/${plan.id}`;
    await call(db, path, "alice", { plan, expectedRevision: 0 });
    expect((await call(db, path, "alice", { plan: { ...plan, name: "Stale" }, expectedRevision: 0 })).status).toBe(409);
    for (let r = 1; r < 23; r++) expect((await call(db, path, "alice", { plan: { ...plan, name: `Version ${r + 1}` }, expectedRevision: r })).status).toBe(200);
    expect((await (await call(db, path)).json()).revision).toBe(23);
    const versions = (await (await call(db, path + "/versions")).json()).versions; expect(versions).toHaveLength(20); expect(versions[0].revision).toBe(23);
    expect((await (await call(db, path + "?revision=4")).json()).plan.name).toBe("Version 4");
    expect((await call(db, path + "?revision=1")).status).toBe(404);
    expect((await (await call(db, "/api/projects")).json()).projects[0].name).toBe("Version 23");
  });
  it("rejects corrupt/oversized data and never creates a project for it", async () => {
    const db = database(), plan = createSamplePlan(), path = `/api/projects/${plan.id}`;
    expect((await call(db, path, "alice", { plan: { ...plan, floors: [] }, expectedRevision: 0 })).status).toBe(400);
    expect((await call(db, path, "alice", { plan, expectedRevision: -1 })).status).toBe(400);
    expect((await call(db, path, "alice", { plan, expectedRevision: 0, extra: "x".repeat(1_001_000) })).status).toBe(413);
    expect((await (await call(db, "/api/projects")).json()).projects).toEqual([]);
  });
});
