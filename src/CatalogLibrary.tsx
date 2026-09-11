import {roomCollections,inRoomCollection} from './roomCollections';
import {useEditorPreferences} from './editorPreferences';
import {modelAssetPath} from "./modelAssetPath";
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Armchair, ArrowsInSimple, ArrowsOutSimple, Bed, Books, Check, FrameCorners, GridFour, HandGrabbing, Heart, Lamp, MagnifyingGlass, Plant, SquaresFour, Table, X } from "@phosphor-icons/react";
import { catalog, hasModelPreview, isWallOpening } from "./catalog";
import { formatLength } from "./domain";
import { modelTags, favoritesKey, filterLibrary, furnitureType, libraryCategories, parseFavorites, type LibraryShelf, type LibrarySort } from "./library";
import { usePlanner } from "./store";
import type { CatalogItem } from "./types";
import "./library.css";
import { LibraryIconRail, libraryIcon } from "./LibraryIconRail";

const membershipCache=new WeakMap<object,string>();
const membership=(items:import('./types').FurniturePlacement[])=>{let key=membershipCache.get(items);if(key===undefined){key=[...new Set(items.map(p=>p.catalogId))].sort().join('|');membershipCache.set(items,key)}return key};
const icons: Record<string, typeof Armchair> = { seat:Armchair, table:Table, bed:Bed, storage:Books, lamp:Lamp, plant:Plant, rug:GridFour, decor:SquaresFour, window:FrameCorners };
export const CatalogLibrary=memo(function CatalogLibrary({onBeginDrag,onStartPlacement,onLocate}: {
  onLocate?():void;
  onBeginDrag(item:CatalogItem,event:PointerEvent<HTMLButtonElement>):void;
  onStartPlacement(item:CatalogItem):void;
}) {
  const touchCard=useRef(false);const {recentModels}=useEditorPreferences();const [recentOnly,setRecentOnly]=useState(false),[room,setRoom]=useState('');
  const search = usePlanner(s=>s.search), category = usePlanner(s=>s.category);
  const setSearch = usePlanner(s=>s.setSearch), setCategory = usePlanner(s=>s.setCategory);
  const units = usePlanner(s=>s.plan.units), membershipKey = usePlanner(s=>membership(s.plan.furniture));
  const [shelf,setShelf] = useState<LibraryShelf>("browse"), [type,setType] = useState("All");
  const sort:LibrarySort="collection";const [tag,setTag]=useState(""),[expanded,setExpanded]=useState(false),[filtersOpen,setFiltersOpen]=useState(false);
  const [storageWarning,setStorageWarning] = useState(false);
  const [favorites,setFavorites] = useState<string[]>(()=>{try{return parseFavorites(localStorage.getItem(favoritesKey))}catch{return []}});
  const scrollRef = useRef<HTMLDivElement>(null), searchRef = useRef<HTMLInputElement>(null), filterToggleRef = useRef<HTMLButtonElement>(null);
  const inPlan = useMemo(()=>membershipKey?membershipKey.split('|'):[],[membershipKey]);
  const {items:baseItems,types} = useMemo(()=>filterLibrary({search,category,type,shelf,favorites,inPlan,sort}),[search,category,type,shelf,favorites,inPlan,sort]);
  const tags=useMemo(()=>[...new Set(baseItems.flatMap(modelTags))].sort(),[baseItems]);
  const items=useMemo(()=>{let result=baseItems.filter(item=>(!tag||modelTags(item).includes(tag))&&inRoomCollection(item,room));if(recentOnly)result=result.filter(item=>recentModels.includes(item.id)).sort((a,b)=>recentModels.indexOf(a.id)-recentModels.indexOf(b.id));return result;},[baseItems,tag,room,recentOnly,recentModels]);
  useEffect(()=>setTag(''),[category,type,search,shelf]);
  useEffect(()=>{setType("All");if(["Windows","Doors","Stairs"].includes(category))setShelf("browse")},[category]);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=0},[category,type,search,shelf,sort,tag,room,recentOnly]);
  useEffect(()=>{const sync=(e:StorageEvent)=>{if(e.key===favoritesKey||e.key===null)setFavorites(parseFavorites(e.newValue))};window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync)},[]);
  const toggleFavorite=(id:string)=>{
    const next=favorites.includes(id)?favorites.filter(value=>value!==id):[...favorites,id];setFavorites(next);
    try{localStorage.setItem(favoritesKey,JSON.stringify(next));setStorageWarning(false)}catch{setStorageWarning(true)}
  };
  const changeShelf=(next:LibraryShelf)=>{setRecentOnly(false);setRoom('');setShelf(next);setCategory("All");setType("All");setSearch("")};
  const reset=()=>{setRoom('');setTag("");setCategory("All");setType("All");setSearch("")};
  const hasFilters=Boolean(room||tag||search.trim()||category!=="All"||type!=="All");
  const start=(item:CatalogItem)=>{setExpanded(false);onStartPlacement(item)};
  const counts=(cat:string)=>catalog.filter(item=>item.category===cat).length;
  const groups = useMemo(()=>{
    if(recentOnly)return [{name:"Recently used",items}];
    const byType=new Map<string,CatalogItem[]>();
    for(const item of items){const name=furnitureType(item);const group=byType.get(name);if(group)group.push(item);else byType.set(name,[item]);}
    return [...byType].map(([name,items])=>({name,items}));
  },[items,recentOnly]);
  const heading=recentOnly?"Recently used":room?roomCollections.find(r=>r.id===room)!.name:search.trim()?`Results for “${search.trim()}”`:type!=="All"?type:category!=="All"?category:shelf==="favorites"?"Your favorites":"All furniture";
  return <div className="catalog-slot"><aside aria-label="Furniture library" className={`catalog-panel library-panel ${expanded?"library-expanded":""}`} onKeyDown={event=>{event.stopPropagation();if(event.key==="Escape"&&expanded){event.preventDefault();setExpanded(false)}}}>
    <div className="panel-heading"><h2>Furniture library</h2><button className="icon-button library-expand" aria-label={expanded?"Compact library":"Expand library"} aria-pressed={expanded} title={expanded?"Compact library":"More room to browse"} onClick={()=>setExpanded(!expanded)}>{expanded?<ArrowsInSimple/>:<ArrowsOutSimple/>}</button></div>
    <div className="library-browser-body">
    <LibraryIconRail label="Category" values={["All",...libraryCategories]} value={category} onChange={value=>{setRoom('');setRecentOnly(false);setCategory(value);setType("All")}}/>
    <div className="library-browser-content">
    <div className="search library-search"><MagnifyingGlass size={18}/><input ref={searchRef} aria-label="Search all furniture" placeholder="Search all furniture…" value={search} onChange={e=>{setRoom('');setRecentOnly(false);setSearch(e.target.value);setCategory("All");setType("All");setShelf("browse")}}/>{search&&<button aria-label="Clear search" onClick={()=>{setSearch("");searchRef.current?.focus()}}><X size={15}/></button>}</div>
    <div className="library-shelves" role="group" aria-label="Library collection">
      <button aria-pressed={shelf==="browse"&&!recentOnly} onClick={()=>changeShelf("browse")}><SquaresFour size={16}/> Browse</button>
      <button aria-pressed={shelf==="favorites"&&!recentOnly} onClick={()=>changeShelf("favorites")}><Heart size={16} weight={shelf==="favorites"?"fill":"regular"}/> Saved <small>{favorites.length}</small></button>
      <button aria-pressed={recentOnly} onClick={()=>{changeShelf("browse");setRecentOnly(true)}}>Recent</button>
    </div>
    <div className="library-filter-bar"><button ref={filterToggleRef} className="library-filter-toggle" data-active={hasFilters} aria-expanded={filtersOpen} aria-controls="library-filter-options" onClick={()=>setFiltersOpen(!filtersOpen)}>Filters</button>{hasFilters&&<button className="library-clear-filters" aria-label="Clear all filters" onClick={()=>{reset();filterToggleRef.current?.focus()}}>Clear all</button>}</div><div id="library-filter-options" className="library-filter-options" hidden={!filtersOpen}><div className="room-collections" role="group" aria-label="Browse by room"><span>Browse by room</span>{roomCollections.map(r=><button key={r.id} aria-pressed={room===r.id} onClick={()=>{reset();setRecentOnly(false);setShelf("browse");setRoom(room===r.id?'':r.id)}}>{r.name}</button>)}</div><div className="library-filters">
      <label>Category<select aria-label="Furniture category" value={category} onChange={e=>{setCategory(e.target.value);setType("All")}}><option value="All">All categories · {catalog.length}</option>{libraryCategories.map(cat=><option key={cat} value={cat}>{cat} · {counts(cat)}</option>)}</select></label>
      <label>Type<select aria-label="Furniture type" value={type} onChange={e=>setType(e.target.value)}><option value="All">All types</option>{[...new Set([...types,...(type==="All"?[]:[type])])].map(value=><option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="library-tags" role="group" aria-label="Model tags">{tags.map(value=><button key={value} aria-pressed={tag===value} onClick={()=>setTag(tag===value?'':value)}>{value}</button>)}</div>
    </div><div className="library-results-heading"><div><h3>{heading}</h3><span role="status" aria-live="polite">{items.length} {items.length===1?"piece":"pieces"}{shelf==="plan"?" · all floors":""}</span></div></div>
    <div ref={scrollRef} className="library-results" id="library-results">
      {items.length?<div className="library-groups">{groups.map(group=>{const TypeIcon=libraryIcon(group.name);return <section className="library-type-section" key={group.name} aria-label={group.name}><button className="library-type-heading" aria-label={`Type: ${group.name}`} aria-pressed={type===group.name} title={`Show only ${group.name}`} disabled={recentOnly} onClick={()=>setType(type===group.name?"All":group.name)}><TypeIcon size={21} aria-hidden="true"/><strong>{group.name}</strong><small>{group.items.length}</small></button><div className="catalog-grid library-grid">{group.items.map(item=>{const Icon=icons[item.shape]??SquaresFour, saved=favorites.includes(item.id);return <article className="library-item" key={item.id}>
        <button className="catalog-card" draggable={false} aria-label={`${item.name}, drag to place`} title={`${item.name} — ${item.description}`} onPointerDown={event=>{touchCard.current=event.pointerType==='touch';if(!touchCard.current&&event.button===0){setExpanded(false);onBeginDrag(item,event)}}} onClick={event=>{if(event.detail===0||touchCard.current){touchCard.current=false;start(item)}}}>
          <span className={`item-illustration ${item.shape} ${hasModelPreview(item.id)?"has-model-preview":""}`}>{hasModelPreview(item.id)?<img src={modelAssetPath(item.id,true)} alt="" loading="lazy" draggable={false}/>:<Icon size={38} weight="duotone"/>}</span>
          <span className="item-copy"><span className="item-family">{furnitureType(item)}</span><strong>{item.name}</strong><small>{formatLength(item.widthMm,units)} × {formatLength(isWallOpening(item.id)?item.heightMm:item.depthMm,units)}</small></span>
          <HandGrabbing className="item-drag-hint" size={14}/>
        </button>
        <button className={`favorite-piece ${saved?"is-saved":""}`} aria-label={`${saved?"Unsave":"Save"} ${item.name}`} aria-pressed={saved} title={saved?"Remove from saved":"Save to favorites"} onClick={()=>toggleFavorite(item.id)}><Heart size={16} weight={saved?"fill":"regular"}/></button>
      </article>})}</div></section>})}</div>:<div className="library-empty"><MagnifyingGlass size={30}/><h3>{recentOnly?"Your next favorite starts here":shelf==="favorites"&&!favorites.length?"Keep your favorites close":false?"Your collection starts here":"No matching pieces"}</h3><p>{recentOnly?"Place a piece in your project and find it here next time.":shelf==="favorites"&&!favorites.length?"Tap the heart on any piece to save it here. Favorites stay in this browser.":false?"Confirm a piece in your apartment and find it here next time.":"Try a broader search, another category, or clear your filters."}</p><button className="primary" onClick={()=>{changeShelf("browse");reset()}}>Browse all furniture</button></div>}
    </div>
    <div className="library-footer"><HandGrabbing size={16}/><span>Drag a piece into the scene · Touch or keyboard: select to preview</span></div>
    {storageWarning&&<p className="library-storage-note" role="status">Favorites can only stay for this session because browser storage is unavailable.</p>}
    </div></div>
  </aside></div>;
});
