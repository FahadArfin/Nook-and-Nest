import {validateRecognition,type Recognition} from './recognitionContract';
import type {PlanReference} from './blueprintImport';

export type ScanModel='gpt-5.6-luna'|'gpt-6-astra';
const storageKey='nook-recognition-cache-v1';
type Entry={key:string;created:number;result:Recognition};
function entries():Entry[] {
  try {const value=JSON.parse(localStorage.getItem(storageKey)??'[]');return Array.isArray(value)?value.filter(e=>e&&typeof e.key==='string'&&Number.isFinite(e.created)&&Date.now()-e.created<30*86400000).slice(-10):[];}catch{return [];}
}
export async function recognitionKey(ref:PlanReference,model:ScanModel):Promise<string|undefined> {
  try {const bytes=new TextEncoder().encode(JSON.stringify(['rooms-v2',model,ref.width,ref.height,ref.url]));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}catch{return undefined;}
}
export function cachedRecognition(key:string|undefined,ref:PlanReference):Recognition|undefined {
  if(!key)return;
  try {const entry=entries().find(e=>e.key===key);if(!entry)return;const result=validateRecognition(entry.result,ref.width,ref.height);return result;}catch{return undefined;}
}
export function saveRecognition(key:string|undefined,result:Recognition):boolean {
  if(!key)return false;
  try {localStorage.setItem(storageKey,JSON.stringify([...entries().filter(e=>e.key!==key),{key,created:Date.now(),result}].slice(-10)));return true;}catch{return false;}
}
export function clearRecognitionCache():boolean {try{localStorage.removeItem(storageKey);return true;}catch{return false;}}
