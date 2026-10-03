import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {deleteDB,openDB} from 'idb';
import {originalRemixExamples,parseRemixPackage,type RemixPackage} from '../src/remixSnapshot';
import {listSavedIdeas,removeSavedIdea,saveIdea,SAVED_IDEAS_LIMITS,SavedIdeasCorruptionError} from '../src/savedIdeas';

const database='nook-saved-ideas';
const original=originalRemixExamples()[0];
function packet(id='example',revision=1):RemixPackage {
  return {schema:'nook-remix-package/1',source:{source:'gallery',id,revision},snapshot:{...structuredClone(original.snapshot),attribution:{version:1,credits:[{source:'builtin',id:original.id,revision:1,title:original.snapshot.title,creator:'Nook & Nest',permission:'remix-with-credit-v1'}]}}};
}
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Saved ideas must not contact the network.');}));});
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();await deleteDB(database);});

it('roundtrips immutable attributed snapshots, deduplicates a source revision and refuses conflicting content',async()=>{
  const input=packet(),before=structuredClone(input),pending=saveIdea(input);input.snapshot.title='Changed after Save';
  const saved=await pending;expect(saved.packet).toEqual(before);expect(saved.id).toBe('saved:gallery:example:1');
  saved.packet.snapshot.creator='Changed returned record';
  const repeated=await saveIdea(before);expect(repeated.packet).toEqual(before);expect(repeated.savedAt).toBe(saved.savedAt);
  await expect(saveIdea({...before,snapshot:{...before.snapshot,title:'Different bytes'}})).rejects.toThrow(/different|conflict/i);
  const next=await saveIdea(packet('example',2));expect(next.id).not.toBe(repeated.id);
  expect((await listSavedIdeas()).map(v=>v.packet).sort((a,b)=>a.source.revision-b.source.revision)).toEqual([before,packet('example',2)]);
  await removeSavedIdea(repeated.id);await removeSavedIdea(repeated.id);expect((await listSavedIdeas()).map(v=>v.id)).toEqual([next.id]);
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects viewing-only, malformed and oversized packages before creating saved entries',async()=>{
  const good=packet();
  for(const value of [
    {...good,snapshot:{...good.snapshot,allowCopy:false}},
    {...good,source:{...good.source,revision:0}},
    {...good,source:{...good.source,url:'https://private.example/token'}},
    {...good,snapshot:{...good.snapshot,title:'<script>unsafe</script>'}},
    {...good,snapshot:{...good.snapshot,title:' '+good.snapshot.title}},
    {...good,snapshot:{...good.snapshot,description:'x'.repeat(600_000)}},
  ])await expect(saveIdea(value as RemixPackage)).rejects.toThrow();
  await expect(removeSavedIdea('../another-store')).rejects.toThrow(/identity|identifier/i);
  expect(await listSavedIdeas()).toEqual([]);expect(fetch).not.toHaveBeenCalled();
});

it('serializes concurrent connections so the last slot cannot bypass the 24-entry limit or lose earlier writes',async()=>{
  await Promise.all(Array.from({length:SAVED_IDEAS_LIMITS.entries-1},(_,i)=>saveIdea(packet('seed-'+i))));
  const outcomes=await Promise.allSettled([saveIdea(packet('last-a')),saveIdea(packet('last-b'))]);
  expect(outcomes.filter(v=>v.status==='fulfilled')).toHaveLength(1);expect(outcomes.find(v=>v.status==='rejected')).toMatchObject({reason:expect.any(Error)});
  const all=await listSavedIdeas();expect(all).toHaveLength(24);expect(all.some(v=>v.packet.source.id==='seed-0')).toBe(true);
  await expect(saveIdea(packet('seed-0'))).resolves.toMatchObject({id:'saved:gallery:seed-0:1'});
});

it('enforces the aggregate UTF-8 byte limit atomically, independently of the entry limit',async()=>{
  // Existing package validation permits these bounded finish maps; Unicode makes bytes differ from characters.
  const large=packet('large-00');large.snapshot.plan.floors[0].wallFinishes=Object.fromEntries(Array.from({length:1450},(_,i)=>[String(i).padEnd(160,'k'),'é'.repeat(90)]));
  const validated=parseRemixPackage(large);const first=await saveIdea(validated);
  expect(first.bytes).toBeGreaterThan(JSON.stringify(validated).length);
  const slots=Math.floor(SAVED_IDEAS_LIMITS.bytes/first.bytes);expect(slots).toBeLessThan(24);
  const make=(i:number)=>({...structuredClone(validated),source:{...validated.source,id:'large-'+String(i).padStart(2,'0')}});
  for(let i=1;i<slots-1;i++)await saveIdea(make(i));
  const outcomes=await Promise.allSettled([saveIdea(make(slots-1)),saveIdea(make(slots))]);
  expect(outcomes.filter(v=>v.status==='fulfilled')).toHaveLength(1);
  const all=await listSavedIdeas();expect(all).toHaveLength(slots);expect(all.reduce((sum,v)=>sum+v.bytes,0)).toBeLessThanOrEqual(SAVED_IDEAS_LIMITS.bytes);
  await removeSavedIdea(first.id);await expect(saveIdea(make(slots+1))).resolves.toBeDefined();
},20000);

it('waits for transaction commit and preserves existing entries on quota failure or late abort',async()=>{
  const previous=await saveIdea(packet('keep'));
  const add=IDBObjectStore.prototype.add;
  const failed=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore){throw new DOMException('Device storage quota reached','QuotaExceededError');});
  await expect(saveIdea(packet('quota'))).rejects.toThrow(/quota/i);failed.mockRestore();
  const aborted=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<typeof add>){const request=add.apply(this,args);request.addEventListener('success',()=>this.transaction.abort());return request;});
  await expect(saveIdea(packet('abort'))).rejects.toThrow();aborted.mockRestore();
  expect(await listSavedIdeas()).toEqual([previous]);
});

it('fails closed on corrupted records without overwriting them and permits targeted removal for recovery',async()=>{
  const first=await saveIdea(packet('damaged')),second=await saveIdea(packet('healthy'));
  const db=await openDB(database);const raw=await db.get('ideas',first.id);raw.packet.snapshot.allowCopy=false;await db.put('ideas',raw);db.close();
  await expect(listSavedIdeas()).rejects.toMatchObject({name:SavedIdeasCorruptionError.name,ideaId:first.id});await expect(saveIdea(packet('new'))).rejects.toThrow(/corrupt|damaged/i);
  const check=await openDB(database);expect((await check.get('ideas',first.id)).packet.snapshot.allowCopy).toBe(false);expect(await check.count('ideas')).toBe(2);check.close();
  await removeSavedIdea(first.id);expect(await listSavedIdeas()).toEqual([second]);
});
