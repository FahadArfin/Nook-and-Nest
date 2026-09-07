// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {ToolBrowser} from '../src/ToolBrowser';
import {usePlanner} from '../src/store';
import {createSamplePlan} from '../src/domain';
import {floorBoundaryWalls} from '../src/floorGeometry';
const s=()=>usePlanner.getState();
beforeEach(()=>{s().replacePlan(createSamplePlan());s().setTool('select');s().select(undefined)});
afterEach(cleanup);
it('browses tasks without altering architecture and cancels a planting preview on exit',()=>{
 render(<ToolBrowser onPlace={vi.fn()}/>);const before=s().plan;
 fireEvent.click(screen.getByRole('button',{name:'Landscape'}));
 fireEvent.click(screen.getByRole('button',{name:'Plant: Lavender drift'}));
 act(()=>s().previewPlanting([{x:-8,z:-8}]));expect(s().plantingDraft?.items.length).toBeGreaterThan(0);
 fireEvent.click(screen.getByRole('button',{name:'Build'}));
 expect(s().plantingDraft).toBeUndefined();expect(s().tool).toBe('select');expect(s().plan).toBe(before);expect(s().past).toHaveLength(0);
 expect(screen.queryByLabelText('Search plants')).toBeNull();
});
it('confirms a plant stroke as one undo and routes single plants into reversible placement',()=>{
 const place=vi.fn();render(<ToolBrowser onPlace={place}/>);fireEvent.click(screen.getByRole('button',{name:'Landscape'}));
 fireEvent.click(screen.getByRole('button',{name:'Plant: Lavender drift'}));act(()=>s().previewPlanting([{x:-8,z:-8}]));
 const count=s().plantingDraft!.items.length,before=s().plan;
 expect(screen.queryByRole('button',{name:'Confirm planting'})).toBeNull();act(()=>s().confirmPlanting());expect(s().plan.furniture.length).toBe(before.furniture.length+count);expect(s().past).toHaveLength(1);
 act(()=>s().undo());expect(s().plan.furniture).toEqual(before.furniture);
 fireEvent.click(screen.getByRole('button',{name:'Single plant'}));fireEvent.click(screen.getByRole('button',{name:'Plant: Lavender drift'}));
 expect(place).toHaveBeenCalledWith(expect.objectContaining({id:'lavender-clump'}));expect(s().plan.furniture).toEqual(before.furniture);
});
it('requires explicit whole-floor apply and keeps section selection uncommitted',()=>{
 render(<ToolBrowser onPlace={vi.fn()}/>);const before=s().plan;
 fireEvent.click(screen.getByRole('button',{name:'Floor: Cottage check'}));expect(s().tool).toBe('floor-finish');expect(s().plan).toBe(before);
 fireEvent.click(screen.getByRole('button',{name:'Whole floor'}));
 fireEvent.click(screen.getByRole('button',{name:'Floor: Cottage check'}));expect(s().plan).toBe(before);
 fireEvent.click(screen.getByRole('button',{name:'Apply to whole floor'}));expect(s().plan.floors[0].floorFinishId).toBe('terracotta-checker-tile');expect(s().past).toHaveLength(1);
});
it('preserves the selected wall when opening Build and supports terrain navigation',()=>{
 render(<ToolBrowser onPlace={vi.fn()}/>);act(()=>usePlanner.setState({selectedWallId:'test-wall'}));
 fireEvent.click(screen.getByRole('button',{name:'Build'}));expect(s().selectedWallId).toBe('test-wall');
 fireEvent.click(screen.getByRole('button',{name:'Landscape'}));fireEvent.click(screen.getByRole('button',{name:'Terrain'}));fireEvent.click(screen.getByRole('button',{name:'Hill'}));expect(s().tool).toBe('terrain-raise');
 fireEvent.click(screen.getByRole('button',{name:'Decorate'}));expect(s().tool).toBe('select');expect(s().past).toHaveLength(0);
});

