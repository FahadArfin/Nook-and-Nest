// @vitest-environment jsdom
import {afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ArHandoffPanel,ArModelPreview,ArPreviewPage} from '../src/ArPiecePreview';
import {arPieceFromSelection} from '../src/arHandoff';
import {loadPieceModelViewer} from '../src/arModelViewer';
vi.mock('../src/arModelViewer',async original=>({...await original<typeof import('../src/arModelViewer')>(),loadPieceModelViewer:vi.fn(async()=>{})}));
vi.mock('../src/arQr',()=>({createPieceQr:vi.fn(async()=>({size:29,path:'M4 4h1v1h-1z'}))}));
const selection={catalogId:'sofa',widthMm:2400,depthMm:950,heightMm:900,variant:'moss'};
class TestModelViewer extends HTMLElement {src='';scale='';canActivateAR=false;updateComplete=Promise.resolve(true);getDimensions(){return {x:2.4,y:.9,z:.95};}updateFraming(){}activateAR(){return Promise.resolve();}model={materials:[{name:'upholstery-textured',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],setBaseColorFactor:vi.fn()}}]};}
beforeAll(()=>{if(!customElements.get('model-viewer'))customElements.define('model-viewer',TestModelViewer);});
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('piece preview UI',()=>{
  it('creates no link or QR before the explicit handoff action',async()=>{
    render(<ArHandoffPanel selected={selection} currentUrl="https://home.example/private?project=secret"/>);expect(screen.queryByRole('img',{name:/QR code/})).toBeNull();expect(loadPieceModelViewer).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Create piece link & QR'}));await screen.findByRole('img',{name:/QR code/});const link=screen.getByRole('link',{name:'Open piece preview'});expect(link.getAttribute('href')).toMatch(/^https:\/\/home\.example\/\?piece-preview=1#piece=/);expect(link.getAttribute('href')).not.toContain('secret');
  });
  it('invalidates the displayed handoff when selected geometry changes',async()=>{
    const {rerender}=render(<ArHandoffPanel selected={selection} currentUrl="https://home.example"/>);fireEvent.click(screen.getByRole('button',{name:'Create piece link & QR'}));await screen.findByRole('img',{name:/QR code/});rerender(<ArHandoffPanel selected={{...selection,widthMm:2500}} currentUrl="https://home.example"/>);expect(screen.queryByRole('img',{name:/QR code/})).toBeNull();
  });
  it('enables only fixed-scale WebXR/Quick Look after the real size check succeeds',async()=>{
    const {container,unmount}=render(<ArModelPreview piece={arPieceFromSelection(selection).piece}/>);await waitFor(()=>expect(container.querySelector('model-viewer')).not.toBeNull());const viewer=container.querySelector('model-viewer')!;expect(viewer.hasAttribute('ar')).toBe(false);expect(viewer.getAttribute('ar-modes')).toBe('webxr quick-look');expect(viewer.getAttribute('ar-scale')).toBe('fixed');expect(viewer.hasAttribute('ios-src')).toBe(false);fireEvent.load(viewer);await screen.findByText(/Size checked against/);expect(viewer.hasAttribute('ar')).toBe(true);expect(screen.getByText(/3D view works when AR is unavailable/)).toBeTruthy();unmount();expect(viewer.hasAttribute('ar')).toBe(false);expect(viewer.isConnected).toBe(false);
  });
  it('keeps dimensions and catalog fallback available when the 3D file fails',async()=>{
    const {container}=render(<ArModelPreview piece={arPieceFromSelection(selection).piece}/>);await waitFor(()=>expect(container.querySelector('model-viewer')).not.toBeNull());fireEvent.error(container.querySelector('model-viewer')!);expect(screen.getByRole('alert').textContent).toContain('could not load');expect(screen.getByRole('img',{name:'Cloud sofa catalog view'})).toBeTruthy();expect(container.querySelector('model-viewer')?.hasAttribute('ar')).toBe(false);
  });
  it('rejects an invalid route without initializing the viewer',()=>{
    render(<ArPreviewPage url="https://home.example/?piece-preview=1#piece=invalid"/>);expect(screen.getByRole('heading').textContent).toBe('Piece preview unavailable');expect(loadPieceModelViewer).not.toHaveBeenCalled();
  });
});
