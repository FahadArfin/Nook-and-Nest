import {describe, expect, it} from 'vitest';
import {catalog} from '../src/catalog';
import {createSamplePlan, rectangleCells} from '../src/domain';
import {applyFurnitureGroupCommand} from '../src/furnitureGroups';
import {kitBounds} from '../src/furnitureKits';
import {validatePlan} from '../src/planValidation';
import {usePlanner} from '../src/store';
import {buildModularPlacement, compatibleModuleJoin, defaultModularConfiguration, MAX_MODULAR_COMPONENTS, modularKit, modularPorts, modularSpanMessage, parseModularConfiguration} from '../src/modularFamilyBuilder';

function room() {
  const plan = createSamplePlan('Authored cabinet run', 'metric');
  plan.gridSizeMm = 1000;
  plan.floors = plan.floors.map(floor => ({...floor, cells: rectangleCells(12, 12)}));
  plan.furniture = [];
  return plan;
}

describe('authored modular cabinet runs', () => {
  it('uses catalog dimensions for every supported module and places exact adjacent side boundaries', () => {
    for (const family of ['closet', 'kitchen-base'] as const) {
      const configuration = defaultModularConfiguration(family);
      configuration.modules = Object.entries(modularPorts).filter(([, port]) => port.family === family).map(([catalogId], index) => ({id: `component-${index}`, catalogId}));
      const assembly = modularKit(configuration);
      const originals = assembly.kit.pieces.map(piece => catalog.find(item => item.id === piece.catalogId)!);
      expect(assembly.spanMm).toBe(originals.reduce((sum, item) => sum + item.widthMm, 0));
      expect(kitBounds(assembly.kit).width).toBe(assembly.spanMm);
      for (const [index, piece] of assembly.kit.pieces.entries()) {
        const original = originals[index];
        expect(piece).toMatchObject({widthMm: original.widthMm, depthMm: original.depthMm, heightMm: original.heightMm, rotation: 0});
        if (index > 0) {
          const previous = assembly.kit.pieces[index - 1];
          expect(previous.x + previous.widthMm / 2).toBe(piece.x - piece.widthMm / 2);
          expect(assembly.joins[index - 1]).toMatchObject({valid: true, x: piece.x - piece.widthMm / 2});
        }
      }
      expect(assembly.joins).toHaveLength(configuration.modules.length - 1);
    }
  });

  it('rejects fabricated connectors, mixed families, corners, mirrored ends, stretched dimensions and oversized runs', () => {
    expect(compatibleModuleJoin('closet-hanging-module', 'push-base-cabinet').valid).toBe(false);
    expect(compatibleModuleJoin('closet-corner-module', 'closet-shelf-module').valid).toBe(false);
    expect(compatibleModuleJoin('closet-shelf-module', 'closet-hanging-module', 'left').valid).toBe(true);
    expect(compatibleModuleJoin('closet-shelf-module', 'closet-hanging-module', 'front' as 'left').valid).toBe(false);
    const config = defaultModularConfiguration();
    for (const invalid of [
      {...config, family: 'sectional'}, {...config, widthMm: 1800}, {...config, modules: []},
      {...config, modules: [{id: 'one', catalogId: 'closet-corner-module'}]},
      {...config, modules: [{id: 'one', catalogId: 'push-base-cabinet'}]},
      {...config, modules: [{...config.modules[0], mirrored: true}]},
      {...config, modules: [{...config.modules[0], widthMm: 880}]},
      {...config, modules: [config.modules[0], config.modules[0]]},
      {...config, modules: Array.from({length: MAX_MODULAR_COMPONENTS + 1}, (_, index) => ({...config.modules[0], id: `part-${index}`}))},
    ]) expect(() => parseModularConfiguration(invalid)).toThrow();
  });

  it('assigns only real authored material slots and explains actual span without inventing fillers', () => {
    const config = {...defaultModularConfiguration(), woodColor: '#aabbcc', hardwareColor: '#223344'};
    const pieces = modularKit(config).kit.pieces;
    expect(pieces[0].materialColors).toEqual({'wood-honey-textured': '#aabbcc', 'modern-brushed-aluminum': '#223344'});
    expect(pieces[1].materialColors).toEqual({'wood-honey-textured': '#aabbcc'});
    expect(pieces.every(piece => piece.surfaceVariant === undefined)).toBe(true);
    const kitchen = modularKit({...defaultModularConfiguration('kitchen-base'), surfaceVariant: 'ivory-marble'});
    expect(kitchen.kit.pieces.every(piece => piece.surfaceVariant === 'ivory-marble')).toBe(true);
    expect(modularSpanMessage(config, 1800)).toContain('1500 mm leaves 300 mm');
    expect(modularSpanMessage(config, 1400)).toContain('exceeds the available width by 100 mm');
    expect(modularSpanMessage(config, 1500)).toContain('Exact fit at 1500 mm');
    const parsed = parseModularConfiguration(config); parsed.modules[0].catalogId = 'closet-shelf-module';
    expect(config.modules[0].catalogId).toBe('closet-hanging-module');
  });

  it('stages independent grouped and locked pieces while preserving existing architecture, furniture and locks', () => {
    const base = room(), floorId = base.floors[0].id;
    const original = catalog.find(item => item.id === 'side-table')!;
    base.furniture = [{id: 'existing', catalogId: original.id, floorId, x: 1000, z: 1000, rotation: 0, widthMm: original.widthMm, depthMm: original.depthMm, heightMm: original.heightMm, variant: 'sage'}];
    base.furnitureGroups = {version: 1, groups: [], lockedItemIds: ['existing']};
    const before = structuredClone(base), config = {...defaultModularConfiguration(), lock: true, woodColor: '#aabbcc'};
    const result = buildModularPlacement(base, base, floorId, config, {x: 6000, z: 6000, rotation: 90});
    expect(result.base).toBe(base); expect(base).toEqual(before); expect(result.plan.floors).toBe(base.floors);
    expect(result.plan.furniture[0]).toBe(base.furniture[0]); expect(result.plan.furnitureGroups!.lockedItemIds).toEqual(['existing']);
    expect(result.addedIds).toHaveLength(2); expect(new Set(result.plan.furniture.map(piece => piece.id)).size).toBe(3);
    const group = result.plan.furnitureGroups!.groups[0];
    expect(group).toMatchObject({floorId, memberIds: result.addedIds, locked: true});
    expect(result.plan.furniture.slice(1).map(piece => [piece.widthMm, piece.depthMm, piece.heightMm, piece.rotation])).toEqual([[900, 600, 2200, 90], [600, 600, 2200, 90]]);
    const restored = JSON.parse(JSON.stringify(result.plan)); expect(() => validatePlan(restored)).not.toThrow();
    const unlocked = applyFurnitureGroupCommand(restored, restored, floorId, {type: 'lock-group', groupId: group.id, locked: false}, validatePlan).plan;
    const ungrouped = applyFurnitureGroupCommand(unlocked, unlocked, floorId, {type: 'ungroup', groupId: group.id}, validatePlan).plan;
    expect(ungrouped.furniture).toEqual(result.plan.furniture); expect(ungrouped.furnitureGroups!.groups).toEqual([]);
    expect(ungrouped.furnitureGroups!.lockedItemIds).toEqual(['existing']);
  });

  it('supports independent item locks without grouping and commits a full assembly in one reversible history step', () => {
    usePlanner.getState().replacePlan(room());
    const base = usePlanner.getState().plan, floorId = base.floors[0].id;
    const candidate = buildModularPlacement(base, base, floorId, {...defaultModularConfiguration(), group: false, lock: true}, {x: 5000, z: 5000, rotation: 0});
    expect(candidate.plan.furnitureGroups!.groups).toEqual([]);
    expect(candidate.plan.furnitureGroups!.lockedItemIds).toEqual(candidate.addedIds);
    expect(usePlanner.getState().plan).toBe(base); expect(usePlanner.getState().past).toHaveLength(0);
    usePlanner.getState().commitDesign(base, candidate.plan);
    expect(usePlanner.getState().past).toHaveLength(1); expect(usePlanner.getState().plan.furniture).toHaveLength(2);
    usePlanner.getState().undo(); expect(usePlanner.getState().plan).toEqual(base);
    expect(() => buildModularPlacement(base, {...base}, floorId, defaultModularConfiguration(), {x: 5000, z: 5000, rotation: 0})).toThrow('project changed');
  });
});
