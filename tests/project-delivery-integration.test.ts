import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {deleteDB,openDB} from 'idb';
import {createSamplePlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
import {captureInstallChecklist} from '../src/installChecklist';
import {startRenovation} from '../src/designHistory';
import {saveLayoutAlternative,publicLayoutPlan} from '../src/layoutAlternatives';
import {reidentifyPrivatePlan} from '../src/projectIdentity';
import {personalPhotoIds} from '../src/personalItems';
import {buildProjectBackup,restoreProjectBackup} from '../src/projectBackup';
import {saveReferenceVersion,loadReferenceVersion} from '../src/studioReference';
import {loadListing,readListing,saveListing} from '../src/listingStorage';
const dbs=['nook-and-nest','nook-listing-studio','nook-studio-references','nook-personal-collection'];
afterEach(async()=>{for(const name of dbs)await deleteDB(name);});
function privateFixture(){
 let p=createSamplePlan('Delivery verification','metric');
 p.installChecklist=captureInstallChecklist(p,'install',[]);
 p.installChecklist.tasks[0].photoAssetIds=['sha256:'+'a'.repeat(64)];
 p.siteSurvey={version:1,areas:[],notes:[{id:'site-note',target:{kind:'room',floorId:p.floors[0].id,id:'test-room'},title:'Private access',text:'Keep private',photoAssetIds:['sha256:'+'b'.repeat(64)],checks:[]}]};
 p=startRenovation(p,p.floors[0].id,validatePlan);
 p=saveLayoutAlternative(p,'Original delivery',p.floors[0].id,validatePlan);
 // Both history systems must retain evidence removed from today's layout.
 p={...p,siteSurvey:undefined,installChecklist:undefined};validatePlan(p);return p;
}
it('keeps private evidence through snapshots and rebinding without altering the source, while shares exclude all delivery metadata',()=>{
 const p=privateFixture(),before=JSON.stringify(p),copy=reidentifyPrivatePlan(p,'copy-id');
 expect(personalPhotoIds(copy).sort()).toEqual(['sha256:'+'a'.repeat(64),'sha256:'+'b'.repeat(64)]);
 validatePlan(copy);
 expect(copy.designHistory!.checkpoints.every(c=>c.snapshot.installChecklist?.projectId==='copy-id')).toBe(true);
 expect(copy.layoutAlternatives!.options[0].snapshot.installChecklist!.projectId).toBe('copy-id');
 expect(JSON.stringify(p)).toBe(before);
 const publicCopy=publicLayoutPlan(p);validatePlan(publicCopy);
 for(const key of ['designHistory','siteSurvey','installChecklist','presentation','layoutAlternatives'])expect(publicCopy).not.toHaveProperty(key);
 expect(JSON.stringify(publicCopy)).not.toContain('Private access');
});
it('round-trips private delivery checkpoints through the real backup path into a separately owned project',async()=>{
 const p=privateFixture(),backup=await buildProjectBackup(p,{includeReferences:false});
 expect(backup.personalAssets?.missing.sort()).toEqual(personalPhotoIds(p).sort());
 const restored=await restoreProjectBackup(backup);validatePlan(restored);
 expect(restored.id).not.toBe(p.id);
 expect(restored.designHistory!.checkpoints[0].snapshot.installChecklist!.projectId).toBe(restored.id);
 expect(restored.layoutAlternatives!.options[0].snapshot.siteSurvey).toEqual(p.layoutAlternatives!.options[0].snapshot.siteSurvey);
 expect(personalPhotoIds(restored).sort()).toEqual(personalPhotoIds(p).sort());
});
it('reads presentation images without creating a listing or adopting another writer revision',async()=>{
 expect(await readListing('read-only-missing')).toBeUndefined();
 let db=await openDB('nook-listing-studio');expect(await db.count('listings')).toBe(0);db.close();
 const mine=await loadListing('listing-read','Initial');
 db=await openDB('nook-listing-studio');await db.put('listings',{revision:2,document:{...mine,details:{...mine.details,title:'Other tab'}}},mine.planId);db.close();
 expect((await readListing(mine.planId))?.details.title).toBe('Other tab');
 await expect(saveListing({...mine,details:{...mine.details,title:'Stale edit'}})).rejects.toThrow('another tab');
 expect((await readListing(mine.planId))?.details.title).toBe('Other tab');
});

it('retains a reference that belongs only to a historical floor after backup restoration',async()=>{
 let p=createSamplePlan('Reference timeline','metric');
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQJ8AAAAASUVORK5CYII=';
 const value={page:1,rotation:0,reference:{url:image,width:1,height:1,pages:1,name:'Earlier plan'}};
 const removed=p.floors[1];removed.referenceId=await saveReferenceVersion(p.id,value);
 p=startRenovation(p,p.floors[0].id,validatePlan);
 p={...p,floors:[p.floors[0]],furniture:p.furniture.filter(item=>item.floorId===p.floors[0].id)};validatePlan(p);
 const backup=await buildProjectBackup(p);expect(backup.referenceVersions?.some(r=>r.floorId===removed.id&&r.status==='included')).toBe(true);
 const restored=await restoreProjectBackup(backup);validatePlan(restored);
 expect(await loadReferenceVersion(restored.id,removed.referenceId!)).toEqual(value);
 expect(restored.floors).toHaveLength(1);expect(restored.designHistory!.checkpoints[0].snapshot.floors).toHaveLength(2);
});
