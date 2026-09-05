// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CatalogLibrary } from "../src/CatalogLibrary";
import { catalog } from "../src/catalog";
import { favoritesKey, filterLibrary, furnitureType, matchesFurniture, parseFavorites } from "../src/library";
import { usePlanner } from "../src/store";
import { createSamplePlan } from "../src/domain";

const options={search:"",category:"All",type:"All",shelf:"browse" as const,favorites:[],inPlan:[],sort:"collection" as const};
const item=(id:string)=>catalog.find(item=>item.id===id)!;
beforeEach(()=>{localStorage.clear();usePlanner.getState().replacePlan(createSamplePlan());usePlanner.setState({search:"",category:"All"});if(!window.PointerEvent)window.PointerEvent=MouseEvent as typeof PointerEvent});
afterEach(cleanup);

describe("library organization",()=>{
  it("gives every piece a real furniture type",()=>{
    expect(catalog).toHaveLength(268);
    for(const item of catalog)expect(furnitureType(item),item.id).not.toBe("Other pieces");
  });
  it("finds common synonyms, categories and multiword queries",()=>{
    expect(matchesFurniture(item("sofa"),"couch")).toBe(true);
    expect(matchesFurniture(item("wall-hung-sink"),"washroom basin")).toBe(true);
    expect(matchesFurniture(item("slim-tv"),"television")).toBe(true);
    expect(matchesFurniture(item("pedestal-computer-desk"),"computer desk")).toBe(true);
    expect(matchesFurniture(item("queen-bed"),"computer desk")).toBe(false);
    expect(matchesFurniture(item("oval-freestanding-tub"),"  TUB  ")).toBe(true);
  });
  it("offers only relevant types and intersects category, type and saved filters",()=>{
    const bath=filterLibrary({...options,category:"Bathroom"});expect(bath.items).toHaveLength(25);
    expect(bath.types).toEqual(["Bathtubs","Mirrors","Organizers","Showers","Sinks & vanities","Toilets"]);
    expect(filterLibrary({...options,category:"Bathroom",type:"Mirrors",shelf:"favorites",favorites:["bath-mirror-pill","sofa"]}).items.map(i=>i.id)).toEqual(["bath-mirror-pill"]);
  });
  it("sorts deterministically without mutating the catalog",()=>{
    const first=catalog[0].id,result=filterLibrary({...options,sort:"size"}).items;
    expect(result.every((i,n)=>!n||i.widthMm*i.depthMm>=result[n-1].widthMm*result[n-1].depthMm)).toBe(true);
    expect(catalog[0].id).toBe(first);
    const names=filterLibrary({...options,sort:"name"}).items.map(i=>i.name);expect(names).toEqual([...names].sort((a,b)=>a.localeCompare(b)));
  });
  it("recovers malformed favorites and drops duplicate or unknown IDs",()=>{
    expect(parseFavorites("broken json")).toEqual([]);expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('["sofa","unknown",7,"sofa","laptop"]')).toEqual(["sofa","laptop"]);
  });
});

