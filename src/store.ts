import { create } from "zustand";
import { openDB } from "idb";
import { catalog } from "./catalog";
import { createSamplePlan, decodeShare, toggleCell, uid } from "./domain";
import type { FurniturePlacement, PlanDocumentV1, Tool, Units, ViewMode, WallSegment } from "./types";

interface Snapshot { plan: PlanDocumentV1; activeFloorId: string }
interface PlannerState {
  plan: PlanDocumentV1; activeFloorId: string; selectedId?: string; tool: Tool; search: string; category: string; past: Snapshot[]; future: Snapshot[];
  setSearch(search: string): void; setCategory(category: string): void; setTool(tool: Tool): void; select(id?: string): void;
  replacePlan(plan: PlanDocumentV1): void; rename(name: string): void; setUnits(units: Units): void; setView(mode: ViewMode): void;
  toggleCameraSetting(key: "ghostBelow" | "showGrid" | "showClearance"): void; setActiveFloor(id: string): void;
  addFloor(): void; deleteFloor(): void; renameFloor(name: string): void; paintCell(x: number, z: number, present: boolean): void;
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
  plan: initialPlan, activeFloorId: initialPlan.floors[0].id, tool: "select", search: "", category: "All", past: [], future: [],
  setSearch: (search) => set({ search }), setCategory: (category) => set({ category }), setTool: (tool) => set({ tool }), select: (selectedId) => set({ selectedId }),
  replacePlan: (plan) => set({ plan, activeFloorId: plan.floors[0].id, selectedId: undefined, past: [], future: [] }),
  rename: (name) => set((state) => commit(state, { ...state.plan, name })),
  setUnits: (units) => set((state) => commit(state, { ...state.plan, units, gridSizeMm: units === "imperial" ? 304.8 : 250 })),
  setView: (mode) => set((state) => commit(state, { ...state.plan, camera: { ...state.plan.camera, mode } })),
  toggleCameraSetting: (key) => set((state) => commit(state, { ...state.plan, camera: { ...state.plan.camera, [key]: !state.plan.camera[key] } })),
  setActiveFloor: (activeFloorId) => set({ activeFloorId, selectedId: undefined }),
  addFloor: () => set((state) => { const previous = state.plan.floors[state.plan.floors.length - 1]; const id = uid(); const floor = { id, name: `Floor ${state.plan.floors.length + 1}`, elevationMm: previous.elevationMm + previous.heightMm + 300, heightMm: previous.heightMm, cells: structuredClone(previous.cells), walls: [], openings: [], stairs: [] }; return { ...commit(state, { ...state.plan, floors: [...state.plan.floors, floor] }, null), activeFloorId: id }; }),
  deleteFloor: () => set((state) => { if (state.plan.floors.length === 1) return state; const floors = state.plan.floors.filter((f) => f.id !== state.activeFloorId); return { ...commit(state, { ...state.plan, floors, furniture: state.plan.furniture.filter((f) => f.floorId !== state.activeFloorId) }, null), activeFloorId: floors[0].id }; }),
  renameFloor: (name) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, name } : f) })),
  paintCell: (x, z, present) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, cells: toggleCell(f.cells, { x, z }, present) } : f) })),
  addWall: (wall) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, walls: [...f.walls, { ...wall, id: uid() }] } : f) })),
  addOpening: (kind, wallKey) => set((state) => commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, openings: [...f.openings, { id: uid(), kind, wallKey, offset: .5, widthMm: kind === "door" ? 914 : 1100 }] } : f) })),
  addStair: (x, z) => set((state) => { const floorIndex = state.plan.floors.findIndex((f) => f.id === state.activeFloorId); const next = state.plan.floors[floorIndex + 1]; return commit(state, { ...state.plan, floors: state.plan.floors.map((f) => f.id === state.activeFloorId ? { ...f, stairs: [...f.stairs, { id: uid(), kind: "straight", x, z, rotation: 0, widthMm: 950, lengthMm: 3000, toFloorId: next?.id }] } : f) }); }),
  placeFurniture: (catalogId, x = 1700, z = 1700) => set((state) => { const item = catalog.find((c) => c.id === catalogId); if (!item) return state; const id = uid(); const placed: FurniturePlacement = { id, catalogId, floorId: state.activeFloorId, x, z, rotation: 0, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, variant: "sage" }; return commit(state, { ...state.plan, furniture: [...state.plan.furniture, placed] }, id); }),
  confirmFurniture: (item) => set((state) => commit(state, { ...state.plan, furniture: [...state.plan.furniture, item] }, item.id)),
  moveFurniture: (id, x, z) => set((state) => commit(state, { ...state.plan, furniture: state.plan.furniture.map((f) => f.id === id ? { ...f, x, z } : f) }, id)),
  updateFurniture: (id, patch) => set((state) => commit(state, { ...state.plan, furniture: state.plan.furniture.map((f) => f.id === id ? { ...f, ...patch } : f) }, id)),
  duplicateSelected: () => set((state) => { const item = state.plan.furniture.find((f) => f.id === state.selectedId); if (!item) return state; const copy = { ...item, id: uid(), x: item.x + 250, z: item.z + 250 }; return commit(state, { ...state.plan, furniture: [...state.plan.furniture, copy] }, copy.id); }),
  deleteSelected: () => set((state) => state.selectedId ? commit(state, { ...state.plan, furniture: state.plan.furniture.filter((f) => f.id !== state.selectedId) }, null) : state),
  undo: () => set((state) => { const previous = state.past.at(-1); if (!previous) return state; return { plan: previous.plan, activeFloorId: previous.activeFloorId, past: state.past.slice(0, -1), future: [snap(state), ...state.future], selectedId: undefined }; }),
  redo: () => set((state) => { const next = state.future[0]; if (!next) return state; return { plan: next.plan, activeFloorId: next.activeFloorId, past: [...state.past, snap(state)], future: state.future.slice(1), selectedId: undefined }; }),
}));

let dbPromise: ReturnType<typeof openDB> | undefined;
const getDb = () => dbPromise ??= openDB("nook-and-nest", 1, { upgrade(db) { if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects"); } });
export async function savePlan(plan: PlanDocumentV1) { const db = await getDb(); await db.put("projects", plan, "active"); }
export async function loadPlan(): Promise<PlanDocumentV1 | undefined> { const hash = new URLSearchParams(location.hash.slice(1)).get("plan"); if (hash) return decodeShare(hash); const db = await getDb(); return db.get("projects", "active"); }
