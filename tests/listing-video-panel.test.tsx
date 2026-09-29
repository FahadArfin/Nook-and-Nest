// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {ListingVideoPanel} from '../src/ListingVideoPanel';
import {createListing} from '../src/listingTypes';
import {getListingVideo,listingVideoAvailability,validateListingVideo,submitListingVideo,type ListingVideoJob,type ListingVideoRequest} from '../src/listingVideo';

vi.mock('../src/listingVideo',async(importOriginal)=>({...await importOriginal<typeof import('../src/listingVideo')>(),listingVideoAvailability:vi.fn(),validateListingVideo:vi.fn(),submitListingVideo:vi.fn(),getListingVideo:vi.fn(),deleteListingVideo:vi.fn()}));
const connected={available:true,signedIn:true,provider:'BytePlus',model:'Seedance',limits:{maxImages:9,maxImageBytes:2*1024*1024,maxRequestBytes:25*1024*1024,durations:[5,10,15],ratios:['16:9','9:16','1:1'],resolutions:['720p','1080p']}};
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5RkAAAAASUVORK5CYII=';
const consent=/I have permission to use these images/;
const job=(status:ListingVideoJob['status']='queued',requestId='request-1234567890123456'):ListingVideoJob=>({id:'job-1234567890123456',requestId,status,createdAt:'2026-09-28T12:00:00.000Z',updatedAt:'2026-09-28T12:01:00.000Z',retryAfterSeconds:10,...(status==='succeeded'?{videoUrl:'https://media.bytepluscdn.com/result.mp4'}:{})});
function listing(){const doc=createListing(crypto.randomUUID(),'Home');doc.media=[{id:'living',title:'Living room',caption:'',kind:'photo',image,seconds:5}];return doc}
function saved(doc:ReturnType<typeof listing>,value:ListingVideoJob){localStorage.setItem('nook-listing-video:'+doc.planId,JSON.stringify({job:value}))}
async function ready(){await screen.findByText(/Video generation is configured/);await waitFor(()=>expect(document.querySelector('.listing-video')).toHaveAttribute('aria-busy','false'))}
async function panelReady(container:HTMLElement){await within(container).findByText(/Video generation is configured/);await waitFor(()=>expect(container.querySelector('.listing-video')).toHaveAttribute('aria-busy','false'))}
function panelApprove(container:HTMLElement){fireEvent.click(within(container).getByLabelText('Living room'));fireEvent.click(within(container).getByLabelText(consent))}
function selectAndApprove(){fireEvent.click(screen.getByLabelText('Living room'));fireEvent.click(screen.getByLabelText(consent))}
beforeEach(()=>{
 localStorage.clear();vi.mocked(listingVideoAvailability).mockReset().mockResolvedValue(connected);vi.mocked(validateListingVideo).mockReset().mockResolvedValue(undefined);vi.mocked(submitListingVideo).mockReset();vi.mocked(getListingVideo).mockReset();
 Object.defineProperty(document,'hidden',{configurable:true,value:false});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()});

it('keeps generation disabled and reports a failed availability check truthfully',async()=>{
 vi.mocked(listingVideoAvailability).mockRejectedValue(new Error('Connection unavailable'));
 render(<ListingVideoPanel listing={listing()}/>);
 expect(await screen.findByText('Video service availability could not be confirmed.')).toBeInTheDocument();
 expect(screen.queryByText('Checking video service…')).not.toBeInTheDocument();
 selectAndApprove();expect(screen.getByRole('button',{name:'Generate with Seedance 2.0'})).toBeDisabled();
 expect(submitListingVideo).not.toHaveBeenCalled();
});

it('shows configuration-required status without implying generation is connected',async()=>{
 vi.mocked(listingVideoAvailability).mockResolvedValue({...connected,available:false,reason:'Seedance is not configured on this site.'});
 render(<ListingVideoPanel listing={listing()}/>);
 expect(await screen.findByText(/Seedance is not configured/)).toBeInTheDocument();expect(screen.queryByText(/Video generation is configured/)).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Generate with Seedance 2.0'})).toBeDisabled();
});

