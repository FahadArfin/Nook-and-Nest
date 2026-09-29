import {openDB} from 'idb';
import {blankListingDetails,createListing,parseListing,type ListingDetails,type ListingDocument} from './listingTypes';

const database=()=>openDB('nook-listing-studio',1,{upgrade(db){db.createObjectStore('listings');db.createObjectStore('preferences');}});
const agentKeys=['agentName','agentEmail','agentPhone','agency'] as const;
interface StoredListing {revision:number;document:ListingDocument}
const revisions=new Map<string,number>();
let queue:Promise<unknown>=Promise.resolve();
function stored(value:unknown,planId:string):StoredListing|undefined {
  if(value===undefined)return;
  const entry=value as Partial<StoredListing>;
  const envelope=entry&&typeof entry==='object'&&'document' in entry;
  if(envelope&&(!Number.isSafeInteger(entry.revision)||(entry.revision??0)<1))throw new Error('The saved listing revision is invalid.');
  const document=parseListing(envelope?entry.document:value);
  if(document.planId!==planId)throw new Error('This listing belongs to another project.');
  return {document,revision:envelope?entry.revision!:0};
}
function enqueue(task:()=>Promise<void>):Promise<void>{const next=queue.catch(()=>{}).then(task);queue=next;return next;}
async function abortTransaction(tx:{abort():void;done:Promise<unknown>}){try{tx.abort()}catch{}await tx.done.catch(()=>{});}
function equalValue(left:unknown,right:unknown):boolean {
  if(left===right)return true;
  if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;
  const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equalValue(a[key],b[key]));
}
/** Timestamps describe edits; refreshing them alone must never create a conflicting save. */
function sameListingContent(left:ListingDocument,right:ListingDocument):boolean {
  return left.version===right.version&&left.planId===right.planId&&left.format===right.format&&left.branded===right.branded&&equalValue(left.details,right.details)&&equalValue(left.media,right.media);
}
export async function loadListing(planId:string,title:string):Promise<ListingDocument>{
  await queue.catch(()=>{});
  const db=await database();
  try {const tx=db.transaction(['listings','preferences'],'readwrite');
    try{
    const value=stored(await tx.objectStore('listings').get(planId),planId);
    if(value){await tx.done;revisions.set(planId,value.revision);return value.document;}
    const next=createListing(planId,title);const prefs=await tx.objectStore('preferences').get('agent');
    if(prefs)for(const key of agentKeys)if(typeof prefs[key]==='string')next.details[key]=prefs[key].slice(0,4000);
    const document=parseListing(next);await tx.objectStore('listings').put({revision:1,document},planId);await tx.done;revisions.set(planId,1);return document;
    }catch(error){await abortTransaction(tx);throw error;}
  } finally {db.close();}
}
// Snapshot before queuing, commit in invocation order, and refuse another tab's newer revision.
export async function saveListing(doc:ListingDocument):Promise<void>{
  const snapshot=parseListing(doc);
  return enqueue(async()=>{const db=await database();try{
    const tx=db.transaction('listings','readwrite');
    try{
    const current=stored(await tx.store.get(snapshot.planId),snapshot.planId),expected=revisions.get(snapshot.planId)??0;
    // Compare inside the write transaction so parallel identical saves cannot increment twice.
    // This also adopts another tab's revision when both tabs made the exact same edit.
    if(current&&sameListingContent(current.document,snapshot)){await tx.done;revisions.set(snapshot.planId,current.revision);return;}
    if((current?.revision??0)!==expected){tx.abort();await tx.done.catch(()=>{});throw new Error('This listing was saved in another tab. Download your backup and reopen the listing before saving again.');}
    const revision=expected+1;await tx.store.put({revision,document:snapshot},snapshot.planId);await tx.done;revisions.set(snapshot.planId,revision);
    }catch(error){await abortTransaction(tx);throw error;}
  }finally{db.close()}});
}
export async function saveAgentDefaults(details:ListingDetails){
  const prefs:Partial<ListingDetails>={};for(const key of agentKeys){const value=details[key]??blankListingDetails[key];if(typeof value!=='string'||value.length>4000)throw new Error('Agent details are invalid or too long.');prefs[key]=value;}
  return enqueue(async()=>{const db=await database();try{await db.put('preferences',prefs,'agent')}finally{db.close()}});
}