it('keeps a wall brush active across clicks and stops it when leaving painting',()=>{
 render(<ToolBrowser onPlace={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Walls'}));
 fireEvent.click(screen.getByRole('button',{name:'Paint Alabaster SW 7008'}));
 expect(s().wallBrushActive).toBe(true);const floor=s().plan.floors[0],wallId=floorBoundaryWalls(floor,s().plan.gridSizeMm)[0].id;
 act(()=>s().selectWall(wallId));expect(s().selectedWallId).toBeUndefined();expect(s().wallBrushActive).toBe(true);
 expect(s().plan.floors[0].wallFinishes?.[wallId]).toBe('paint-edeae0');
 fireEvent.click(screen.getByRole('button',{name:'Done painting'}));expect(s().wallBrushActive).toBe(false);
});
it('stages whole-wall paint, applies once, preserves other floors, and undoes all overrides',()=>{
 render(<ToolBrowser onPlace={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Walls'}));
 fireEvent.click(screen.getByRole('button',{name:'All walls'}));const before=s().plan;
 fireEvent.click(screen.getByRole('button',{name:'Paint Sea Salt SW 6204'}));expect(s().plan).toBe(before);
 fireEvent.click(screen.getByRole('button',{name:'Paint all walls'}));expect(s().plan.floors[0].wallFinishId).toBe('paint-cdd2ca');expect(s().plan.floors[1]).toBe(before.floors[1]);expect(s().past).toHaveLength(1);
 act(()=>s().undo());expect(s().plan).toEqual(before);
});
it('searches paint names and codes, with exterior collection separate from wall scope',()=>{
 render(<ToolBrowser onPlace={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Walls'}));const before=s().plan;
 fireEvent.click(screen.getByText('Interior & exterior collections'));fireEvent.click(screen.getByRole('button',{name:'Exterior favorites'}));expect(s().plan).toBe(before);
 fireEvent.change(screen.getByLabelText('Search finishes'),{target:{value:'SW 7048'}});
 expect(screen.getByRole('button',{name:'Paint Urbane Bronze SW 7048'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Paint Alabaster SW 7008'})).toBeNull();expect(screen.getByRole('button',{name:'Brush'}).getAttribute('aria-pressed')).toBe('true');
});

it('collects distinct wall plates without painting and applies them together with one undo',()=>{
 render(<ToolBrowser onPlace={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Walls'}));fireEvent.click(screen.getByRole('button',{name:'Select walls'}));
 const before=s().plan,ids=floorBoundaryWalls(before.floors[0],before.gridSizeMm).map(w=>w.id);
 act(()=>s().selectWall(ids[0]));act(()=>s().selectWall(ids.at(-1)!));expect(s().paintWallIds.length).toBeGreaterThan(0);
 const count=s().paintWallIds.length;fireEvent.click(screen.getByRole('button',{name:'Paint Sea Salt SW 6204'}));expect(s().plan).toBe(before);
 fireEvent.click(screen.getByRole('button',{name:`Paint ${count} wall${count===1?'':'s'}`}));expect(s().past).toHaveLength(1);expect(s().plan.floors[1]).toBe(before.floors[1]);
 expect(s().paintWallIds).toEqual([]);act(()=>s().undo());expect(s().plan).toEqual(before);
});
it('groups flooring formats and preserves the chosen physical size through apply and undo',()=>{
 render(<ToolBrowser onPlace={vi.fn()}/>);const before=s().plan;
 expect(screen.getAllByRole('button',{name:'Floor: Ivory travertine'})).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Whole floor'}));fireEvent.click(screen.getByRole('button',{name:'Floor: Ivory travertine'}));
 fireEvent.click(screen.getByRole('button',{name:'80 \u00d7 160 cm'}));expect(s().plan).toBe(before);
 fireEvent.click(screen.getByRole('button',{name:'Apply to whole floor'}));expect(s().plan.floors[0].floorFinishId).toContain('80x160');act(()=>s().undo());expect(s().plan).toEqual(before);
});
it('neutral preview is transient and leaves plan, history and night preference alone',()=>{
 const before=s().plan;const {unmount}=render(<ToolBrowser onPlace={vi.fn()}/>);
 expect(s().neutralPreview).toBe(true);fireEvent.click(screen.getByRole('switch',{name:'Neutral preview lighting'}));expect(s().neutralPreview).toBe(false);
 expect(s().plan).toBe(before);expect(s().past).toHaveLength(0);unmount();expect(s().neutralPreview).toBe(false);
});