it('saves the request ID before submission and recovers identical payload after reload and listing edits',async()=>{
 const doc=listing();
 vi.mocked(submitListingVideo).mockImplementationOnce(async input=>{
  expect(JSON.parse(localStorage.getItem('nook-listing-video:'+doc.planId)!).pending.requestId).toBe(input.requestId);
  throw new Error('The submission connection was interrupted.');
 }).mockImplementationOnce(async input=>job('queued',input.requestId));
 const view=render(<ListingVideoPanel listing={doc}/>);await ready();selectAndApprove();
 fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('interrupted');
 const originalRequest=structuredClone(vi.mocked(submitListingVideo).mock.calls[0][0]);view.unmount();
 render(<ListingVideoPanel listing={{...doc,format:'portrait',media:[{...doc.media[0],title:'Changed later',image:'data:image/jpeg;base64,/9j/2Q=='}]}}/>);await ready();
 expect(screen.getByRole('button',{name:'Landscape 16:9'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('button',{name:'Portrait 9:16'})).toBeDisabled();
 expect(screen.getByLabelText(consent)).not.toBeChecked();fireEvent.click(screen.getByLabelText(consent));
 fireEvent.click(screen.getByRole('button',{name:'Recover this saved request'}));
 expect(await screen.findByText('Video: queued')).toBeInTheDocument();
 expect(vi.mocked(submitListingVideo).mock.calls[1][0]).toEqual(originalRequest);
 expect(validateListingVideo).toHaveBeenCalledTimes(1);
});

it('shows the initial format and submits only the format reviewed after renewed consent',async()=>{
 const doc={...listing(),format:'portrait' as const};vi.mocked(submitListingVideo).mockImplementation(async input=>job('queued',input.requestId));
 render(<ListingVideoPanel listing={doc}/>);await ready();
 expect(screen.getByRole('button',{name:'Portrait 9:16'})).toHaveAttribute('aria-pressed','true');selectAndApprove();
 fireEvent.click(screen.getByRole('button',{name:'Square 1:1'}));expect(screen.getByLabelText(consent)).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Generate with Seedance 2.0'})).toBeDisabled();fireEvent.click(screen.getByLabelText(consent));
 fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));await screen.findByText('Video: queued');
 expect(vi.mocked(submitListingVideo).mock.calls[0][0].ratio).toBe('1:1');expect(vi.mocked(validateListingVideo).mock.calls[0][0].ratio).toBe('1:1');
 expect(screen.getByRole('button',{name:'Square 1:1'})).toBeDisabled();
});

it('keeps invalid new requests editable when the no-charge preflight rejects them',async()=>{
 const doc=listing();vi.mocked(validateListingVideo).mockRejectedValueOnce(new Error('Image dimensions are too small.'));
 render(<ListingVideoPanel listing={doc}/>);await ready();selectAndApprove();fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('dimensions are too small');
 expect(screen.getByLabelText('Creative direction')).toBeEnabled();expect(screen.getByLabelText('Living room')).toBeEnabled();
 expect(localStorage.getItem('nook-listing-video:'+doc.planId)).toBeNull();expect(submitListingVideo).not.toHaveBeenCalled();
});

it('does not submit if saving the recovery marker fails',async()=>{
 const doc=listing();render(<ListingVideoPanel listing={doc}/>);await ready();selectAndApprove();
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Quota exceeded','QuotaExceededError')});
 fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('No video was submitted');
 expect(submitListingVideo).not.toHaveBeenCalled();
});

it('shows a successful job even if the post-submission status write fails',async()=>{
 const doc=listing();vi.mocked(submitListingVideo).mockImplementation(async input=>{
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Storage unavailable')});return job('succeeded',input.requestId);
 });
 render(<ListingVideoPanel listing={doc}/>);await ready();selectAndApprove();fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));
 expect(await screen.findByText('Video: succeeded')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Open finished video to save'})).toHaveAttribute('href','https://media.bytepluscdn.com/result.mp4');
 expect(await screen.findByRole('alert')).toHaveTextContent('latest status could not be saved');
 expect(JSON.parse(localStorage.getItem('nook-listing-video:'+doc.planId)!).pending.requestId).toBe(vi.mocked(submitListingVideo).mock.calls[0][0].requestId);
 expect(screen.queryByRole('button',{name:'Generate with Seedance 2.0'})).not.toBeInTheDocument();expect(submitListingVideo).toHaveBeenCalledTimes(1);
});

