import {useState} from 'react';
import type {ListingDocument} from './listingTypes';
import {ListingVideoPanel} from './ListingVideoPanel';
import {LocalVideoPanel} from './LocalVideoPanel';

export function ListingGenerationPanel({listing}:{listing:ListingDocument}){
 const [provider,setProvider]=useState<'local'|'seedance'>('local');
 return <><div className="listing-segments" aria-label="Video provider"><button aria-pressed={provider==='local'} onClick={()=>setProvider('local')}>My model server</button><button aria-pressed={provider==='seedance'} onClick={()=>setProvider('seedance')}>Seedance · cloud</button></div>{provider==='local'?<LocalVideoPanel key={listing.planId} listing={listing}/>:<ListingVideoPanel listing={listing}/>}</>;
}
