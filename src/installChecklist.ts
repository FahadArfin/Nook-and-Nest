import { buildSelectionSchedule } from './selectionSchedule';
import type { PlanDocumentV1 } from './types';

export const MAX_INSTALL_ITEMS = 500, MAX_INSTALL_TASKS = 160, MAX_INSTALL_ROOMS = 40, MAX_INSTALL_PHOTOS = 32, MAX_INSTALL_BYTES = 256_000;
export type InstallTemplate = 'install' | 'photo-day';
export type InstallState = 'unknown' | 'todo' | 'done' | 'blocked';
export type InstallSourceStatus = 'unknown' | 'owned' | 'wishlist' | 'selected' | 'ordered';
export interface InstallRoom { floorId: string; floorName: string; roomKey: string; roomName: string }
export interface InstallItem extends InstallRoom {
  placementId: string; catalogId: string; name: string; signature: string;
  dimensions: { widthMm: number; depthMm: number; heightMm: number };
  sourceStatus: InstallSourceStatus; roomWarning?: string; present: boolean; needsReview: boolean;
  packing: 'unknown' | 'include' | 'exclude'; delivery: 'unknown' | 'pending' | 'received';
}
export interface InstallTask {
  id: string; title: string; floorId?: string; roomKey?: string; itemId?: string;
  state: InstallState; assignee?: string; dueDate?: string; note?: string;
  photoAssetIds: string[]; evidenceRevision: string; needsReview: boolean;
}
export interface InstallChecklist {
  version: 1; id: string; template: InstallTemplate; projectId: string; projectName: string;
  createdAt: string; capturedAt: string; revision: { fingerprint: string; planUpdatedAt: string };
  rooms: InstallRoom[]; items: InstallItem[]; tasks: InstallTask[];
}
export type InstallPlan = PlanDocumentV1 & { installChecklist?: InstallChecklist };
const photoId = /^sha256:[a-f0-9]{64}$/;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
const validDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const validTime = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(v) && validDate(v.slice(0, 10)) && Number.isFinite(Date.parse(v));
const roomId = (v: InstallRoom) => JSON.stringify([v.floorId, v.roomKey]);
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
function fingerprint(value: unknown): string {
  const raw = JSON.stringify(value); let a = 2166136261, b = 5381;
  for (let i = 0; i < raw.length; i++) { a = Math.imul(a ^ raw.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ raw.charCodeAt(i); }
  return `${raw.length}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}
/** A change indicator, never an authorization token. Metadata saves do not stale their own capture. */
export function installRevision(plan: PlanDocumentV1): string {
  return fingerprint({ id: plan.id, name: plan.name, gridSizeMm: plan.gridSizeMm, floors: plan.floors.map(({ referenceId: _reference, ...floor }) => floor), furniture: plan.furniture, environment: plan.environment });
}
export function parseInstallChecklist(value: unknown): InstallChecklist {
  function fail(): never { throw new Error('This installation checklist is invalid or exceeds its bounded limits.'); }
  if (!record(value) || !keys(value, ['version', 'id', 'template', 'projectId', 'projectName', 'createdAt', 'capturedAt', 'revision', 'rooms', 'items', 'tasks']) || value.version !== 1 || !text(value.id, 100) || !text(value.projectId, 160) || !text(value.projectName, 160) || !['install', 'photo-day'].includes(String(value.template)) || !validTime(value.createdAt) || !validTime(value.capturedAt)) fail();
  if (!record(value.revision) || !keys(value.revision, ['fingerprint', 'planUpdatedAt']) || !text(value.revision.fingerprint, 80) || !validTime(value.revision.planUpdatedAt)) fail();
  if (!Array.isArray(value.rooms) || value.rooms.length > MAX_INSTALL_ROOMS || !Array.isArray(value.items) || value.items.length > MAX_INSTALL_ITEMS || !Array.isArray(value.tasks) || value.tasks.length > MAX_INSTALL_TASKS) fail();
  const roomKeys = new Set<string>(), itemIds = new Set<string>(), taskIds = new Set<string>(); let photos = 0;
  const roomFields = ['floorId', 'floorName', 'roomKey', 'roomName'];
  const validRoom = (r: Record<string, unknown>) => text(r.floorId, 160) && text(r.floorName, 160) && text(r.roomKey, 160) && text(r.roomName, 160);
  for (const r of value.rooms) {
    if (!record(r) || !keys(r, roomFields) || !validRoom(r)) fail();
    const key = roomId(r as unknown as InstallRoom); if (roomKeys.has(key)) fail(); roomKeys.add(key);
  }
  for (const item of value.items) {
    if (!record(item) || !keys(item, [...roomFields, 'placementId', 'catalogId', 'name', 'signature', 'dimensions', 'sourceStatus', 'roomWarning', 'present', 'needsReview', 'packing', 'delivery']) || !validRoom(item) || !text(item.placementId, 160) || itemIds.has(item.placementId) || !text(item.catalogId, 160) || !text(item.name, 160) || !text(item.signature, 80) || !roomKeys.has(roomId(item as unknown as InstallRoom))) fail();
    const d = item.dimensions;
    if (!record(d) || !keys(d, ['widthMm', 'depthMm', 'heightMm']) || ![d.widthMm, d.depthMm, d.heightMm].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100_000)) fail();
    if (!['unknown', 'owned', 'wishlist', 'selected', 'ordered'].includes(String(item.sourceStatus)) || !['unknown', 'include', 'exclude'].includes(String(item.packing)) || !['unknown', 'pending', 'received'].includes(String(item.delivery)) || typeof item.present !== 'boolean' || typeof item.needsReview !== 'boolean' || item.roomWarning !== undefined && !text(item.roomWarning, 600)) fail();
    itemIds.add(item.placementId);
  }
  for (const task of value.tasks) {
    if (!record(task) || !keys(task, ['id', 'title', 'floorId', 'roomKey', 'itemId', 'state', 'assignee', 'dueDate', 'note', 'photoAssetIds', 'evidenceRevision', 'needsReview']) || !text(task.id, 100) || taskIds.has(task.id) || !text(task.title, 160) || !['unknown', 'todo', 'done', 'blocked'].includes(String(task.state)) || !text(task.evidenceRevision, 80) || typeof task.needsReview !== 'boolean') fail();
    if ((task.floorId === undefined) !== (task.roomKey === undefined) || task.floorId !== undefined && (!text(task.floorId, 160) || !text(task.roomKey, 160) || !roomKeys.has(JSON.stringify([task.floorId, task.roomKey]))) || task.itemId !== undefined && (!text(task.itemId, 160) || !itemIds.has(task.itemId))) fail();
    if (task.assignee !== undefined && !text(task.assignee, 100) || task.dueDate !== undefined && !validDate(task.dueDate) || task.note !== undefined && !text(task.note, 1200)) fail();
    if (!Array.isArray(task.photoAssetIds) || task.photoAssetIds.length > 4 || new Set(task.photoAssetIds).size !== task.photoAssetIds.length || !task.photoAssetIds.every(id => typeof id === 'string' && photoId.test(id))) fail();
    photos += task.photoAssetIds.length; taskIds.add(task.id);
  }
  if (photos > MAX_INSTALL_PHOTOS) throw new Error('Use up to 32 photo references per checklist.');
  if (bytes(value) > MAX_INSTALL_BYTES) throw new Error('Checklist metadata exceeds 256 KB. Track fewer pieces or shorten the notes.');
  return structuredClone(value) as unknown as InstallChecklist;
}
export function installCandidates(plan: PlanDocumentV1): InstallItem[] {
  const placements = new Map(plan.furniture.map(p => [p.id, p]));
  return buildSelectionSchedule(plan).rows.map(row => {
    const p = placements.get(row.id)!;
    const sourceStatus: InstallSourceStatus = p.specification?.status ?? (p.personalItem?.status === 'keep' ? 'owned' : 'unknown');
    const room = { floorId: row.floorId, floorName: row.floorName, roomKey: row.room.key, roomName: row.room.name };
    return { ...room, placementId: p.id, catalogId: p.catalogId, name: row.name, dimensions: row.dimensions, sourceStatus, ...(row.room.warning ? { roomWarning: row.room.warning } : {}), signature: fingerprint({ placement: p, room }), present: true, needsReview: false, packing: 'unknown', delivery: 'unknown' };
  });
}
function capturedItems(plan: PlanDocumentV1, ids: string[]): InstallItem[] {
  if (ids.length > MAX_INSTALL_ITEMS || new Set(ids).size !== ids.length) throw new Error(`Choose up to ${MAX_INSTALL_ITEMS} distinct placed items.`);
  const candidates = new Map(installCandidates(plan).map(i => [i.placementId, i]));
  return ids.map(id => { const row = candidates.get(id); if (!row) throw new Error('A chosen item no longer exists. Update the selection.'); return row; });
}
function roomsFor(items: InstallItem[]): InstallRoom[] {
  return [...new Map(items.map(({ floorId, floorName, roomKey, roomName }) => [JSON.stringify([floorId, roomKey]), { floorId, floorName, roomKey, roomName }])).values()];
}
export function captureInstallChecklist(plan: PlanDocumentV1, template: InstallTemplate, ids: string[], now = new Date().toISOString(), allocateId = () => crypto.randomUUID()): InstallChecklist {
  const items = capturedItems(plan, ids), rooms = roomsFor(items), revision = installRevision(plan);
  if (rooms.length > MAX_INSTALL_ROOMS) throw new Error('Track up to 40 rooms in one checklist. Narrow the chosen pieces by floor or room.');
  const titles = template === 'install' ? ['Confirm site measurements and access', 'Check placement and assembly', 'Record condition and outstanding work'] : ['Tidy and style the room', 'Check lighting and visible personal details', 'Confirm photo views and permissions'];
  const task = (title: string, room?: InstallRoom): InstallTask => ({ id: allocateId(), title, ...(room ? { floorId: room.floorId, roomKey: room.roomKey } : {}), state: 'unknown', photoAssetIds: [], evidenceRevision: revision, needsReview: false });
  const tasks = [task(template === 'install' ? 'Confirm access, people and delivery plan' : 'Confirm photo purpose, people and privacy'), ...rooms.flatMap(room => titles.map(title => task(title, room)))];
  return parseInstallChecklist({ version: 1, id: allocateId(), template, projectId: plan.id, projectName: plan.name, createdAt: now, capturedAt: now, revision: { fingerprint: revision, planUpdatedAt: plan.updatedAt }, rooms, items, tasks });
}
export interface InstallReview { stale: boolean; differentProject: boolean; changed: InstallItem[]; removed: InstallItem[]; notIncluded: InstallItem[]; unchanged: InstallItem[] }
export function reviewInstallChecklist(plan: PlanDocumentV1, list: InstallChecklist): InstallReview {
  const current = installCandidates(plan), byId = new Map(current.map(i => [i.placementId, i])), captured = new Set(list.items.map(i => i.placementId));
  return { stale: installRevision(plan) !== list.revision.fingerprint, differentProject: plan.id !== list.projectId, changed: list.items.filter(i => i.present && byId.has(i.placementId) && byId.get(i.placementId)!.signature !== i.signature), removed: list.items.filter(i => i.present && !byId.has(i.placementId)), unchanged: list.items.filter(i => i.present && byId.get(i.placementId)?.signature === i.signature), notIncluded: current.filter(i => !captured.has(i.placementId)) };
}
/** Explicit refresh only: changed decisions retain their evidence but require individual review.
 * Task scopes retain original IDs, even after a move or room rename. No name-based reassignment.
 */
export function refreshInstallChecklist(plan: PlanDocumentV1, list: InstallChecklist, includeIds: string[], now = new Date().toISOString()): InstallChecklist {
  if (plan.id !== list.projectId) throw new Error('This checklist belongs to a different project.');
  const fresh = capturedItems(plan, includeIds), current = new Map(fresh.map(i => [i.placementId, i]));
  const old = new Map(list.items.map(i => [i.placementId, i]));
  const items = fresh.map(i => { const previous = old.get(i.placementId); return previous ? { ...i, packing: previous.packing, delivery: previous.delivery, needsReview: previous.needsReview || !previous.present || previous.signature !== i.signature } : i; });
  // Retired rows keep task/photo provenance and never count as active packing.
  for (const item of list.items) if (!current.has(item.placementId)) items.push({ ...item, present: false, needsReview: true });
  const rooms = [...new Map([...list.rooms, ...roomsFor(items)].map(r => [roomId(r), r])).values()];
  if (items.length > MAX_INSTALL_ITEMS || rooms.length > MAX_INSTALL_ROOMS) throw new Error('Retained evidence and new items exceed this checklist’s 500-piece or 40-room limit. Download the existing record, then start a replacement checklist with fewer pieces.');
  const changed = new Set(items.filter(i => i.needsReview).map(i => i.placementId)), oldRooms = new Set(list.items.filter(i => changed.has(i.placementId)).map(roomId));
  const stale = installRevision(plan) !== list.revision.fingerprint;
  const tasks = list.tasks.map(task => ({ ...task, needsReview: task.needsReview || (task.itemId ? changed.has(task.itemId) : task.floorId ? oldRooms.has(JSON.stringify([task.floorId, task.roomKey])) || stale : stale) }));
  return parseInstallChecklist({ ...list, capturedAt: now, projectName: plan.name, revision: { fingerprint: installRevision(plan), planUpdatedAt: plan.updatedAt }, rooms, items, tasks });
}
export function updateInstallChecklist(base: InstallPlan, current: InstallPlan, value: InstallChecklist | undefined, validate: (plan: unknown) => void): InstallPlan {
  if (base !== current) throw new Error('The project changed. Reopen this checklist edit before saving.');
  const { installChecklist: _old, ...rest } = base;
  const next: InstallPlan = value ? { ...rest, installChecklist: parseInstallChecklist(value) } : rest;
  if (value && value.projectId !== base.id) throw new Error('This checklist belongs to a different project.');
  if (bytes(next) > 8_000_000) throw new Error('This project exceeds the 8 MB save limit.'); validate(next); return next;
}
export function packingSummary(list: InstallChecklist) {
  const active = list.items.filter(i => i.present), included = active.filter(i => i.packing === 'include' && !i.needsReview);
  return { included, count: included.length, owned: included.filter(i => i.sourceStatus === 'owned').length, selected: included.filter(i => i.sourceStatus === 'selected' || i.sourceStatus === 'ordered').length, wishlist: included.filter(i => i.sourceStatus === 'wishlist').length, unknownStatus: included.filter(i => i.sourceStatus === 'unknown').length, pending: included.filter(i => i.delivery === 'pending').length, received: included.filter(i => i.delivery === 'received').length, unknownDelivery: included.filter(i => i.delivery === 'unknown').length, undecided: active.filter(i => i.packing === 'unknown').length, needsReview: active.filter(i => i.needsReview).length };
}
export function installPhotoIds(value: InstallChecklist | undefined): string[] { return value ? [...new Set(value.tasks.flatMap(t => t.photoAssetIds))] : []; }
export function withoutInstallChecklist<T extends { installChecklist?: unknown }>(plan: T): Omit<T, 'installChecklist'> { const { installChecklist: _private, ...publicPlan } = plan; return publicPlan; }
const csv = (v: unknown) => '"' + (/^[\s]*[=+@-]/.test(String(v ?? '')) ? "'" : '') + String(v ?? '').replaceAll('"', '""') + '"';
const html = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function installChecklistCsv(list: InstallChecklist, currentRevision?: string): string {
  const rows: unknown[][] = [['Project', list.projectName], ['Captured revision', list.revision.fingerprint], ['Captured at', list.capturedAt], ['Current revision', currentRevision ?? 'Not checked'], ['Review', currentRevision === list.revision.fingerprint ? 'Matches captured layout' : 'Compare with current layout'], ['Physical packing count', packingSummary(list).count], ['Private photo files', 'Stored locally; not embedded in this export'], [], ['Kind', 'Name', 'Floor', 'Room', 'Placement ID', 'State', 'Packing', 'Delivery', 'Ownership / selection', 'Assignee', 'Due', 'Notes', 'Review', 'Photos']];
  for (const i of list.items) rows.push(['Item', i.name, i.floorName, i.roomName, i.placementId, i.present ? 'Captured' : 'Retired / excluded', i.packing, i.delivery, i.sourceStatus, '', '', '', i.needsReview ? 'Required' : 'Checked at capture', '']);
  for (const t of list.tasks) { const r = list.rooms.find(r => r.floorId === t.floorId && r.roomKey === t.roomKey); rows.push(['Task', t.title, r?.floorName, r?.roomName, t.itemId, t.state, '', '', '', t.assignee, t.dueDate, t.note, t.needsReview ? 'Required' : 'Checked at capture', t.photoAssetIds.length]); }
  return '\uFEFF' + rows.map(row => row.map(csv).join(',')).join('\r\n');
}
export function installChecklistHtml(list: InstallChecklist, currentRevision?: string): string {
  const packing = packingSummary(list), room = (t: InstallTask) => list.rooms.find(r => r.floorId === t.floorId && r.roomKey === t.roomKey);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${html(list.projectName)} · Checklist</title><style>body{font:14px system-ui;color:#222;max-width:1000px;margin:30px auto;padding:16px}h1,h2{color:#3e5545}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:8px;text-align:left;border-bottom:1px solid #ccc;vertical-align:top;overflow-wrap:anywhere}small{display:block;color:#555}tr{break-inside:avoid}.notice{padding:12px;border:1px solid #aaa} @media print{body{margin:0;max-width:none}thead{display:table-header-group}h2{break-after:avoid}}</style></head><body><h1>${html(list.projectName)} · ${list.template === 'install' ? 'Ready for installation' : 'Ready for photos'}</h1><p>Captured ${html(list.capturedAt)} · Revision ${html(list.revision.fingerprint)}<small>Current revision: ${html(currentRevision ?? 'Not checked')}</small></p><p class="notice">${currentRevision === list.revision.fingerprint ? 'Layout matches this captured revision.' : 'Layout changes need review. This copy records the captured revision.'} Task completion records manual progress; it does not approve the design or verify installation. Unknown means not recorded.</p><h2>Tasks</h2><table><thead><tr><th>Task / captured room</th><th>Progress</th><th>Person / due</th><th>Notes / evidence</th></tr></thead><tbody>${list.tasks.map(t => `<tr><td>${html(t.title)}<small>${html(room(t)?.floorName ?? 'Project')} · ${html(room(t)?.roomName ?? 'All rooms')}</small>${t.itemId ? `<small>Placement ${html(t.itemId)}</small>` : ''}</td><td>${html(t.state)}${t.needsReview ? '<small>Review required</small>' : ''}</td><td>${html(t.assignee ?? 'Unassigned')}<small>${html(t.dueDate ?? 'No date')}</small></td><td>${html(t.note ?? '')}<small>${t.photoAssetIds.length} private photo(s); files not included</small></td></tr>`).join('')}</tbody></table><h2>Packing · ${packing.count} explicitly included physical pieces</h2><p>${packing.owned} owned · ${packing.selected} selected/ordered · ${packing.wishlist} wishlist · ${packing.unknownStatus} status unknown. ${packing.received} received · ${packing.pending} pending delivery · ${packing.unknownDelivery} delivery unknown. ${packing.undecided} packing choices unknown; ${packing.needsReview} items require review and are excluded from this count. Purchase pack quantities do not multiply placed pieces.</p><table><thead><tr><th>Item / captured room</th><th>Source / delivery</th><th>Packing / review</th></tr></thead><tbody>${list.items.map(i => `<tr><td>${html(i.name)}<small>${html(i.floorName)} · ${html(i.roomName)} · ${html(i.placementId)}</small><small>${i.dimensions.widthMm} × ${i.dimensions.depthMm} × ${i.dimensions.heightMm} mm</small></td><td>${html(i.sourceStatus)}<small>${html(i.delivery)}</small></td><td>${i.present ? html(i.packing) : 'Retired — excluded'}${i.needsReview ? '<small>Review required</small>' : ''}</td></tr>`).join('')}</tbody></table><p>Assignees, dates, notes and photo references are private project information. Share this downloaded copy deliberately. Local photo files remain in your private media store and backup.</p></body></html>`;
}
export function downloadInstallChecklist(list: InstallChecklist, format: 'csv' | 'html', currentRevision?: string): void {
  const blob = new Blob([format === 'csv' ? installChecklistCsv(list, currentRevision) : installChecklistHtml(list, currentRevision)], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `nook-and-nest-${list.template}-checklist.${format}`;
  try { anchor.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export function printInstallChecklist(list: InstallChecklist, currentRevision?: string): void {
  const page = window.open('about:blank', '_blank'); if (!page) throw new Error('Allow the printable checklist window, then try again.');
  page.opener = null; page.document.open(); page.document.write(installChecklistHtml(list, currentRevision)); page.document.close(); page.focus(); page.setTimeout(() => page.print(), 100);
}