it('pauses status polling while hidden, resumes on return and continues after transient failure',async()=>{
 Object.defineProperty(document,'hidden',{configurable:true,value:true});
 const doc=listing();saved(doc,job());vi.mocked(getListingVideo).mockRejectedValueOnce(new Error('Temporary status failure')).mockResolvedValueOnce(job('succeeded'));
 render(<ListingVideoPanel listing={doc}/>);await ready();vi.useFakeTimers();
 await act(async()=>{await vi.advanceTimersByTimeAsync(30_000)});expect(getListingVideo).not.toHaveBeenCalled();
 Object.defineProperty(document,'hidden',{configurable:true,value:false});fireEvent(document,new Event('visibilitychange'));
 await act(async()=>{await vi.advanceTimersByTimeAsync(0)});expect(getListingVideo).toHaveBeenCalledTimes(1);expect(screen.getByRole('alert')).toHaveTextContent('Temporary');
 await act(async()=>{await vi.advanceTimersByTimeAsync(10_000)});expect(getListingVideo).toHaveBeenCalledTimes(2);
 expect(screen.getByRole('link',{name:'Open finished video to save'})).toBeInTheDocument();
 await act(async()=>{await vi.advanceTimersByTimeAsync(30_000)});expect(getListingVideo).toHaveBeenCalledTimes(2);expect(submitListingVideo).not.toHaveBeenCalled();
});

it('checks an ambiguous accepted job without submitting or enabling a second paid request',async()=>{
 const doc=listing();saved(doc,job('submission_unknown'));vi.mocked(getListingVideo).mockResolvedValue(job('submission_unknown'));
 render(<ListingVideoPanel listing={doc}/>);await ready();
 expect(screen.getByText('Video: submission unknown')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/Generate with|Prepare another|Recover this/})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Check status'}));await waitFor(()=>expect(getListingVideo).toHaveBeenCalledTimes(1));
 expect(submitListingVideo).not.toHaveBeenCalled();
});

it('does not apply a late submission response to a different project',async()=>{
 let finish!:(value:ListingVideoJob)=>void;vi.mocked(submitListingVideo).mockReturnValue(new Promise(resolve=>{finish=resolve}));
 const first=listing(),second=listing(),view=render(<ListingVideoPanel listing={first}/>);await ready();selectAndApprove();
 fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));await waitFor(()=>expect(submitListingVideo).toHaveBeenCalledTimes(1));
 const request=vi.mocked(submitListingVideo).mock.calls[0][0] as ListingVideoRequest;
 view.rerender(<ListingVideoPanel listing={second}/>);await ready();
 await act(async()=>{finish(job('succeeded',request.requestId));await Promise.resolve()});
 expect(screen.queryByText('Video: succeeded')).not.toBeInTheDocument();
 expect(localStorage.getItem('nook-listing-video:'+second.planId)).toBeNull();
 await waitFor(()=>expect(JSON.parse(localStorage.getItem('nook-listing-video:'+first.planId)!).job?.status).toBe('succeeded'));
});

