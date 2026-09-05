import { create } from "zustand";
import { openDB } from "idb";
import { catalog, defaultMountHeight, isWindow, isDoor, isStairs, isWallOpening } from "./catalog";
import { defaultCountertopFinish, defaultDoorFinish, supportsCountertopFinish } from "./surfaces";
import { addMeasuredRegion, measuredRegion, paintFloorCells, type MeasuredRegion } from "./floorGeometry";
import { fitStair } from "./building";
import { snapWindow, windowProblem } from "./windows";
import { createSamplePlan, decodeShare, toggleCell, toggleCells, uid } from "./domain";
import type { FurniturePlacement, PlanDocumentV1, TileCell, Tool, Units, ViewMode, WallSegment } from "./types";
import { validatePlan } from "./planValidation";
import { getWallVisibility, nextWallVisibility } from "./wallVisibility";
import { paintWallPlate } from "./wallEditing";
import {scatterPlants,type PlantingBrush} from './planting';

interface Snapshot { plan: PlanDocumentV1; activeFloorId: string }
interface PlannerState {
  plantingBrush:PlantingBrush;setPlantingBrush(brush:PlantingBrush):void;
  plantingDraft?:{base:PlanDocumentV1;items:FurniturePlacement[]};
  previewPlanting(points:Array<{x:number;z:number}>):void;confirmPlanting():void;cancelPlanting():void;
  terrainRadius:number;terrainStrength:number;setTerrainBrush(radius:number,strength:number):void;
  addTerrainStroke(stroke:import('./terrain').TerrainStroke):void;
  selectedWallId?:string; selectWall(id?:string):void;
  cycleWallVisibility(): void;
  commitDesign(base:PlanDocumentV1,plan:PlanDocumentV1):void;
  setEnvironment(patch:Partial<NonNullable<PlanDocumentV1["environment"]>>):void;
  roomSize?: {widthMm:number;depthMm:number};setRoomSize(size:{widthMm:number;depthMm:number}):void; addMeasuredRoom(region:MeasuredRegion):void;
  activeSurfaceFinish: string; setSurfaceBrush(kind:"floor-finish"|"wall-finish",finishId:string):void; finishCells(cells:TileCell[],finishId:string):void; finishWall(id:string,finishId:string):void;
  placementNotice?: string; plan: PlanDocumentV1; activeFloorId: string; selectedId?: string; tool: Tool; search: string; category: string; activeDoorFinish: string; past: Snapshot[]; future: Snapshot[];
  setSearch(search: string): void; setCategory(category: string): void; setTool(tool: Tool): void; setDoorFinish(finishId:string):void; select(id?: string): void;
  replacePlan(plan: PlanDocumentV1): void; rename(name: string): void; setUnits(units: Units): void; setView(mode: ViewMode): void;
  toggleCameraSetting(key: "ghostBelow" | "showGrid" | "showClearance" | "transparentWalls" | "darkMode"): void; setActiveFloor(id: string): void;
  addFloor(): void; deleteFloor(floorId?: string): void; renameFloor(name: string): void; paintCell(x: number, z: number, present: boolean): void; paintCells(cells: TileCell[], present: boolean): void;
  setFloorFinish(kind: "floorFinishId" | "wallFinishId", finishId: string): void;
  addWall(wall: Omit<WallSegment, "id">): void; addOpening(kind: "door" | "window", wallKey: string): void; addStair(x: number, z: number): void;
  placeFurniture(catalogId: string, x?: number, z?: number): void; moveFurniture(id: string, x: number, z: number): void;
  confirmFurniture(item: FurniturePlacement): void;
  updateFurniture(id: string, patch: Partial<FurniturePlacement>): void; duplicateSelected(): void; deleteSelected(): void;
  undo(): void; redo(): void;
}

const initialPlan = createSamplePlan();
const snap = (state: PlannerState): Snapshot => ({ plan: structuredClone(state.plan), activeFloorId: state.activeFloorId });
const commit = (state: PlannerState, plan: PlanDocumentV1, selectedId: string|null|undefined = state.selectedId) => ({ plan: { ...plan, updatedAt: new Date().toISOString() }, selectedId: selectedId === null ? undefined : selectedId, past: [...state.past.slice(-39), snap(state)], future: [] });

