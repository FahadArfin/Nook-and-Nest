// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {StagingInventoryPanel} from '../src/StagingInventoryPanel';
import {stagingApi} from '../src/stagingApi';
import {stagingSample} from '../src/stagingInventory';
afterEach(cleanup);
const catalog=[{id:'sofa',name:'Sofa',widthMm:2200,depthMm:950,heightMm:850},{id:'coffee-table',name:'Coffee table',widthMm:1000,depthMm:600,heightMm:450}];
function api(role:'owner'|'viewer'='owner'){return {...stagingApi,status:vi.fn(async()=>({enabled:true,signedIn:true,canEnroll:false})),workspaces:vi.fn(async()=>({workspaces:[{id:'w',name:'Synthetic inventory',role}]})),calendar:vi.fn(async()=>({units:[{...stagingSample.units[0],available:true}],reservations:[],next:null})),reserve:vi.fn(async(_workspace:string,_data:unknown)=>({reservation:stagingSample.reservations[0]})),unitDetail:vi.fn(async()=>({unit:stagingSample.units[0],events:[],next:null})),addUnit:vi.fn(),action:vi.fn(),enroll:vi.fn(),detail:vi.fn()};}
it('disabled pilot exposes a read-only sample and never calls a real inventory mutation',async()=>{
 const service=api();service.status.mockResolvedValue({enabled:false,signedIn:false,canEnroll:false});const preview=vi.fn();
 render(<StagingInventoryPanel catalog={catalog} onClose={()=>{}} onPreviewProxy={preview} api={service}/>);
 expect(await screen.findByText(/Real reservations are currently disabled/)).toBeTruthy();
 expect(screen.getByText(/Read-only sample/)).toBeTruthy();
 expect(screen.queryByRole('button',{name:/Register physical unit/})).toBeNull();
 expect((screen.getByLabelText('Reserve SOFA-001') as HTMLInputElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Open 1 unit'}));
 expect(screen.getByText(/Packing, returns and cancellation are disabled/)).toBeTruthy();
 fireEvent.click(screen.getAllByRole('button',{name:'Preview piece'})[0]);
 expect(preview).toHaveBeenCalledWith({catalogId:'sofa',widthMm:2200,depthMm:950,heightMm:850});
 expect(service.workspaces).not.toHaveBeenCalled();expect(service.reserve).not.toHaveBeenCalled();expect(service.action).not.toHaveBeenCalled();
});
it('viewer can inspect real stock but receives no reservation or condition mutation controls',async()=>{
 const service=api('viewer');render(<StagingInventoryPanel catalog={catalog} onClose={()=>{}} api={service}/>);
 await screen.findByRole('button',{name:'Synthetic inventory · viewer'});
 await waitFor(()=>expect(screen.queryByText('Loading private inventory…')).toBeNull());
 expect(screen.queryByRole('button',{name:/Reserve \d/})).toBeNull();expect(screen.queryByText('Add one physical stock unit')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'SOFA-001'}));expect(screen.queryByRole('button',{name:'Record stock condition'})).toBeNull();
});
it('owner makes one explicit atomic booking request; a conflict is visible and refreshes stock',async()=>{
 const service=api();service.reserve.mockRejectedValue(Error('Physical unit changed. Refresh the calendar.'));
 render(<StagingInventoryPanel catalog={catalog} onClose={()=>{}} api={service}/>);
 await screen.findByRole('button',{name:'Synthetic inventory · owner'});
 await waitFor(()=>expect(screen.queryByText('Loading private inventory…')).toBeNull());
 fireEvent.click(screen.getByLabelText('Reserve SOFA-001'));fireEvent.change(screen.getByLabelText('Private property label'),{target:{value:'Private property'}});
 fireEvent.click(screen.getByRole('button',{name:'Reserve 1 physical unit'}));
 expect((await screen.findByRole('alert')).textContent).toContain('Physical unit changed');
 expect(service.reserve).toHaveBeenCalledOnce();expect(service.reserve.mock.calls[0][1]).toEqual(expect.objectContaining({unitIds:['sample-sofa-01'],propertyLabel:'Private property'}));
 await waitFor(()=>expect(service.calendar.mock.calls.length).toBeGreaterThan(1));
});
it('sample calendar distinguishes another physical unit and damage without pretending quantity',async()=>{
 const service=api();service.status.mockResolvedValue({enabled:false,signedIn:false,canEnroll:false});render(<StagingInventoryPanel catalog={catalog} onClose={()=>{}} api={service}/>);
 const rows=screen.getAllByRole('row');const first=rows.find(r=>r.textContent?.includes('SOFA-001'))!,second=rows.find(r=>r.textContent?.includes('SOFA-002'))!,table=rows.find(r=>r.textContent?.includes('TABLE-001'))!;
 expect(within(first).getByText('Unavailable')).toBeTruthy();expect(within(second).getByText('Free for these dates')).toBeTruthy();expect(within(table).getByText('damaged')).toBeTruthy();
});


