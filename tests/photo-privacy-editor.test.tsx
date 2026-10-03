// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {PhotoPrivacyEditor} from '../src/PhotoPrivacyEditor';
import type {ListingMedia} from '../src/listingTypes';
const original='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5RkAAAAASUVORK5CYII=';
const copy='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const media:ListingMedia={id:'photo',title:'Room',caption:'',kind:'photo',image:original,sourceImage:original,seconds:5};
beforeEach(()=>{
 vi.stubGlobal('Image',class {onload?:()=>void;onerror?:()=>void;naturalWidth=1;naturalHeight=1;set src(value:string){if(value)queueMicrotask(()=>this.onload?.());}async decode(){}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillStyle:'',fillRect:vi.fn(),save:vi.fn(),restore:vi.fn(),translate:vi.fn(),rotate:vi.fn(),drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
 vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue(copy);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('manual photo privacy editing',()=>{
 it('requires reviewing the flattened result and saves a copy with output selection still off',async()=>{
  const save=vi.fn(()=>true),close=vi.fn();render(<PhotoPrivacyEditor media={media} onSave={save} onClose={close}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Preview flattened copy'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Add centered mask'}));fireEvent.click(screen.getByRole('button',{name:'Rotate right 90°'}));fireEvent.click(screen.getByRole('button',{name:'Preview flattened copy'}));
  expect(await screen.findByAltText('Flattened photo privacy copy to review')).toHaveAttribute('src',copy);
  expect(screen.getByRole('button',{name:'Save reviewed copy'})).toBeDisabled();expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed the flattened/}));fireEvent.click(screen.getByRole('button',{name:'Save reviewed copy'}));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({image:copy,selected:false,recipe:expect.objectContaining({turns:1,masks:[{x:0,y:0,width:1,height:1}]})}),original);expect(close).toHaveBeenCalledOnce();expect(media.image).toBe(original);
 });
 it('discards draft masks on cancel and resets review after returning to edit',async()=>{
  const save=vi.fn(()=>true),close=vi.fn();render(<PhotoPrivacyEditor media={media} onSave={save} onClose={close}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Preview flattened copy'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Add centered mask'}));fireEvent.click(screen.getByRole('button',{name:'Preview flattened copy'}));await screen.findByRole('checkbox',{name:/I reviewed/});fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed/}));fireEvent.click(screen.getByRole('button',{name:'Back to masks'}));fireEvent.click(screen.getByRole('button',{name:'Undo last mask'}));fireEvent.click(screen.getByRole('button',{name:'Preview flattened copy'}));
  expect(await screen.findByRole('checkbox',{name:/I reviewed/})).not.toBeChecked();fireEvent.click(screen.getByRole('button',{name:'Cancel privacy edit'}));expect(save).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();
 });
 it('reports raster failures without saving or enabling approval',async()=>{
  vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockReturnValue('data:,');const save=vi.fn(()=>true);render(<PhotoPrivacyEditor media={media} onSave={save} onClose={vi.fn()}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Preview flattened copy'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Preview flattened copy'}));await screen.findByRole('alert');expect(save).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Save reviewed copy'})).not.toBeInTheDocument();
 });
});