export const usePlanner = create<PlannerState>((set, get) => ({
  plantingBrush:{catalogId:'grass-clump',radius:1.5,spacing:.5},
  setPlantingBrush:plantingBrush=>set({plantingBrush,plantingDraft:undefined}),
  previewPlanting:points=>set(s=>({plantingDraft:{base:s.plan,items:scatterPlants(s.plan,points,s.plantingBrush)}})),
  cancelPlanting:()=>set({plantingDraft:undefined}),
  confirmPlanting:()=>set(s=>{
    const draft=s.plantingDraft;if(!draft)return {};
    if(draft.base!==s.plan)return {plantingDraft:undefined,placementNotice:'The garden changed. Paint a fresh stroke.'};
    if(!draft.items.length)return {plantingDraft:undefined};
    const plan={...s.plan,furniture:[...s.plan.furniture,...draft.items.map(p=>({...p,id:uid()}))]};
    validatePlan(plan);return {...commit(s,plan,null),plantingDraft:undefined,placementNotice:undefined};
  }),
  terrainRadius:2,terrainStrength:.6,
  setTerrainBrush:(radius,strength)=>set({terrainRadius:Math.max(.5,Math.min(8,radius)),terrainStrength:Math.max(.1,Math.min(2,strength))}),
  addTerrainStroke:stroke=>set(state=>{const terrain=[...(state.plan.environment?.terrain??[]),stroke];if(terrain.length>128)return {...state,placementNotice:'Terrain is at its 128-stroke limit. Undo or clear terrain to reshape it.'};const plan={...state.plan,environment:{background:'plain' as const,grass:'off' as const,...state.plan.environment,terrain}};validatePlan(plan);return commit(state,plan);}),
  selectWall:selectedWallId=>set({selectedWallId,selectedId:undefined,tool:"wall-finish"}),
  commitDesign:(base,plan)=>set(state=>{if(state.plan!==base||plan.id!==base.id)throw new Error('The apartment changed. Read it again and prepare a new design.');validatePlan(plan);return {...commit(state,structuredClone(plan),null),tool:'select',placementNotice:undefined};}),
  setEnvironment:patch=>set(state=>commit(state,{...state.plan,environment:{background:"plain",grass:"off",...state.plan.environment,...patch}})),
  roomSize:undefined,
  setRoomSize:roomSize=>set({roomSize,tool:"measured-room",selectedId:undefined}),
  addMeasuredRoom:region=>set(state=>{try{const checked=measuredRegion(state.plan.gridSizeMm,region.origin,region.widthMm,region.depthMm);return commit(state,{...state.plan,floors:state.plan.floors.map(f=>f.id===state.activeFloorId?addMeasuredRegion(f,state.plan.gridSizeMm,checked):f)});}catch(e){return {placementNotice:(e as Error).message};}}),
  activeSurfaceFinish:"honey-oak",
  setSurfaceBrush:(tool,activeSurfaceFinish)=>set({tool,activeSurfaceFinish,selectedId:undefined,selectedWallId:undefined}),
  finishCells:(cells,finishId)=>set(state=>commit(state,{...state.plan,floors:state.plan.floors.map(f=>{if(f.id!==state.activeFloorId)return f;const occupied=new Set(f.cells.map(c=>`${c.x},${c.z}`));const cellFinishes={...f.cellFinishes};for(const c of cells){const key=`${c.x},${c.z}`;if(occupied.has(key))cellFinishes[key]=finishId;}return {...f,cellFinishes};})})),
  finishWall:(id,finishId)=>set(state=>commit(state,{...state.plan,floors:state.plan.floors.map(f=>f.id===state.activeFloorId?paintWallPlate(f,state.plan.gridSizeMm,id,finishId):f)})),
  plan: initialPlan, activeFloorId: initialPlan.floors[0].id, tool: "select", search: "", category: "All", activeDoorFinish: defaultDoorFinish.id, past: [], future: [],
  setSearch: (search) => set({ search }), setCategory: (category) => set({ category }), setTool: (tool) => set({ tool, plantingDraft:undefined, selectedWallId:undefined, placementNotice:undefined }), setDoorFinish:(activeDoorFinish)=>set({activeDoorFinish}), select: (selectedId) => set({ selectedId,selectedWallId:undefined,placementNotice:undefined }),
  replacePlan: (plan) => set({ plan, activeFloorId: plan.floors[0].id, selectedId: undefined, selectedWallId:undefined, past: [], future: [] }),
  rename: (name) => set((state) => commit(state, { ...state.plan, name })),
  setUnits: (units) => set((state) => commit(state, { ...state.plan, units })),
  setView: (mode) => set((state) => commit(state, { ...state.plan, camera: { ...state.plan.camera, mode } })),
  cycleWallVisibility: () => set(state => {
    const wallVisibility = nextWallVisibility(getWallVisibility(state.plan.camera));
    return commit(state, { ...state.plan, camera: { ...state.plan.camera, wallVisibility, transparentWalls: wallVisibility !== "all-visible" } });
  }),
  toggleCameraSetting: (key) => set((state) => {
    // Retain the old boolean action for existing callers, without leaving a
    // stale enum that would override its result.
    const camera = { ...state.plan.camera, [key]: !state.plan.camera[key] };
    if (key === "transparentWalls") camera.wallVisibility = camera.transparentWalls ? "near-hidden" : "all-visible";
    return commit(state, { ...state.plan, camera });
  }),
  setActiveFloor: (activeFloorId) => set({ activeFloorId, selectedId: undefined, selectedWallId:undefined }),
  addFloor: () => set((state) => { const previous = state.plan.floors[state.plan.floors.length - 1]; const id = uid(); const floor = { id, name: `Floor ${state.plan.floors.length + 1}`, elevationMm: previous.elevationMm + previous.heightMm + 300, heightMm: previous.heightMm, cells: structuredClone(previous.cells), ...(previous.cellRects?{cellRects:structuredClone(previous.cellRects)}:{}), walls: [], openings: [], stairs: [], floorFinishId: previous.floorFinishId, wallFinishId: previous.wallFinishId }; return { ...commit(state, { ...state.plan, floors: [...state.plan.floors, floor] }, null), activeFloorId: id }; }),
  deleteFloor: (floorId) => set((state) => {
    const targetId = floorId ?? state.activeFloorId;
    const index = state.plan.floors.findIndex(f => f.id === targetId);
    if (index < 0) return state;
    // Keep one editable layer; clearing the last floor removes its contents.
    const floors = state.plan.floors.length === 1
      ? [{ ...state.plan.floors[0], cells: [], walls: [], openings: [], stairs: [], ...(state.plan.floors[0].cellRects?{cellRects:{}}:{}), ...(state.plan.floors[0].cellFinishes?{cellFinishes:{}}:{}), ...(state.plan.floors[0].wallFinishes?{wallFinishes:{}}:{}) }]
      : state.plan.floors.filter(f => f.id !== targetId).map(f => ({ ...f, stairs: f.stairs.filter(stair => stair.toFloorId !== targetId) }));
    const activeFloorId = floors.some(f => f.id === state.activeFloorId) ? state.activeFloorId : floors[Math.max(0, index - 1)].id;
    return { ...commit(state, { ...state.plan, floors, furniture: state.plan.furniture.filter(f => f.floorId !== targetId).map(f=>f.toFloorId===targetId?{...f,toFloorId:undefined}:f) }, null), activeFloorId, placementNotice: undefined };
  }),
  renameFloor: (name) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, name } : f) })),
  paintCell: (x, z, present) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? paintFloorCells(f,[{x,z}],present) : f) })),
  paintCells: (cells, present) => set((state) => cells.length ? commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? paintFloorCells(f,cells,present) : f) }) : state),
  setFloorFinish: (kind, finishId) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((floor) => floor.id === state.activeFloorId ? { ...floor, [kind]: finishId, ...(kind==="floorFinishId"?{cellFinishes:{}}:{wallFinishes:{}}) } : floor) })),
  addWall: (wall) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, walls: [...f.walls, { ...wall, id: uid() }] } : f) })),
  addOpening: (kind, wallKey) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, openings: [...f.openings, { id: uid(), kind, wallKey, offset: .5, widthMm: kind === "door" ? 914 : 1100, finishId: kind==="door"?state.activeDoorFinish:undefined }] } : f) })),
  addStair: (x, z) => set((state) => { const floorIndex = state.plan.floors.findIndex((f) => f.id === state.activeFloorId); const next = state.plan.floors[floorIndex + 1]; return commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, stairs: [...f.stairs, { id: uid(), kind: "straight", x, z, rotation: 0, widthMm: 950, lengthMm: 3000, toFloorId: next?.id }] } : f) }); }),
  placeFurniture: (catalogId, x = 1700, z = 1700) => set((state) => { const item = catalog.find((c) => c.id === catalogId); if (!item) return state; const id = uid(); const placed: FurniturePlacement = { id, catalogId, floorId: state.activeFloorId, x, z, rotation: 0, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, variant: "sage", surfaceVariant: supportsCountertopFinish(catalogId) ? defaultCountertopFinish.id : undefined, elevationMm:defaultMountHeight(catalogId) }; return commit(state, { ...state.plan, furniture: [...state.plan.furniture, placed] }, id); }),
  confirmFurniture: (item) => set((state) => {const mounted=fitStair(state.plan,snapWindow(state.plan,item)),problem=windowProblem(state.plan,mounted);if(problem)return {placementNotice:problem};return {...commit(state,{...state.plan,furniture:[...state.plan.furniture,mounted]},null),placementNotice:undefined};}),
  moveFurniture: (id,x,z) => get().updateFurniture(id,{x,z}),
  updateFurniture: (id,patch) => set((state) => {const existing=state.plan.furniture.find(f=>f.id===id);if(!existing)return state;const candidate=fitStair(state.plan,snapWindow(state.plan,{...existing,...patch}));const problem=windowProblem(state.plan,candidate);if(problem)return {placementNotice:problem};return {...commit(state,{...state.plan,furniture:state.plan.furniture.map(f=>f.id===id?candidate:f)},id),placementNotice:undefined};}),
  duplicateSelected: () => set((state) => { const item = state.plan.furniture.find((f) => f.id === state.selectedId); if (!item) return state; const copy = snapWindow(state.plan,{ ...item, id: uid(), x: item.x + (isWallOpening(item.catalogId)&&item.rotation%180===0?item.widthMm+80:250), z: item.z + (isWindow(item.catalogId)&&item.rotation%180!==0?item.widthMm+80:250) }); const problem=windowProblem(state.plan,copy);if(problem)return {placementNotice:problem}; return commit(state, { ...state.plan, furniture: [...state.plan.furniture, copy] }, copy.id); }),
  deleteSelected: () => set((state) => state.selectedId ? commit(state, { ...state.plan, furniture: state.plan.furniture.filter((f) => f.id !== state.selectedId) }, null) : state),
  undo: () => set((state) => { const previous = state.past.at(-1); if (!previous) return state; return { plan: previous.plan, activeFloorId: previous.activeFloorId, past: state.past.slice(0, -1), future: [snap(state), ...state.future], selectedId: undefined, selectedWallId:undefined }; }),
  redo: () => set((state) => { const next = state.future[0]; if (!next) return state; return { plan: next.plan, activeFloorId: next.activeFloorId, past: [...state.past, snap(state)], future: state.future.slice(1), selectedId: undefined, selectedWallId:undefined }; }),
}));

let dbPromise: ReturnType<typeof openDB> | undefined;
const getDb = () => dbPromise ??= openDB("nook-and-nest", 1, { upgrade(db) { if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects"); } });
export async function savePlan(plan: PlanDocumentV1) { const db = await getDb(); const tx=db.transaction("projects","readwrite"); await tx.store.put(plan,"active"); await tx.store.put(plan,"project:"+plan.id); await tx.done; }
export async function listLocalPlans(): Promise<PlanDocumentV1[]> { const db=await getDb(); const all=await db.getAll("projects"); const map=new Map<string,PlanDocumentV1>(); for(const p of all)if(p?.schemaVersion===1&&p.id)map.set(p.id,p); return [...map.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
export async function getCloudRevision(owner:string,id:string):Promise<number> { return (await (await getDb()).get("projects",`cloud:${owner}:${id}`))??0; }
export async function saveCloudRevision(owner:string,id:string,revision:number) { await (await getDb()).put("projects",revision,`cloud:${owner}:${id}`); }
export async function loadPlan(): Promise<PlanDocumentV1 | undefined> { const hash = new URLSearchParams(location.hash.slice(1)).get("plan"); if (hash) return decodeShare(hash); const db = await getDb(); return db.get("projects", "active"); }
