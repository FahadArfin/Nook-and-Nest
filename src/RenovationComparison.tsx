import { useMemo, useState } from 'react';
import { comparisonBounds } from './LayoutComparison';
import { floorBoundaryWalls, floorRects } from './floorGeometry';
import type { LayoutSnapshot } from './layoutAlternatives';
import type { FurniturePlacement, Opening, StairPlacement, WallSegment } from './types';
import { filterPhaseChanges, type PhaseChange, type PhaseEntity, type PhaseFilters, type PhaseStatus } from './designHistory';
const statusNames = { keep: 'Keep', remove: 'Remove', new: 'New', changed: 'Changed' } as const;
const polygonPath = (points: { x: number; z: number }[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.z}`).join(' ') + 'Z';
function footprint(p: { x: number; z: number; widthMm: number; depthMm: number; rotation: number }) {
  const a = p.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return polygonPath([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => ({ x: p.x + dx * p.widthMm / 2 * c + dz * p.depthMm / 2 * s, z: p.z - dx * p.widthMm / 2 * s + dz * p.depthMm / 2 * c })));
}
function entityPath(entity: PhaseEntity, layout: LayoutSnapshot): string {
  const floor = layout.floors.find(f => f.id === entity.floorId); if (!floor) return '';
  if (entity.kind === 'floor') return floorRects(floor, layout.gridSizeMm).map(r => polygonPath(r.polygon ?? [{ x: r.x, z: r.z }, { x: r.x + r.width, z: r.z }, { x: r.x + r.width, z: r.z + r.depth }, { x: r.x, z: r.z + r.depth }])).join(' ');
  if (entity.kind === 'furniture') return footprint(entity.value as FurniturePlacement);
  if (entity.kind === 'stairs') { const s = entity.value as StairPlacement; return footprint({ ...s, depthMm: s.lengthMm }); }
  if (entity.kind === 'wall' || entity.kind === 'wall-cut') { const wall = entity.value as WallSegment; return `M${wall.ax * layout.gridSizeMm} ${wall.az * layout.gridSizeMm}L${wall.bx * layout.gridSizeMm} ${wall.bz * layout.gridSizeMm}`; }
  const opening = entity.value as Opening, wall = [...floor.walls, ...floorBoundaryWalls(floor, layout.gridSizeMm)].find(w => w.id === opening.wallKey);
  if (!wall) return '';
  const dx = (wall.bx - wall.ax) * layout.gridSizeMm, dz = (wall.bz - wall.az) * layout.gridSizeMm, length = Math.hypot(dx, dz);
  if (!length) return '';
  const x = wall.ax * layout.gridSizeMm + dx * opening.offset, z = wall.az * layout.gridSizeMm + dz * opening.offset;
  return `M${x - dx / length * opening.widthMm / 2} ${z - dz / length * opening.widthMm / 2}L${x + dx / length * opening.widthMm / 2} ${z + dz / length * opening.widthMm / 2}`;
}
/** Two bounded SVG views, no second live 3D scene. Filters are visual only. */
export function RenovationComparison({ existing, proposed, revision, changes, filters, initialFloorId }: { existing: LayoutSnapshot; proposed: LayoutSnapshot; revision: number; changes: PhaseChange[]; filters: PhaseFilters; initialFloorId: string }) {
  const [chosen, setChosen] = useState(initialFloorId);
  const floors = useMemo(() => [...new Map([...existing.floors, ...proposed.floors].map(f => [f.id, f])).values()], [existing, proposed]);
  const floorId = filters.floorId ?? (floors.some(f => f.id === chosen) ? chosen : floors[0]?.id);
  const viewBox = useMemo(() => comparisonBounds([existing, proposed], floorId), [existing, proposed, floorId]);
  const shown = useMemo(() => filterPhaseChanges(changes, { ...filters, floorId }), [changes, filters, floorId]);
  const paths = useMemo(() => (['before', 'after'] as const).map((side, index) => {
    const layout = index ? proposed : existing, result: Record<PhaseStatus, string> = { keep: '', remove: '', new: '', changed: '' };
    // A single path per status bounds DOM cost even on densely furnished plans.
    for (const change of shown.slice(0, 3000)) { const entity = change[side]; if (entity?.floorId === floorId) result[change.status] += entityPath(entity, layout) + ' '; }
    return result;
  }), [shown, existing, proposed, floorId]);
  return <section className="renovation-comparison" aria-label="Existing and Proposed phase comparison"><div className="history-actions" role="group" aria-label="Phase comparison floor">{floors.map(f => <button type="button" key={f.id} disabled={!!filters.floorId} aria-pressed={floorId === f.id} onClick={() => setChosen(f.id)}>{f.name}</button>)}</div><div className="renovation-views">{['Existing · baseline', `Proposed · revision ${revision}`].map((label, i) => <figure key={label}><figcaption>{label}</figcaption><svg viewBox={viewBox} role="img" aria-label={`${label}, same-scale planning diagram`}>{(['keep', 'remove', 'new', 'changed'] as const).map(status => <path key={status} d={paths[i][status]} className={`renovation-shape ${status}`} vectorEffect="non-scaling-stroke"/>)}</svg></figure>)}</div><p className="history-muted">Same scale and position · filtered planning outlines only. {(['keep', 'remove', 'new', 'changed'] as const).map(status => <span className={`history-status ${status}`} key={status}>{statusNames[status]} </span>)} {shown.length > 3000 && 'First 3,000 matching entities shown; the export includes every change.'}</p></section>;
}
