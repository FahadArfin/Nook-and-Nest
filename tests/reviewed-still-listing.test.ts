import {describe,it,expect} from 'vitest';
import {createBlankPlan} from '../src/domain';
import {createListing,type ListingMedia} from '../src/listingTypes';
import {reviewedStillListing} from '../src/reviewedStillListing';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5RkAAAAASUVORK5CYII=';
describe('reviewed still listing handoff',()=>{
  it('keeps original photos intact, binds the camera, and makes exact retries idempotent',()=>{
    const plan=createBlankPlan(),source=createListing(plan.id,plan.name);
    source.media=[{id:'photo',title:'Property',caption:'Original',kind:'photo',image,seconds:5}];
    const media:ListingMedia={id:'still-job',title:'Design',caption:'Render',kind:'render',image,seconds:5,floorId:plan.floors[0].id};
    const result=reviewedStillListing(source,plan,media);
    expect(source.media).toHaveLength(1);expect(result.media).toHaveLength(2);expect(result.media[0]).toEqual(source.media[0]);
    expect(reviewedStillListing(result,plan,media)).toBe(result);
    expect(()=>reviewedStillListing(result,plan,{...media,title:'Changed output'})).toThrow('already');
  });
  it('rejects old-floor results before they can make combined backups invalid',()=>{
    const plan=createBlankPlan(),source=createListing(plan.id,plan.name),media:ListingMedia={id:'still-job',title:'Old floor',caption:'Render',kind:'render',image,seconds:5,camera:{version:1,kind:'orbit',floorId:'removed-floor',target:{x:0,y:1,z:0},alpha:1,beta:1,radius:4,mode:0,fov:.8}};
    expect(()=>reviewedStillListing(source,plan,media)).toThrow('floor that was removed');
    expect(()=>reviewedStillListing(source,plan,{...media,camera:undefined,floorId:'removed-floor'})).toThrow('floor that was removed');
    expect(source.media).toEqual([]);
    expect(()=>reviewedStillListing({...source,planId:'another'},plan,{...media,camera:undefined})).toThrow('project changed');
    expect(()=>reviewedStillListing(source,plan,{...media,camera:undefined,kind:'photo'})).toThrow('reviewed design');
  });
});
