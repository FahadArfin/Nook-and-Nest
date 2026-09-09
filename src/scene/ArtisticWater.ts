import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {Effect} from '@babylonjs/core/Materials/effect';
import type {Scene} from '@babylonjs/core/scene';
Effect.ShadersStore.artisticWaterVertexShader=`precision highp float;
attribute vec3 position;attribute vec2 uv;attribute float waterDepth;
uniform mat4 worldViewProjection;uniform float time;
varying vec2 vUv;varying float vDepth;varying vec2 vWorld;
void main(){vec3 p=position;float shore=smoothstep(0.0,.22,waterDepth);p.y+=shore*.009*(sin(p.x*3.1+p.z*1.8-time*1.3)+sin(p.z*5.2-p.x*.9+time*.8))*.5;vUv=uv;vWorld=p.xz;vDepth=waterDepth;gl_Position=worldViewProjection*vec4(p,1.0);}`;
Effect.ShadersStore.artisticWaterFragmentShader=`precision highp float;
uniform float time;uniform float night;varying vec2 vUv;varying float vDepth;varying vec2 vWorld;
void main(){vec2 p=vWorld;float waves=sin(p.x*3.1+p.y*1.8-time*1.3)*sin(p.y*5.2-p.x*.9+time*.8);float fine=sin(p.x*19.0+p.y*12.0+time*.6)*sin(p.y*16.0-p.x*7.0-time*.5);float depth=smoothstep(0.0,1.2,vDepth);vec3 color=mix(vec3(.39,.70,.65),vec3(.10,.37,.42),depth);color+=waves*.026+fine*.008;float glint=pow(max(0.0,waves),12.0)*.10;float foam=(1.0-smoothstep(.015,.13,vDepth))*(.45+.15*sin(p.x*8.0+p.y*5.0-time));color=mix(color,vec3(.81,.88,.77),foam)+glint;color*=mix(1.0,.43,night);gl_FragColor=vec4(color,mix(.66,.92,depth)*smoothstep(0.0,.035,vDepth));}`;
export function artisticWater(scene:Scene){const material=new ShaderMaterial('artistic-river',scene,'artisticWater',{attributes:['position','uv','waterDepth'],uniforms:['worldViewProjection','time','night'],needAlphaBlending:true});material.backFaceCulling=false;material.setFloat('time',0);material.setFloat('night',0);return material;}