describe("library controls",()=>{
  const mount=()=>{const drag=vi.fn(),start=vi.fn();render(<CatalogLibrary onBeginDrag={drag} onStartPlacement={start}/>);return {drag,start}};
  it("navigates categories and subtypes, then searches the entire collection",()=>{
    mount();fireEvent.change(screen.getByLabelText("Furniture category"),{target:{value:"Bathroom"}});
    fireEvent.change(screen.getByLabelText("Furniture type"),{target:{value:"Toilets"}});
    expect(screen.getAllByRole("button",{name:/drag to place/})).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Search all furniture"),{target:{value:"couch"}});
    expect((screen.getByLabelText("Furniture category") as HTMLSelectElement).value).toBe("All");
    expect(screen.getByRole("button",{name:"Cloud sofa, drag to place"})).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Clear search"));expect(document.activeElement).toBe(screen.getByLabelText("Search all furniture"));
  });
  it("saves a favorite without placing it or recording plan history",()=>{
    const before=usePlanner.getState().plan,{drag,start}=mount();
    fireEvent.click(screen.getByLabelText("Save Capsule bathroom mirror"));
    expect(parseFavorites(localStorage.getItem(favoritesKey))).toEqual(["bath-mirror-pill"]);
    fireEvent.click(screen.getByRole("button",{name:/Saved/}));
    expect(screen.getAllByRole("button",{name:/drag to place/})).toHaveLength(1);
    expect(start).not.toHaveBeenCalled();expect(drag).not.toHaveBeenCalled();expect(usePlanner.getState().past).toHaveLength(0);expect(usePlanner.getState().plan).toBe(before);
    fireEvent.click(screen.getByLabelText("Unsave Capsule bathroom mirror"));expect(screen.getByText("Keep your favorites close")).toBeTruthy();
  });
  it("restores favorites when the library is reopened",()=>{
    localStorage.setItem(favoritesKey,JSON.stringify(["laptop"]));mount();fireEvent.click(screen.getByRole("button",{name:/Saved/}));
    expect(screen.getByRole("button",{name:"Daylight laptop, drag to place"})).toBeTruthy();
  });
  it("keeps favorites usable if device storage is blocked",()=>{
    const spy=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("blocked")});
    try{mount();fireEvent.click(screen.getByLabelText("Save Capsule bathroom mirror"));expect(screen.getByText(/only stay for this session/)).toBeTruthy();expect(screen.getByLabelText("Unsave Capsule bathroom mirror")).toBeTruthy()}finally{spy.mockRestore()}
  });
  it("supports wide browsing and preserves pointer and keyboard draft callbacks",()=>{
    const {drag,start}=mount();fireEvent.click(screen.getByLabelText("Expand library"));
    expect(screen.getByLabelText("Furniture library").className).toContain("library-expanded");
    const card=screen.getByRole("button",{name:"Capsule bathroom mirror, drag to place"});
    fireEvent.pointerDown(card,{button:0});fireEvent.click(card,{detail:1});
    expect(drag).toHaveBeenCalledTimes(1);expect(start).not.toHaveBeenCalled();expect(screen.getByLabelText("Expand library")).toBeTruthy();
    fireEvent.click(card,{detail:0});expect(start).toHaveBeenCalledWith(item("bath-mirror-pill"));
  });
  it("shows distinct already-placed pieces and never adds drafts itself",()=>{
    usePlanner.getState().placeFurniture("sofa");usePlanner.getState().placeFurniture("sofa");usePlanner.getState().placeFurniture("laptop");
    const {start}=mount();fireEvent.click(screen.getByRole("button",{name:"In plan"}));
    const ids=new Set(usePlanner.getState().plan.furniture.map(i=>i.catalogId));
    expect(screen.getAllByRole("button",{name:/drag to place/})).toHaveLength(ids.size);
    const before=usePlanner.getState().plan;fireEvent.click(screen.getAllByRole("button",{name:/drag to place/})[0],{detail:0});
    expect(start).toHaveBeenCalledOnce();expect(usePlanner.getState().plan).toBe(before);
  });
  it("shows an actionable empty search and keeps editing shortcuts out of library controls",()=>{
    mount();fireEvent.change(screen.getByLabelText("Search all furniture"),{target:{value:"no-such-piece"}});
    expect(screen.getByText("No matching pieces")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Browse all furniture"}));
    expect(screen.getAllByRole("button",{name:/drag to place/})).toHaveLength(catalog.length);
    const listener=vi.fn();window.addEventListener("keydown",listener);
    try{fireEvent.keyDown(screen.getByLabelText("Furniture category"),{key:"r"});expect(listener).not.toHaveBeenCalled()}finally{window.removeEventListener("keydown",listener)}
    expect(within(screen.getByRole("group",{name:"Library collection"})).getAllByRole("button")).toHaveLength(3);
  });
});
