import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {deleteDB,openDB} from 'idb';
import {createListing,hasPairedOriginal,isListingImage,listingReadiness,MAX_LISTING_BYTES,parseListing,type ListingDocument,type ListingMedia} from '../src/listingTypes';
import {loadListing,saveAgentDefaults,saveListing} from '../src/listingStorage';
import {pairListingOriginal} from '../src/listingMedia';
import type {CameraShotPose} from '../src/walkthrough';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQJ8AAAAASUVORK5CYII=';
const source='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2Q==';
const pose=():CameraShotPose=>({version:1,kind:'orbit',floorId:'floor-1',target:{x:1,y:1,z:2},alpha:.1,beta:1,radius:4,mode:0,fov:.8});
const slide=(extra:Partial<ListingMedia>={}):ListingMedia=>({id:'slide-1',title:'Living room',caption:'Window view',kind:'photo',image,seconds:5,...extra});
const document=(id='project-1'):ListingDocument=>({...createListing(id,'Property'),media:[slide()]});
afterEach(async()=>{vi.restoreAllMocks();await deleteDB('nook-listing-studio');});

describe('listing backup validation and provenance',()=>{
  it('whitelists a backup without changing its project, timestamp or nested caller objects',()=>{
    const input={...document(),privateField:'drop',details:{...document().details,privateField:'drop'},media:[{...slide({kind:'render',camera:pose()}),privateField:'drop',camera:{...pose(),privateField:'drop',target:{...pose().target,privateField:'drop'}}}]};
    const result=parseListing(input);expect(result.planId).toBe(input.planId);expect(result.updatedAt).toBe(input.updatedAt);expect(JSON.stringify(result)).not.toContain('privateField');expect(result.media[0].floorId).toBe('floor-1');
    result.media[0].camera!.target.x=99;expect(input.media[0].camera.target.x).toBe(1);expect(parseListing(input,'restored-project').planId).toBe('restored-project');
  });
  it('rejects executable and disguised media, duplicate slides, oversized text and invalid viewpoint data',()=>{
    expect(isListingImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false);
    expect(isListingImage('data:image/png;base64,'+btoa('<html><script>alert(1)</script></html>'))).toBe(false);
    expect(isListingImage('https://example.com/room.jpg')).toBe(false);expect(isListingImage('data:image/jpeg;base64,YQ=')).toBe(false);
    for(const bad of [
      {...document(),media:[slide(),slide()]},
      {...document(),media:[slide({sourceImage:'data:text/html;base64,SGk='})]},
      {...document(),media:[slide({camera:{...pose(),radius:0}})]},
      {...document(),media:[slide({camera:pose(),kind:'photo'})]},
      {...document(),media:[slide({camera:{...pose(),target:{x:Infinity,y:0,z:0}}})]},
      {...document(),media:[slide({camera:pose(),floorId:'different-floor'})]},
      {...document(),media:[slide({camera:{...pose(),floorId:'x'.repeat(101)}})]},
      {...document(),details:{...document().details,description:'x'.repeat(4001)}},
      {...document(),updatedAt:'yesterday'},
      {...document(),media:Array.from({length:25},(_,i)=>slide({id:'slide-'+i}))},
    ])expect(()=>parseListing(bad)).toThrow();
  });
  it('enforces the 100 MB serialized backup budget across source, comparison and preview images',()=>{
    const padded='data:image/png;base64,'+'iVBORw0KGgoA'+'A'.repeat(15*1024*1024-12);
    expect(isListingImage(padded)).toBe(true);
    const doc={...document(),media:Array.from({length:7},(_,i)=>slide({id:'slide-'+i,sourceImage:padded}))};
    expect(padded.length*7).toBeGreaterThan(MAX_LISTING_BYTES);expect(()=>parseListing(doc)).toThrow('100 MB');
  });
  it('does not count a staged upload as its own unaltered comparison and requires a distinct paired image',()=>{
    const photo=slide({sourceImage:source}),staged={...photo,kind:'staged' as const};
    expect(hasPairedOriginal(staged)).toBe(false);expect(hasPairedOriginal({...staged,originalImage:source})).toBe(false);expect(hasPairedOriginal({...staged,originalImage:image})).toBe(false);
    expect(listingReadiness({...document(),media:[staged]}).at(-1)?.done).toBe(false);
    expect(()=>pairListingOriginal(staged,photo)).toThrow('same image');
    const other='data:image/webp;base64,UklGRhQAAABXRUJQVlA4WAoAAAAAAAAAAAAAAA==';
    const paired=pairListingOriginal(staged,slide({image:other,sourceImage:other}));expect(paired.originalImage).toBe(other);expect(paired.sourceImage).toBe(source);expect(hasPairedOriginal(paired)).toBe(true);
    expect(listingReadiness({...document(),media:[paired]}).at(-1)?.done).toBe(true);expect(staged.originalImage).toBeUndefined();
    const legacy=parseListing({...document(),media:[slide({kind:'staged',originalImage:source})]});expect(legacy.media[0].sourceImage).toBe(source);expect(legacy.media[0].originalImage).toBeUndefined();
    expect(hasPairedOriginal(parseListing({...document(),media:[paired]}).media[0])).toBe(true);
  });
});

