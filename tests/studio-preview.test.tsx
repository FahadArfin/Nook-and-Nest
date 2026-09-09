// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {createSamplePlan,parsePlan} from '../src/domain';
import {BlueprintStudio} from '../src/BlueprintStudio';
import {blueprintPlan} from '../src/blueprint';
import {usePlanner,loadPlan} from '../src/store';
import {stickyRotation} from '../src/rotationGesture';
import {homeShots} from '../src/previewShots';
import {HomePreview} from '../src/HomePreview';
import {SceneController} from '../src/scene/SceneController';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();history.replaceState(null,'','/');});
it('saves an unfinished room without building it and reopens its exact dimensions',async()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 const p=createSamplePlan(),id=p.floors[0].id;
 const plan=blueprintPlan(p,id,{rooms:[{id:'room',name:'Solarium',kind:'Living',x:0,z:0,width:2743,depth:2591,enclosed:true}],walls:[],fixtures:[],omittedWalls:[]});
 usePlanner.getState().replacePlan(plan);const original=usePlanner.getState().plan;
 let ui=render(<BlueprintStudio onClose={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:/Solarium/}));fireEvent.change(screen.getByLabelText('Room name'),{target:{value:'Saved solarium'}});
 fireEvent.click(screen.getByRole('button',{name:'Save draft'}));
 await waitFor(()=>expect(usePlanner.getState().plan.studioDrafts?.[id].draft.rooms[0].name).toBe('Saved solarium'));
 expect(usePlanner.getState().plan.floors).toEqual(original.floors);expect(usePlanner.getState().past).toHaveLength(0);
 const saved=await loadPlan();expect(saved?.studioDrafts?.[id].draft.rooms[0].width).toBe(2743);expect(()=>parsePlan(JSON.stringify(saved))).not.toThrow();
 ui.unmount();ui=render(<BlueprintStudio onClose={()=>{}}/>);expect(screen.getByRole('button',{name:/Saved solarium/})).toBeTruthy();
});
it('rejects malformed persisted drafts',()=>{const p=createSamplePlan();(p as any).studioDrafts={[p.floors[0].id]:{draft:{rooms:[{id:'bad',width:NaN}],walls:[],fixtures:[],omittedWalls:[]},savedAt:'now',imageScale:10,calibrated:true,view:{x:0,z:0,width:100,height:100}}};expect(()=>parsePlan(JSON.stringify(p))).toThrow();});
it('sticks near 45 and 90, releases outside the detent, and crosses zero continuously',()=>{
 expect(stickyRotation(-722,0)).toBe(-720);expect(stickyRotation(43)).toBe(45);expect(stickyRotation(94,90)).toBe(90);expect(stickyRotation(98,90)).toBe(98);expect(stickyRotation(358,0)).toBe(360);expect(stickyRotation(43,45,true)).toBe(43);expect(stickyRotation(29,undefined,false,true)).toBe(30);
});
it('does not schedule a focus motion on top-view selection',()=>{
 const c:any=Object.create(SceneController.prototype),p=createSamplePlan();p.camera.mode='top';p.furniture=[{id:'a',floorId:p.floors[0].id,catalogId:'sofa',x:0,z:0,widthMm:1000,heightMm:1000,depthMm:500,variant:'cream',rotation:0}];
 Object.assign(c,{activePlan:p,selectedId:'a',selectedNode:{position:Vector3.Zero()},editingKey:'',rotationMode:false,camera:{radius:20}});c.initializeControllers();c.updateEditingGuides();expect(c.cameraControls.focusMotion).toBeUndefined();expect(c.camera.radius).toBe(20);
});
it('preview pauses, advances views, and restores through cleanup without changing a plan',()=>{
 const p=createSamplePlan(),shots=homeShots(p,p.floors[0].id),controller:any={beginHomePreview:vi.fn(),showHomeShot:vi.fn(),endHomePreview:vi.fn()};
 const ui=render(<HomePreview shots={shots} controller={controller} onClose={()=>{}} canCapture/>);expect(controller.beginHomePreview).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByLabelText('Next view'));expect(controller.showHomeShot).toHaveBeenLastCalledWith(shots[1],false);fireEvent.click(screen.getByText('Play slideshow'));expect(screen.getByText('Pause')).toBeTruthy();ui.unmount();expect(controller.endHomePreview).toHaveBeenCalledTimes(1);
});

it('restores the dragged item before handing two-finger input to navigation',()=>{
 const c:any=Object.create(SceneController.prototype),p=createSamplePlan();p.furniture=[{id:'a',floorId:p.floors[0].id,catalogId:'sofa',x:1200,z:800,widthMm:1000,heightMm:1000,depthMm:500,variant:'cream',rotation:45,elevationMm:0}];
 const node={position:new Vector3(8,8,8),rotation:{y:2}};Object.assign(c,{activePlan:p,dragging:'a',draggedPosition:{x:8000,z:8000},selectedNode:node,cancelOutdoorStroke:vi.fn(),cancelWallDraft:vi.fn()});c.initializeControllers();c.cancelTouchEdit();expect(node.position.x).toBe(1.2);expect(node.position.z).toBe(.8);expect(node.rotation.y).toBeCloseTo(Math.PI/4);expect(c.dragging).toBeUndefined();expect(c.draggedPosition).toBeUndefined();
});
it('restores the exact editor camera after presenting a different view',()=>{
 const c:any=Object.create(SceneController.prototype),camera:any={target:new Vector3(1,2,3),alpha:1,beta:2,radius:19,mode:1,detachControl:vi.fn(),attachControl:vi.fn()};camera.setTarget=(target:Vector3)=>camera.target=target;
 Object.assign(c,{camera,engine:{resize:vi.fn(),getRenderWidth:()=>800,getRenderHeight:()=>600},cancelFocus:vi.fn()});vi.stubGlobal('requestAnimationFrame',vi.fn());c.initializeControllers();c.beginHomePreview();c.showHomeShot({name:'room',x:9,y:1,z:9,radius:5,alpha:3,beta:.6},true);expect(camera.radius).toBe(5);c.endHomePreview();expect(camera.target.asArray()).toEqual([1,2,3]);expect(camera).toMatchObject({alpha:1,beta:2,radius:19,mode:1});
});
