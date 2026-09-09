import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {Effect} from '@babylonjs/core/Materials/effect';
import type {Scene} from '@babylonjs/core/scene';
Effect.ShadersStore.artisticWaterVertexShader=`precision highp float;
attribute vec3 position;attribute vec2 uv;attribute float waterDepth;attribute vec2 waterFlow;
uniform mat4 worldViewProjection;uniform float time;
varying vec2 vUv;varying float vDepth;varying vec2 vWorld;varying vec2 vFlow;varying float vHeight;
void main(){vec3 p=position;float shore=smoothstep(0.0,.22,waterDepth);p.y+=shore*.009*(sin(p.x*3.1+p.z*1.8-time*1.3)+sin(p.z*5.2-p.x*.9+time*.8))*.5;vFlow=waterFlow;vHeight=p.y;vUv=uv;vWorld=p.xz;vDepth=waterDepth;gl_Position=worldViewProjection*vec4(p,1.0);}`;
Effect.ShadersStore.artisticWaterFragmentShader=`precision highp float;
uniform float time;uniform float night;uniform vec3 eye;
varying vec2 vUv;varying float vDepth;varying vec2 vWorld;varying vec2 vFlow;varying float vHeight;
float swell(vec2 p){return sin(p.x*2.7+p.y*1.3-time*.85)*.018+sin(p.y*4.1-p.x*1.7+time*.65)*.011+sin(p.x*13.0+p.y*9.0-time*1.1)*.0025+sin(p.y*21.0-p.x*7.0+time*.8)*.0012;}
void main(){
 vec2 p=vWorld-vFlow*sin(time*.025)*6.0;float h=swell(p);vec3 normal=normalize(vec3((h-swell(p+vec2(.025,0.0)))/.025,1.0,(h-swell(p+vec2(0.0,.025)))/.025));
 vec3 view=normalize(eye-vec3(vWorld.x,vHeight,vWorld.y));float facing=max(dot(normal,view),0.0);float fresnel=.035+.55*pow(1.0-facing,5.0);
 float depth=smoothstep(0.0,1.4,vDepth);vec3 body=mix(vec3(.35,.58,.48),vec3(.055,.25,.28),depth);
 vec3 reflected=reflect(-view,normal);vec3 sky=mix(vec3(.59,.66,.57),vec3(.48,.67,.78),smoothstep(0.0,.8,reflected.y));
 vec3 light=normalize(vec3(-.4,.8,.25));float sparkle=pow(max(dot(normal,normalize(light+view)),0.0),180.0)*.55;
 float caustic=pow(.5+.5*sin(p.x*9.0+sin(p.y*7.0+time*.3)+time*.4),8.0)*pow(.5+.5*sin(p.y*11.0-p.x*2.0-time*.35),4.0);
 body+=caustic*.065*(1.0-depth);vec3 color=mix(body,sky,fresnel)+sparkle*(1.0-night*.9);
 float shore=(1.0-smoothstep(.01,.10,vDepth))*(.22+.14*sin(p.x*7.0+p.y*9.0-time*.6));color=mix(color,vec3(.79,.84,.72),shore);color*=mix(1.0,.43,night);
 gl_FragColor=vec4(color,mix(.68,.96,depth)*smoothstep(0.0,.035,vDepth));}`;
export function artisticWater(scene:Scene){const material=new ShaderMaterial('artistic-river',scene,'artisticWater',{attributes:['position','uv','waterDepth','waterFlow'],uniforms:['worldViewProjection','time','night','eye'],needAlphaBlending:true});material.backFaceCulling=false;material.setFloat('time',0);material.setFloat('night',0);const observer=scene.onBeforeRenderObservable.add(()=>{if(scene.activeCamera)material.setVector3('eye',scene.activeCamera.globalPosition)});material.onDisposeObservable.add(()=>scene.onBeforeRenderObservable.remove(observer));return material;}