it('reserves only one paid request when two tabs submit stale new-video forms together',async()=>{
 const doc=listing();vi.mocked(submitListingVideo).mockImplementation(async input=>job('queued',input.requestId));
 const first=render(<ListingVideoPanel listing={doc}/>),second=render(<ListingVideoPanel listing={doc}/>);
 await panelReady(first.container);await panelReady(second.container);panelApprove(first.container);panelApprove(second.container);
 fireEvent.click(within(first.container).getByRole('button',{name:'Generate with Seedance 2.0'}));
 fireEvent.click(within(second.container).getByRole('button',{name:'Generate with Seedance 2.0'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('No video was submitted'));
 expect(submitListingVideo).toHaveBeenCalledTimes(1);expect(screen.getByText('Video: queued')).toBeInTheDocument();
 expect(JSON.parse(localStorage.getItem('nook-listing-video:'+doc.planId)!).pending.requestId).toBe(vi.mocked(submitListingVideo).mock.calls[0][0].requestId);
});

it('does not let a stale completed tab clear a newer request recovery record',async()=>{
 const doc=listing(),key='nook-listing-video:'+doc.planId;saved(doc,job('succeeded'));
 vi.mocked(submitListingVideo).mockImplementation(async input=>job('queued',input.requestId));
 const first=render(<ListingVideoPanel listing={doc}/>),stale=render(<ListingVideoPanel listing={doc}/>);
 await panelReady(first.container);await panelReady(stale.container);
 fireEvent.click(within(first.container).getByRole('button',{name:'Prepare another video'}));
 await within(first.container).findByRole('button',{name:'Generate with Seedance 2.0'});panelApprove(first.container);
 fireEvent.click(within(first.container).getByRole('button',{name:'Generate with Seedance 2.0'}));
 await within(first.container).findByText('Video: queued');const requestId=vi.mocked(submitListingVideo).mock.calls[0][0].requestId;
 fireEvent.click(within(stale.container).getByRole('button',{name:'Prepare another video'}));
 expect(await within(stale.container).findByRole('alert')).toHaveTextContent('newer video request');
 expect(JSON.parse(localStorage.getItem(key)!).pending.requestId).toBe(requestId);expect(submitListingVideo).toHaveBeenCalledTimes(1);
});

it('keeps a newer reservation when a prior unmounted submission resolves late',async()=>{
 let finish!:(value:ListingVideoJob)=>void;const doc=listing(),key='nook-listing-video:'+doc.planId;
 vi.mocked(submitListingVideo).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockImplementationOnce(async input=>job('succeeded',input.requestId)).mockImplementationOnce(async input=>job('queued',input.requestId));
 const first=render(<ListingVideoPanel listing={doc}/>);await ready();selectAndApprove();fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));
 await waitFor(()=>expect(submitListingVideo).toHaveBeenCalledTimes(1));const oldId=vi.mocked(submitListingVideo).mock.calls[0][0].requestId;first.unmount();
 render(<ListingVideoPanel listing={doc}/>);await ready();fireEvent.click(screen.getByLabelText(consent));fireEvent.click(screen.getByRole('button',{name:'Recover this saved request'}));
 await screen.findByText('Video: succeeded');fireEvent.click(screen.getByRole('button',{name:'Prepare another video'}));
 await screen.findByRole('button',{name:'Generate with Seedance 2.0'});fireEvent.click(screen.getByLabelText(consent));fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));
 await screen.findByText('Video: queued');const newId=vi.mocked(submitListingVideo).mock.calls[2][0].requestId;expect(newId).not.toBe(oldId);
 await waitFor(()=>expect(JSON.parse(localStorage.getItem(key)!).job?.requestId).toBe(newId));
 await act(async()=>{finish(job('queued',oldId))});
 // Reload after the late response: the atomic reservation remains the newer job.
 cleanup();render(<ListingVideoPanel listing={doc}/>);await ready();
 expect(screen.getByText('Request '+newId)).toBeInTheDocument();expect(JSON.parse(localStorage.getItem(key)!).pending.requestId).toBe(newId);
});

it('recovers the exact saved ID from IndexedDB if the localStorage mirror is lost',async()=>{
 const doc=listing(),key='nook-listing-video:'+doc.planId;
 vi.mocked(submitListingVideo).mockRejectedValueOnce(new Error('Interrupted')).mockImplementationOnce(async input=>job('queued',input.requestId));
 const view=render(<ListingVideoPanel listing={doc}/>);await ready();selectAndApprove();fireEvent.click(screen.getByRole('button',{name:'Generate with Seedance 2.0'}));
 await screen.findByRole('alert');const request=vi.mocked(submitListingVideo).mock.calls[0][0];view.unmount();localStorage.removeItem(key);
 render(<ListingVideoPanel listing={doc}/>);await ready();fireEvent.click(screen.getByLabelText(consent));fireEvent.click(screen.getByRole('button',{name:'Recover this saved request'}));
 await screen.findByText('Video: queued');expect(vi.mocked(submitListingVideo).mock.calls[1][0]).toEqual(request);
});

it('locks paid submission when an existing recovery record is corrupt',async()=>{
 const doc=listing();localStorage.setItem('nook-listing-video:'+doc.planId,'{broken');render(<ListingVideoPanel listing={doc}/>);await ready();
 expect(screen.getByRole('alert')).toHaveTextContent('saved video request could not be read');
 expect(screen.getByRole('button',{name:'Generate with Seedance 2.0'})).toBeDisabled();expect(submitListingVideo).not.toHaveBeenCalled();
});
