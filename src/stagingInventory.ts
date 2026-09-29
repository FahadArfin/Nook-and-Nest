/** Private professional inventory. None of these records belong in PlanDocument. */
export const STAGING_LIMITS = { bodyBytes: 24_000, workspaces: 5, units: 500, reservations: 2000, unitsPerReservation: 50, calendarPage: 100, days: 366, revisions: 200 } as const;
export const STOCK_CONDITIONS = ['good', 'fair', 'damaged', 'missing'] as const;
export type StockCondition = typeof STOCK_CONDITIONS[number];
export type StagingRole = 'owner' | 'manager' | 'viewer';
export type StockUnit = { id: string; stockCode: string; label: string; catalogId: string; widthMm: number; depthMm: number; heightMm: number; condition: StockCondition; retired: boolean; revision: number };
export type StagingReservation = { id: string; propertyLabel: string; start: string; end: string; state: 'reserved' | 'packed' | 'completed' | 'cancelled'; revision: number; unitCount: number };
export type ReservationUnit = StockUnit & { status: 'reserved' | 'packed' | 'returned' | 'cancelled'; conditionOut: StockCondition; conditionIn: StockCondition | null; returnNote: string | null; packedAt: string | null; returnedAt: string | null };
export type StagingEvent = { id: number; kind: string; unitId: string | null; reservationId: string | null; at: string; detail: Record<string, unknown> };
export type ReservationDetail = { reservation: StagingReservation; units: ReservationUnit[]; events: StagingEvent[] };
export type StockUnitDetail = { unit: StockUnit; events: StagingEvent[]; next: number | null };
export type StagingCatalogEntry = { id: string; name: string; widthMm: number; depthMm: number; heightMm: number };
export type StagingVisualProxy = Pick<StockUnit, 'catalogId' | 'widthMm' | 'depthMm' | 'heightMm'>;
export const stagingId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v);
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw Error('Unsupported inventory fields.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw Error(`Check ${name}.`);
  return value.trim();
}
function id(value: unknown): string { if (!stagingId(value)) throw Error('Invalid inventory identifier.'); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 2_000_000_000) throw Error('Refresh this record before changing it.'); return Number(value); }
function condition(value: unknown): StockCondition { if (!STOCK_CONDITIONS.includes(value as StockCondition)) throw Error('Choose a stock condition.'); return value as StockCondition; }
export function stagingDay(value: unknown): string {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw Error('Use a valid calendar date between 2000 and 2099.');
  return value;
}
/** Whole calendar days; end is the first day free again. No timezone conversion. */
export function stagingDateRange(start: unknown, end: unknown) {
  const a = stagingDay(start), b = stagingDay(end), days = (Date.parse(b)-Date.parse(a))/86_400_000;
  if (days < 1 || days > STAGING_LIMITS.days) throw Error('Choose a booking from 1 to 366 days; return date is the first free day.');
  return { start: a, end: b };
}
export const stagingOverlap = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end;
export const stagingEventLabel = (kind: string): string => ({'unit.created':'Stock registered','unit.updated':'Stock condition updated','reservation.reserved':'Reservation confirmed','reservation.packed':'Pack list updated','reservation.completed':'All units returned','reservation.cancelled':'Reservation cancelled','unit.packed':'Unit packed','unit.returned':'Unit returned','unit.cancelled':'Unit released from reservation'}[kind]??'Inventory record updated');
export function parseStockUnit(value: unknown, catalog: readonly StagingCatalogEntry[]) {
  const v = record(value, ['requestId','stockCode','label','catalogId','widthMm','depthMm','heightMm','condition']);
  const catalogId = id(v.catalogId); if (!catalog.some(c => c.id === catalogId)) throw Error('Choose an existing catalog proxy.');
  const dimensions = {} as Pick<StockUnit,'widthMm'|'depthMm'|'heightMm'>;
  for (const k of ['widthMm','depthMm','heightMm'] as const) { if (!Number.isSafeInteger(v[k]) || Number(v[k]) < 10 || Number(v[k]) > 20_000) throw Error('Enter measured stock dimensions from 10 to 20,000 mm.'); dimensions[k]=Number(v[k]); }
  return { requestId:id(v.requestId), stockCode:text(v.stockCode,48,'the physical stock code'), label:text(v.label,100,'the stock label'), catalogId, ...dimensions, condition:condition(v.condition) };
}
export function parseReservation(value: unknown) {
  const v=record(value,['requestId','propertyLabel','start','end','unitIds']);
  if (!Array.isArray(v.unitIds) || !v.unitIds.length || v.unitIds.length > STAGING_LIMITS.unitsPerReservation) throw Error('Choose 1 to 50 individual stock units.');
  const unitIds=v.unitIds.map(id).sort(); if(new Set(unitIds).size!==unitIds.length) throw Error('Choose each physical unit once.');
  return { requestId:id(v.requestId), propertyLabel:text(v.propertyLabel,100,'the private property label'), ...stagingDateRange(v.start,v.end), unitIds };
}
export function parseStockUpdate(value: unknown) {
  const v=record(value,['expectedRevision','condition','retired']); if(typeof v.retired!=='boolean')throw Error('Choose active or retired.');
  return {expectedRevision:revision(v.expectedRevision),condition:condition(v.condition),retired:v.retired};
}
export function parseReservationAction(value: unknown, action: string) {
  const v=record(value,action==='return'?['expectedRevision','unitId','condition','note']:['expectedRevision']);
  const base={expectedRevision:revision(v.expectedRevision)};
  if(action!=='return')return base;
  const note=v.note===''?'':text(v.note,300,'a return note');
  return {...base,unitId:id(v.unitId),condition:condition(v.condition),note};
}
export function parseWorkspace(value: unknown) { const v=record(value,['name']); return {name:text(v.name,80,'the inventory name')}; }
/** New object with only ordinary catalog/dimension fields. No account, stock or reservation identity. */
export function toStagingVisualProxy(unit: StockUnit, catalog: readonly StagingCatalogEntry[]): StagingVisualProxy | null {
  if(!catalog.some(c=>c.id===unit.catalogId))return null;
  return {catalogId:unit.catalogId,widthMm:unit.widthMm,depthMm:unit.depthMm,heightMm:unit.heightMm};
}
export const stagingSample = {
  units: [
    {id:'sample-sofa-01',stockCode:'SOFA-001',label:'Sample linen sofa',catalogId:'sofa',widthMm:2200,depthMm:950,heightMm:850,condition:'good',retired:false,revision:1},
    {id:'sample-sofa-02',stockCode:'SOFA-002',label:'Sample linen sofa',catalogId:'sofa',widthMm:2200,depthMm:950,heightMm:850,condition:'fair',retired:false,revision:1},
    {id:'sample-table-01',stockCode:'TABLE-001',label:'Sample coffee table',catalogId:'coffee-table',widthMm:1000,depthMm:600,heightMm:450,condition:'damaged',retired:false,revision:2},
  ] as StockUnit[],
  reservations: [{id:'sample-booking-01',propertyLabel:'Sample property A',start:'2026-10-01',end:'2026-10-08',state:'reserved',revision:1,unitCount:1}] as StagingReservation[],
  events: [{id:1,kind:'unit.created',unitId:'sample-table-01',reservationId:null,at:'2026-09-01T09:00:00.000Z',detail:{condition:'good'}},{id:2,kind:'unit.updated',unitId:'sample-table-01',reservationId:null,at:'2026-09-15T09:00:00.000Z',detail:{condition:'damaged'}}] as StagingEvent[],
};
