// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {ListingGenerationPanel} from '../src/ListingGenerationPanel';
import {createListing} from '../src/listingTypes';
import {discoverLocalVideo,getLocalVideo,readLocalVideoRecord,reserveLocalVideo,submitLocalVideo,updateLocalVideoRecord,type LocalVideoJob,type LocalVideoRecord} from '../src/localVideo';
import {listingVideoAvailability} from '../src/listingVideo';
import {reviewedPhotoPrivacy} from '../src/photoPrivacy';

vi.mock('../src/localVideo',async importOriginal=>({
 ...await importOriginal<typeof import('../src/localVideo')>(),
 discoverLocalVideo:vi.fn(),getLocalVideo:vi.fn(),downloadLocalVideo:vi.fn(),
 readLocalVideoRecord:vi.fn(),reserveLocalVideo:vi.fn(),submitLocalVideo:vi.fn(),updateLocalVideoRecord:vi.fn(),
}));
vi.mock('../src/listingVideo');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5RkAAAAASUVORK5CYII=';
const otherImage='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2Q==';
const consent=/Send this selected image and direction/;
const token='ephemeral-access-secret';
const records=new Map<string,LocalVideoRecord>();
type Reservation=Awaited<ReturnType<typeof reserveLocalVideo>>;
const job:LocalVideoJob={id:'video-123',status:'queued'};
const listing=()=>{const d=createListing(crypto.randomUUID(),'Home');d.media=[{id:'living',title:'Living room',kind:'photo',caption:'',image,seconds:5},{id:'bedroom',title:'Bedroom',kind:'photo',caption:'',image:otherImage,seconds:5}];return d};
async function ready(){await waitFor(()=>expect(screen.getByRole('region',{name:'My model server'})).toHaveAttribute('aria-busy','false'))}
async function connect(){
 await ready();fireEvent.change(screen.getByLabelText('Server address'),{target:{value:'https://my-server.test'}});
 fireEvent.change(screen.getByLabelText(/Access token/),{target:{value:token}});
 fireEvent.click(screen.getByRole('button',{name:'Check server'}));await screen.findByText('Server reached · 1 model');await ready();
}
function approve(){fireEvent.click(screen.getByLabelText('Living room'));fireEvent.click(screen.getByLabelText(consent))}
function generate(){fireEvent.click(screen.getByRole('button',{name:'Generate on my server'}))}
beforeEach(()=>{
 localStorage.clear();records.clear();vi.resetAllMocks();
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Unexpected network request')));
 vi.mocked(discoverLocalVideo).mockResolvedValue(['local-model']);
 vi.mocked(readLocalVideoRecord).mockImplementation(async id=>records.get(id));
 vi.mocked(reserveLocalVideo).mockImplementation(async(id,profile)=>{if(records.has(id))throw new Error('Existing request');const record={requestId:crypto.randomUUID(),profile:{...profile}};records.set(id,record);return record});
 vi.mocked(updateLocalVideoRecord).mockImplementation(async(id,record,remove)=>{if(remove)records.delete(id);else records.set(id,record)});
 vi.mocked(submitLocalVideo).mockResolvedValue(job);vi.mocked(getLocalVideo).mockResolvedValue({...job,status:'completed'});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()});

it('never reserves or sends an unselected privacy copy, then sends only its selected derivative',async()=>{
 const doc=listing(),copy='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';doc.media[0].privacy=reviewedPhotoPrivacy(image,{width:1,height:1,crop:{x:0,y:0,width:1,height:1},turns:0,masks:[]},copy);
 const {rerender}=render(<ListingGenerationPanel listing={doc}/>);await connect();approve();generate();expect(await screen.findByRole('alert')).toHaveTextContent('Choose the reviewed privacy copy');expect(reserveLocalVideo).not.toHaveBeenCalled();expect(submitLocalVideo).not.toHaveBeenCalled();
 rerender(<ListingGenerationPanel listing={{...doc,media:[{...doc.media[0],privacy:{...doc.media[0].privacy,selected:true}}]}}/>);generate();await waitFor(()=>expect(submitLocalVideo).toHaveBeenCalledOnce());expect(vi.mocked(submitLocalVideo).mock.calls[0][2].image).toBe(copy);
});

