import {expect,it} from 'vitest';
import {parseReservation,parseStockUnit,stagingDateRange,stagingOverlap,toStagingVisualProxy,stagingSample} from '../src/stagingInventory';
const catalog=[{id:'sofa',name:'Sofa',widthMm:2200,depthMm:950,heightMm:850}];
it('keeps calendar boundaries exact across month, leap day and DST without timezone conversion',()=>{
 expect(stagingDateRange('2028-02-29','2028-03-01')).toEqual({start:'2028-02-29',end:'2028-03-01'});
 expect(()=>stagingDateRange('2027-02-29','2027-03-01')).toThrow();
 expect(stagingOverlap({start:'2026-11-01',end:'2026-11-03'},{start:'2026-11-03',end:'2026-11-08'})).toBe(false);
 expect(()=>stagingDateRange('2026-10-01','2027-10-03')).toThrow();
});
it('requires individual unique stock IDs and rejects fabricated quantities and identities',()=>{
 const base={requestId:'r',propertyLabel:'Property',start:'2026-10-01',end:'2026-10-02',unitIds:['b','a']};
 expect(parseReservation(base).unitIds).toEqual(['a','b']);
 for(const patch of [{quantity:3},{ownerId:'victim'},{unitIds:['a','a']},{unitIds:[]},{start:'2026-10-05'},{start:'2026-01-01T00:00:00Z'}])expect(()=>parseReservation({...base,...patch})).toThrow();
});
it('allows only catalog proxies and bounded physical dimensions',()=>{
 const input={requestId:'u',stockCode:'S-001',label:'Measured sofa',catalogId:'sofa',widthMm:2450,depthMm:1020,heightMm:880,condition:'fair'};
 expect(parseStockUnit(input,catalog).widthMm).toBe(2450);
 for(const patch of [{catalogId:'https://private.test/photo'},{widthMm:Infinity},{heightMm:2.5},{label:'x'.repeat(101)},{condition:'newish'}])expect(()=>parseStockUnit({...input,...patch},catalog)).toThrow();
});
it('a proxy is a detached public-catalog draft with no ownership, booking or stock IDs',()=>{
 const stock=structuredClone(stagingSample.units[0]),before=JSON.stringify(stock),proxy=toStagingVisualProxy(stock,catalog)!;
 expect(Object.keys(proxy).sort()).toEqual(['catalogId','depthMm','heightMm','widthMm']);
 proxy.catalogId='another-sofa';proxy.widthMm=3000;
 expect(JSON.stringify(stock)).toBe(before);
 expect(toStagingVisualProxy({...stock,catalogId:'removed-model'},catalog)).toBeNull();
});
