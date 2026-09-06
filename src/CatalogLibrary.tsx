import {modelAssetPath} from "./modelAssetPath";
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Armchair, ArrowsInSimple, ArrowsOutSimple, Bed, Books, Check, FrameCorners, GridFour, HandGrabbing, Heart, Lamp, MagnifyingGlass, Plant, SquaresFour, Table, X } from "@phosphor-icons/react";
import { catalog, hasModelPreview, isWallOpening } from "./catalog";
import { formatLength } from "./domain";
import { favoritesKey, filterLibrary, furnitureType, libraryCategories, parseFavorites, type LibraryShelf, type LibrarySort } from "./library";
import { usePlanner } from "./store";
import type { CatalogItem } from "./types";
import "./library.css";
import { LibraryIconRail, libraryIcon } from "./LibraryIconRail";

const icons: Record<string, typeof Armchair> = { seat:Armchair, table:Table, bed:Bed, storage:Books, lamp:Lamp, plant:Plant, rug:GridFour, decor:SquaresFour, window:FrameCorners };
export const CatalogLibrary=memo(function CatalogLibrary({onBeginDrag,onStartPlacement}: {
  onBeginDrag(item:CatalogItem,event:PointerEvent<HTMLButtonElement>):void;
  onStartPlacement(item:CatalogItem):void;
}) {
  const search = usePlanner(s=>s.search), category = usePlanner(s=>s.category);
  const setSearch = usePlanner(s=>s.setSearch), setCategory = usePlanner(s=>s.setCategory);
  const units = usePlanner(s=>s.plan.units), placed = usePlanner(s=>s.plan.furniture);
  const [shelf,setShelf] = useState<LibraryShelf>("browse"), [type,setType] = useState("All");
  const [sort,setSort] = useState<LibrarySort>("collection"), [expanded,setExpanded] = useState(false);
  const [storageWarning,setStorageWarning] = useState(false);
  const [favorites,setFavorites] = useState<string[]>(()=>{try{return parseFavorites(localStorage.getItem(favoritesKey))}catch{return []}});
  const scrollRef = useRef<HTMLDivElement>(null), searchRef = useRef<HTMLInputElement>(null);
  const inPlan = useMemo(()=>[...new Set(placed.map(item=>item.catalogId))],[placed]);
  const {items,types} = useMemo(()=>filterLibrary({search,category,type,shelf,favorites,inPlan,sort}),[search,category,type,shelf,favorites,inPlan,sort]);
  useEffect(()=>{setType("All");if(["Windows","Doors","Stairs"].includes(category))setShelf("browse")},[category]);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=0},[category,type,search,shelf,sort]);
  useEffect(()=>{const sync=(e:StorageEvent)=>{if(e.key===favoritesKey||e.key===null)setFavorites(parseFavorites(e.newValue))};window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync)},[]);
  const toggleFavorite=(id:string)=>{
    const next=favorites.includes(id)?favorites.filter(value=>value!==id):[...favorites,id];setFavorites(next);
    try{localStorage.setItem(favoritesKey,JSON.stringify(next));setStorageWarning(false)}catch{setStorageWarning(true)}
  };
  const changeShelf=(next:LibraryShelf)=>{setShelf(next);setCategory("All");setType("All");setSearch("")};
  const reset=()=>{setCategory("All");setType("All");setSearch("")};
  const start=(item:CatalogItem)=>{setExpanded(false);onStartPlacement(item)};
  const counts=(cat:string)=>catalog.filter(item=>item.category===cat).length;
  const groups = useMemo(()=>{
    const byType=new Map<string,CatalogItem[]>();
    for(const item of items){const name=furnitureType(item);const group=byType.get(name);if(group)group.push(item);else byType.set(name,[item]);}
    return [...byType].map(([name,items])=>({name,items}));
  },[items]);
  const heading=search.trim()?`Results for “${search.trim()}”`:type!=="All"?type:category!=="All"?category:shelf==="favorites"?"Your favorites":shelf==="plan"?"Pieces in this plan":"All furniture";
  return <div className="catalog-slot"><aside aria-label="Furniture library" className={`catalog-panel library-panel ${expanded?"library-expanded":""}`} onKeyDown={event=>{event.stopPropagation();if(event.key==="Escape"&&expanded){event.preventDefault();setExpanded(false)}}}>
    <div className="panel-heading"><div><span className="eyebrow">Furniture library</span><h2>Find your next piece</h2></div><button className="icon-button library-expand" aria-label={expanded?"Compact library":"Expand library"} aria-pressed={expanded} title={expanded?"Compact library":"More room to browse"} onClick={()=>setExpanded(!expanded)}>{expanded?<ArrowsInSimple/>:<ArrowsOutSimple/>}</button></div>
    <div className="library-browser-body">
    <LibraryIconRail label="Category" values={["All",...libraryCategories]} value={category} onChange={value=>{setCategory(value);setType("All")}}/>
    <div className="library-browser-content">
    <div className="search library-search"><MagnifyingGlass size={18}/><input ref={searchRef} aria-label="Search all furniture" placeholder="Search all furniture…" value={search} onChange={e=>{setSearch(e.target.value);setCategory("All");setType("All");setShelf("browse")}}/>{search&&<button aria-label="Clear search" onClick={()=>{setSearch("");searchRef.current?.focus()}}><X size={15}/></button>}</div>
    <div className="library-shelves" role="group" aria-label="Library collection">
      <button aria-pressed={shelf==="browse"} onClick={()=>changeShelf("browse")}><SquaresFour size={16}/> Browse</button>
      <button aria-pressed={shelf==="favorites"} onClick={()=>changeShelf("favorites")}><Heart size={16} weight={shelf==="favorites"?"fill":"regular"}/> Saved <small>{favorites.length}</small></button>
      <button aria-pressed={shelf==="plan"} onClick={()=>changeShelf("plan")}><Check size={16}/> In plan</button>
    </div>
    <div className="library-filters">
      <label>Category<select aria-label="Furniture category" value={category} onChange={e=>{setCategory(e.target.value);setType("All")}}><option value="All">All categories · {catalog.length}</option>{libraryCategories.map(cat=><option key={cat} value={cat}>{cat} · {counts(cat)}</option>)}</select></label>
      <label>Type<select aria-label="Furniture type" value={type} onChange={e=>setType(e.target.value)}><option value="All">All types</option>{[...new Set([...types,...(type==="All"?[]:[type])])].map(value=><option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="library-results-heading"><div><h3>{heading}</h3><span role="status" aria-live="polite">{items.length} {items.length===1?"piece":"pieces"}{shelf==="plan"?" · all floors":""}</span></div><select aria-label="Sort furniture" value={sort} onChange={e=>setSort(e.target.value as LibrarySort)}><option value="collection">Collection order</option><option value="name">Name A–Z</option><option value="size">Smallest footprint</option></select></div>
    {(category!=="All"||type!=="All"||search)&&<button className="library-reset" onClick={reset}><X size={12}/> Clear filters</button>}
    <div ref={scrollRef} className="library-results" id="library-results">
      {items.length?<div className="library-groups">{groups.map(group=>{const TypeIcon=libraryIcon(group.name);return <section className="library-type-section" key={group.name} aria-label={group.name}><button className="library-type-heading" aria-label={`Type: ${group.name}`} aria-pressed={type===group.name} title={`Show only ${group.name}`} onClick={()=>setType(type===group.name?"All":group.name)}><TypeIcon size={21} aria-hidden="true"/><strong>{group.name}</strong><small>{group.items.length}</small></button><div className="catalog-grid library-grid">{group.items.map(item=>{const Icon=icons[item.shape]??SquaresFour, saved=favorites.includes(item.id);return <article className="library-item" key={item.id}>
        <button className="catalog-card" draggable={false} aria-label={`${item.name}, drag to place`} title={`${item.name} — ${item.description}`} onPointerDown={event=>{if(event.button===0){setExpanded(false);onBeginDrag(item,event)}}} onClick={event=>{if(event.detail===0)start(item)}}>
          <span className={`item-illustration ${item.shape} ${hasModelPreview(item.id)?"has-model-preview":""}`}>{hasModelPreview(item.id)?<img src={modelAssetPath(item.id,true)} alt="" loading="lazy" draggable={false}/>:<Icon size={38} weight="duotone"/>}</span>
          <span className="item-copy"><span className="item-family">{furnitureType(item)}</span><strong>{item.name}</strong><small>{formatLength(item.widthMm,units)} × {formatLength(isWallOpening(item.id)?item.heightMm:item.depthMm,units)}</small></span>
          <HandGrabbing className="item-drag-hint" size={14}/>
        </button>
        <button className={`favorite-piece ${saved?"is-saved":""}`} aria-label={`${saved?"Unsave":"Save"} ${item.name}`} aria-pressed={saved} title={saved?"Remove from saved":"Save to favorites"} onClick={()=>toggleFavorite(item.id)}><Heart size={16} weight={saved?"fill":"regular"}/></button>
      </article>})}</div></section>})}</div>:<div className="library-empty"><MagnifyingGlass size={30}/><h3>{shelf==="favorites"&&!favorites.length?"Keep your favorites close":shelf==="plan"&&!inPlan.length?"Your collection starts here":"No matching pieces"}</h3><p>{shelf==="favorites"&&!favorites.length?"Tap the heart on any piece to save it here. Favorites stay in this browser.":shelf==="plan"&&!inPlan.length?"Confirm a piece in your apartment and find it here next time.":"Try a broader search, another category, or clear your filters."}</p><button className="primary" onClick={()=>changeShelf("browse")}>Browse all furniture</button></div>}
    </div>
    <div className="library-footer"><HandGrabbing size={16}/><span>Drag into your room · Enter to start placing</span></div>
    {storageWarning&&<p className="library-storage-note" role="status">Favorites can only stay for this session because browser storage is unavailable.</p>}
    </div></div>
  </aside></div>;
});
