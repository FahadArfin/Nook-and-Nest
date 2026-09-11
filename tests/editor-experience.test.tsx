// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {EditorFeedback,EmptyCanvasHint,PinnedControls,QuickPinSettings} from '../src/EditorExperience';
import {editorPreferencesKey,parseEditorPreferences,rememberFinish,rememberModel} from '../src/editorPreferences';
import {clearModelFailure,reportModelFailure,retryModelFailures} from '../src/modelLoadFeedback';
import {SaveControl} from '../src/SaveControl';
import {usePlanner} from '../src/store';
import {createBlankPlan} from '../src/domain';
import {catalog} from '../src/catalog';
import {inRoomCollection,roomCollections} from '../src/roomCollections';
import {CatalogLibrary} from '../src/CatalogLibrary';

beforeEach(()=>{localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:editorPreferencesKey,newValue:null}));usePlanner.getState().replacePlan(createBlankPlan());usePlanner.setState({tool:'select',search:'',category:'All'});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('persistent editor preferences',()=>{
  it('recovers corrupt storage, validates pins and bounds recent lists',()=>{
    expect(parseEditorPreferences('broken').pins).toEqual([]);
    const raw=JSON.stringify({pins:['brush','evil','brush',4],recentModels:Array.from({length:30},(_,i)=>'piece'+i)});
    const result=parseEditorPreferences(raw);expect(result.pins).toEqual(['brush']);expect(result.recentModels).toHaveLength(12);
  });
  it('keeps preferences separate from plan history and remembers choices',()=>{
    const plan=usePlanner.getState().plan;render(<><QuickPinSettings/><EmptyCanvasHint onBuild={vi.fn()}/></>);
    fireEvent.click(screen.getByLabelText('Recent finishes'));fireEvent.click(screen.getByLabelText('Dismiss canvas tip'));
    act(()=>{rememberModel('sofa');rememberModel('queen-bed');rememberModel('sofa');rememberFinish('honey-oak');});
    const value=parseEditorPreferences(localStorage.getItem(editorPreferencesKey));
    expect(value.pins).toEqual(['finishes']);expect(value.recentModels).toEqual(['sofa','queen-bed']);expect(value.dismissedHints).toContain('empty-canvas');expect(usePlanner.getState().plan).toBe(plan);expect(usePlanner.getState().past).toHaveLength(0);
    expect(screen.queryByText('Start with a floor')).toBeNull();
  });
  it('keeps session preferences usable if storage is blocked',()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});render(<QuickPinSettings/>);fireEvent.click(screen.getByLabelText('Grid labels'));expect((screen.getByLabelText('Grid labels') as HTMLInputElement).checked).toBe(true);
  });
  it('changes brush size with brackets without stealing text entry',()=>{
    usePlanner.setState({tool:'terrain-raise',terrainRadius:2});render(<><PinnedControls/><input aria-label="Test name"/></>);
    fireEvent.keyDown(window,{key:']'});expect(usePlanner.getState().terrainRadius).toBe(2.5);
    fireEvent.keyDown(screen.getByLabelText('Test name'),{key:'['});expect(usePlanner.getState().terrainRadius).toBe(2.5);
    expect(usePlanner.getState().past).toHaveLength(0);
  });
  it('opens a pinned palette after its anchor becomes available and selects a brush without painting',()=>{
    act(()=>rememberFinish('honey-oak'));const plan=usePlanner.getState().plan,onOpen=vi.fn();
    render(<div className="canvas-stage"><QuickPinSettings/><PinnedControls onOpen={onOpen}/></div>);
    fireEvent.click(screen.getByLabelText('Recent finishes'));fireEvent.click(screen.getByRole('button',{name:'Pinned recent finishes'}));
    expect(onOpen).toHaveBeenCalledTimes(1);expect(screen.getByRole('region',{name:'Pinned options'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Paint with Honey oak'}));
    expect(usePlanner.getState().tool).toBe('floor-finish');expect(usePlanner.getState().plan).toBe(plan);expect(usePlanner.getState().past).toHaveLength(0);
  });
});
describe('browsing continuity',()=>{
  it('offers populated room collections including complementary lighting',()=>{
    for(const room of roomCollections)expect(catalog.some(item=>inRoomCollection(item,room.id))).toBe(true);
    expect(inRoomCollection(catalog.find(i=>i.id==='queen-bed')!,'bedroom')).toBe(true);
    expect(inRoomCollection(catalog.find(i=>i.id==='dome-pendant')!,'kitchen')).toBe(true);
    expect(inRoomCollection(catalog.find(i=>i.id==='queen-bed')!,'kitchen')).toBe(false);
  });
  it('recent navigation and clearing highlighted filters never place a model',()=>{
    // Start with one real result. Testing every catalog card belongs to library.test.tsx.
    usePlanner.setState({search:'Button tufted sofa'});
    act(()=>rememberModel('sofa'));const start=vi.fn(),plan=usePlanner.getState().plan;
    render(<CatalogLibrary onBeginDrag={vi.fn()} onStartPlacement={start}/>);
    fireEvent.click(screen.getByRole('button',{name:'Recent'}));expect(screen.getAllByRole('button',{name:/drag to place/})).toHaveLength(1);
    const filters=screen.getByRole('button',{name:'Filters'});fireEvent.click(filters);const bedroom=within(screen.getByRole('group',{name:'Browse by room'})).getByRole('button',{name:'Bedroom'});fireEvent.click(bedroom);expect(bedroom.getAttribute('aria-pressed')).toBe('true');expect(screen.queryByLabelText('Active furniture filters')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Clear all filters'}));expect(bedroom.getAttribute('aria-pressed')).toBe('false');expect(document.activeElement).toBe(filters);expect(screen.queryByRole('button',{name:'Clear all filters'})).toBeNull();expect(usePlanner.getState().plan).toBe(plan);expect(start).not.toHaveBeenCalled();
  });
});
describe('recovery feedback',()=>{
  it('offers undo for the exact edit and removes a stale action after another change',()=>{
    render(<EditorFeedback/>);act(()=>usePlanner.getState().addFloor());expect(screen.getByText(/Added Floor/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/^Undo:/}));expect(usePlanner.getState().plan.floors).toHaveLength(1);
    act(()=>usePlanner.getState().addFloor());act(()=>usePlanner.getState().setView('top'));expect(screen.queryByRole('button',{name:/^Undo:/})).toBeNull();
  });
  it('records a confirmed piece in recents and reverses it in one step',()=>{
    render(<EditorFeedback/>);act(()=>usePlanner.getState().placeFurniture('sofa'));expect(parseEditorPreferences(localStorage.getItem(editorPreferencesKey)).recentModels).toEqual(['sofa']);fireEvent.click(screen.getByRole('button',{name:/^Undo:/}));expect(usePlanner.getState().plan.furniture).toHaveLength(0);
  });
  it('retries active failures once and clears disposed renderer callbacks',()=>{
    const owner={},retry=vi.fn();render(<EditorFeedback draftCatalogId="sofa"/>);act(()=>reportModelFailure(owner,'sofa',retry));expect(screen.getByText(/unavailable/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Retry models'}));expect(retry).toHaveBeenCalledTimes(1);act(()=>retryModelFailures(['sofa']));expect(retry).toHaveBeenCalledTimes(1);
    act(()=>clearModelFailure(owner));expect(screen.queryByText(/unavailable/)).toBeNull();act(()=>retryModelFailures(['sofa']));expect(retry).toHaveBeenCalledTimes(1);
  });
  it('exposes save failure recovery without opening a menu',async()=>{
    const persist=vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined);
    render(<SaveControl plan={usePlanner.getState().plan} persist={persist} onProjects={vi.fn()}/>);
    await waitFor(()=>expect(screen.getByText('Device storage could not save this change.')).toBeTruthy());fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.queryByText('Device storage could not save this change.')).toBeNull());expect(persist).toHaveBeenCalledTimes(2);
  });
});
