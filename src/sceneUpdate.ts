import { isWallOpening, isStairs } from './catalog';
import type { PlanDocumentV1 } from './types';

/** Furniture transforms and selection never invalidate floor/wall geometry. */
export function architectureKey(plan: PlanDocumentV1, floorId: string, tool: string, wallId?: string) {
  return JSON.stringify([plan.id, floorId, tool, wallId, plan.gridSizeMm, plan.floors,
    plan.camera.mode, plan.camera.ghostBelow, plan.camera.showGrid, plan.camera.showClearance, plan.camera.darkMode,
    plan.furniture.filter(f => isWallOpening(f.catalogId) || isStairs(f.catalogId)).map(({id,catalogId,floorId,x,z,rotation,widthMm,depthMm,heightMm,elevationMm,toFloorId,stairRiseMm,doorless}) => ({id,catalogId,floorId,x,z,rotation,widthMm,depthMm,heightMm,elevationMm,toFloorId,stairRiseMm,doorless}))]);
}
