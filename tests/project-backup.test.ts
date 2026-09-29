import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {deleteDB,openDB} from 'idb';
import {createSamplePlan} from '../src/domain';
import {createListing} from '../src/listingTypes';
import * as studioReference from '../src/studioReference';
import {backupNotices,buildProjectBackup,parseProjectBackup,restoreProjectBackup,validateProjectBackup,type ProjectBackup} from '../src/projectBackup';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQJ8AAAAASUVORK5CYII=';
const otherImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgQIAZ+X6WQAAAABJRU5ErkJggg==';
const databases=['nook-and-nest','nook-listing-studio','nook-studio-references'];
async function database(name:string){return openDB(name,1,{upgrade(db){for(const store of name===databases[0]?['projects']:name===databases[1]?['listings','preferences']:['references'])db.createObjectStore(store)}})}
async function entries(name:string,store:string){const db=await database(name);try{return await db.getAll(store)}finally{db.close()}}
async function fixture(){
  const plan=createSamplePlan('Family home','metric'),[ground,upper]=plan.floors;
  ground.stairs=[{id:'stairs-a',kind:'straight',x:1000,z:1000,rotation:0,widthMm:900,lengthMm:3000,toFloorId:upper.id}];
  const listing={...createListing(plan.id,plan.name),media:[{id:'existing-photo',title:'Evening view',caption:'Concept staging',kind:'staged' as const,image,sourceImage:image,originalImage:otherImage,seconds:6,floorId:upper.id,camera:{version:1 as const,kind:'orbit' as const,floorId:upper.id,target:{x:1,y:1,z:2},alpha:.1,beta:1,radius:4,mode:0,fov:.8}}]};
  let db=await database(databases[0]);await db.put('projects',plan,'project:'+plan.id);await db.put('projects',plan.id,'active');db.close();
  db=await database(databases[1]);await db.put('listings',{revision:4,document:listing},plan.id);db.close();
  const file=new File([Uint8Array.from(atob(image.split(',')[1]),c=>c.charCodeAt(0))],'ground.png',{type:'image/png',lastModified:1234});
  const reference={page:1,rotation:0,reference:{url:image,width:1,height:1,pages:1,name:'Ground plan'},file};
  db=await database(databases[2]);await db.put('references',reference,JSON.stringify([plan.id,ground.id]));db.close();
  // Node clones File as Blob; supply browser File metadata at this read boundary.
  // All restoration and rollback operations still run against real fake-indexeddb transactions.
  vi.spyOn(studioReference,'loadStudioReference').mockResolvedValueOnce(reference);
  return {plan,listing,file,backup:await buildProjectBackup(plan)};
}
afterEach(async()=>{vi.restoreAllMocks();for(const db of databases)await deleteDB(db)});

describe('complete local project backups',()=>{
  it('round-trips floor links, paired media and reference bytes into a separate project without changing the active original',async()=>{
    const {plan,listing,file,backup}=await fixture();
    expect(backupNotices(backup)).toHaveLength(1);
    const restored=await restoreProjectBackup(parseProjectBackup(JSON.stringify(backup)));
    expect(restored.id).not.toBe(plan.id);expect(restored.floors).toEqual(plan.floors);expect(restored.floors[0].stairs[0].toFloorId).toBe(restored.floors[1].id);
    let db=await database(databases[0]);expect(await db.get('projects','active')).toBe(plan.id);expect(await db.get('projects','project:'+plan.id)).toEqual(plan);expect(await db.get('projects','project:'+restored.id)).toEqual(restored);db.close();
    db=await database(databases[1]);const saved=await db.get('listings',restored.id);expect(saved.document.planId).toBe(restored.id);expect(saved.document.media[0].id).not.toBe(listing.media[0].id);expect(saved.document.media[0]).toEqual({...listing.media[0],id:saved.document.media[0].id});expect((await db.get('listings',plan.id)).revision).toBe(4);db.close();
    db=await database(databases[2]);const ref=await db.get('references',JSON.stringify([restored.id,plan.floors[0].id]));expect(ref.reference.url).toBe(image);expect(new Uint8Array(await ref.file.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()));db.close();
    const withoutReferences=await buildProjectBackup(plan,{includeReferences:false});expect(withoutReferences.references.every(r=>r.status==='omitted')).toBe(true);expect(withoutReferences.listing).toEqual(backup.listing);
  });
  it('rejects mismatched project ownership, remote reference images and invalid viewpoint floors before writing any records',async()=>{
    const {backup}=await fixture(),add=vi.spyOn(IDBObjectStore.prototype,'add');
    const badInputs:unknown[]=[{...backup,listing:{...backup.listing,planId:'someone-else'}},{...backup,references:[{floorId:backup.plan.floors[0].id,status:'included',page:1,rotation:0,preview:{url:'https://example.com/private.png',width:1,height:1,pages:1,name:'Remote'}}]},{...backup,listing:{...backup.listing,media:[{...backup.listing!.media[0],floorId:'missing',camera:{...backup.listing!.media[0].camera,floorId:'missing'}}]}}];
    for(const input of badInputs)await expect(restoreProjectBackup(input as ProjectBackup)).rejects.toThrow();
    expect(add).not.toHaveBeenCalled();expect((await entries(databases[1],'listings')).length).toBe(1);
  });
  it('rolls back new media and reference records when publishing the new plan hits a quota failure, then permits a clean retry',async()=>{
    const {plan,backup}=await fixture(),original=IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){if(this.name==='projects')throw new DOMException('Storage is full','QuotaExceededError');return original.apply(this,args)});
    await expect(restoreProjectBackup(backup)).rejects.toThrow('Storage is full');
    expect(await entries(databases[1],'listings')).toHaveLength(1);expect(await entries(databases[2],'references')).toHaveLength(1);expect((await entries(databases[0],'projects')).filter(v=>typeof v==='object')).toEqual([plan]);
    vi.restoreAllMocks();const restored=await restoreProjectBackup(backup);expect(restored.id).not.toBe(plan.id);expect(await entries(databases[1],'listings')).toHaveLength(2);
  });
  it('refuses an identity collision without overwriting or deleting the existing project or its media',async()=>{
    const {plan,backup}=await fixture();vi.spyOn(crypto,'randomUUID').mockReturnValue(plan.id as `${string}-${string}-${string}-${string}-${string}`);
    await expect(restoreProjectBackup(backup)).rejects.toThrow('new project identity');expect(await entries(databases[1],'listings')).toHaveLength(1);expect(await entries(databases[2],'references')).toHaveLength(1);
    const valid=validateProjectBackup({...backup,references:[]});expect(valid.references.every(r=>r.status==='missing')).toBe(true);
  });
});
