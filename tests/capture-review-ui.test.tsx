// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {CaptureReviewPanel} from '../src/CaptureReviewPanel';
import {CaptureBenchmarkPanel} from '../src/CaptureBenchmarkPanel';
import {completeCaptureReview,createCaptureReview} from '../src/captureReview';
import {loadCaptureBenchmarks} from '../src/captureBenchmark';
import {reviewed,source,detection} from './capture-fixtures';
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();});
describe('capture review interaction',()=>{
  it('does not apply an unreviewed capture and exposes original geometry to the preview callback',()=>{
    const onChange=vi.fn(),onAccept=vi.fn(),onHighlight=vi.fn();render(<CaptureReviewPanel review={createCaptureReview(detection,source,'draft-1',1000)} source={source} draftKey="draft-1" onChange={onChange} onAccept={onAccept} onHighlight={onHighlight}/>);
    expect((screen.getByRole('button',{name:'Preview reviewed layout'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Show original and edited geometry'}));expect(onHighlight.mock.calls[0][0].original.width).toBe(400);fireEvent.click(screen.getByRole('button',{name:'Keep original'}));expect(onChange.mock.calls[0][0].decisions['room:0']).toBe('keep');expect(onAccept).not.toHaveBeenCalled();
  });
  it('only returns the reviewed proposal after its explicit preview action',()=>{
    vi.spyOn(Date,'now').mockReturnValue(5000);const onAccept=vi.fn();render(<CaptureReviewPanel review={reviewed()} source={source} draftKey="draft-1" onChange={vi.fn()} onAccept={onAccept}/>);expect(onAccept).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Preview reviewed layout'}));expect(onAccept).toHaveBeenCalledOnce();expect(onAccept.mock.calls[0][0].recognition.rooms[0].width).toBe(400);
  });
  it('blocks stale preview and offers a deliberate restart',()=>{
    const onAccept=vi.fn(),restart=vi.fn();render(<CaptureReviewPanel review={reviewed()} source={{...source,page:2}} draftKey="draft-1" onChange={vi.fn()} onAccept={onAccept} onRestart={restart}/>);expect(screen.getByRole('alert').textContent).toContain('changed');expect((screen.getByRole('button',{name:'Preview reviewed layout'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Start fresh review'}));expect(restart).toHaveBeenCalledOnce();expect(onAccept).not.toHaveBeenCalled();
  });
  it('does not prefill reference truth or persist a benchmark until opt-in and measured values',()=>{
    const review=completeCaptureReview(reviewed(),source,'draft-1',5000).snapshot;render(<CaptureBenchmarkPanel review={review}/>);expect(loadCaptureBenchmarks(localStorage)).toEqual([]);expect((screen.getByLabelText('Verified width (mm)') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText('Case label'),{target:{value:'Measured test room'}});fireEvent.change(screen.getByLabelText('Verified width (mm)'),{target:{value:'4000'}});fireEvent.change(screen.getByLabelText('Verified depth (mm)'),{target:{value:'3000'}});fireEvent.click(screen.getByRole('button',{name:'Add measured reference'}));expect((screen.getByRole('button',{name:'Compare and save locally'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox',{name:/I have permission/}));fireEvent.click(screen.getByRole('button',{name:'Compare and save locally'}));expect(loadCaptureBenchmarks(localStorage)).toHaveLength(1);expect(screen.getByRole('table').textContent).toContain('within tolerance');fireEvent.click(screen.getByRole('button',{name:'Delete'}));expect(loadCaptureBenchmarks(localStorage)).toEqual([]);
  });
});
