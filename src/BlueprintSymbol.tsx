import type { SVGProps } from 'react';

export const planItems = [
  {id:'range-oven',label:'Stove',symbol:'stove'},
  {id:'refrigerator',label:'Fridge',symbol:'fridge'},
  {id:'sink-cabinet',label:'Kitchen sink',symbol:'sink'},
  {id:'double-bath-vanity',label:'Double sink',symbol:'double-sink'},
  {id:'tall-pantry-cabinet',label:'Pantry',symbol:'pantry'},
  {id:'two-piece-toilet',label:'Toilet',symbol:'toilet'},
  {id:'single-bath-vanity',label:'Bathroom sink',symbol:'sink'},
  {id:'alcove-bathtub',label:'Bathtub',symbol:'bath'},
  {id:'walk-in-shower',label:'Standing shower',symbol:'shower'},
  {id:'washer',label:'Laundry',symbol:'laundry'},
];
export const openingItems = [
  {id:'door-flush',label:'Door',symbol:'door'},
  {id:'door-flush',label:'Entrance',symbol:'entrance',doorless:true},
  {id:'window-picture',label:'Window',symbol:'window'},
];
export function BlueprintSymbol({symbol,...props}:SVGProps<SVGSVGElement>&{symbol:string}) {
  return <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {symbol==='stove'?<><rect x="4" y="4" width="32" height="32" rx="3"/>{[[12,12],[28,12],[12,28],[28,28]].map(([x,y])=><circle key={`${x}:${y}`} cx={x} cy={y} r="5"/>)}</>:
    symbol==='fridge'?<><rect x="6" y="3" width="28" height="34" rx="3"/><path d="M6 16h28M11 8v4m0 10v8"/></>:
    symbol==='pantry'?<><rect x="5" y="3" width="30" height="34" rx="2"/><path d="M20 3v34M16 16v8m8-8v8"/></>:
    symbol==='sink'||symbol==='double-sink'?<><rect x="3" y="8" width="34" height="28" rx="4"/>{symbol==='double-sink'?<><rect x="7" y="13" width="11" height="18" rx="3"/><rect x="22" y="13" width="11" height="18" rx="3"/></>:<rect x="8" y="13" width="24" height="18" rx="5"/>}<path d="M20 17V5q0-5 5-2"/></>:
    symbol==='toilet'?<><rect x="9" y="3" width="22" height="10" rx="2"/><ellipse cx="20" cy="25" rx="10" ry="12"/><ellipse cx="20" cy="24" rx="6" ry="8"/></>:
    symbol==='bath'?<><rect x="3" y="7" width="34" height="26" rx="6"/><rect x="7" y="11" width="26" height="18" rx="7"/><path d="M8 16h6m-3-3v6"/></>:
    symbol==='shower'?<><rect x="4" y="4" width="32" height="32" rx="2"/><path d="M4 4l32 32M28 7v5m-4-2 8 4M22 17v3m5-2v4m5-2v3"/><circle cx="13" cy="27" r="2"/></>:
    symbol==='laundry'?<><rect x="5" y="3" width="30" height="34" rx="3"/><path d="M5 11h30M10 7h4m13 0h2"/><circle cx="20" cy="24" r="9"/><path d="M12 25q4-5 8 0t8 0"/></>:
    symbol==='door'?<><path d="M4 36V4h4v32h28M8 4a32 32 0 0 1 28 32" strokeDasharray="3 3"/><path d="M8 36V4" strokeWidth="3"/></>:
    symbol==='entrance'?<><path d="M3 10h7v20H3m34-20h-7v20h7M14 20h12m-4-4 4 4-4 4"/></>:
    <><path d="M3 12h34v16H3zM3 20h34M20 12v16"/></>}
  </svg>;
}
