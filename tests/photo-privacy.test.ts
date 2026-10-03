import {describe,expect,it} from 'vitest';
import {strFromU8} from 'fflate';
import {createBlankPlan} from '../src/domain';
import {buildListingPackFiles} from '../src/listingExport';
import {createListing,parseListing,type ListingMedia} from '../src/listingTypes';
import {listingOutputImage,listingPreviewImage,parsePhotoRecipe,photoMaskBetween,photoSourcePoint,reviewedPhotoPrivacy} from '../src/photoPrivacy';

const original='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5RkAAAAASUVORK5CYII=';
const copy='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const recipe={width:1,height:1,crop:{x:0,y:0,width:1,height:1},turns:0 as const,masks:[{x:0,y:0,width:1,height:1}]};
const photo=():ListingMedia=>({id:'photo',title:'Private room',caption:'',image:original,sourceImage:original,originalImage:original,kind:'photo',seconds:5,privacy:reviewedPhotoPrivacy(original,recipe,copy)});

describe('reviewed photo privacy copies',()=>{
 it('preserves private bytes and an unselected derivative through local backup validation',()=>{
  const listing=createListing('home','Home');listing.media=[photo()];const parsed=parseListing(listing);
  expect(parsed.media[0]).toEqual(listing.media[0]);expect(parsed.media[0].privacy?.selected).toBe(false);
 });
 it('requires explicit output selection and blocks changed source images',()=>{
  const media=photo();expect(listingPreviewImage(media)).toBe(copy);expect(()=>listingOutputImage(media)).toThrow('Choose the reviewed');media.privacy!.selected=true;expect(listingOutputImage(media)).toBe(copy);
  media.image=copy;expect(()=>listingOutputImage(media)).toThrow('source image changed');
 });
 it('exports only a selected flattened copy and never embeds its original, raw source or mask recipe',()=>{
  const plan=createBlankPlan(),listing=createListing(plan.id,'Private listing');listing.media=[photo()];
  expect(()=>buildListingPackFiles(listing,plan)).toThrow('Choose the reviewed');listing.media[0].privacy!.selected=true;
  const files=buildListingPackFiles(listing,plan),paths=Object.keys(files).filter(p=>p.startsWith('media/'));
  expect(paths).toHaveLength(1);expect(btoa(String.fromCharCode(...files[paths[0]]))).toBe(copy.split(',')[1]);
  const provenance=JSON.parse(strFromU8(files['provenance.json']));expect(provenance.media[0]).not.toHaveProperty('sourcePath');expect(provenance.media[0]).not.toHaveProperty('originalPath');expect(provenance.media[0]).toHaveProperty('privacyReviewed',true);
  for(const bytes of Object.values(files)){expect(strFromU8(bytes)).not.toContain(original);expect(strFromU8(bytes)).not.toContain('sourceKey');}
  expect(listing.media[0].image).toBe(original);expect(listing.media[0].sourceImage).toBe(original);
 });
 it('keeps masks in source coordinates through all quarter turns and crop changes',()=>{
  const base={width:100,height:80,crop:{x:20,y:10,width:40,height:60},turns:0 as 0|1|2|3,masks:[]};
  const corners=[[20,10],[20,70],[60,70],[60,10]];
  for(const turns of [0,1,2,3] as const){const r={...base,turns};expect(photoSourcePoint(r,0,0)).toEqual({x:corners[turns][0],y:corners[turns][1]});expect(photoMaskBetween(r,photoSourcePoint(r,0,0),photoSourcePoint(r,1,1))).toEqual(base.crop);}
  expect(photoMaskBetween(base,{x:39.2,y:18.8},{x:21.7,y:10.1})).toEqual({x:21,y:10,width:19,height:9});
 });
 it('blocks another slide from silently exporting the private original of a masked photo',()=>{
  const plan=createBlankPlan(),listing=createListing(plan.id,'Private listing'),masked=photo();masked.privacy!.selected=true;const {privacy:_privacy,...duplicate}=photo();listing.media=[masked,{...duplicate,id:'duplicate'}];expect(()=>buildListingPackFiles(listing,plan)).toThrow('duplicate source');
 });
 it('rejects malformed, oversized and excessive masks or derivatives before export',()=>{
  for(const invalid of [{...recipe,width:1601},{...recipe,turns:4},{...recipe,masks:Array(81).fill(recipe.crop)},{...recipe,crop:{...recipe.crop,width:2}},{...recipe,masks:[{x:0,y:0,width:NaN,height:1}]}])expect(()=>parsePhotoRecipe(invalid)).toThrow();
  const listing=createListing('home','Home');listing.media=[photo()];listing.media[0].privacy!.recipe.width=2;listing.media[0].privacy!.recipe.crop.width=2;expect(()=>parseListing(listing)).toThrow('privacy copy');
 });
});
