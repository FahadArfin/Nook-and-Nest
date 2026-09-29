import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {deleteDB,openDB} from 'idb';
import {createSamplePlan,parsePlan,serializePlan} from '../src/domain';
import {catalog} from '../src/catalog';
import {buildPersonalPlacement,initialPersonalPosition} from '../src/personalPlacement';
import {parsePersonalCollectionItem,parsePersonalItemMetadata,personalPhotoIds,publicPersonalPlan,type PersonalCollectionItem,type PersonalPlacement} from '../src/personalItems';
import {MAX_PERSONAL_MEDIA_BYTES,parsePersonalPhotoAsset,personalAssetBytes,preparePersonalPhoto,verifyPersonalPhotoAsset,type PersonalPhotoAsset} from '../src/personalMedia';
import {deletePersonalItem,exportPersonalAssets,importPersonalAssets,listPersonalItems,loadPersonalPhoto,PERSONAL_DATABASE,savePersonalItem} from '../src/personalStorage';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQJ8AAAAASUVORK5CYII=';
const other='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgQIAZ+X6WQAAAABJRU5ErkJggg==';
const date='2026-09-29T00:00:00.000Z';
const item=(changes:Partial<PersonalCollectionItem>={}):PersonalCollectionItem=>({version:1,id:crypto.randomUUID(),name:'Inherited chair',catalogId:'armchair',widthMm:731.5,depthMm:812,heightMm:957,status:'keep',notes:'Private family note',revision:0,createdAt:date,updatedAt:date,...changes});
async function photo(original=image):Promise<PersonalPhotoAsset>{const bytes=Uint8Array.from(atob(original.split(',')[1]),c=>c.charCodeAt(0)),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');return {version:1,id:'sha256:'+hash,original,preview:original,width:1,height:1,createdAt:date};}
afterEach(async()=>{vi.restoreAllMocks();await deleteDB(PERSONAL_DATABASE)});

describe('personal furniture identity and placement',()=>{
  it('creates an uncommitted measured proxy, keeps private metadata in clones/backups and strips photos/notes from public working and alternative layouts',async()=>{
    const asset=await photo(),owned=item({photoAssetId:asset.id}),base=createSamplePlan(),originalCatalog=structuredClone(catalog.find(c=>c.id===owned.catalogId)),before=JSON.stringify(base);
    const request=buildPersonalPlacement(base,base.floors[0].id,owned,initialPersonalPosition(base,base.floors[0].id,owned)),placed=request.plan.furniture.at(-1) as PersonalPlacement;
    expect(JSON.stringify(base)).toBe(before);expect(catalog.find(c=>c.id===owned.catalogId)).toEqual(originalCatalog);expect(request.base).toBe(base);
    expect([placed.widthMm,placed.depthMm,placed.heightMm]).toEqual([731.5,812,957]);expect(placed.personalItem).toMatchObject({itemId:owned.id,notes:owned.notes,photoAssetId:asset.id,representation:'catalog-proxy'});
    const duplicate={...structuredClone(placed),id:crypto.randomUUID()},plan={...request.plan,furniture:[placed,duplicate],layoutAlternatives:{version:1 as const,options:[{id:'idea-1',name:'A remembered room',createdAt:date,activeFloorId:base.floors[0].id,snapshot:{floors:base.floors,furniture:[placed],gridSizeMm:base.gridSizeMm}}]}};
    const parsed=parsePlan(serializePlan(plan));expect((parsed.furniture[1] as PersonalPlacement).personalItem).toEqual(placed.personalItem);expect(personalPhotoIds(plan)).toEqual([asset.id]);
    const published=publicPersonalPlan(plan);expect(JSON.stringify(published)).not.toContain('Private family note');expect(JSON.stringify(published)).not.toContain(asset.id);expect((published.furniture[0] as PersonalPlacement).personalItem).toMatchObject({name:owned.name,representation:'catalog-proxy'});expect(placed.personalItem?.notes).toBe(owned.notes);
    expect(()=>parsePersonalItemMetadata({...placed.personalItem,representation:'exact-manufacturer'})).toThrow();expect(()=>parsePersonalCollectionItem({...owned,widthMm:Infinity})).toThrow();expect(()=>parsePersonalItemMetadata({...placed.personalItem,photoAssetId:'https://example.com/photo.jpg'})).toThrow();
  });
});
describe('private collection and photo integrity',()=>{
  it('deduplicates identical originals, rejects stale writers and preserves placed-photo assets when a collection item is removed',async()=>{
    const asset=await photo(),first=await savePersonalItem(item({photoAssetId:asset.id}),asset),second=await savePersonalItem(item({photoAssetId:asset.id}),asset);
    const db=await openDB(PERSONAL_DATABASE,1);expect(await db.count('photos')).toBe(1);expect(await db.get('meta','photoBytes')).toBe(personalAssetBytes(asset));db.close();
    const updated=await savePersonalItem({...first,name:'My reading chair',status:'replace'});await expect(savePersonalItem({...first,notes:'Stale edit'})).rejects.toThrow('another tab');expect((await listPersonalItems()).find(i=>i.id===first.id)?.name).toBe('My reading chair');
    await deletePersonalItem(first.id,updated.revision);expect(await listPersonalItems()).toEqual([second]);expect(await loadPersonalPhoto(asset.id)).toEqual(asset);
  });
  it('rolls back photo bytes and item writes after a storage failure, and enforces the shared photo budget before mutation',async()=>{
    const asset=await photo(),owned=item({photoAssetId:asset.id}),original=IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){if(this.name==='items')throw new DOMException('Device storage full','QuotaExceededError');return original.apply(this,args)});
    await expect(savePersonalItem(owned,asset)).rejects.toThrow('Device storage full');vi.restoreAllMocks();
    let db=await openDB(PERSONAL_DATABASE,1);expect(await db.count('items')).toBe(0);expect(await db.count('photos')).toBe(0);expect(await db.get('meta','photoBytes')).toBeUndefined();await db.put('meta',MAX_PERSONAL_MEDIA_BYTES,'photoBytes');db.close();
    await expect(savePersonalItem(owned,asset)).rejects.toThrow('64 MB');db=await openDB(PERSONAL_DATABASE,1);expect(await db.count('photos')).toBe(0);db.close();
  });
  it('exports only referenced photos, reports missing assets and restores a verified bundle without duplicating existing photos',async()=>{
    const asset=await photo(),unrelated=await photo(other),owned=item({photoAssetId:asset.id});await savePersonalItem(owned,asset);await savePersonalItem(item({photoAssetId:unrelated.id}),unrelated);
    const base=createSamplePlan(),proposal=buildPersonalPlacement(base,base.floors[0].id,owned,{x:1000,z:1000,rotation:0}),missing='sha256:'+'0'.repeat(64);
    const plan={...proposal.plan,furniture:[...proposal.plan.furniture,{...proposal.plan.furniture[0],id:'missing-copy',personalItem:{...((proposal.plan.furniture[0] as PersonalPlacement).personalItem!),photoAssetId:missing}}]};
    const bundle=await exportPersonalAssets(plan);expect(bundle.assets.map(a=>a.id)).toEqual([asset.id]);expect(bundle.missing).toEqual([missing]);
    await deleteDB(PERSONAL_DATABASE);await importPersonalAssets(bundle);await importPersonalAssets(bundle);expect(await loadPersonalPhoto(asset.id)).toEqual(asset);expect(await loadPersonalPhoto(missing)).toBeUndefined();expect(await listPersonalItems()).toEqual([]);
    const db=await openDB(PERSONAL_DATABASE,1);expect(await db.count('photos')).toBe(1);db.close();
  });
  it('rejects disguised, oversized and hash-mismatched photo data before starting a persistence transaction',async()=>{
    const asset=await photo(),add=vi.spyOn(IDBObjectStore.prototype,'add');
    expect(()=>parsePersonalPhotoAsset({...asset,original:'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='})).toThrow();
    expect(()=>parsePersonalPhotoAsset({...asset,width:50000})).toThrow();
    await expect(verifyPersonalPhotoAsset({...asset,id:'sha256:'+'0'.repeat(64)})).rejects.toThrow('fingerprint');
    await expect(savePersonalItem(item({photoAssetId:asset.id}),{...asset,id:'sha256:'+'0'.repeat(64)})).rejects.toThrow();
    await expect(preparePersonalPhoto(new File([new Uint8Array(5*1024*1024+1)],'too-large.png',{type:'image/png'}))).rejects.toThrow('5 MB');
    expect(add).not.toHaveBeenCalled();
  });
});
