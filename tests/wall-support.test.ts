import {describe,it,expect} from 'vitest';
import {wallSupport} from '../src/wallSupport';
import {validateEvidence,PIPELINE_VERSION} from '../src/recognitionEvidence';
const image=()=>new Uint8ClampedArray(400*300*4).fill(255);
function ink(p:Uint8ClampedArray,x:number,y:number,w:number,h:number){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const k=(yy*400+xx)*4;p[k]=p[k+1]=p[k+2]=0;}}
describe('wall support',()=>{
  it('retains substantial strokes without filling a doorway or retaining thin grids',()=>{const p=image();ink(p,40,40,8,100);ink(p,40,175,8,100);ink(p,48,40,200,8);ink(p,70,90,180,1);ink(p,100,120,6,7);const before=p.slice();const r=wallSupport(p,400,300);expect(r.mask[(50*400+43)*4]).toBe(0);expect(r.mask[(155*400+43)*4]).toBe(255);expect(r.mask[(90*400+100)*4]).toBe(255);expect(r.mask[(122*400+102)*4]).toBe(255);expect(p).toEqual(before);});
  it('handles blank and transparent inputs without inventing walls',()=>{expect(wallSupport(image(),400,300).components).toBe(0);expect(wallSupport(new Uint8ClampedArray(400*300*4),400,300).components).toBe(0);expect(()=>wallSupport(image(),2000,2000)).toThrow();});
  it('bounds auxiliary images and versions while accepting the unchanged baseline',()=>{const base={version:PIPELINE_VERSION,walls:[],crops:[]};expect(validateEvidence(base,400,300)).toEqual(base);expect(()=>validateEvidence({...base,wallView:{version:'other',image:'data:image/png;base64,AA=='}},400,300)).toThrow();expect(()=>validateEvidence({...base,wallView:{version:'wall-support-v1',image:'https://example.com/image.png'}},400,300)).toThrow();expect(validateEvidence({...base,wallView:{version:'wall-support-v1',image:'data:image/png;base64,AA=='}},400,300)?.wallView).toBeDefined();});
});
