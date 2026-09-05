import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import type {Scene} from '@babylonjs/core/scene';
import type {Observer} from '@babylonjs/core/Misc/observable';

export const motionData=(node:{metadata?:any}|null)=>node?.metadata?.gltf?.extras??node?.metadata??{};
export const fireplaceIds=new Set(['cottage-fireplace','wood-stove','linear-fireplace','stone-arch-fireplace','cast-iron-fireplace','tiled-corner-stove']);
export const holidayBrightness=(time:number,phase=0)=>.72+.28*Math.sin(time*Math.PI/3+phase);
export function swimPose(time:number,index:number,w:number,d:number){
 const t=time*(.25+index*.017)+index*1.47;
 return {x:Math.sin(t)*w*.105,z:Math.cos(t)*d*.12,y:Math.sin(t*1.7)*.014,heading:Math.atan2(Math.sin(t)*d*.12,Math.cos(t)*w*.105),tail:Math.sin(time*7+index)*.27};
}
const fireVertex=`precision highp float;
attribute vec3 position; uniform mat4 worldViewProjection; uniform float time; uniform float bottom; uniform float span;
varying vec3 local; varying float level;
void main(){vec3 p=position;level=clamp((p.y-bottom)/span,0.,1.);float phase=p.x*39.+p.z*53.;
p.x+=sin(time*3.4+phase+level*8.)*span*.055*level;
p.z+=cos(time*2.7+phase+level*5.)*span*.025*level;
p.y+=sin(time*4.1+phase)*span*.10*level;local=p;gl_Position=worldViewProjection*vec4(p,1.);}`;
const fireFragment=`precision highp float;
uniform float time;uniform vec3 tint;varying vec3 local;varying float level;
void main(){float swirl=.5+.5*sin(local.x*91.+local.z*71.-time*5.+sin(local.y*47.-time*3.));
vec3 hot=vec3(1.,.85,.30);vec3 edge=tint;float shade=clamp(level*.65+swirl*.28,0.,1.);
gl_FragColor=vec4(mix(hot,edge,shade)*(1.05+.09*sin(time*4.7+local.x*22.)),1.);}`;

/** One scene clock. Authored geometry is shared; only transforms/uniforms change. */
export class LivingModels{
 private entries=new Map<TransformNode,(time:number)=>void>();private observer:Observer<Scene>;private elapsed=0;
 constructor(private scene:Scene){this.observer=scene.onBeforeRenderObservable.add(()=>{
  if(typeof document!=='undefined'&&document.hidden)return;
  const reduced=typeof window!=='undefined'&&(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
  if(!reduced)this.elapsed+=Math.min(scene.getEngine().getDeltaTime(),50)/1000;
  this.tick(reduced?0:this.elapsed);
 });}
 tick(time:number){for(const [root,animate] of this.entries){if(root.isDisposed()){this.entries.delete(root);continue;}if(!root.isEnabled())continue;const camera=this.scene.activeCamera;if(camera&&Vector3.DistanceSquared(root.getAbsolutePosition(),camera.position)>1600)continue;animate(time);}}
 attach(root:TransformNode,id:string,w:number,d:number,h:number){
  const materials:ShaderMaterial[]=[];
  if(fireplaceIds.has(id)){
   for(const mesh of root.getChildMeshes()){
    const name=mesh.metadata?.livingMaterial??mesh.material?.name??'';if(!['golden-flame','warm-light'].includes(name))continue;
    const bounds=mesh.getBoundingInfo().boundingBox;const mat=new ShaderMaterial('living-fire',this.scene,{vertexSource:fireVertex,fragmentSource:fireFragment},{attributes:['position'],uniforms:['worldViewProjection','time','bottom','span','tint']});
    mat.backFaceCulling=false;mat.setFloat('bottom',bounds.minimum.y);mat.setFloat('span',Math.max(.01,bounds.maximum.y-bounds.minimum.y));mat.setFloat('time',0);mat.setColor3('tint',name==='golden-flame'?new Color3(1,.19,.015):new Color3(1,.45,.05));mesh.material=mat;materials.push(mat);
   }
   if(materials.length)this.entries.set(root,time=>{for(const m of materials)m.setFloat('time',time);});
  }
  if(id==='christmas-tree'||id==='christmas-slim-tree'){
   for(const mesh of root.getChildMeshes()){
    const name=mesh.metadata?.livingMaterial??mesh.material?.name??'';if(!name.startsWith('holiday-light-'))continue;
    const color=name.endsWith('red')?new Color3(1,.025,.012):name.endsWith('blue')?new Color3(.03,.18,1):new Color3(1,.67,.035);
    const mat=new ShaderMaterial('holiday-glow',this.scene,{vertexSource:'precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; void main(){gl_Position=worldViewProjection*vec4(position,1.);}',fragmentSource:'precision highp float; uniform vec3 tint; uniform float brightness; void main(){gl_FragColor=vec4(tint*brightness*1.7,1.);}'},{attributes:['position'],uniforms:['worldViewProjection','tint','brightness']});
    mat.setColor3('tint',color);mat.setFloat('brightness',holidayBrightness(0,materials.length*2));mesh.material=mat;materials.push(mat);
   }
   if(materials.length)this.entries.set(root,time=>materials.forEach((m,i)=>m.setFloat('brightness',holidayBrightness(time,i*2))));
  }
  if(id.endsWith('-aquarium')){
   const nodes=root.getDescendants(false).filter(n=>motionData(n).motion_role&&!motionData(n.parent).motion_role) as TransformNode[];
   const fish=nodes.filter(n=>motionData(n).motion_role==='fish').map(node=>({node,index:Number(motionData(node).motion_index),rest:node.position.clone(),tail:nodes.find(n=>motionData(n).motion_role==='tail'&&motionData(n).motion_index===motionData(node).motion_index)}));
   const tails=new Map(fish.filter(f=>f.tail).map(f=>[f.index,f.tail!.position.subtract(f.rest)]));
   const bubbles=nodes.filter(n=>motionData(n).motion_role==='bubble').map(node=>({node,index:Number(motionData(node).motion_index),rest:node.position.clone()}));
   const base=id==='desktop-aquarium'?.025:h*.53,range=h-base-.13;
   this.entries.set(root,time=>{
    for(const f of fish){const pose=swimPose(time,f.index,w,d);f.node.rotationQuaternion=null;f.node.position.set(f.rest.x+pose.x,f.rest.y+pose.y,f.rest.z+pose.z);f.node.rotation.y=pose.heading;
     if(f.tail){const offset=tails.get(f.index)!,a=pose.heading;f.tail.rotationQuaternion=null;f.tail.position.set(f.node.position.x+offset.x*Math.cos(a)+offset.z*Math.sin(a),f.node.position.y+offset.y,f.node.position.z-offset.x*Math.sin(a)+offset.z*Math.cos(a));f.tail.rotation.y=a+pose.tail;}
    }
    for(const b of bubbles){const t=(time*.14+b.index/18)%1;b.node.position.y=base+.07+range*t;b.node.position.x=b.rest.x+Math.sin(time*1.7+b.index)*.008;b.node.scaling.setAll(.65+t*.45);}
   });
  }
  root.onDisposeObservable.add(()=>{this.entries.delete(root);for(const m of materials)m.dispose();});
 }
 dispose(){this.scene.onBeforeRenderObservable.remove(this.observer);this.entries.clear();}
}
