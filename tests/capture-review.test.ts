import {describe,it,expect} from 'vitest';
import {captureDraftKey,captureItems,captureReviewStatus,completeCaptureReview,confirmCaptureMeasurement,createCaptureReview,decideCaptureItem,editCaptureItem,validateCaptureReview} from '../src/captureReview';
import {reviewed,source,detection} from './capture-fixtures';
describe('source-linked capture review',()=>{
  it('uses actual dimension evidence and notes, with no invented model confidence',()=>{
    const r=createCaptureReview(detection,source,'draft-1',1000),items=captureItems(r);
    expect(items.find(i=>i.kind==='dimension')?.evidence).toBe('printed-label');expect(items[0].reason).toContain('faint');expect(Object.values(r.decisions).every(v=>v==='pending')).toBe(true);expect(JSON.stringify(r)).not.toMatch(/confidence/i);expect(r.measurement).toBeUndefined();
  });
  it('keeps exact originals and returns an edited proposal without floor mutation',()=>{
    const original=JSON.stringify(detection);let r=reviewed();r=editCaptureItem(r,'room:0',{...r.current.rooms[0],width:420});
    const out=completeCaptureReview(r,source,'draft-1',5000);expect(out.recognition.rooms[0].width).toBe(420);expect(out.scale).toBe(10);expect(out.snapshot.original.rooms[0].width).toBe(400);expect(JSON.stringify(detection)).toBe(original);
    r=decideCaptureItem(r,'room:0','keep');expect(r.current.rooms[0].width).toBe(400);
  });
  it('requires every decision, measured span and correction checklist',()=>{
    const initial=createCaptureReview(detection,source,'draft-1',1000);expect(()=>completeCaptureReview(initial,source,'draft-1',5000)).toThrow(/Verify one known length/);
    const r=reviewed();delete r.measurement;expect(captureReviewStatus(r,source,'draft-1').ready).toBe(false);r.measurement=reviewed().measurement;r.checklist.openings=false;expect(captureReviewStatus(r,source,'draft-1').missingChecks).toEqual(['openings']);
  });
  it.each([{id:'another-reference'},{page:2},{rotation:90 as const},{widthPx:900},{method:'manual-tracing' as const},{pipelineVersion:'regions-v2'}])('invalidates review when source changes: %j',patch=>{
    expect(captureReviewStatus(reviewed(),{...source,...patch},'draft-1').stale).toBe(true);expect(()=>completeCaptureReview(reviewed(),{...source,...patch},'draft-1',5000)).toThrow(/changed/);
  });
  it('invalidates after geometry changes and ignores review metadata in draft keys',()=>{
    const draft={rooms:[{x:0,width:400}],walls:[],fixtures:[],omittedWalls:[]};const key=captureDraftKey(draft,100);expect(key).toBe(captureDraftKey({...draft,captureReview:{}} as typeof draft,100));expect(key).not.toBe(captureDraftKey({...draft,rooms:[{x:0,width:401}]},100));expect(captureReviewStatus(reviewed(),source,'draft-2').stale).toBe(true);
  });
  it('retains rejected evidence while excluding it from the proposal',()=>{
    const r=decideCaptureItem(reviewed(),'fixture:0','reject'),out=completeCaptureReview(r,source,'draft-1',5000);expect(out.recognition.fixtures).toEqual([]);expect(out.snapshot.original.fixtures).toHaveLength(1);expect(()=>completeCaptureReview(decideCaptureItem(r,'room:0','reject'),source,'draft-1',5000)).toThrow(/usable floor plan/);
  });
  it('rejects out-of-bounds edits, forged kept values and unbounded payloads',()=>{
    const r=reviewed();expect(()=>editCaptureItem(r,'room:0',{...r.current.rooms[0],width:2000})).toThrow(/geometry/);r.current.rooms[0].width=401;expect(()=>validateCaptureReview(r)).toThrow(/Kept geometry/);
    expect(()=>createCaptureReview({...detection,rooms:Array.from({length:101},()=>detection.rooms[0])},source,'draft-1',0)).toThrow(/usable/);
    expect(()=>confirmCaptureMeasurement(reviewed(),{ax:0,ay:0,bx:0,by:0,millimetres:4000})).toThrow(/measured span/);
  });
  it('strips unknown source/media and recognition payload fields from saved metadata',()=>{
    const r=reviewed();const clean=validateCaptureReview({...r,image:'secret image',source:{...r.source,name:'private.pdf',url:'data:secret'},original:{...r.original,image:'secret'}});expect(JSON.stringify(clean)).not.toMatch(/secret|private\.pdf/);
  });
  it('clears completion when a decision or measurement changes',()=>{
    const done=completeCaptureReview(reviewed(),source,'draft-1',5000).snapshot;expect(decideCaptureItem(done,'room:0','pending').completedAtMs).toBeUndefined();expect(confirmCaptureMeasurement(done,done.measurement!).completedAtMs).toBeUndefined();
  });
});
