// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useState} from 'react';
import {createSamplePlan} from '../src/domain';
import {PresentationPanel} from '../src/PresentationPanel';
import {buildPresentationPack,downloadPresentationPack,type PresentationResult} from '../src/presentationPack';
import type {PresentationPlan} from '../src/presentationTypes';
vi.mock('../src/presentationPack',()=>({buildPresentationPack:vi.fn(),downloadPresentationPack:vi.fn(),printPresentation:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();localStorage.clear();});
const result:PresentationResult={html:'<p>Reviewed design</p>',files:{},pageCount:1,revision:'revision',warnings:[],assets:[]};
it('discards an async preview when the project changes and only downloads a freshly reviewed result',async()=>{
  const p=createSamplePlan('Home','metric');let resolve!:(value:PresentationResult)=>void;vi.mocked(buildPresentationPack).mockImplementationOnce(()=>new Promise(r=>resolve=r));const ui=render(<PresentationPanel plan={p} onCommit={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Preview presentation'}));const changed={...p,name:'Changed'};ui.rerender(<PresentationPanel plan={changed} onCommit={()=>{}}/>);resolve(result);await waitFor(()=>expect(screen.queryByTitle('Presentation preview')).toBeNull());expect(screen.queryByRole('button',{name:'Download reviewed ZIP'})).toBeNull();
  vi.mocked(buildPresentationPack).mockResolvedValue(result);fireEvent.click(screen.getByRole('button',{name:'Preview presentation'}));await screen.findByTitle('Presentation preview');fireEvent.click(screen.getByRole('button',{name:'Download reviewed ZIP'}));expect(downloadPresentationPack).toHaveBeenCalledTimes(1);fireEvent.change(screen.getByLabelText('Presentation title'),{target:{value:'Changed title'}});expect(screen.queryByRole('button',{name:'Download reviewed ZIP'})).toBeNull();
});
it('persists choices through a cloned parent commit and rejects an unrelated stale draft',async()=>{
  const p=createSamplePlan(),commit=vi.fn();function Host(){const [plan,setPlan]=useState<PresentationPlan>(p);return <><button onClick={()=>setPlan({...plan,name:'Other change'})}>External edit</button><PresentationPanel plan={plan} onCommit={(base,next)=>{expect(base).toBe(plan);commit(next);setPlan(structuredClone(next));}}/></>;}
  render(<Host/>);fireEvent.change(screen.getByLabelText('Presentation title'),{target:{value:'Client option'}});fireEvent.click(screen.getByRole('button',{name:'Save presentation choices'}));await screen.findByText('Presentation choices saved.');expect(commit).toHaveBeenCalledTimes(1);expect((screen.getByRole('button',{name:'Save presentation choices'}) as HTMLButtonElement).disabled).toBe(false);fireEvent.click(screen.getByRole('button',{name:'External edit'}));expect((screen.getByRole('button',{name:'Save presentation choices'}) as HTMLButtonElement).disabled).toBe(true);
});
