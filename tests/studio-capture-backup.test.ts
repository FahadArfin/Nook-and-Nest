import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {deleteDB,openDB} from 'idb';
import {createSamplePlan} from '../src/domain';
import {createStudioCaptureSource} from '../src/studioCaptureSource';
import {loadFloorReference,saveStudioReference,saveReferenceVersion} from '../src/studioReference';
import {buildProjectBackup,parseProjectBackup,restoreProjectBackup,validateProjectBackup} from '../src/projectBackup';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQJ8AAAAASUVORK5CYII=';
const otherImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgQIAZ+X6WQAAAABJRU5ErkJggg==';
afterEach(async()=>{for(const db of ['nook-studio-references','nook-and-nest','nook-listing-studio'])await deleteDB(db);});
async function fixture(){const plan=createSamplePlan('Source preservation');plan.floors=plan.floors.slice(0,1);plan.furniture=[];plan.floors[0].stairs=[];const reference={url:image,width:1,height:1,pages:1,name:'Local reference'},captureSource=await createStudioCaptureSource(reference,1,0,'manual-tracing'),value={reference,page:1,rotation:0,captureSource};await saveStudioReference(plan.id,plan.floors[0].id,value);plan.floors[0].referenceId=await saveReferenceVersion(plan.id,value);return {plan,captureSource,backup:await buildProjectBackup(plan)};}
it('complete local backup preserves exact source identity through parsing and restored reference versions',async()=>{
 const {backup,captureSource}=await fixture(),parsed=parseProjectBackup(JSON.stringify(backup));
 expect(parsed.references[0].status==='included'&&parsed.references[0].captureSource).toEqual(captureSource);
 const restored=await restoreProjectBackup(parsed),local=await loadFloorReference(restored.id,restored.floors[0]);expect(local?.captureSource).toEqual(captureSource);expect(local?.reference?.url).toBe(image);
});
it('matching dimensions with different image bytes cannot acquire the old source ID and write a restored project',async()=>{
 const {backup}=await fixture();if(backup.references[0].status!=='included')throw Error('fixture');backup.references[0].preview!.url=otherImage;
 expect(()=>validateProjectBackup(backup)).not.toThrow();await expect(restoreProjectBackup(backup)).rejects.toThrow('does not match the backup reference bytes');
 const db=await openDB('nook-and-nest',1,{upgrade(d){d.createObjectStore('projects');}});expect(await db.count('projects')).toBe(0);db.close();
});
it('bounds backup evidence, strips unknown media fields, and rejects page/rotation mismatch',async()=>{
 const {backup}=await fixture();const input=structuredClone(backup);if(input.references[0].status!=='included')throw Error('fixture');
 (input.references[0].captureSource as unknown as Record<string,unknown>).privateFile='do not retain';
 const parsed=validateProjectBackup(input);expect(JSON.stringify(parsed.references)).not.toContain('privateFile');
 input.references[0].captureSource!.source.rotation=90;expect(()=>validateProjectBackup(input)).toThrow('does not match');
 input.references[0].captureSource!.source.rotation=0;input.references[0].captureSource!.referenceDigest='a'.repeat(10000);expect(()=>validateProjectBackup(input)).toThrow('Invalid capture evidence');
});
