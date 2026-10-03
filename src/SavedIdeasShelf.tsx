import {useMemo,useState} from 'react';
import {BookmarkSimple,Trash} from '@phosphor-icons/react';
import {RemixMiniature} from './RemixPreview';
import {makeRemixThumbnail} from './remixThumbnail';
import type {RemixPackage} from './remixSnapshot';
import {SAVED_IDEAS_LIMITS,type SavedIdea} from './savedIdeas';

export function SavedIdeasShelf({ideas,busy,onChoose,onRemove}:{
 ideas:SavedIdea[];busy:boolean;onChoose:(packet:RemixPackage)=>void;onRemove:(idea:SavedIdea)=>void;
}){
 const [search,setSearch]=useState(''),[tag,setTag]=useState('');
 const tags=useMemo(()=>[...new Set(ideas.flatMap(idea=>idea.packet.snapshot.tags).filter(value=>value!=='budget-unknown'))].sort(),[ideas]);
 const activeTag=tags.find(value=>value===tag)??'';
 const filtered=useMemo(()=>ideas.filter(({packet:{snapshot}})=>(!activeTag||snapshot.tags.includes(activeTag as typeof snapshot.tags[number]))&&`${snapshot.title} ${snapshot.creator} ${snapshot.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[ideas,search,activeTag]);
 return <section aria-label="Saved ideas" className="saved-ideas-shelf">
  <div className="saved-ideas-heading"><h3>Your inspiration shelf</h3><span>{ideas.length} / {SAVED_IDEAS_LIMITS.entries}</span></div>
  <p className="saved-ideas-note">On this device · separate from your projects. Export a room package to keep a backup.</p>
  {!ideas.length?<div className="saved-ideas-empty"><BookmarkSimple size={30} aria-hidden="true"/><h4>A place for your next idea</h4><p>Preview an original or import a room package, then save it here.</p></div>:<>
   <label className="saved-ideas-search">Find a saved idea<input type="search" placeholder="Title, creator or description" value={search} maxLength={120} onChange={event=>setSearch(event.target.value)}/></label>
   <div className="saved-ideas-filters" role="group" aria-label="Filter saved ideas">
    <button aria-pressed={!activeTag} onClick={()=>setTag('')}>All</button>
    {tags.map(value=><button key={value} aria-pressed={activeTag===value} onClick={()=>setTag(activeTag===value?'':value)}>{value.replaceAll('-',' ')}</button>)}
   </div>
   <p className="saved-ideas-count" role="status">{filtered.length} {filtered.length===1?'idea':'ideas'}</p>
   <div className="idea-grid">{filtered.map(idea=>{
    const snapshot=idea.packet.snapshot;
    return <article key={idea.id}>
     <RemixMiniature value={makeRemixThumbnail(snapshot)} label={snapshot.title}/>
     <h4>{snapshot.title}</h4><p>By {snapshot.creator} · {snapshot.plan.furniture.length} pieces</p>
     <div className="saved-ideas-actions"><button disabled={busy} onClick={()=>onChoose(idea.packet)}>Preview {snapshot.title}</button><button className="saved-ideas-remove" disabled={busy} onClick={()=>onRemove(idea)} aria-label={`Remove ${snapshot.title} from saved ideas`} title="Remove from saved ideas"><Trash size={18} aria-hidden="true"/></button></div>
    </article>;
   })}</div>
   {!filtered.length&&<p>No saved ideas match.</p>}
  </>}
 </section>;
}
