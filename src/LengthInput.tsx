import {useEffect,useState} from 'react';
import {fraction,parseFraction} from './measurement';
import type {Units} from './types';
export function LengthInput({label,value,units,onChange,min=0,disabled=false}:{label:string;value:number;units:Units;onChange(value:number):void;min?:number;disabled?:boolean}){
 const imperial=units==='imperial',total=Math.round(Math.abs(value)/25.4*16)/16;
 const a=imperial?(value<0?'-':'')+String(Math.floor(total/12)):String(Number((value/1000).toFixed(3))),b=fraction(total%12);
 const [primary,setPrimary]=useState(a),[inches,setInches]=useState(b);
 useEffect(()=>{setPrimary(a);setInches(b)},[a,b,value,units]);
 const commit=()=>{if(primary===a&&inches===b)return;const n=imperial?(Math.abs(Number(primary))*12+parseFraction(inches))*25.4*(primary.startsWith('-')?-1:1):Number(primary)*1000;if(primary.trim()&&Number.isFinite(n)&&n>=min)onChange(Math.round(n));else{setPrimary(a);setInches(b)}};
 return <fieldset className="length-input"><legend>{label}</legend><label>{imperial?'Feet':'Metres'}<input disabled={disabled} aria-label={`${label} ${imperial?'feet':'metres'}`} inputMode="decimal" value={primary} onChange={e=>setPrimary(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/></label>{imperial&&<label>Inches<input disabled={disabled} aria-label={`${label} inches`} inputMode="text" placeholder="6 1/2" value={inches} onChange={e=>setInches(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/></label>}</fieldset>;
}