it('stays offline by default, discovers only on request and keeps the access token out of saved preferences',async()=>{
 const doc=listing(),view=render(<ListingGenerationPanel listing={doc}/>);await ready();
 expect(screen.getByRole('button',{name:'My model server'})).toHaveAttribute('aria-pressed','true');
 expect(discoverLocalVideo).not.toHaveBeenCalled();expect(listingVideoAvailability).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 await connect();
 expect(discoverLocalVideo).toHaveBeenCalledWith(expect.objectContaining({endpoint:'https://my-server.test/v1',adapter:'standard'}),token,expect.any(AbortSignal));
 expect(reserveLocalVideo).not.toHaveBeenCalled();expect(submitLocalVideo).not.toHaveBeenCalled();expect(getLocalVideo).not.toHaveBeenCalled();
 expect(JSON.parse(localStorage.getItem('nook-local-video-profile')!)).toEqual({endpoint:'https://my-server.test/v1',model:'local-model',adapter:'standard'});
 view.unmount();render(<ListingGenerationPanel listing={doc}/>);await ready();
 expect(screen.getByLabelText(/Access token/)).toHaveValue('');expect(screen.getByText('Disconnected')).toBeInTheDocument();
 expect(discoverLocalVideo).toHaveBeenCalledTimes(1);expect(listingVideoAvailability).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});

it('recovers an existing job when optional connection preferences cannot be saved',async()=>{
 const doc=listing(),record:LocalVideoRecord={requestId:crypto.randomUUID(),profile:{endpoint:'https://my-server.test/v1',model:'local-model',adapter:'standard'},job};
 records.set(doc.planId,record);render(<ListingGenerationPanel listing={doc}/>);await ready();
 const save=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Quota exceeded','QuotaExceededError')});
 fireEvent.click(screen.getByRole('button',{name:'Check server'}));await screen.findByText('Server reached · 1 model');await ready();
 expect(save).toHaveBeenCalled();expect(screen.getByText(/Connection preferences could not be remembered/)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Check job status'})).toBeEnabled();expect(getLocalVideo).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Check job status'}));await screen.findByText('Video: completed');
 expect(getLocalVideo).toHaveBeenCalledExactlyOnceWith(record.profile,'',job.id,expect.any(AbortSignal));
 expect(records.get(doc.planId)?.job?.status).toBe('completed');expect(screen.getByText('Server reached · 1 model')).toBeInTheDocument();
 expect(reserveLocalVideo).not.toHaveBeenCalled();expect(submitLocalVideo).not.toHaveBeenCalled();
});

it('requires renewed consent for the selected image and waits for durable reservation before one submission',async()=>{
 const doc=listing();let finishReservation!:(record:Reservation)=>void;
 vi.mocked(reserveLocalVideo).mockImplementationOnce(()=>new Promise(resolve=>{finishReservation=resolve}));
 render(<ListingGenerationPanel listing={doc}/>);await connect();approve();
 fireEvent.click(screen.getByLabelText('Bedroom'));expect(screen.getByLabelText(consent)).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Generate on my server'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Direction'),{target:{value:'Keep the bedroom windows and oak furniture.'}});
 fireEvent.click(screen.getByRole('button',{name:'10 seconds'}));fireEvent.click(screen.getByLabelText(consent));generate();generate();
 await waitFor(()=>expect(reserveLocalVideo).toHaveBeenCalledOnce());expect(submitLocalVideo).not.toHaveBeenCalled();
 const profile=vi.mocked(reserveLocalVideo).mock.calls[0][1],record={requestId:crypto.randomUUID(),profile};
 await act(async()=>{records.set(doc.planId,record);finishReservation(record)});
 await screen.findByText('Video: queued');
 expect(submitLocalVideo).toHaveBeenCalledExactlyOnceWith(profile,token,{image:otherImage,prompt:'Keep the bedroom windows and oak furniture.',seconds:10,consent:true},expect.any(AbortSignal));
 expect(JSON.stringify(records.get(doc.planId))).not.toContain(token);
 expect(screen.queryByRole('button',{name:'Generate on my server'})).not.toBeInTheDocument();
});

