// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { FloorBar } from "../src/FloorBar";
import { usePlanner } from "../src/store";
import { createSamplePlan, decodeShare, encodeShare, parsePlan, serializePlan } from "../src/domain";

const state=()=>usePlanner.getState();
beforeEach(()=>{
  state().replacePlan(createSamplePlan());
  // JSDOM does not implement native modal opening/focus containment.
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","")};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute("open")};
});
afterEach(cleanup);

describe("floor removal",()=>{
  it("deletes the chosen floor, its furniture and inbound stairs in one undo step",()=>{
    const [ground,upper]=state().plan.floors;
    state().addStair(1000,1000);state().placeFurniture("sofa");state().setActiveFloor(upper.id);state().placeFurniture("queen-bed");
    const before=structuredClone(state().plan),history=state().past.length;
    state().deleteFloor(upper.id);
    expect(state().plan.floors.map(f=>f.id)).toEqual([ground.id]);expect(state().activeFloorId).toBe(ground.id);
    expect(state().plan.floors[0].stairs).toEqual([]);expect(state().plan.furniture.map(f=>f.catalogId)).toEqual(["sofa"]);
    expect(state().selectedId).toBeUndefined();expect(state().past).toHaveLength(history+1);
    state().undo();expect(state().plan).toEqual(before);expect(state().activeFloorId).toBe(upper.id);
    state().redo();expect(state().plan.floors).toHaveLength(1);
  });
  it("preserves surviving floors and elevations when removing a middle floor",()=>{
    const [ground,middle]=state().plan.floors;state().addFloor();const top=state().plan.floors[2];
    state().setActiveFloor(middle.id);state().deleteFloor();
    expect(state().activeFloorId).toBe(ground.id);expect(state().plan.floors).toEqual([ground,top]);
  });
  it("can delete ground floor and keeps another active floor when deleting by ID",()=>{
    const [ground,upper]=state().plan.floors;state().setActiveFloor(upper.id);state().deleteFloor(ground.id);
    expect(state().activeFloorId).toBe(upper.id);expect(state().plan.floors).toEqual([upper]);
  });
  it("clears the final layer without losing its identity or finishes, and supports undo",()=>{
    state().deleteFloor(state().plan.floors[1].id);state().placeFurniture("sofa");state().addWall({ax:0,az:0,bx:1,bz:0});state().addOpening("door","wall");state().addStair(1000,1000);
    const before=structuredClone(state().plan);state().deleteFloor();
    expect(state().plan.floors).toHaveLength(1);expect(state().plan.floors[0]).toEqual({...before.floors[0],cells:[],walls:[],openings:[],stairs:[]});expect(state().plan.furniture).toEqual([]);
    expect(parsePlan(serializePlan(state().plan))).toEqual(state().plan);
    const shared=decodeShare(encodeShare(state().plan));expect(shared.floors).toEqual(state().plan.floors);expect(shared.furniture).toEqual([]);
    state().undo();expect(state().plan).toEqual(before);
  });
  it("ignores a stale target without deleting a different floor",()=>{
    const before=state().plan;state().deleteFloor("missing");expect(state().plan).toBe(before);expect(state().past).toHaveLength(0);
  });
});

