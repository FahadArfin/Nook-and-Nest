import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

const vertexSource = `precision highp float;
attribute vec3 position; attribute vec2 uv;
uniform mat4 world; uniform mat4 worldViewProjection;
varying vec2 vUV; varying vec3 vWorld; varying vec3 vLocal;
void main(){vUV=uv;vLocal=position;vWorld=(world*vec4(position,1.0)).xyz;gl_Position=worldViewProjection*vec4(position,1.0);}`;

export function createTorontoGround(scene:Scene, image:Texture, base:Color3, night:()=>boolean) {
 const material=new ShaderMaterial('Toronto aerial ground',scene,{vertexSource,fragmentSource:`precision highp float;
 varying vec2 vUV; uniform sampler2D aerial; uniform vec3 baseColor; uniform float night; uniform float photoReady;
 void main(){
  vec2 border=min(vUV,1.0-vUV);
  float coverage=photoReady*smoothstep(0.0,0.012,min(border.x,border.y));
  vec3 color=mix(baseColor,texture2D(aerial,clamp(vUV,0.0,1.0)).rgb,coverage);
  gl_FragColor=vec4(color*mix(0.88,0.24,night),1.0);
 }`},{attributes:['position','uv'],uniforms:['world','worldViewProjection','baseColor','night','photoReady'],samplers:['aerial']});
 material.setFloat('photoReady',0);material.setTexture('aerial',image);material.setColor3('baseColor',base);material.backFaceCulling=false;
 material.onBindObservable.add(()=>material.setFloat('night',night()?1:0));
 return material;
}

/** Analytic ripple normals: no moving shoreline vertices and no reflection render pass. */
export function createTorontoLake(scene:Scene, night:()=>boolean) {
 const material=new ShaderMaterial('Toronto rippling lake',scene,{vertexSource,fragmentSource:`precision highp float;
 varying vec3 vWorld; varying vec3 vLocal; uniform float time; uniform float night; uniform float photoReady; uniform vec3 eye;
 void main(){
  vec2 p=vLocal.xz;
  float a=dot(p,vec2(0.42,0.25))+time*0.55;
  float b=dot(p,vec2(-0.16,0.31))-time*0.38;
  float c=dot(p,vec2(1.8,0.7))+time*0.9;
  vec3 normal=normalize(vec3(0.08*cos(a)+0.05*cos(b),1.0,0.06*sin(a)+0.07*cos(b)+0.02*sin(c)));
  vec3 view=normalize(eye-vWorld);
  float fresnel=pow(1.0-clamp(dot(view,normal),0.0,1.0),4.0);
  vec3 deep=mix(vec3(0.045,0.18,0.22),vec3(0.014,0.035,0.065),night);
  vec3 sky=mix(vec3(0.46,0.62,0.67),vec3(0.07,0.11,0.17),night);
  vec3 color=mix(deep,sky,0.18+0.72*fresnel);
  vec3 light=normalize(vec3(-0.4,0.8,0.25));
  float sparkle=pow(max(dot(normal,normalize(view+light)),0.0),110.0);
  color+=mix(vec3(0.7,0.73,0.64),vec3(0.2,0.25,0.35),night)*sparkle*0.55;
  color+=0.009*sin(a+b);
  gl_FragColor=vec4(color,1.0);
 }`},{attributes:['position','uv'],uniforms:['world','worldViewProjection','time','night','eye']});
 material.backFaceCulling=false;let elapsed=0;
 material.onBindObservable.add(()=>{
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(!reduced)elapsed+=Math.min(scene.getEngine().getDeltaTime(),100)/1000;
  material.setFloat('time',elapsed);material.setFloat('night',night()?1:0);
  material.setVector3('eye',scene.activeCamera?.globalPosition??new Vector3(0,100,0));
 });
 return material;
}