it.each(['read','reserve'] as const)('does not submit when recovery storage fails during %s',async stage=>{
 if(stage==='read')vi.mocked(readLocalVideoRecord).mockRejectedValueOnce(new Error('Storage unavailable'));
 else vi.mocked(reserveLocalVideo).mockRejectedValueOnce(new Error('Storage unavailable'));
 render(<ListingGenerationPanel listing={listing()}/>);await connect();approve();
 if(stage==='read')expect(screen.getByRole('button',{name:'Generate on my server'})).toBeDisabled();else generate();
 expect(await screen.findByRole('alert')).toHaveTextContent(stage==='read'?'saved model request could not be read':'Storage unavailable');
 expect(submitLocalVideo).not.toHaveBeenCalled();expect(records.size).toBe(0);
});

it('keeps an interrupted submission blocked after privacy edits and recovers by job ID without another POST',async()=>{
 const doc=listing();let signal:AbortSignal|undefined;
 vi.mocked(submitLocalVideo).mockImplementationOnce((_profile,_token,_input,abortSignal)=>new Promise((_resolve,reject)=>{signal=abortSignal;signal!.addEventListener('abort',()=>reject(new Error('Submission interrupted')),{once:true})}));
 const view=render(<ListingGenerationPanel listing={doc}/>);await connect();approve();generate();
 await waitFor(()=>expect(submitLocalVideo).toHaveBeenCalledOnce());view.unmount();expect(signal?.aborted).toBe(true);
 expect(records.get(doc.planId)?.job).toBeUndefined();expect(records.has(doc.planId)).toBe(true);
 doc.media[0].privacy=reviewedPhotoPrivacy(image,{width:1,height:1,crop:{x:0,y:0,width:1,height:1},turns:0,masks:[]},image);
 render(<ListingGenerationPanel listing={doc}/>);await ready();
 expect(screen.getByText('Submission needs checking')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Generate on my server'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Clear local job record'})).toBeDisabled();expect(screen.getByLabelText(/Access token/)).toHaveValue('');
 fireEvent.click(screen.getByRole('button',{name:'Check server'}));await screen.findByText('Server reached · 1 model');await ready();
 fireEvent.change(screen.getByLabelText('Recover server job ID'),{target:{value:job.id}});fireEvent.click(screen.getByRole('button',{name:'Check job status'}));
 await screen.findByText('Video: completed');expect(getLocalVideo).toHaveBeenCalledWith(records.get(doc.planId)!.profile,'',job.id,expect.any(AbortSignal));
 expect(submitLocalVideo).toHaveBeenCalledOnce();expect(records.get(doc.planId)?.job?.id).toBe(job.id);
});

it('persists a late accepted job for its original project after switching to another home',async()=>{
 let finish!:(job:LocalVideoJob)=>void;vi.mocked(submitLocalVideo).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 const first=listing(),second=listing(),view=render(<ListingGenerationPanel listing={first}/>);await connect();approve();generate();
 await waitFor(()=>expect(submitLocalVideo).toHaveBeenCalledOnce());view.rerender(<ListingGenerationPanel listing={second}/>);await ready();
 await act(async()=>finish(job));
 expect(records.get(first.planId)?.job).toEqual(job);expect(records.has(second.planId)).toBe(false);
 expect(screen.queryByText('Video: queued')).not.toBeInTheDocument();expect(screen.getByText('Disconnected')).toBeInTheDocument();
 expect(screen.getByLabelText(/Access token/)).toHaveValue('');expect(submitLocalVideo).toHaveBeenCalledOnce();
});

it('releases an unfinished reservation after leaving before any request was sent',async()=>{
 const doc=listing();let finish!:(record:Reservation)=>void;
 vi.mocked(reserveLocalVideo).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 const view=render(<ListingGenerationPanel listing={doc}/>);await connect();approve();generate();
 await waitFor(()=>expect(reserveLocalVideo).toHaveBeenCalledOnce());view.unmount();
 const record={requestId:crypto.randomUUID(),profile:vi.mocked(reserveLocalVideo).mock.calls[0][1]};
 await act(async()=>{records.set(doc.planId,record);finish(record)});
 expect(updateLocalVideoRecord).toHaveBeenCalledWith(doc.planId,record,true);expect(records.has(doc.planId)).toBe(false);expect(submitLocalVideo).not.toHaveBeenCalled();
});