describe("floor deletion controls",()=>{
  it("names the target, focuses Cancel, and changes nothing until confirmed",()=>{
    const cancelDraft=vi.fn();render(<FloorBar onBeforeDelete={cancelDraft}/>);const before=state().plan;
    fireEvent.click(screen.getByRole("button",{name:`Options for ${state().plan.floors.find(f=>f.id===state().activeFloorId)!.name}`}));fireEvent.click(screen.getByRole("button",{name:"Delete",exact:true}));
    const dialog=screen.getByRole("dialog");expect(within(dialog).getByText('Delete “Ground floor”?')).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole("button",{name:"Cancel"}));expect(state().plan).toBe(before);
    fireEvent.click(within(dialog).getByRole("button",{name:"Cancel"}));expect(state().plan).toBe(before);expect(cancelDraft).not.toHaveBeenCalled();expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button",{name:"Delete",exact:true}));
  });
  it("deletes only after confirmation and dismisses pending placement",()=>{
    const cancelDraft=vi.fn();render(<FloorBar onBeforeDelete={cancelDraft}/>);
    fireEvent.click(screen.getByRole("button",{name:/2Upstairs/}));
    fireEvent.click(screen.getByRole("button",{name:`Options for ${state().plan.floors.find(f=>f.id===state().activeFloorId)!.name}`}));fireEvent.click(screen.getByRole("button",{name:"Delete",exact:true}));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Delete floor"}));
    expect(cancelDraft).toHaveBeenCalledOnce();expect(state().plan.floors).toHaveLength(1);expect(state().plan.floors[0].name).toBe("Ground floor");expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button",{name:"Options for Ground floor"})).toBeTruthy();
  });
  it("allows clearing the last floor and explains that its layer remains",()=>{
    state().deleteFloor(state().plan.floors[1].id);render(<FloorBar onBeforeDelete={()=>{}}/>);
    fireEvent.click(screen.getByRole("button",{name:"Options for Ground floor"}));fireEvent.click(screen.getByRole("button",{name:"Delete",exact:true}));const dialog=screen.getByRole("dialog");
    expect(within(dialog).getByText(/empty layer will remain/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button",{name:"Clear floor"}));expect(state().plan.floors[0].cells).toEqual([]);
  });
  it("supports native Escape cancellation and prevents editor shortcuts inside the dialog",()=>{
    render(<FloorBar onBeforeDelete={()=>{}}/>);fireEvent.click(screen.getByRole("button",{name:"Options for Ground floor"}));fireEvent.click(screen.getByRole("button",{name:"Delete",exact:true}));const dialog=screen.getByRole("dialog"),before=state().plan;
    const listener=vi.fn();window.addEventListener("keydown",listener);
    try{fireEvent.keyDown(within(dialog).getByRole("button",{name:"Cancel"}),{key:"Delete"});expect(listener).not.toHaveBeenCalled()}finally{window.removeEventListener("keydown",listener)}
    fireEvent(dialog,new Event("cancel",{bubbles:false,cancelable:true}));expect(screen.queryByRole("dialog")).toBeNull();expect(state().plan).toBe(before);
  });
});

it('duplicates independent furniture and reorders physical levels with undo and sharing',()=>{
 const ground=state().plan.floors[0];state().placeFurniture('sofa');const before=structuredClone(state().plan);state().duplicateFloor(ground.id);const copy=state().plan.floors.at(-1)!;expect(copy.id).not.toBe(ground.id);expect(copy.cells).toEqual(ground.cells);const cloned=state().plan.furniture.filter(f=>f.floorId===copy.id);expect(cloned).toHaveLength(before.furniture.filter(f=>f.floorId===ground.id).length);expect(cloned[0].id).not.toBe(before.furniture[0].id);state().reorderFloor(copy.id,0);expect(state().plan.floors[0].id).toBe(copy.id);expect(state().plan.floors[0].elevationMm).toBe(0);expect(state().plan.floors[1].elevationMm).toBe(copy.heightMm+300);expect(parsePlan(serializePlan(state().plan)).floors).toEqual(state().plan.floors);state().undo();expect(state().plan.floors.at(-1)!.id).toBe(copy.id);state().undo();expect(state().plan).toEqual(before);
});

it('uses a compact three-action menu, renames with undo and drags physical floors',()=>{
 render(<FloorBar onBeforeDelete={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Options for Upstairs'}));
 const menu=screen.getByRole('group',{name:'Upstairs actions'});
 expect(within(menu).getAllByRole('button').map(b=>b.textContent)).toEqual(['Clone','Delete','Rename']);
 expect(screen.getByRole('button',{name:'Options for Upstairs'}).parentElement?.classList.contains('is-active')).toBe(true);
 fireEvent.click(within(menu).getByRole('button',{name:'Rename'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Floor name'}),{target:{value:'Loft'}});
 fireEvent.click(screen.getByRole('button',{name:'Save floor name'}));
 expect(state().plan.floors[1].name).toBe('Loft');
 const before=structuredClone(state().plan);
 const dataTransfer={setData:vi.fn(),effectAllowed:'',dropEffect:''};
 fireEvent.dragStart(screen.getByRole('button',{name:/2Loft/}),{dataTransfer});
 fireEvent.drop(screen.getByRole('button',{name:/1Ground floor/}).parentElement!,{dataTransfer});
 expect(state().plan.floors[0].name).toBe('Loft');
 expect(state().plan.floors[0].elevationMm).toBe(0);
 state().undo();expect(state().plan).toEqual(before);
 state().undo();expect(state().plan.floors[1].name).toBe('Upstairs');
});
