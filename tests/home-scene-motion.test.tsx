// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,render,act} from '@testing-library/react';
import {HomeSceneMotion} from '../src/HomeSceneMotion';
let reduced=false,hidden=false;
let mediaChanged:()=>void;
let images:Array<{onload:null|(()=>void)}>;
let frames:Map<number,FrameRequestCallback>;
let context:Record<string,unknown>;
beforeEach(()=>{
 reduced=false;hidden=false;images=[];frames=new Map();let serial=0;
 const gradient={addColorStop:vi.fn()};
 context=new Proxy({} as Record<string,unknown>, {get:(o,k)=>o[k as string]??(o[k as string]=String(k).startsWith('create')?vi.fn(()=>gradient):vi.fn())});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
 vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 vi.stubGlobal('matchMedia',()=>({get matches(){return reduced;},addEventListener:(_s:string,f:()=>void)=>{mediaChanged=f;},removeEventListener:vi.fn()}));
 vi.stubGlobal('Image',class {onload=null;constructor(){images.push(this);}set src(_s:string){}});
 vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{frames.set(++serial,f);return serial;});
 vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('stops scheduling on pause, hidden page, reduced motion and unmount',()=>{
 const view=render(<HomeSceneMotion src="/assets/ambience/rain-day.webp" moving/>);
 act(()=>images[0].onload?.());expect(frames.size).toBe(1);
 act(()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));});expect(frames.size).toBe(0);
 act(()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));});expect(frames.size).toBe(1);
 act(()=>{reduced=true;mediaChanged();});expect(frames.size).toBe(0);
 act(()=>{reduced=false;mediaChanged();});expect(frames.size).toBe(1);
 view.rerender(<HomeSceneMotion src="/assets/ambience/rain-day.webp" moving={false}/>);
 act(()=>images.at(-1)!.onload?.());expect(frames.size).toBe(0);
 view.rerender(<HomeSceneMotion src="/assets/ambience/rain-day.webp" moving/>);
 act(()=>images.at(-1)!.onload?.());expect(frames.size).toBe(1);view.unmount();expect(frames.size).toBe(0);
});
it('does not animate a late image from a previous background',()=>{
 const view=render(<HomeSceneMotion src="/assets/ambience/rain-day.webp" moving/>);
 const late=images[0].onload!;
 view.rerender(<HomeSceneMotion src="/assets/ambience/morning-day.webp" moving/>);
 act(()=>late());expect(frames.size).toBe(0);
 act(()=>images.at(-1)!.onload?.());expect(frames.size).toBe(1);
});
it('leaves the artwork still when reduced motion is already enabled',()=>{
 reduced=true;render(<HomeSceneMotion src="/assets/ambience/fireside-night.webp" moving/>);
 act(()=>images[0].onload?.());expect(frames.size).toBe(0);expect(context.drawImage).not.toHaveBeenCalled();
});