describe('listing IndexedDB persistence',()=>{
  it('does not write or increase revisions when two tabs open and save unchanged content',async()=>{
    const firstTab=await import('../src/listingStorage');vi.resetModules();const secondTab=await import('../src/listingStorage');
    const [first,second]=await Promise.all([firstTab.loadListing('parallel-open','Same listing'),secondTab.loadListing('parallel-open','Same listing')]);
    const put=vi.spyOn(IDBObjectStore.prototype,'put');
    await Promise.all([firstTab.saveListing(first),secondTab.saveListing({...second,updatedAt:'2030-01-01T00:00:00.000Z'})]);
    await firstTab.saveListing(first);await secondTab.saveListing(second);expect(put).not.toHaveBeenCalled();
    const db=await openDB('nook-listing-studio');try{const entry=await db.get('listings','parallel-open');expect(entry.revision).toBe(1);expect(entry.document.updatedAt).toBe(first.updatedAt);}finally{db.close();}
  });
  it('deduplicates queued saves and safely adopts an identical real edit from another tab',async()=>{
    const firstTab=await import('../src/listingStorage');vi.resetModules();const secondTab=await import('../src/listingStorage');
    const [first,second]=await Promise.all([firstTab.loadListing('same-edit','Initial'),secondTab.loadListing('same-edit','Initial')]);
    first.details.title='Matching edit';second.details.title='Matching edit';
    await Promise.all([firstTab.saveListing(first),firstTab.saveListing(first)]);await secondTab.saveListing(second);
    let db=await openDB('nook-listing-studio');try{expect((await db.get('listings','same-edit')).revision).toBe(2);}finally{db.close();}
    second.details.description='A new edit after adopting the matching revision';await secondTab.saveListing(second);
    db=await openDB('nook-listing-studio');try{const entry=await db.get('listings','same-edit');expect(entry.revision).toBe(3);expect(entry.document.details.description).toBe(second.details.description);}finally{db.close();}
    first.details.description='A different stale edit';await expect(firstTab.saveListing(first)).rejects.toThrow('another tab');
  });
  it('persists an initial listing before returning and isolates two projects and agent defaults',async()=>{
    const a=await loadListing('project-a','First home');a.details.address='Private address A';a.details.agentName='Agent A';a.media=[slide({sourceImage:source})];await saveListing(a);await saveAgentDefaults(a.details);
    const b=await loadListing('project-b','Second home');expect(b.details.agentName).toBe('Agent A');expect(b.details.address).toBe('');expect(b.media).toEqual([]);b.details.title='Edited second';await saveListing(b);
    expect((await loadListing('project-a','Ignored title')).details.address).toBe('Private address A');expect((await loadListing('project-a','Ignored')).media[0].sourceImage).toBe(source);
    const db=await openDB('nook-listing-studio');try{const stored=await db.get('listings','project-b');expect(stored.document.details.title).toBe('Edited second');expect(stored.revision).toBe(2);}finally{db.close();}
  });
  it('captures a deep snapshot and serializes concurrent autosaves so the newest call wins',async()=>{
    const original=await loadListing('ordered-project','Initial');original.media=[slide({kind:'render',camera:pose()})];
    const first=saveListing(original);original.media[0].camera!.target.x=100;await first;
    expect((await loadListing('ordered-project','')).media[0].camera!.target.x).toBe(1);
    const older={...original,details:{...original.details,title:'Older'}},newer={...original,details:{...original.details,title:'Newest'}};
    await Promise.all([saveListing(older),saveListing(newer)]);expect((await loadListing('ordered-project','')).details.title).toBe('Newest');
    const pending=saveListing({...newer,details:{...newer.details,title:'Saved before read'}});const loaded=await loadListing('ordered-project','');await pending;expect(loaded.details.title).toBe('Saved before read');
  });
  it('rejects another tab’s newer revision instead of overwriting it',async()=>{
    const local=await loadListing('tab-project','Original'),db=await openDB('nook-listing-studio');
    try{const entry=await db.get('listings','tab-project');await db.put('listings',{revision:entry.revision+1,document:{...entry.document,details:{...entry.document.details,title:'Other tab saved this'}}},'tab-project');}finally{db.close();}
    await expect(saveListing({...local,details:{...local.details,title:'Stale tab'}})).rejects.toThrow('another tab');
    const fresh=await loadListing('tab-project','');expect(fresh.details.title).toBe('Other tab saved this');await expect(saveListing({...fresh,details:{...fresh.details,title:'Reviewed new edit'}})).resolves.toBeUndefined();
  });
  it('propagates failed writes, preserves the prior saved listing and recovers the write queue',async()=>{
    const local=await loadListing('quota-project','Last saved');
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementationOnce(()=>{throw new DOMException('Quota exceeded','QuotaExceededError');});
    await expect(saveListing({...local,details:{...local.details,title:'Not actually saved'}})).rejects.toMatchObject({name:'QuotaExceededError'});
    expect((await loadListing('quota-project','')).details.title).toBe('Last saved');await saveListing({...local,details:{...local.details,title:'Recovered save'}});expect((await loadListing('quota-project','')).details.title).toBe('Recovered save');
    await expect(saveListing({...local,media:[slide({image:'invalid'})]})).rejects.toThrow('slide');
  });
  it('does not return a supposedly saved first document when storage fails',async()=>{
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementationOnce(()=>{throw new DOMException('Quota exceeded','QuotaExceededError');});
    await expect(loadListing('failed-first-save','Unsaved')).rejects.toMatchObject({name:'QuotaExceededError'});
    const db=await openDB('nook-listing-studio');try{expect(await db.get('listings','failed-first-save')).toBeUndefined();}finally{db.close();}
  });
  it('reads existing raw document storage and refuses a record belonging to another project',async()=>{
    await loadListing('bootstrap','Bootstrap');const db=await openDB('nook-listing-studio');
    try{await db.put('listings',document('legacy-project'),'legacy-project');await db.put('listings',document('another-project'),'wrong-key');}finally{db.close();}
    const old=await loadListing('legacy-project','');expect(old.details.title).toBe('Property');await saveListing(old);await expect(loadListing('wrong-key','')).rejects.toThrow('another project');
  });
});
