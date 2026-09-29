import { catalog } from './catalog';
import { isVegetation } from './vegetation';
import { fieldCount } from './vegetationField';
import type { KitPreviewRequest } from './FurnitureKitsPanel';
import type { FurniturePlacement, PlanDocumentV1 } from './types';
export type SeasonalPalette = 'spring' | 'summer' | 'autumn' | 'winter';
export interface SeasonalLook { version: 1; palette: SeasonalPalette; region: { floorId: string; x: number; z: number; width: number; depth: number } }
export type SeasonalPlan = PlanDocumentV1 & { environment?: NonNullable<PlanDocumentV1['environment']> & { seasonalLook?: SeasonalLook } };
export const MAX_SEASONAL_PLACEMENTS = 2000, MAX_SEASONAL_MATERIALS = 256;
const leaves = ['foliage-main', 'foliage-shadow', 'foliage-new-growth'];
/** Reviewed against current GLB material tables. Unknown plants/roles remain authored. */
export const seasonalRoles: Readonly<Record<string, readonly string[]>> = Object.assign(Object.create(null), {
  'maple-tree': ['maple-ochre', 'maple-russet', 'maple-gold'],
  'fern-clump': leaves, 'hydrangea-border': [...leaves, 'petal-blush'],
  'lavender-clump': [...leaves, 'lavender-florets'], 'tulip-planter': [...leaves, 'petal-blush'],
});
const colors: Record<SeasonalPalette, { leaf: readonly string[]; maple: readonly string[]; petal: string; lavender: string }> = {
  spring: { leaf: ['#6e9255', '#49673b', '#99b86d'], maple: ['#76a35a', '#527c42', '#a7bd6c'], petal: '#dcabc0', lavender: '#a79bbd' },
  summer: { leaf: ['#547844', '#385332', '#82a35b'], maple: ['#6f8d43', '#536f39', '#91a650'], petal: '#cfa0bb', lavender: '#9381b2' },
  autumn: { leaf: ['#737c4d', '#4e593b', '#9da66b'], maple: ['#c18439', '#a14f39', '#d5aa4f'], petal: '#bca3ad', lavender: '#948997' },
  winter: { leaf: ['#7a897e', '#535f56', '#a0aaa0'], maple: ['#a59982', '#8e7f70', '#bcb19a'], petal: '#c6bec7', lavender: '#b0abb7' },
};
export function parseSeasonalLook(value: unknown, floorIds?: readonly string[]): SeasonalLook {
  const v = value as SeasonalLook, r = v?.region;
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !['version', 'palette', 'region'].includes(k)) || v.version !== 1 || !['spring', 'summer', 'autumn', 'winter'].includes(v.palette) || !r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).some(k => !['floorId', 'x', 'z', 'width', 'depth'].includes(k)) || typeof r.floorId !== 'string' || !r.floorId.length || r.floorId.length > 160 || floorIds && !floorIds.includes(r.floorId) || ![r.x, r.z, r.width, r.depth].every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(r.x) > 100_000 || Math.abs(r.z) > 100_000 || r.width < 100 || r.depth < 100 || r.width > 100_000 || r.depth > 100_000 || r.x + r.width > 100_000 || r.z + r.depth > 100_000) throw new Error('Choose a seasonal palette and a region between 10 cm and 100 m within the supported ground bounds.');
  return structuredClone(v);
}
export function inSeasonalRegion(item: Pick<FurniturePlacement, 'floorId' | 'x' | 'z'>, look: SeasonalLook): boolean { const r = look.region; return item.floorId === r.floorId && item.x >= r.x && item.x <= r.x + r.width && item.z >= r.z && item.z <= r.z + r.depth; }
export function seasonalColor(id: string, role: string, palette: SeasonalPalette): string | undefined {
  if (!seasonalRoles[id]?.includes(role)) return undefined;
  const c = colors[palette]; if (!c) return undefined;
  if (id === 'maple-tree') return c.maple[seasonalRoles[id].indexOf(role)];
  if (role === 'petal-blush') return c.petal;
  if (role === 'lavender-florets') return c.lavender;
  return c.leaf[leaves.indexOf(role)];
}
export function seasonalScope(plan: PlanDocumentV1, look: SeasonalLook) {
  const inRegion = plan.furniture.filter(p => !p.id.startsWith('field:') && inSeasonalRegion(p, look) && isVegetation(p.catalogId));
  return { supported: inRegion.filter(p => seasonalRoles[p.catalogId]), unsupported: inRegion.filter(p => !seasonalRoles[p.catalogId]), fieldPlants: fieldCount(plan.environment?.vegetationField) };
}
export function initialSeasonalLook(plan: SeasonalPlan, floorId: string): SeasonalLook {
  if (plan.environment?.seasonalLook?.region.floorId === floorId) return structuredClone(plan.environment.seasonalLook);
  const plants = plan.furniture.filter(p => p.floorId === floorId && seasonalRoles[p.catalogId]);
  const x = plants.length ? Math.max(-100_000, Math.min(...plants.map(p => p.x)) - 500) : -4000, z = plants.length ? Math.max(-100_000, Math.min(...plants.map(p => p.z)) - 500) : -4000;
  return { version: 1, palette: 'summer', region: { floorId, x, z, width: Math.max(100, Math.min(100_000 - x, 100_000, plants.length ? Math.max(...plants.map(p => p.x)) - x + 500 : 8000)), depth: Math.max(100, Math.min(100_000 - z, 100_000, plants.length ? Math.max(...plants.map(p => p.z)) - z + 500 : 8000)) } };
}
export function seasonalPreview(base: SeasonalPlan, current: SeasonalPlan, floorId: string, value: SeasonalLook | undefined, validate: (plan: unknown) => void): KitPreviewRequest {
  if (base !== current) throw new Error('The project changed. Preview the seasonal view again.');
  const look = value ? parseSeasonalLook(value, base.floors.map(f => f.id)) : undefined;
  if (look && seasonalScope(base, look).supported.length > MAX_SEASONAL_PLACEMENTS) throw new Error('Choose a smaller region with at most 2,000 reviewed placed plants. Dense field-brush plants retain their authored look.');
  const { seasonalLook: _old, ...environment } = base.environment ?? { background: 'plain' as const, grass: 'off' as const };
  const plan: SeasonalPlan = { ...base, environment: look ? { ...environment, seasonalLook: look } : environment };
  validate(plan); if (new TextEncoder().encode(JSON.stringify(plan)).length > 8_000_000) throw new Error('This project exceeds the 8 MB save limit.');
  return { base, plan, floorId, label: look ? `${look.palette[0].toUpperCase() + look.palette.slice(1)} cosmetic garden palette` : 'Original plant materials', addedIds: [], warnings: [] };
}
export const seasonalSpeciesNames = Object.keys(seasonalRoles).map(id => catalog.find(c => c.id === id)?.name ?? id);

