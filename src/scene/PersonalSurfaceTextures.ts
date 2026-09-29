import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {Color3} from '@babylonjs/core/Maths/math.color';
import type {PBRMaterial} from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type {Scene} from '@babylonjs/core/scene';
import type {FurniturePlacement,PlanDocumentV1} from '../types';
import type {PersonalSurface} from '../moodboards';
import {loadPersonalPhoto} from '../personalStorage';
import {personalSurfaceImageKey,personalSurfaceRepeat,renderPersonalSurfaceImage} from '../personalSurfaceImage';

export const PERSONAL_TEXTURE_LIMIT=16;
type Entry={key:string;surface:PersonalSurface;item:FurniturePlacement;texture?:DynamicTexture;abort:AbortController;started:boolean;missing:boolean};
/** At most 16 small GPU textures and two concurrent preview decodes. Originals stay in storage. */
export class PersonalSurfaceTextures {
 private scope='';private entries=new Map<string,Entry>();private targets=new Map<string,Set<PBRMaterial>>();private running=0;private disposed=false;
 private desired:FurniturePlacement[]=[];private channel?:BroadcastChannel;
 private changed=()=>{this.clear();this.configure(this.scope,this.desired);this.invalidate()};
 constructor(private scene:Scene,private invalidate:()=>void){
  if(typeof window!=='undefined')window.addEventListener('nook-private-media-change',this.changed);
  if(typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel('nook-private-media');this.channel.onmessage=this.changed;}
 }
 get loading(){return this.running>0||[...this.entries.values()].some(e=>!e.started);}
 key(item:FurniturePlacement){const s=item.personalSurface;return !s||s.hidden?'':JSON.stringify([this.scope,personalSurfaceImageKey(s),s.repeatWidthMm,s.repeatHeightMm,item.widthMm,item.heightMm]);}
 configure(projectId:string,items:FurniturePlacement[]){
  if(this.disposed)return;
  if(this.scope!==projectId){this.clear();this.scope=projectId;}
  this.desired=items;const chosen=new Map<string,FurniturePlacement>();
  for(const item of items){const key=this.key(item);if(key&&!chosen.has(key)){chosen.set(key,item);if(chosen.size===PERSONAL_TEXTURE_LIMIT)break;}}
  for(const [key,entry] of this.entries)if(!chosen.has(key)){entry.abort.abort();this.fallback(key);entry.texture?.dispose();this.entries.delete(key);}
  for(const [key,item] of chosen)if(!this.entries.has(key))this.entries.set(key,{key,item,surface:structuredClone(item.personalSurface!),abort:new AbortController(),started:false,missing:false});
  this.pump();
 }
 bind(material:PBRMaterial,item:FurniturePlacement){
  const surface=item.personalSurface;if(!surface)return;
  material.albedoTexture=null;material.albedoColor=Color3.FromHexString(surface.fallbackColor).toLinearSpace();
  material.metadata={...material.metadata,personalImageState:surface.hidden?'private':'loading'};
  if(surface.hidden)return;
  const key=this.key(item);let set=this.targets.get(key);if(!set){set=new Set();this.targets.set(key,set)}set.add(material);
  material.onDisposeObservable.addOnce(()=>{set!.delete(material);if(!set!.size)this.targets.delete(key)});
  const entry=this.entries.get(key);if(entry?.texture)this.apply(key,entry.texture);else material.metadata.personalImageState=entry?.missing?'missing':entry?'loading':'budget';
 }
 private apply(key:string,texture:DynamicTexture){for(const material of this.targets.get(key)??[]){material.albedoTexture=texture;material.albedoColor=Color3.White();material.metadata={...material.metadata,personalImageState:'ready'}}}
 private fallback(key:string){for(const material of this.targets.get(key)??[]){material.albedoTexture=null;const s=this.entries.get(key)?.surface;if(s)material.albedoColor=Color3.FromHexString(s.fallbackColor).toLinearSpace();material.metadata={...material.metadata,personalImageState:'placeholder'}}}
 private pump(){
  if(this.disposed)return;
  for(const entry of this.entries.values()){
   if(this.running>=2)break;if(entry.started)continue;entry.started=true;this.running++;
   void this.load(entry).finally(()=>{this.running--;this.pump()});
  }
 }
 private async load(entry:Entry){
  try{
   const photo=entry.surface.assetId?await loadPersonalPhoto(entry.surface.assetId):undefined;
   if(entry.abort.signal.aborted||this.disposed||this.entries.get(entry.key)!==entry)return;
   const rendered=await renderPersonalSurfaceImage(entry.surface,photo,512,true,entry.abort.signal);
   if(entry.abort.signal.aborted||this.disposed||this.entries.get(entry.key)!==entry)return;
   if(rendered.missing){entry.missing=true;this.fallback(entry.key);return;}
   const texture=new DynamicTexture('personal-surface',rendered.canvas,this.scene,true,Texture.TRILINEAR_SAMPLINGMODE);
   // glTF color images use the loader's non-inverted orientation.
   texture.update(false);texture.gammaSpace=true;texture.anisotropicFilteringLevel=2;
   const repeat=personalSurfaceRepeat(entry.surface,entry.item.widthMm,entry.item.heightMm);
   texture.uScale=repeat.uScale;texture.vScale=repeat.vScale;texture.wrapU=texture.wrapV=entry.surface.kind==='swatch'?Texture.WRAP_ADDRESSMODE:Texture.CLAMP_ADDRESSMODE;
   entry.texture=texture;this.apply(entry.key,texture);
  }catch{if(!entry.abort.signal.aborted){entry.missing=true;this.fallback(entry.key)}}finally{this.invalidate()}
 }
 private clear(){for(const [key,entry] of this.entries){entry.abort.abort();this.fallback(key);entry.texture?.dispose()}this.entries.clear();}
 dispose(){if(this.disposed)return;this.disposed=true;this.clear();this.targets.clear();this.channel?.close();if(typeof window!=='undefined')window.removeEventListener('nook-private-media-change',this.changed);}
}

/** Prioritize the selected and current-floor items without reordering saved furniture. */
export function personalTextureCandidates(plan:PlanDocumentV1,floorId:string,selectedId?:string,draft?:FurniturePlacement){
 const items=plan.furniture.filter(p=>p.personalSurface&&!p.personalSurface.hidden);
 items.sort((a,b)=>Number(b.id===selectedId)-Number(a.id===selectedId)||Number(b.floorId===floorId)-Number(a.floorId===floorId));
 return draft?.personalSurface?[draft,...items.filter(p=>p.id!==draft.id)]:items;
}
