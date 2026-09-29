import {describe,expect,it} from 'vitest';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {geometryKey} from '../src/blueprint';
import {appendMeasurementCheck,blankSiteSurvey,classifySiteArea,collectSurveyAssetIds,parseSiteSurvey,publicSurveyPlan,saveSiteNote,siteAreaBreakdown,siteNoteStatus,type SurveyPlan} from '../src/siteSurvey';
function plan():SurveyPlan{const p=createSamplePlan('Site','metric');p.gridSizeMm=1000;p.furniture=[];p.floors=[{...p.floors[0],id:'ground',heightMm:2500,cells:rectangleCells(4,3),walls:[{id:'partition',ax:1,az:0,bx:1,bz:2}],stairs:[],openings:[]}];return p;}
const note={id:'note',target:{kind:'wall' as const,floorId:'ground',id:'partition'},title:'Hall partition',text:'Check before installation',photoAssetIds:[]};
const input={source:'laser' as const,checkedOn:'2026-09-29',reviewer:'Author',measured:{lengthMm:2000},question:'Check mounting points'};
describe('site evidence',()=>{
  it('captures actual model values and preserves earlier checks when the wall changes',()=>{
    const original=plan(),saved=saveSiteNote(original,original,note,()=>{}),recorded=appendMeasurementCheck(saved,saved,'note',input,()=>{},'2026-09-29T10:00:00Z');
    expect(original.siteSurvey).toBeUndefined();const first=recorded.siteSurvey!.notes[0].checks[0];expect(first.model).toEqual({lengthMm:2000,heightMm:2500});expect(first.units).toBe('mm');expect(siteNoteStatus(recorded,recorded.siteSurvey!.notes[0]).state).toBe('checked');
    const moved=structuredClone(recorded);moved.floors[0].walls[0].bz=2.5;expect(siteNoteStatus(moved,moved.siteSurvey!.notes[0]).state).toBe('changed');const corrected=appendMeasurementCheck(moved,moved,'note',{...input,measured:{lengthMm:2500}},()=>{});expect(corrected.siteSurvey!.notes[0].checks[0]).toEqual(first);expect(corrected.siteSurvey!.notes[0].checks[1].model.lengthMm).toBe(2500);expect(siteNoteStatus(corrected,corrected.siteSurvey!.notes[0]).state).toBe('checked');
  });
  it('separates reference evidence, discrepancies and missing geometry without claiming certification',()=>{
    const p=plan(),saved=saveSiteNote(p,p,note,()=>{}),reference=appendMeasurementCheck(saved,saved,'note',{...input,source:'ai'},()=>{});expect(siteNoteStatus(reference,reference.siteSurvey!.notes[0]).state).toBe('recorded');const discrepancy=appendMeasurementCheck(saved,saved,'note',{...input,measured:{lengthMm:2200}},()=>{});expect(siteNoteStatus(discrepancy,discrepancy.siteSurvey!.notes[0]).state).toBe('discrepancy');const removed={...reference,floors:[{...reference.floors[0],walls:[]}]};expect(siteNoteStatus(removed,removed.siteSurvey!.notes[0]).state).toBe('changed');
  });
  it('rejects stale writes, malformed dates, history truncation and oversized evidence',()=>{
    const p=plan(),saved=saveSiteNote(p,p,note,()=>{});expect(()=>saveSiteNote(p,structuredClone(p),note,()=>{})).toThrow(/changed/);expect(()=>appendMeasurementCheck(saved,saved,'note',{...input,checkedOn:'2026-02-30'},()=>{})).toThrow();expect(()=>saveSiteNote(saved,saved,{...note,target:{...note.target,id:'other'}},()=>{})).toThrow(/unchanged/);
    const checked=appendMeasurementCheck(saved,saved,'note',input,()=>{}),edited=saveSiteNote(checked,checked,{...note,text:'New note'},()=>{});expect(edited.siteSurvey!.notes[0].checks).toEqual(checked.siteSurvey!.notes[0].checks);const invalid=structuredClone(edited.siteSurvey!);invalid.notes[0].checks=Array.from({length:13},(_,i)=>({...invalid.notes[0].checks[0],id:String(i)}));expect(()=>parseSiteSurvey(invalid)).toThrow(/twelve/);
  });
  it('reconciles irregular room unions and keeps outdoor and unspecified areas out of included totals',()=>{
    const p=plan(),f=p.floors[0];f.blueprint={geometryKey:geometryKey(f),rooms:[{id:'living',name:'Living',kind:'Living',enclosed:true,x:0,z:0,width:3000,depth:3000},{id:'balcony',name:'Balcony',kind:'Outdoor',enclosed:false,x:3000,z:0,width:1000,depth:3000}]};let rows=siteAreaBreakdown(p);expect(rows.map(r=>[r.classification,r.areaM2])).toEqual([['unclassified',9],['outdoor',3]]);expect(rows.reduce((s,r)=>s+r.areaM2!,0)).toBe(12);const classified=classifySiteArea(p,p,'ground','living','included',()=>{});rows=siteAreaBreakdown(classified);expect(rows.filter(r=>r.classification==='included').reduce((s,r)=>s+r.areaM2!,0)).toBe(9);
    const overlap=structuredClone(p);overlap.floors[0].blueprint!.rooms[1].x=2000;overlap.floors[0].blueprint!.rooms[1].width=2000;rows=siteAreaBreakdown(overlap);expect(rows.reduce((s,r)=>s+r.areaM2!,0)).toBe(12);expect(rows.find(r=>r.roomKey==='ambiguous')?.classification).toBe('unclassified');
  });
  it('collects selected and saved-layout media for private backups and strips public evidence',()=>{
    const p=plan(),id='sha256:'+'a'.repeat(64);p.siteSurvey={...blankSiteSurvey(),notes:[{...note,text:'PRIVATE SURVEY',photoAssetIds:[id],checks:[]}]};p.layoutAlternatives={version:1,options:[{id:'a',name:'Idea',createdAt:p.createdAt,activeFloorId:'ground',snapshot:{gridSizeMm:p.gridSizeMm,floors:p.floors,furniture:[],siteSurvey:p.siteSurvey} as never}]};expect(collectSurveyAssetIds(p)).toEqual([id]);const safe=JSON.stringify(publicSurveyPlan(p));expect(safe).not.toContain('PRIVATE SURVEY');expect(safe).not.toContain(id);expect(p.siteSurvey.notes).toHaveLength(1);
  });
});
