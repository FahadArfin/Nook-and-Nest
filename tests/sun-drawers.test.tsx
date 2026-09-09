// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {BottomTools} from '../src/BottomTools';
import {SunControls} from '../src/SunControls';
import {sunDirection} from '../src/sunlight';
import {usePlanner} from '../src/store';
import {createBlankPlan,serializePlan,parsePlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
import {SceneController} from '../src/scene/SceneController';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
afterEach(()=>{cleanup();vi.useRealTimers()});
const advance=(ms:number)=>act(()=>{vi.advanceTimersByTime(ms)});
it('retains exiting drawers, switches after closing, and exposes no repeated dock navigation',()=>{
 vi.useFakeTimers();usePlanner.getState().replacePlan(createBlankPlan());
 const props={onClose:vi.fn(),onPlace:vi.fn(),onViewScenery:vi.fn(),onSunPreview:vi.fn()};
 const view=render(<BottomTools {...props} mode="paint"/>);advance(0);advance(20);
 const floor=screen.getByRole('region',{name:'Floor finishes'});expect(floor.classList.contains('is-open')).toBe(true);
 expect(within(floor).queryByRole('button',{name:'Paint tiles'})).toBeNull();expect(within(floor).queryByRole('button',{name:'Erase'})).toBeNull();
 view.rerender(<BottomTools {...props} mode="wall"/>);expect(floor.getAttribute('aria-hidden')).toBe('true');expect(floor.hasAttribute('inert')).toBe(true);
 advance(649);expect(floor.isConnected).toBe(true);advance(1);advance(20);expect(screen.getByRole('region',{name:'Wall tools'})).toBeTruthy();
 view.rerender(<BottomTools {...props}/>);expect(screen.queryByRole('region',{name:'Wall tools'})).toBeNull();advance(650);expect(document.querySelector('.bottom-tools')).toBeNull();
});
it('previews slider changes live and commits a single undoable saved sun setting',()=>{
 const plan=createBlankPlan();usePlanner.setState({plan,past:[],future:[]});const preview=vi.fn();render(<SunControls onPreview={preview}/>);
 const slider=screen.getByLabelText('Sun direction');fireEvent.change(slider,{target:{value:'90'}});fireEvent.change(slider,{target:{value:'110'}});
 expect(usePlanner.getState().plan).toBe(plan);expect(preview).toHaveBeenLastCalledWith({enabled:true,azimuth:110,elevation:45});fireEvent.pointerUp(slider);
 const saved=usePlanner.getState().plan;expect(saved.environment?.sun?.azimuth).toBe(110);expect(usePlanner.getState().past).toHaveLength(1);expect(parsePlan(serializePlan(saved)).environment?.sun).toEqual(saved.environment?.sun);
 act(()=>usePlanner.getState().undo());expect(usePlanner.getState().plan.environment?.sun).toBeUndefined();expect(preview).toHaveBeenLastCalledWith({enabled:false,azimuth:135,elevation:45});
 expect(()=>validatePlan({...plan,environment:{background:'plain',grass:'off',sun:{enabled:true,azimuth:Infinity,elevation:45}}})).toThrow();
});
it('changes actual directional lighting without mutating the apartment and restores neutral lighting',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),sun=new DirectionalLight('sun',new Vector3(-.8,-1.5,.7),scene),sky=new HemisphericLight('sky',Vector3.Up(),scene);
 try{const plan=createBlankPlan(),r:any=Object.create(SceneController.prototype);Object.assign(r,{scene,activePlan:plan,neutralPreview:true,canvas:{dataset:{}}});
 r.setSunPreview({enabled:true,azimuth:90,elevation:20});expect(sun.direction.x).toBeLessThan(0);expect(sun.direction.z).toBeCloseTo(0);expect(sun.direction.length()).toBeCloseTo(1);const low=sun.direction.y;
 r.setSunPreview({enabled:true,azimuth:270,elevation:65});expect(sun.direction.x).toBeGreaterThan(0);expect(sun.direction.y).toBeLessThan(low);expect(sky.intensity).toBe(.32);expect(plan.environment?.sun).toBeUndefined();
 r.setSunPreview({enabled:true,night:true,azimuth:180,elevation:45});expect(sun.intensity).toBe(.035);expect(sky.intensity).toBe(.16);
 r.setSunPreview();expect(sun.direction.asArray()).toEqual([-.8,-1.5,.7]);expect(sky.intensity).toBe(.95);expect(sunDirection({enabled:true,azimuth:0,elevation:45}).z).toBeGreaterThan(0);
 }finally{scene.dispose();engine.dispose()}
});

it('cancels a pending switch when the original drawer is selected again',()=>{
 vi.useFakeTimers();usePlanner.getState().replacePlan(createBlankPlan());const props={onClose:vi.fn(),onPlace:vi.fn(),onViewScenery:vi.fn(),onSunPreview:vi.fn()};
 const view=render(<BottomTools {...props} mode="wall"/>);advance(0);advance(20);view.rerender(<BottomTools {...props} mode="landscape"/>);advance(300);view.rerender(<BottomTools {...props} mode="wall"/>);advance(20);advance(650);expect(screen.getByRole('region',{name:'Wall tools'})).toBeTruthy();expect(screen.queryByRole('region',{name:'Land formation'})).toBeNull();
});
