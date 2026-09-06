// @vitest-environment jsdom
import React from "react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,act,waitFor,within } from "@testing-library/react";
import { OutdoorSettings } from "../src/OutdoorSettings";
import { ShelfPlacement } from "../src/ShelfPlacement";
import { shelfChoices } from "../src/shelfSurfaces";
import { MeasuredRoom } from "../src/MeasuredRoom";
import { StairSettings } from "../src/StairSettings";
import { createSamplePlan } from "../src/domain";
import { usePlanner } from "../src/store";
import { fitStair,stairHoles } from "../src/building";
import { catalog } from "../src/catalog";
import { EditorApp as App } from "../src/App";
const scene=vi.hoisted(()=>({callbacks:undefined as any,preview:vi.fn(),update:vi.fn(),zoom:vi.fn(),focus:vi.fn()}));
vi.mock("../src/scene/SceneController",()=>({SceneController:class{
  constructor(_canvas:unknown,callbacks:unknown){scene.callbacks=callbacks}
  zoom(factor:number){scene.zoom(factor)} focusSelected(){scene.focus()}
  placementRotation(){return 0;} setTool(){} setWallSelection(){} update(...args:unknown[]){scene.update(...args)} cancelTileDraft(){} dispose(){}
  previewMeasuredRoom(region:unknown){scene.preview(region)}
  projectPreview(){return {x:200,y:200}} projectSelected(){return {x:200,y:200}} projectTileDraft(){return {x:200,y:200}}
}}));
vi.mock("../src/store",async()=>{const actual=await vi.importActual<typeof import("../src/store")>("../src/store");return {...actual,loadPlan:async()=>actual.usePlanner.getState().plan,savePlan:async()=>{}}});
const state=()=>usePlanner.getState();
beforeEach(()=>{state().replacePlan(createSamplePlan());state().setTool("select");state().setCategory("All");state().setSearch("");scene.callbacks=undefined;scene.preview.mockClear();scene.update.mockClear();vi.stubGlobal("requestAnimationFrame",()=>1);vi.stubGlobal("cancelAnimationFrame",()=>{});});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
describe("measured room controls",()=>{
  it("selects a wall before changing its whole plate finish in the right panel",async()=>{
    const p=createSamplePlan();p.floors[0].walls=[{id:"inside-test",ax:2,az:2,bx:5,bz:2}];state().replacePlan(p);
    render(<App/>);await waitFor(()=>expect(scene.callbacks).toBeTruthy());
    act(()=>scene.callbacks.onWall("inside-test"));expect(state().selectedWallId).toBe("inside-test");expect(state().past).toHaveLength(0);
    expect((screen.getByLabelText("Finish area") as HTMLSelectElement).selectedOptions[0].text).toBe("Selected wall");
    fireEvent.click(screen.getByRole("button",{name:/Walls:.*sage/i}));
    expect(state().plan.floors[0].wallFinishes).toEqual({"inside-test":"sage-plaster"});expect(state().past).toHaveLength(1);
    act(()=>state().undo());expect(state().plan.floors[0].wallFinishes).toBeUndefined();
  });
  it("starts a reversible measured draft without changing the plan or history",()=>{
    render(<MeasuredRoom/>);fireEvent.click(screen.getByText("Exact room size"));
    fireEvent.change(screen.getByLabelText("Room width"),{target:{value:"12' 6\""}});
    fireEvent.change(screen.getByLabelText("Room depth"),{target:{value:"10"}});
    const before=state().plan;fireEvent.click(screen.getByRole("button",{name:"Place measured room"}));
    expect(state().roomSize).toEqual({widthMm:3810,depthMm:3048});expect(state().tool).toBe("measured-room");
    expect(state().plan).toBe(before);expect(state().past).toHaveLength(0);expect(screen.getByRole("status").textContent).toMatch(/starting corner/);
  });
  it("accepts metric dimensions and reports invalid input without changing the plan",()=>{
    render(<MeasuredRoom/>);fireEvent.click(screen.getByText("Exact room size"));
    fireEvent.change(screen.getByLabelText("Room measurement units"),{target:{value:"m"}});
    fireEvent.change(screen.getByLabelText("Room width"),{target:{value:"3.801"}});fireEvent.change(screen.getByLabelText("Room depth"),{target:{value:"2.707"}});
    fireEvent.click(screen.getByRole("button",{name:"Place measured room"}));expect(state().roomSize).toEqual({widthMm:3801,depthMm:2707});
    const before=state().plan;fireEvent.change(screen.getByLabelText("Room width"),{target:{value:"-1"}});fireEvent.click(screen.getByRole("button",{name:"Place measured room"}));expect(screen.getByRole("alert")).toBeTruthy();expect(state().plan).toBe(before);
  });
  it("keeps measurement typing out of global editor shortcuts",()=>{
    render(<MeasuredRoom/>);fireEvent.click(screen.getByText("Exact room size"));const listener=vi.fn();window.addEventListener("keydown",listener);
    try{fireEvent.keyDown(screen.getByLabelText("Room width"),{key:"Delete"});expect(listener).not.toHaveBeenCalled()}finally{window.removeEventListener("keydown",listener)}
  });
});
describe("stair connection controls",()=>{
  it("connects/disconnects a placed stair and restores the opening with undo",()=>{
    const p=state().plan,c=catalog.find(c=>c.id==="stairs-floating")!;
    state().confirmFurniture(fitStair(p,{id:"stair-controls",catalogId:c.id,floorId:p.floors[0].id,x:1800,z:1800,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:"sage"}));
    function Connected(){const item=usePlanner(s=>s.plan.furniture.find(i=>i.id==="stair-controls")!);return <StairSettings item={item}/>}
    render(<Connected/>);const target=p.floors[1].id;
    fireEvent.change(screen.getByLabelText("Connect to floor"),{target:{value:target}});
    expect(stairHoles(state().plan,target)).toHaveLength(1);expect((screen.getByLabelText("Floor-to-floor rise (mm)") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Connect to floor"),{target:{value:""}});expect(stairHoles(state().plan,target)).toEqual([]);
    fireEvent.change(screen.getByLabelText("Floor-to-floor rise (mm)"),{target:{value:"2900"}});expect(state().plan.furniture[0].stairRiseMm).toBe(2900);
    act(()=>{state().undo();state().undo()});expect(stairHoles(state().plan,target)).toHaveLength(1);
  });
});
describe("building editor wiring",()=>{
  it("opens backsplash browsing without placing anything, then confirms and edits a panel",async()=>{
    render(<App/>);await waitFor(()=>expect(scene.callbacks).toBeTruthy());const before=state().plan;
    fireEvent.click(screen.getByRole("button",{name:"Build"}));fireEvent.click(screen.getByRole("button",{name:"Openings"}));fireEvent.click(screen.getByRole("button",{name:"Add kitchen backsplash"}));expect(state().category).toBe("Kitchen");expect(state().search).toBe("backsplash");expect(state().plan).toBe(before);
    const model=catalog.find(c=>c.id==="backsplash-subway")!;fireEvent.click(screen.getByRole("button",{name:`${model.name}, drag to place`}),{detail:0});
    expect(state().plan.furniture).toEqual([]);fireEvent.click(screen.getByRole("button",{name:"Confirm placement"}));expect(state().plan.furniture).toHaveLength(1);
    const id=state().plan.furniture[0].id;act(()=>scene.callbacks.onSelect(id));
    fireEvent.change(screen.getByLabelText("grout color"),{target:{value:"#ccbbaa"}});fireEvent.change(screen.getByLabelText("Height from floor"),{target:{value:"920"}});
    expect(state().plan.furniture[0].materialColors?.grout).toBe("#ccbbaa");expect(state().plan.furniture[0].elevationMm).toBe(920);
    expect(screen.getAllByRole("button",{name:"Flip"})).toHaveLength(2);
  });
  it("shows a separate backsplash material chooser and keeps the selected finish on undo/redo",async()=>{
    const c=catalog.find(c=>c.id==="backsplash-slab")!,p=state().plan;
    state().confirmFurniture({id:"slab",catalogId:c.id,floorId:p.floors[0].id,x:1800,z:0,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:"cream"});
    render(<App/>);await waitFor(()=>expect(scene.callbacks).toBeTruthy());act(()=>state().select("slab"));
    expect(screen.getByRole("heading",{name:/Backsplash material/})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Ivory marble"}));expect(state().plan.furniture[0].surfaceVariant).toBe("ivory-marble");
    act(()=>{state().undo();state().redo()});expect(state().plan.furniture[0].surfaceVariant).toBe("ivory-marble");
  });
  it("provides a hanging-height control for ceiling lights",async()=>{
    render(<App/>);await waitFor(()=>expect(scene.callbacks).toBeTruthy());act(()=>{state().setCategory("Lighting");state().setSearch("pendant")});
    const c=catalog.find(c=>c.id==="dome-pendant")!;fireEvent.click(screen.getByRole("button",{name:`${c.name}, drag to place`}),{detail:0});fireEvent.click(screen.getByRole("button",{name:"Confirm placement"}));
    act(()=>state().select(state().plan.furniture[0].id));fireEvent.change(screen.getByLabelText("Height from floor"),{target:{value:"1300"}});expect(state().plan.furniture[0].elevationMm).toBe(1300);
  });
  it("positions, cancels, and confirms an exact-size room through the editor toolbar",async()=>{
    render(<App/>);await waitFor(()=>expect(scene.callbacks).toBeTruthy());fireEvent.click(screen.getByRole("button",{name:"Build"}));fireEvent.click(screen.getByRole("button",{name:"Floor area"}));fireEvent.click(screen.getByText("Exact room size"));
    const stage=within(screen.getByLabelText("Interactive 3D apartment editor").parentElement!);
    fireEvent.change(screen.getByLabelText("Room width"),{target:{value:"12' 6\""}});fireEvent.change(screen.getByLabelText("Room depth"),{target:{value:"10"}});
    fireEvent.click(screen.getByRole("button",{name:"Place measured room"}));const before=state().plan;
    act(()=>scene.callbacks.onCell(20,20));expect(scene.preview).toHaveBeenCalled();expect(state().plan).toBe(before);
    fireEvent.click(stage.getByRole("button",{name:"Cancel tile change"}));expect(state().plan).toBe(before);
    act(()=>scene.callbacks.onCell(20,20));fireEvent.click(stage.getByRole("button",{name:"Confirm tile change"}));
    expect(state().plan.floors[0].cellRects).toBeTruthy();expect(state().past).toHaveLength(1);expect(stage.queryByRole("button",{name:"Confirm tile change"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Undo"}));expect(state().plan).toEqual(before);
  });
  it("keeps keyboard library placement as a draft when leaving a building tool",async()=>{
    render(<App/>);await waitFor(()=>expect(scene.callbacks).toBeTruthy());act(()=>state().setTool("paint"));
    act(()=>state().setCategory("Stairs"));const model=catalog.find(c=>c.id==="stairs-floating")!;
    fireEvent.click(screen.getByRole("button",{name:`${model.name}, drag to place`}),{detail:0});
    expect(screen.getByRole("toolbar",{name:`Place ${model.name}`})).toBeTruthy();expect(state().plan.furniture).toEqual([]);
    fireEvent.click(screen.getByRole("button",{name:"Rotate right"}));fireEvent.click(screen.getByRole("button",{name:"Confirm placement"}));
    expect(state().plan.furniture).toHaveLength(1);expect(state().plan.furniture[0].rotation).toBe(270);expect(state().selectedId).toBeUndefined();
    act(()=>scene.callbacks.onSelect(state().plan.furniture[0].id));expect(screen.getByRole("toolbar",{name:`Edit ${model.name}`})).toBeTruthy();expect(screen.getByLabelText("Connect to floor")).toBeTruthy();
  });
});


describe("shelf level controls",()=>{
  it("offers fitting levels and commits one reversible placement without moving its shelf",()=>{
    const p=state().plan,floorId=p.floors[0].id;
    const make=(id:string)=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId,x:1000,z:1000,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:"sage"}};
    const owner=make("display-bookcase"),item=make("adventurer-figurine");p.furniture=[owner,item];state().replacePlan(p);
    function Connected(){const selected=usePlanner(s=>s.plan.furniture[1]);return <ShelfPlacement item={selected}/>}
    render(<Connected/>);const option=shelfChoices(p,item)[1];
    fireEvent.change(screen.getByLabelText("Rest on a shelf"),{target:{value:option.key}});
    expect(state().plan.furniture[1].elevationMm).toBe(740);expect(state().plan.furniture[0]).toEqual(owner);expect(state().past).toHaveLength(1);
    act(()=>state().undo());expect(state().plan.furniture[1]).toEqual(item);act(()=>state().redo());expect(state().plan.furniture[1].elevationMm).toBe(740);
    act(()=>state().updateFurniture(item.id,{heightMm:1800}));expect((screen.getByLabelText("Rest on a shelf") as HTMLSelectElement).disabled).toBe(true);
  });
});

describe("outdoor and detail controls",()=>{
  it("changes scenery and grass without losing the build, and opens the Outdoor category",()=>{
    const before=state().plan;render(<OutdoorSettings/>);
    fireEvent.change(screen.getByLabelText("Surroundings"),{target:{value:"medieval"}});
    fireEvent.change(screen.getByLabelText("Ground grass"),{target:{value:"sparse"}});
    expect(state().plan.environment).toEqual({background:"medieval",grass:"sparse"});expect(state().plan.floors).toEqual(before.floors);
    fireEvent.click(screen.getByRole("button",{name:"Browse outdoor furniture"}));expect(state().category).toBe("Outdoor");
    act(()=>state().undo());expect(state().plan.environment?.grass).toBe("off");
  });
  it("exposes zoom buttons and only enables detail focus after selection",async()=>{
    render(<App/>);await waitFor(()=>expect(scene.callbacks).toBeTruthy());
    fireEvent.click(screen.getByRole("button",{name:"Zoom in"}));expect(scene.zoom).toHaveBeenCalledWith(.75);
    expect((screen.getByRole("button",{name:"Focus selected furniture"}) as HTMLButtonElement).disabled).toBe(true);
    act(()=>{state().placeFurniture("small-plant");state().select(state().plan.furniture[0].id)});
    fireEvent.click(screen.getByRole("button",{name:"Focus selected furniture"}));expect(scene.focus).toHaveBeenCalled();
  });
});

it('carries shared appearance through the studio and editor without changing the saved plan',async()=>{
 const {Welcome}=await import('../src/Welcome');localStorage.removeItem('nook-welcome-theme');
 let matches=true;const listeners=new Set<()=>void>();vi.stubGlobal('matchMedia',()=>({get matches(){return matches;},addEventListener:(_name:string,fn:()=>void)=>listeners.add(fn),removeEventListener:(_name:string,fn:()=>void)=>listeners.delete(fn)}));
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','');}});
 const {container}=render(<Welcome Editor={App}/>);
 const studio=screen.getByRole('button',{name:/Create floor plan/});await waitFor(()=>expect(studio.hasAttribute('disabled')).toBe(false));fireEvent.click(studio);
 expect(screen.getByRole('dialog',{name:'Floor plan studio'}).getAttribute('data-theme')).toBe('dark');
 act(()=>{matches=false;listeners.forEach(fn=>fn());});expect(screen.getByRole('dialog',{name:'Floor plan studio'}).getAttribute('data-theme')).toBe('light');
 fireEvent.click(screen.getByRole('button',{name:'Close floor plan studio'}));fireEvent.click(screen.getByRole('button',{name:'Use dark theme'}));
 fireEvent.click(screen.getByRole('button',{name:/Free 3D editor/}));
 expect(container.querySelector('.app-shell.dark-mode')).toBeTruthy();expect(scene.update.mock.calls.at(-1)?.[0].camera.darkMode).toBe(true);
 const plan=state().plan;const past=state().past;
 fireEvent.click(screen.getByRole('button',{name:'Night mode'}));expect(container.querySelector('.app-shell.dark-mode')).toBeNull();expect(scene.update.mock.calls.at(-1)?.[0].camera.darkMode).toBe(false);
 expect(state().plan).toBe(plan);expect(state().past).toBe(past);expect(localStorage.getItem('nook-welcome-theme')).toBe('light');
 fireEvent.click(screen.getByRole('button',{name:'Back to home'}));await screen.findByRole('button',{name:'Use light theme'});expect(screen.getByRole('button',{name:'Use light theme'}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByRole('button',{name:'Use system theme'}));fireEvent.click(screen.getByRole('button',{name:/Free 3D editor/}));const next=state().plan;
 act(()=>{matches=true;listeners.forEach(fn=>fn());});expect(container.querySelector('.app-shell.dark-mode')).toBeTruthy();expect(scene.update.mock.calls.at(-1)?.[0].camera.darkMode).toBe(true);expect(state().plan).toBe(next);localStorage.removeItem('nook-welcome-theme');
});
