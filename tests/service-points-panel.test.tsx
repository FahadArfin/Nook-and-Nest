// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useState} from 'react';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {ServicePointsPanel} from '../src/ServicePointsPanel';
import {SiteSurveyPanel} from '../src/SiteSurveyPanel';
import {ServicePointOverlay} from '../src/ServicePointOverlay';
import {saveServicePoint,servicePointWalls} from '../src/servicePoints';
import {validatePlan} from '../src/planValidation';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function plan(){const p=createSamplePlan('Home','metric');p.gridSizeMm=1000;p.floors=[{...p.floors[0],id:'floor',cells:rectangleCells(4,3),walls:[],openings:[],stairs:[]}];p.furniture=[];return p;}
it('opens service points from the existing site records while retaining notes and area tabs',()=>{render(<SiteSurveyPanel plan={plan()} onCommit={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Service points'}));expect(screen.getByRole('button',{name:'Add service point'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Site notes'}));expect(screen.getByText('Attach a new note')).toBeTruthy();});
it('keeps a measured preview uncommitted, then saves once and explicitly verifies the recorded marker',async()=>{
  const initial=plan(),commit=vi.fn();function Host(){const [value,setValue]=useState(initial);return <ServicePointsPanel plan={value} onCommit={(base,next)=>{expect(base).toBe(value);commit(next);setValue(structuredClone(next));}}/>;}
  render(<Host/>);fireEvent.click(screen.getByRole('button',{name:'Add service point'}));fireEvent.change(screen.getByLabelText('Marker label'),{target:{value:'Desk sockets'}});fireEvent.change(screen.getByLabelText('Distance from A (mm)'),{target:{value:'1234.5'}});fireEvent.change(screen.getByLabelText('Height above floor (mm)'),{target:{value:'350'}});
  expect(commit).not.toHaveBeenCalled();expect(screen.getByTestId('service-point-draft')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Save measured marker'}));await waitFor(()=>expect(commit).toHaveBeenCalledTimes(1));expect(commit.mock.calls[0][0].siteSurvey.servicePoints[0]).toMatchObject({label:'Desk sockets',offsetMm:1234.5,heightMm:350});expect(commit.mock.calls[0][0].floors).toEqual(initial.floors);
  fireEvent.change(screen.getByLabelText('Checked by'),{target:{value:'Owner'}});fireEvent.change(screen.getByLabelText('Check date'),{target:{value:'2026-10-03'}});fireEvent.click(screen.getByLabelText('I checked this wall, position and height on site'));fireEvent.click(screen.getByRole('button',{name:'Record on-site check'}));await waitFor(()=>expect(commit).toHaveBeenCalledTimes(2));expect(commit.mock.calls[1][0].siteSurvey.servicePoints[0].verification.reviewer).toBe('Owner');
  fireEvent.click(screen.getByLabelText('Show service points'));expect(document.querySelector('[data-service-point]')).toBeNull();expect(commit).toHaveBeenCalledTimes(2);
});
it('blocks stale draft saves until reload and keeps removed-floor markers available for relinking',()=>{
  const p=plan(),w=servicePointWalls(p,'floor')[0],saved=saveServicePoint(p,p,{id:'retained',kind:'vent',label:'Hall vent',floorId:'floor',wallKey:w.key,face:'front',offsetMm:500,heightMm:200},validatePlan),commit=vi.fn();
  const ui=render(<ServicePointsPanel plan={saved} onCommit={commit}/>);fireEvent.click(screen.getByRole('button',{name:/Hall vent/}));ui.rerender(<ServicePointsPanel plan={{...saved,name:'Changed elsewhere'}} onCommit={commit}/>);expect((screen.getByRole('button',{name:'Save measured marker'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Reload saved marker'}));expect((screen.getByRole('button',{name:'Save measured marker'}) as HTMLButtonElement).disabled).toBe(false);
  ui.rerender(<ServicePointsPanel plan={{...saved,floors:[{...saved.floors[0],id:'replacement'}]}} onCommit={commit}/>);expect(screen.getByText(/Markers on removed floors/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/Hall vent/}));expect(screen.getByRole('button',{name:'Save measured marker'})).toBeTruthy();expect(commit).not.toHaveBeenCalled();
});
it('renders retained positions and status labels safely when current geometry no longer matches',()=>{
  const p=plan(),w=servicePointWalls(p,'floor')[0],saved=saveServicePoint(p,p,{id:'one',kind:'data',label:'<script>private</script>',floorId:'floor',wallKey:w.key,face:'front',offsetMm:500,heightMm:200},validatePlan),changed={...saved,floors:[{...saved.floors[0],elevationMm:1000}]};
  render(<svg><ServicePointOverlay plan={changed} floorId="floor" size={100}/></svg>);expect(document.querySelector('[data-service-status="changed"]')).toBeTruthy();expect(document.querySelector('script')).toBeNull();expect(document.querySelector('svg')!.textContent).toContain('RECHECK');
});
it('exports the visible saved map without exporting a dirty draft or hidden marker layer',async()=>{
  const p=plan(),w=servicePointWalls(p,'floor')[0],saved=saveServicePoint(p,p,{id:'one',kind:'switch',label:'Saved switch',floorId:'floor',wallKey:w.key,face:'front',offsetMm:500,heightMm:1000},validatePlan),blobs:Blob[]=[];
  vi.stubGlobal('URL',class extends URL {static createObjectURL(blob:Blob){blobs.push(blob);return 'blob:services';}static revokeObjectURL(){}});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});render(<ServicePointsPanel plan={saved} onCommit={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:/Saved switch/}));fireEvent.change(screen.getByLabelText('Marker label'),{target:{value:'UNSAVED PRIVATE DRAFT'}});fireEvent.click(screen.getByRole('button',{name:'Export visible map SVG'}));fireEvent.click(screen.getByLabelText('Show service points'));fireEvent.click(screen.getByRole('button',{name:'Export visible map SVG'}));
  const read=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsText(blob);});const first=await read(blobs[0]),hidden=await read(blobs[1]);expect(first).toContain('Saved switch');expect(first).not.toContain('UNSAVED PRIVATE DRAFT');expect(first).not.toContain('data-preview');expect(hidden).not.toContain('Saved switch');
});
