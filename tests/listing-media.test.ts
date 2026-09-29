// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {importListingPhoto,loadListingImage,normalizeListingImage} from '../src/listingMedia';
import {isListingImage} from '../src/listingTypes';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQJ8AAAAASUVORK5CYII=';
const jpeg='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2Q==';
let width=2400,height=1800,loads:string[]=[];
beforeEach(()=>{
  width=2400;height=1800;loads=[];
  vi.stubGlobal('Image',class {naturalWidth=width;naturalHeight=height;onload?:()=>void;onerror?:()=>void;set src(value:string){loads.push(value);queueMicrotask(()=>this.onload?.());}});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillStyle:'',fillRect:vi.fn(),drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue(jpeg);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const file=(name='Living room.png',type='image/png')=>new File([Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0))],name,{type});

describe('local property photo import',()=>{
  it('keeps the uploaded source bytes separate from the normalized preview and an unaltered comparison',async()=>{
    const photo=await importListingPhoto(file());expect(photo.sourceImage).toBe(png);expect(photo.image).toBe(jpeg);expect(photo.originalImage).toBeUndefined();expect(photo.title).toBe('Living room');expect(photo.kind).toBe('photo');expect(isListingImage(photo.image)).toBe(true);
    const canvas=vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.instances[0] as HTMLCanvasElement;expect(canvas.width).toBe(1600);expect(canvas.height).toBe(1200);
  });
  it('rejects HTML, SVG, mislabeled image bytes and oversized files before decoding images',async()=>{
    await expect(importListingPhoto(new File(['<html>payload</html>'],'room.png',{type:'image/png'}))).rejects.toThrow('damaged');
    await expect(importListingPhoto(new File(['<svg/>'],'room.svg',{type:'image/svg+xml'}))).rejects.toThrow('Choose');
    await expect(importListingPhoto(new File(['hi'],'room.html',{type:'text/html'}))).rejects.toThrow('Choose');
    const large=file();Object.defineProperty(large,'size',{value:10*1024*1024+1});await expect(importListingPhoto(large)).rejects.toThrow('10 MB');expect(loads).toEqual([]);
  });
  it('refuses remote sources, invalid dimensions and excessive decoded images',async()=>{
    await expect(loadListingImage('https://example.com/photo.jpg')).rejects.toThrow('local');expect(loads).toEqual([]);
    width=0;await expect(normalizeListingImage(png)).rejects.toThrow('invalid dimensions');width=9000;height=9000;await expect(normalizeListingImage(png)).rejects.toThrow('60 megapixels');
    width=20000;height=1;await expect(normalizeListingImage(png)).rejects.toThrow('16,000');
  });
  it('rejects missing drawing support and failed image decoding instead of producing fake previews',async()=>{
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);await expect(normalizeListingImage(png)).rejects.toThrow('unavailable');
    vi.stubGlobal('Image',class {onerror?:()=>void;set src(_value:string){queueMicrotask(()=>this.onerror?.());}});await expect(loadListingImage(png)).rejects.toThrow('could not be opened');
  });
  it('bounds imported names and rejects an empty or non-image canvas export',async()=>{
    expect((await importListingPhoto(file('x'.repeat(180)+'.png'))).title).toHaveLength(160);
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockReturnValue('data:,');await expect(normalizeListingImage(png)).rejects.toThrow('supported preview');
  });
});
