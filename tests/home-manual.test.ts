import {describe,expect,it,vi} from 'vitest';
import {createBlankPlan} from '../src/domain';
import {completeHomeMaintenance,filterHomeManualRecords,homeManualHtml,homeRecordStatus,localCalendarDay,parseHomeManual,removeHomeManualRecord,resolveHomeFurniture,saveHomeManualRecord,type HomeManualRecord} from '../src/homeManual';

const record=(changes:Partial<HomeManualRecord>={}):HomeManualRecord=>({id:'washer-record',name:'Laundry washer',notes:'Keep the filter clean',maintenanceTask:'Clean the filter',nextMaintenanceOn:'2026-10-03',history:[],...changes});
const fixture=()=>{const p=createBlankPlan('Our home','metric');p.furniture=[{id:'washer',floorId:p.floors[0].id,catalogId:'washer',x:0,z:0,widthMm:600,depthMm:600,heightMm:850,rotation:0,variant:'white'}];return p;};
const manual=(item=record())=>({version:1 as const,records:[item]});

describe('private home manual',()=>{
  it('keeps blank optional dates unknown and validates actual leap/calendar days',()=>{
    const parsed=parseHomeManual(manual(record({purchasedOn:'',warrantyEndsOn:'',nextMaintenanceOn:''})));
    expect(parsed.records[0].purchasedOn).toBeUndefined();expect(parsed.records[0].nextMaintenanceOn).toBeUndefined();
    expect(parseHomeManual(manual(record({purchasedOn:'2024-02-29'}))).records[0].purchasedOn).toBe('2024-02-29');
    for(const day of ['2026-02-29','2026-04-31','2026-13-01','1900-02-29','0000-01-01','2026-2-03','2026-10-03T00:00:00Z'])expect(()=>parseHomeManual(manual(record({purchasedOn:day})))).toThrow(/date/i);
    expect(()=>parseHomeManual(manual(record({purchasedOn:'2026-10-03',warrantyEndsOn:'2026-01-01'})))).toThrow(/warranty/i);
  });
  it('classifies dates as local calendar days, including the warranty end day',()=>{
    const clock=new Date(2026,9,3,23,45);expect(localCalendarDay(clock)).toBe('2026-10-03');
    expect(homeRecordStatus(record({nextMaintenanceOn:'2026-10-02',warrantyEndsOn:'2026-10-03'}),'2026-10-03')).toEqual({maintenance:'overdue',warranty:'current'});
    expect(homeRecordStatus(record(),'2026-10-03').maintenance).toBe('due');
    expect(homeRecordStatus(record({nextMaintenanceOn:'2026-10-04'}),'2026-10-03').maintenance).toBe('upcoming');
    expect(homeRecordStatus(record({nextMaintenanceOn:undefined,warrantyEndsOn:'2026-10-02'}),'2026-10-03')).toEqual({maintenance:'unknown',warranty:'expired'});
  });
  it('rejects unsafe URLs, duplicate identities and unsupported private fields',()=>{
    for(const productUrl of ['javascript:alert(1)','data:text/html,test','file:///manual.pdf','https://name:password@example.com','https://example.com/\nprivate'])expect(()=>parseHomeManual(manual(record({productUrl})))).toThrow(/link/i);
    expect(parseHomeManual(manual(record({manualUrl:'https://example.com/manual.pdf?item=washer'}))).records[0].manualUrl).toContain('manual.pdf');
    expect(()=>parseHomeManual({version:1,records:[record(),record()]})).toThrow(/duplicate/i);
    expect(()=>parseHomeManual(manual({...record(),attachment:'private-file'} as HomeManualRecord))).toThrow(/unsupported/i);
    expect(()=>parseHomeManual(manual(record({history:[{id:'same',completedOn:'2026-01-01',task:'Clean',notes:''},{id:'same',completedOn:'2026-02-01',task:'Clean',notes:''}]})))).toThrow(/duplicate/i);
  });
  it('bounds records, history, text and UTF-8 metadata bytes without truncating',()=>{
    expect(()=>parseHomeManual({version:1,records:Array.from({length:101},(_,i)=>record({id:String(i)}))})).toThrow(/100/);
    expect(()=>parseHomeManual(manual(record({notes:'x'.repeat(2001)})))).toThrow(/long|2000/i);
    expect(()=>parseHomeManual(manual(record({history:Array.from({length:41},(_,i)=>({id:String(i),completedOn:'2026-01-01',task:'Clean',notes:''}))})))).toThrow(/40/);
    expect(()=>parseHomeManual({version:1,records:Array.from({length:60},(_,i)=>record({id:String(i),notes:'家'.repeat(2000)}))})).toThrow(/256|size/i);
  });
  it('saves atomically, retains missing furniture references and refuses stale writes',()=>{
    const p=fixture(),validate=vi.fn(),saved=saveHomeManualRecord(p,p,record({furnitureId:'washer'}),validate);
    expect(p.homeManual).toBeUndefined();expect(saved.homeManual?.records[0].furnitureId).toBe('washer');expect(validate).toHaveBeenCalledWith(saved);
    const missing={...saved,furniture:[]};expect(resolveHomeFurniture(missing,missing.homeManual!.records[0]).state).toBe('missing');
    const edited=saveHomeManualRecord(missing,missing,{...missing.homeManual!.records[0],notes:'Still have the appliance'},validate);
    expect(edited.homeManual?.records[0].furnitureId).toBe('washer');
    expect(()=>saveHomeManualRecord(saved,structuredClone(saved),record(),validate)).toThrow(/changed/i);
    expect(()=>removeHomeManualRecord(saved,structuredClone(saved),'washer-record',validate)).toThrow(/changed/i);
    expect(()=>saveHomeManualRecord(p,p,record({furnitureId:'missing'}),validate)).toThrow(/furniture/i);
  });
  it('records completed work and clears its old due date without inferring a recurrence',()=>{
    const p=fixture(),saved=saveHomeManualRecord(p,p,record(),()=>{});
    const completed=completeHomeMaintenance(saved,saved,'washer-record',{completedOn:'2026-10-03',notes:'Rinsed and refitted'},()=>{},'2026-10-03');
    expect(completed.homeManual!.records[0].nextMaintenanceOn).toBeUndefined();expect(completed.homeManual!.records[0].history).toEqual([{id:expect.any(String),completedOn:'2026-10-03',task:'Clean the filter',notes:'Rinsed and refitted'}]);
    expect(saved.homeManual!.records[0].history).toEqual([]);
    const rescheduled=completeHomeMaintenance(saved,saved,'washer-record',{completedOn:'2026-10-03',notes:'',nextMaintenanceOn:'2027-01-03'},()=>{},'2026-10-03');
    expect(rescheduled.homeManual!.records[0].nextMaintenanceOn).toBe('2027-01-03');
    expect(()=>completeHomeMaintenance(saved,saved,'washer-record',{completedOn:'2026-10-04',notes:''},()=>{},'2026-10-03')).toThrow(/future/i);
    expect(()=>completeHomeMaintenance(saved,saved,'washer-record',{completedOn:'2026-10-03',notes:'',nextMaintenanceOn:'2026-10-02'},()=>{},'2026-10-03')).toThrow(/after/i);
    expect(()=>completeHomeMaintenance(saved,{...saved,name:'Changed'},'washer-record',{completedOn:'2026-10-03',notes:''},()=>{},'2026-10-03')).toThrow(/changed/i);
    expect(removeHomeManualRecord(completed,completed,'washer-record',()=>{}).homeManual?.records).toEqual([]);
  });
  it('preserves service history while editing record details',()=>{
    const p=fixture();p.homeManual=manual(record({history:[{id:'entry',completedOn:'2026-09-01',task:'Old task',notes:'Earlier service'}]}));
    const edited=saveHomeManualRecord(p,p,record({name:'Renamed washer'}),()=>{});
    expect(edited.homeManual!.records[0].history).toEqual(p.homeManual.records[0].history);
  });
  it('searches records and filters due/overdue and warranty dates independently',()=>{
    const items=[record(),record({id:'old',name:'Boiler',nextMaintenanceOn:'2026-10-01',warrantyEndsOn:'2026-10-03'}),record({id:'later',name:'Desk',nextMaintenanceOn:'2026-11-01',warrantyEndsOn:'2026-01-01'})];
    expect(filterHomeManualRecords(items,'','due','2026-10-03').map(r=>r.id)).toEqual(['washer-record','old']);
    expect(filterHomeManualRecords(items,'','overdue','2026-10-03').map(r=>r.id)).toEqual(['old']);
    expect(filterHomeManualRecords(items,'boiler','warranty','2026-10-03').map(r=>r.id)).toEqual(['old']);
    expect(filterHomeManualRecords(items,'','warranty-expired','2026-10-03').map(r=>r.id)).toEqual(['later']);
  });
  it('exports only selected saved records with escaped text and protected links',()=>{
    const p=fixture();p.name='Home <script>alert(1)</script>';p.homeManual={version:1,records:[record({name:'Washer <img src=x onerror=alert(1)>',manualUrl:'https://example.com/manual?a=1&b=2',history:[{id:'e',completedOn:'2026-01-01',task:'<b>Filter</b>',notes:'"quoted"'}]}),record({id:'secret',name:'Private safe',notes:'UNSELECTED SECRET'})]};
    const html=homeManualHtml(p,['washer-record'],'2026-10-03');
    expect(html).not.toContain('UNSELECTED SECRET');expect(html).not.toContain('Private safe');expect(html).not.toContain('<script>');expect(html).not.toContain('<img ');expect(html).toContain('&lt;img');expect(html).toContain('a=1&amp;b=2');expect(html).toContain('noopener noreferrer');expect(html).toContain('&lt;b&gt;Filter&lt;/b&gt;');
    expect(()=>homeManualHtml(p,[],'2026-10-03')).toThrow(/select/i);
    expect(()=>homeManualHtml(p,['deleted-record'],'2026-10-03')).toThrow(/changed|missing/i);
  });
});
