import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import type {Scene} from '@babylonjs/core/scene';
import type {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import type {Observer} from '@babylonjs/core/Misc/observable';
import {motionData} from './LivingModels';

export const liveClockIds=new Set(['divergence-clock','digital-alarm-clock']);
export const desktopClockTime=(date:Date)=>[date.getHours(),date.getMinutes(),date.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');

/** Local computer time; one shared texture per clock style, refreshed at most once a second.
 * No saved state or simulated-time accumulation. Clock ticks have no movement or flashing. */
export class LiveClocks {
 private observer:Observer<Scene>;
 private displays=new Map<string,{texture:DynamicTexture;material:StandardMaterial;roots:Set<TransformNode>}>();
 private lastSecond=-1;
 constructor(private scene:Scene){this.observer=scene.onBeforeRenderObservable.add(()=>{
  if(typeof document!=='undefined'&&document.hidden)return;
  const now=new Date(),second=Math.floor(now.getTime()/1000);if(second===this.lastSecond)return;this.lastSecond=second;
  for(const [id,display] of this.displays)if([...display.roots].some(r=>!r.isDisposed()&&r.isEnabled()))this.paint(id,now);
 });}
 private paint(id:string,now:Date){
  const display=this.displays.get(id);if(!display)return;
  const ctx=display.texture.getContext() as CanvasRenderingContext2D;ctx.clearRect(0,0,512,128);
  if(id==='digital-alarm-clock'){ctx.fillStyle='#081012';ctx.fillRect(0,0,512,128);}
  ctx.fillStyle=id==='divergence-clock'?'#ff9c40':'#c5f1e8';ctx.font='92px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  [...desktopClockTime(now)].forEach((char,i)=>ctx.fillText(char,(i+.5)*64,66));display.texture.update(false);
 }
 attach(root:TransformNode,id:string){
  if(!liveClockIds.has(id))return;
  let display=this.displays.get(id);
  if(!display){
   const texture=new DynamicTexture('local-time-'+id,{width:512,height:128},this.scene,false);texture.hasAlpha=true;texture.uScale=-1;texture.uOffset=1;
   const material=new StandardMaterial('local-clock-'+id,this.scene);material.diffuseTexture=texture;material.emissiveTexture=texture;material.emissiveColor=Color3.White();material.specularColor=Color3.Black();material.disableLighting=true;material.useAlphaFromDiffuseTexture=true;material.backFaceCulling=false;
   display={texture,material,roots:new Set()};this.displays.set(id,display);this.paint(id,new Date());
  }
  for(const node of root.getDescendants())if(motionData(node).motion_role==='clock_preview')node.setEnabled(false);
  for(const mesh of root.getChildMeshes())if(mesh.metadata?.livingMaterial==='live-clock-display')mesh.material=display.material;
  display.roots.add(root);root.onDisposeObservable.addOnce(()=>{display?.roots.delete(root);});
 }
 dispose(){this.scene.onBeforeRenderObservable.remove(this.observer);for(const d of this.displays.values()){d.material.dispose();d.texture.dispose();}this.displays.clear();}
}