const renderPlans = new WeakMap<PlanDocumentV1, PlanDocumentV1>();
const renderLooks = new WeakMap<PlanDocumentV1, SeasonalLook | null>();
export function renderableSeasonalLook(plan: PlanDocumentV1): SeasonalLook | undefined {
  if (renderLooks.has(plan)) return renderLooks.get(plan) ?? undefined;
  const look = (plan as SeasonalPlan).environment?.seasonalLook;
  let count = 0;
  if (look) for (const item of plan.furniture) if (!item.id.startsWith('field:') && seasonalRoles[item.catalogId] && inSeasonalRegion(item, look) && ++count > MAX_SEASONAL_PLACEMENTS) break;
  const eligible = look && plan.floors.some(f => f.id === look.region.floorId) && count <= MAX_SEASONAL_PLACEMENTS ? look : undefined;
  renderLooks.set(plan, eligible ?? null); return eligible;
}
/** GrassRenderer receives a derived visual plan only. Never commit or export this value.
 * Field IDs are deliberately neutral; no dense vegetation is expanded into furniture.
 */
export function seasonalRenderPlan(plan: PlanDocumentV1): PlanDocumentV1 {
  const look = renderableSeasonalLook(plan); if (!look) return plan;
  const cached = renderPlans.get(plan); if (cached) return cached;
  const candidates = plan.furniture.filter(p => !p.id.startsWith('field:') && seasonalRoles[p.catalogId] && inSeasonalRegion(p, look));
  if (!candidates.length) { renderPlans.set(plan, plan); return plan; }
  if (candidates.length > MAX_SEASONAL_PLACEMENTS) { renderPlans.set(plan, plan); return plan; }
  const selected = new Set(candidates.map(p => p.id));
  const furniture = plan.furniture.map(item => {
    if (!selected.has(item.id)) return item;
    const materialColors = { ...item.materialColors };
    for (const role of seasonalRoles[item.catalogId]) { const color = seasonalColor(item.catalogId, role, look.palette); if (color) materialColors[role] = color; }
    return { ...item, materialColors };
  });
  const visual = { ...plan, furniture }; renderPlans.set(plan, visual); return visual;
}
