// @vitest-environment jsdom
import React,{useState} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {FitReviewPanel} from '../src/FitReviewPanel';
import {defaultFitReviewSettings,type FitReviewResult} from '../src/fitReview';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {useFitReview} from '../src/useFitReview';
import * as fitLogic from '../src/fitReview';
import type {PlanDocumentV1} from '../src/types';
afterEach(cleanup);

it('opens optional review, explains a measured gap, links its items, and clears overlays without modifying the home',async()=>{
  const plan=createSamplePlan('Panel fit','metric');plan.gridSizeMm=1000;plan.floors[0].cells=rectangleCells(8,8);const floor=plan.floors[0].id;
  plan.furniture=[{id:'left',floorId:floor,catalogId:'side-table',x:3000,z:3000,rotation:0,widthMm:500,depthMm:500,heightMm:500,variant:'oat'},{id:'right',floorId:floor,catalogId:'side-table',x:3750,z:3000,rotation:0,widthMm:500,depthMm:500,heightMm:500,variant:'oat'}];
  const before=JSON.stringify(plan),select=vi.fn(),publish=vi.fn<(result:FitReviewResult)=>void>();
  function Harness(){const [settings,setSettings]=useState({...defaultFitReviewSettings,checkChairs:false});return <FitReviewPanel plan={plan} floorId={floor} settings={settings} onSettingsChange={setSettings} onSelectItems={select} onResult={publish}/>;}
  const view=render(<Harness/>);expect(screen.getByText('Review is off. Your home and undo history are unchanged.')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox',{name:'Show practical fit review'}));
  await screen.findByText(/Measured 0.25 m/);fireEvent.click(screen.getByRole('button',{name:'Show these pieces'}));expect(select).toHaveBeenCalledWith(['left','right'],floor);
  expect(publish.mock.calls.at(-1)![0].overlays.length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('checkbox',{name:'Show practical fit review'}));await waitFor(()=>expect(publish.mock.calls.at(-1)![0].overlays).toEqual([]));expect(JSON.stringify(plan)).toBe(before);
  view.unmount();expect(publish.mock.calls.at(-1)![0].overlays).toEqual([]);
});

it('shares the root evaluator with a controlled panel and keeps review live after that panel closes',async()=>{
  const plan=createSamplePlan('Live review','metric');plan.gridSizeMm=1000;plan.floors[0].cells=rectangleCells(8,8);const floor=plan.floors[0].id;
  plan.furniture=[{id:'left',floorId:floor,catalogId:'side-table',x:3000,z:3000,rotation:0,widthMm:500,depthMm:500,heightMm:500,variant:'oat'},{id:'right',floorId:floor,catalogId:'side-table',x:3750,z:3000,rotation:0,widthMm:500,depthMm:500,heightMm:500,variant:'oat'}];
  const factory=vi.spyOn(fitLogic,'createFitReviewEvaluator'),publish=vi.fn();
  function Harness({current}:{current:PlanDocumentV1}){
    const [open,setOpen]=useState(true),[settings,setSettings]=useState({...defaultFitReviewSettings,enabled:true,checkChairs:false});
    const review=useFitReview(current,floor,settings);
    return <><output data-testid="live-overlay-count">{review.result.overlays.length}</output><output data-testid="live-review-pending">{String(review.pending)}</output>{open&&<FitReviewPanel plan={current} floorId={floor} settings={settings} onSettingsChange={setSettings} onSelectItems={()=>{}} onClose={()=>setOpen(false)} result={review.result} pending={review.pending} error={review.error} onResult={publish}/>}</>;
  }
  try{
    const view=render(<Harness current={plan}/>);await screen.findByText(/Measured 0.25 m/);expect(factory).toHaveBeenCalledTimes(1);
    const count=screen.getByTestId('live-overlay-count').textContent;fireEvent.click(screen.getByRole('button',{name:'Close fit review'}));
    expect(screen.getByTestId('live-overlay-count').textContent).toBe(count);expect(publish).not.toHaveBeenCalled();
    const moved={...plan,furniture:plan.furniture.map(p=>p.id==='right'?{...p,x:5500}:p)};view.rerender(<Harness current={moved}/>);
    await waitFor(()=>{expect(screen.getByTestId('live-overlay-count').textContent).toBe('0');expect(screen.getByTestId('live-review-pending').textContent).toBe('false');});expect(factory).toHaveBeenCalledTimes(1);
  }finally{factory.mockRestore();}
});
