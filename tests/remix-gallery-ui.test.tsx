// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {IdeasPanel} from '../src/IdeasPanel';
import {ShareArrangementPanel} from '../src/ShareArrangementPanel';
import {RemixViewer} from '../src/RemixViewer';
import {originalRemixExamples,type RemixPlan} from '../src/remixSnapshot';
import * as api from '../src/remixApi';
vi.mock('../src/remixApi',async original=>({...await original<typeof import('../src/remixApi')>(),ideasPage:vi.fn(),readIdea:vi.fn(),createRemixShare:vi.fn(),submitIdea:vi.fn(),remixAvailability:vi.fn(),listRemixShares:vi.fn()}));
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
describe('explicit room sharing and original ideas',()=>{
 it('opens original examples without network or saving and copies only after preview and explicit acknowledgment',async()=>{
  const create=vi.fn(async(_seed:RemixPlan)=>{});render(<IdeasPanel onCreatePrivateCopy={create}/>);expect(fetch).not.toHaveBeenCalled();expect(api.ideasPage).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();fireEvent.click(screen.getAllByRole('button',{name:/^Preview /})[0]);expect(screen.getByRole('button',{name:'Make my own private copy'})).toBeDisabled();fireEvent.click(screen.getByRole('checkbox',{name:/Create a new private project/}));fireEvent.click(screen.getByRole('button',{name:'Make my own private copy'}));await waitFor(()=>expect(create).toHaveBeenCalledTimes(1));expect(create.mock.calls[0][0]).toMatchObject({remixAttribution:{version:1,credits:[{source:'builtin',creator:'Nook & Nest',permission:'remix-with-credit-v1'}]}});expect(fetch).not.toHaveBeenCalled();
 });
 it('checks fresh public permission before copying a link and leaves the user home untouched after revocation',async()=>{
  const original=originalRemixExamples()[0],create=vi.fn(async()=>{});vi.mocked(api.readIdea).mockResolvedValueOnce({id:'approved-idea',revision:1,snapshot:original.snapshot}).mockRejectedValueOnce(Error('This arrangement is unavailable, expired or withdrawn.'));render(<RemixViewer location={{kind:'gallery',id:'approved-idea'}} onCreatePrivateCopy={create} onExit={()=>{}}/>);await screen.findByText(original.snapshot.title);fireEvent.click(screen.getByRole('checkbox',{name:/Create a new local project/}));fireEvent.click(screen.getByRole('button',{name:'Make my own private copy'}));await screen.findByRole('alert');expect(api.readIdea).toHaveBeenCalledTimes(2);expect(create).not.toHaveBeenCalled();
 });
 it('previews sanitized selections locally and never creates a link or submits to the gallery automatically',async()=>{
  const original=originalRemixExamples()[0],plan=original.snapshot.plan;render(<ShareArrangementPanel plan={plan} floorId={plan.floors[0].id}/>);fireEvent.change(screen.getByRole('textbox',{name:'Public title'}),{target:{value:'My calm corner'}});fireEvent.change(screen.getByRole('textbox',{name:'Creator credit (self-reported)'}),{target:{value:'A nickname'}});const pieceCheckboxes=screen.getAllByRole('checkbox').filter(e=>(e.parentElement?.textContent??'').includes('mm'));fireEvent.click(pieceCheckboxes[0]);fireEvent.click(screen.getByRole('button',{name:'Preview exact shared snapshot'}));expect(screen.getByRole('region',{name:'Read-only arrangement preview'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Create unlisted link'})).toBeDisabled();expect(api.createRemixShare).not.toHaveBeenCalled();expect(api.submitIdea).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 });
});
