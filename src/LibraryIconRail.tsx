import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Armchair, Bed, Books, CaretUp, CaretDown, CookingPot, Door, Flower, FrameCorners, GridFour, Lamp, Monitor, Plant, Shower, SquaresFour, Stairs, Table, Tree, Bathtub, Toilet, Fish, Flame, Clock, PawPrint, Baby, ForkKnife, Lightbulb, WashingMachine, type Icon } from '@phosphor-icons/react';

const categoryIcons: Record<string, Icon> = {All:SquaresFour, Living:Armchair, Bedroom:Bed, Dining:ForkKnife, Office:Monitor, Kitchen:CookingPot, Bathroom:Bathtub, Storage:Books, Lighting:Lamp, Decor:Flower, Outdoor:Tree, Windows:FrameCorners, Doors:Door, Stairs};
export function libraryIcon(label: string): Icon {
  if (categoryIcons[label]) return categoryIcons[label];
  for (const [pattern, icon] of [
    [/aquarium/i,Fish], [/fire|barbecue/i,Flame], [/clock/i,Clock], [/pet/i,PawPrint], [/baby/i,Baby],
    [/tree/i,Tree], [/garden|plant/i,Plant], [/sofa|chair|seating/i,Armchair], [/bed/i,Bed],
    [/shower/i,Shower], [/toilet/i,Toilet], [/sink|bath|vanit/i,Bathtub], [/laundry/i,WashingMachine],
    [/lamp|light|pendant/i,Lightbulb], [/computer|screen|desk|audio|media/i,Monitor],
    [/table|counter|island/i,Table], [/appliance|kitchen|hood/i,CookingPot],
    [/door/i,Door], [/window|curtain|blind|mirror|art/i,FrameCorners], [/stair/i,Stairs],
    [/shel|book|cabinet|storage|closet|dresser|organizer/i,Books], [/rug|path|backsplash/i,GridFour],
  ] as [RegExp, Icon][]) if (pattern.test(label)) return icon;
  return SquaresFour;
}

export function LibraryIconRail({label, values, value, onChange}: {
  label: 'Category' | 'Type'; values: readonly string[]; value: string; onChange(value: string): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({start:true,end:true});
  const measure = () => {const el=ref.current;if(el)setEdges({start:el.scrollTop<2,end:el.scrollTop+el.clientHeight>=el.scrollHeight-2})};
  const signature=values.join('|');
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    measure();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
    observer?.observe(el);return()=>observer?.disconnect();
  },[signature]);
  useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.scrollIntoView?.({block:'nearest',inline:'nearest'})},[value,signature]);
  const scroll=(direction:number)=>ref.current?.scrollBy({top:direction*ref.current.clientHeight*.75,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  const navigate=(event:KeyboardEvent<HTMLButtonElement>, index:number)=>{
    const next=(event.key==='ArrowDown'||event.key==='ArrowRight')?(index+1)%values.length:(event.key==='ArrowUp'||event.key==='ArrowLeft')?(index+values.length-1)%values.length:event.key==='Home'?0:event.key==='End'?values.length-1:-1;
    if(next<0)return;event.preventDefault();ref.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };
  return <div className="library-icon-navigation">
    <div className="library-rail-heading"><span>Categories</span><div>
      <button aria-label={`Scroll ${label.toLowerCase()} icons up`} disabled={edges.start} onClick={()=>scroll(-1)}><CaretUp size={13}/></button>
      <button aria-label={`Scroll ${label.toLowerCase()} icons down`} disabled={edges.end} onClick={()=>scroll(1)}><CaretDown size={13}/></button>
    </div></div>
    <div ref={ref} className="library-icon-rail" role="group" aria-label={`${label} icons`} onScroll={measure}>
      {values.map((item,index)=>{const ItemIcon=libraryIcon(item);return <button key={item} aria-label={`${label}: ${item}`} title={item==='All'?`All ${label==='Category'?'categories':'types'}`:item} aria-pressed={value===item} onClick={()=>onChange(item)} onKeyDown={event=>navigate(event,index)}><ItemIcon size={22} weight={value===item?'duotone':'regular'} aria-hidden="true"/><span>{item}</span></button>})}
    </div>
  </div>;
}
