// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createBlankPlan} from '../src/domain';
import {createListing,type ListingDocument} from '../src/listingTypes';
import type {SceneController} from '../src/scene/SceneController';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5RkAAAAASUVORK5CYII=';
const storage=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),defaults:vi.fn()}));
vi.mock('../src/listingStorage',()=>({loadListing:storage.load,saveListing:storage.save,saveAgentDefaults:storage.defaults}));
vi.mock('../src/listingMedia',()=>({normalizeListingImage:vi.fn(async(s:string)=>s),downloadListingFile:vi.fn(),importListingPhoto:vi.fn(),pairListingOriginal:vi.fn()}));
vi.mock('../src/listingExport',()=>({exportListingPack:vi.fn()}));
vi.mock('../src/ListingVideoPanel',()=>({ListingVideoPanel:()=>null}));
import {ListingStudio} from '../src/ListingStudio';
import {importListingPhoto,pairListingOriginal} from '../src/listingMedia';

describe('Listing Studio integration',()=>{
 let doc:ListingDocument;
 const plan=createBlankPlan('Realtor test','metric'),floorId=plan.floors[0].id;
 const pose={version:1,kind:'orbit',floorId,target:{x:2,y:1,z:3},alpha:1,beta:1,radius:6,mode:0,fov:.8};
 const camera=()=>({beginListingPresentation:vi.fn(),endListingPresentation:vi.fn(),beginWalkthrough:vi.fn(()=>true),endWalkthrough:vi.fn(),moveWalkthrough:vi.fn(),captureListingImage:vi.fn(()=>image),captureCameraShot:vi.fn(()=>pose),restoreCameraShot:vi.fn(()=>true),showHomeShot:vi.fn()});
 beforeEach(()=>{doc=createListing(plan.id,plan.name);storage.load.mockReset().mockImplementation(async()=>structuredClone(doc));storage.save.mockReset().mockResolvedValue(undefined);storage.defaults.mockReset().mockResolvedValue(undefined);vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),0));vi.stubGlobal('cancelAnimationFrame',clearTimeout)});
 afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()});
 it('captures a clean frame before its pose and keeps it distinct from a property photograph',async()=>{
  const c=camera(),original=JSON.stringify(plan);render(<ListingStudio controller={c as unknown as SceneController} plan={plan} floorId={floorId} setFloor={vi.fn()} onClose={vi.fn()} canCapture/>);
  await screen.findByRole('button',{name:'Capture this view'});fireEvent.click(screen.getByRole('button',{name:'Capture this view'}));
  await screen.findByRole('button',{name:'Ground floor · view 1'});
  expect(c.captureListingImage.mock.invocationCallOrder[0]).toBeLessThan(c.captureCameraShot.mock.invocationCallOrder[0]);
  fireEvent.click(screen.getByRole('button',{name:'Photos & slides'}));expect((screen.getByRole('button',{name:'Property photo'}) as HTMLButtonElement).disabled).toBe(true);
  expect(JSON.stringify(plan)).toBe(original);await waitFor(()=>expect(storage.save).toHaveBeenCalled());
  expect(storage.save.mock.calls.at(-1)?.[0].media[0]).toMatchObject({kind:'render',floorId,camera:pose});
 });
 it('stops movement on Escape from a focused panel control and restores the editor on close',async()=>{
  const c=camera(),setFloor=vi.fn(),close=vi.fn();render(<ListingStudio controller={c as unknown as SceneController} plan={plan} floorId={floorId} setFloor={setFloor} onClose={close} canCapture/>);
  fireEvent.click(await screen.findByRole('button',{name:'Start walkthrough'}));const back=screen.getByRole('button',{name:'Return to orbit'});back.focus();fireEvent.keyDown(back,{key:'Escape'});
  expect(screen.getByRole('button',{name:'Start walkthrough'})).toBeTruthy();expect(c.endWalkthrough).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Close Listing Studio'}));await waitFor(()=>expect(close).toHaveBeenCalled());expect(setFloor).toHaveBeenCalledWith(floorId);expect(c.endListingPresentation).toHaveBeenCalled();expect(storage.save).not.toHaveBeenCalled();
 });
 it('retains unsaved edits and offers a backup when local storage fails',async()=>{
  storage.save.mockRejectedValue(new Error('This listing was saved in another tab.'));
  const c=camera(),close=vi.fn();render(<ListingStudio controller={c as unknown as SceneController} plan={plan} floorId={floorId} setFloor={vi.fn()} onClose={close} canCapture/>);
  await screen.findByRole('button',{name:'Capture this view'});fireEvent.click(screen.getByRole('button',{name:'Property'}));fireEvent.change(screen.getByRole('textbox',{name:'Listing title'}),{target:{value:'Do not lose this title'}});
  fireEvent.click(screen.getByRole('button',{name:'Close Listing Studio'}));await screen.findByRole('button',{name:'Save backup'});expect(close).not.toHaveBeenCalled();expect((screen.getByRole('textbox',{name:'Listing title'}) as HTMLInputElement).value).toBe('Do not lose this title');
 });
 it('pairs originals against the latest slide without reverting edits made while the image loads',async()=>{
  doc.media=[{id:'slide',title:'Original title',caption:'',kind:'staged',image,seconds:5}];
  let resolve!:(value:typeof doc.media[number])=>void;
  vi.mocked(importListingPhoto).mockImplementationOnce(()=>new Promise(r=>{resolve=r}));
  vi.mocked(pairListingOriginal).mockImplementationOnce((current,photo)=>({...current,originalImage:photo.image}));
  const c=camera();render(<ListingStudio controller={c as unknown as SceneController} plan={plan} floorId={floorId} setFloor={vi.fn()} onClose={vi.fn()} canCapture/>);
  await screen.findByRole('button',{name:'Capture this view'});fireEvent.click(screen.getByRole('button',{name:'Photos & slides'}));
  fireEvent.change(screen.getByLabelText('Pair original property photo'),{target:{files:[new File(['photo'],'original.png',{type:'image/png'})]}});
  fireEvent.change(screen.getByRole('textbox',{name:'Slide title'}),{target:{value:'Keep my new title'}});
  await act(async()=>resolve({id:'source',title:'Source',caption:'',kind:'photo',image,seconds:5}));
  expect((screen.getByRole('textbox',{name:'Slide title'}) as HTMLInputElement).value).toBe('Keep my new title');
  expect(pairListingOriginal).toHaveBeenLastCalledWith(expect.objectContaining({title:'Keep my new title'}),expect.anything());
 });
 it('refuses capture with restricted third-party scenery',async()=>{
  const c=camera();render(<ListingStudio controller={c as unknown as SceneController} plan={plan} floorId={floorId} setFloor={vi.fn()} onClose={vi.fn()} canCapture={false}/>);
  const capture=await screen.findByRole('button',{name:'Capture this view'});expect((capture as HTMLButtonElement).disabled).toBe(true);expect(c.captureListingImage).not.toHaveBeenCalled();
 });
});
