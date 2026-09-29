import { catalog } from './catalog';
import { applyFurnitureGroupCommand, assertLockedFurnitureUnchanged } from './furnitureGroups';
import { buildKitPlacement, kitBounds, parseFurnitureKit, type FurnitureKit, type KitPosition } from './furnitureKits';
import type { KitPreviewRequest } from './FurnitureKitsPanel';
import { validatePlan } from './planValidation';
import type { PlanDocumentV1 } from './types';

export const MAX_MODULAR_COMPONENTS = 12;
export type ModularFamily = 'closet' | 'kitchen-base';
export interface ModularComponent { id: string; catalogId: string }
export interface ModularConfiguration {
  version: 1; family: ModularFamily; modules: ModularComponent[];
  variant: 'oat' | 'sage' | 'slate'; woodColor?: string; hardwareColor?: string;
  surfaceVariant: 'warm-granite' | 'ivory-marble' | 'clay-laminate' | 'soft-concrete';
  group: boolean; lock: boolean;
}
/** Authored cabinet carcass boundaries, verified in modern_models.py and current GLB materials.
 * Side-by-side planning joints only, not a manufacturer's connector/installation specification.
 * Existing corner/sink/wall modules deliberately have no ports in this first release.
 */
export const modularPorts: Readonly<Record<string, { family: ModularFamily; width: number; depth: number; height: number; sides: readonly ['left', 'right'] }>> = {
  'closet-hanging-module': { family: 'closet', width: 900, depth: 600, height: 2200, sides: ['left', 'right'] },
  'closet-shelf-module': { family: 'closet', width: 600, depth: 600, height: 2200, sides: ['left', 'right'] },
  'push-base-cabinet': { family: 'kitchen-base', width: 800, depth: 620, height: 910, sides: ['left', 'right'] },
  'shaker-drawer-cabinet': { family: 'kitchen-base', width: 900, depth: 620, height: 910, sides: ['left', 'right'] },
  'arched-base-cabinet': { family: 'kitchen-base', width: 900, depth: 620, height: 910, sides: ['left', 'right'] },
};
const byId = new Map(catalog.map(c => [c.id, c]));
export const modularChoices = (family: ModularFamily) => Object.keys(modularPorts).filter(id => modularPorts[id].family === family).map(id => byId.get(id)!).filter(Boolean);
export function defaultModularConfiguration(family: ModularFamily = 'closet'): ModularConfiguration {
  return { version: 1, family, modules: (family === 'closet' ? ['closet-hanging-module', 'closet-shelf-module'] : ['push-base-cabinet', 'shaker-drawer-cabinet']).map((catalogId, i) => ({ id: `module-${i + 1}`, catalogId })), variant: 'oat', surfaceVariant: 'warm-granite', group: true, lock: false };
}
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
export function parseModularConfiguration(v: unknown): ModularConfiguration {
  const fail = () => { throw new Error('Choose supported cabinet modules at their authored dimensions. Mirrored, stretched, corner and wall joins are not available.'); };
  if (!record(v) || Object.keys(v).some(k => !['version', 'family', 'modules', 'variant', 'woodColor', 'hardwareColor', 'surfaceVariant', 'group', 'lock'].includes(k)) || v.version !== 1 || !['closet', 'kitchen-base'].includes(String(v.family)) || !['oat', 'sage', 'slate'].includes(String(v.variant)) || !['warm-granite', 'ivory-marble', 'clay-laminate', 'soft-concrete'].includes(String(v.surfaceVariant)) || typeof v.group !== 'boolean' || typeof v.lock !== 'boolean' || !Array.isArray(v.modules) || !v.modules.length || v.modules.length > MAX_MODULAR_COMPONENTS) fail();
  const data = v as unknown as ModularConfiguration, ids = new Set<string>();
  for (const c of data.modules) {
    if (!record(c) || Object.keys(c).some(k => !['id', 'catalogId'].includes(k)) || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(c.id) || ids.has(c.id) || typeof c.catalogId !== 'string') fail();
    const port = modularPorts[c.catalogId], item = byId.get(c.catalogId);
    if (!port || port.family !== data.family || !item || item.mount !== 'floor' || item.widthMm !== port.width || item.depthMm !== port.depth || item.heightMm !== port.height) fail();
    ids.add(c.id);
  }
  for (const key of ['woodColor', 'hardwareColor'] as const) if (data[key] !== undefined && !/^#[a-f0-9]{6}$/i.test(data[key]!)) throw new Error('Use a six-digit material color.');
  if (new TextEncoder().encode(JSON.stringify(v)).length > 8000) fail();
  return structuredClone(data);
}
export function compatibleModuleJoin(leftId: string, rightId: string, side: 'left' | 'right' = 'right'): { valid: boolean; reason: string } {
  const a = modularPorts[leftId], b = modularPorts[rightId];
  if (!a || !b) return { valid: false, reason: 'This module has no reviewed side-join metadata.' };
  if (!['left', 'right'].includes(side) || a.family !== b.family || a.depth !== b.depth || a.height !== b.height) return { valid: false, reason: 'Join modules from the same family with the same depth, height and front direction.' };
  return { valid: true, reason: `Aligned ${a.depth} mm deep × ${a.height} mm high; adjacent authored side panels touch.` };
}
export function modularKit(input: ModularConfiguration): { kit: FurnitureKit; joins: { leftId: string; rightId: string; x: number; valid: boolean; reason: string }[]; spanMm: number; depthMm: number; heightMm: number } {
  const configuration = parseModularConfiguration(input), pieces: FurnitureKit['pieces'] = [], joins: { leftId: string; rightId: string; x: number; valid: boolean; reason: string }[] = [];
  let cursor = 0;
  for (let i = 0; i < configuration.modules.length; i++) {
    const component = configuration.modules[i], item = byId.get(component.catalogId)!;
    if (i) { const previous = configuration.modules[i - 1], joint = compatibleModuleJoin(previous.catalogId, component.catalogId); if (!joint.valid) throw new Error(joint.reason); joins.push({ leftId: previous.id, rightId: component.id, x: cursor, ...joint }); }
    const materialColors: Record<string, string> = {};
    if (configuration.woodColor) materialColors['wood-honey-textured'] = configuration.woodColor;
    // The shelf module has no hardware material. Don't save a fictitious color role.
    if (configuration.hardwareColor && component.catalogId !== 'closet-shelf-module') materialColors['modern-brushed-aluminum'] = configuration.hardwareColor;
    pieces.push({ catalogId: component.catalogId, x: cursor + item.widthMm / 2, z: 0, rotation: 0, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, variant: configuration.variant, ...(Object.keys(materialColors).length ? { materialColors } : {}), ...(configuration.family === 'kitchen-base' ? { surfaceVariant: configuration.surfaceVariant } : {}) });
    cursor += item.widthMm;
  }
  const first = pieces[0], date = '2026-09-29T00:00:00.000Z';
  return { kit: parseFurnitureKit({ version: 1, id: 'modular-draft', name: configuration.family === 'closet' ? 'Walk-in closet run' : 'Kitchen base run', createdAt: date, updatedAt: date, pieces }), joins, spanMm: cursor, depthMm: first.depthMm, heightMm: first.heightMm };
}
export function modularSpanMessage(input: ModularConfiguration, availableWidthMm?: number): string {
  const { spanMm } = modularKit(input);
  if (availableWidthMm === undefined) return `Exact authored span: ${spanMm} mm. No module has been stretched.`;
  if (!Number.isFinite(availableWidthMm) || availableWidthMm < 1 || availableWidthMm > 50000) return 'Enter a wall width between 1 mm and 50 m to compare the exact authored span.';
  const difference = availableWidthMm - spanMm;
  return difference === 0 ? `Exact fit at ${spanMm} mm before site tolerances.` : difference > 0 ? `Actual span ${spanMm} mm leaves ${difference} mm. Fillers and arbitrary widths are not modeled.` : `Actual span ${spanMm} mm exceeds the available width by ${-difference} mm. Choose fewer or narrower modules.`;
}
export function buildModularPlacement(base: PlanDocumentV1, current: PlanDocumentV1, floorId: string, input: ModularConfiguration, position: KitPosition): KitPreviewRequest {
  if (base !== current) throw new Error('The project changed. Preview this assembly again.');
  const configuration = parseModularConfiguration(input), { kit } = modularKit(configuration), placed = buildKitPlacement(base, floorId, kit, position);
  let candidate = placed.plan;
  if (configuration.group && placed.addedIds.length > 1) {
    const grouped = applyFurnitureGroupCommand(candidate, candidate, floorId, { type: 'group', ids: placed.addedIds, name: kit.name }, validatePlan); candidate = grouped.plan;
    if (configuration.lock) { const group = candidate.furnitureGroups!.groups.find(g => g.memberIds.includes(placed.addedIds[0]))!; candidate = applyFurnitureGroupCommand(candidate, candidate, floorId, { type: 'lock-group', groupId: group.id, locked: true }, validatePlan).plan; }
  } else if (configuration.lock) candidate = applyFurnitureGroupCommand(candidate, candidate, floorId, { type: 'lock-items', ids: placed.addedIds, locked: true }, validatePlan).plan;
  assertLockedFurnitureUnchanged(base, candidate);
  return { ...placed, plan: candidate, base, label: `${kit.name} · ${kitBounds(kit).width} mm`, floorId };
}
