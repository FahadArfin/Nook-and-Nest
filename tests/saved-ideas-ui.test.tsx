// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {deleteDB} from 'idb';
import {IdeasPanel} from '../src/IdeasPanel';
import {originalRemixExamples} from '../src/remixSnapshot';
import * as savedIdeas from '../src/savedIdeas';
import * as remixApi from '../src/remixApi';

beforeEach(async()=>{await deleteDB('nook-saved-ideas');vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('saves only on request, reopens after remount, searches and copies with credits without network',async()=>{
 const create=vi.fn(async()=>{});
 const view=render(<IdeasPanel onCreatePrivateCopy={create}/>);
 fireEvent.click(screen.getAllByRole('button',{name:/^Preview /})[0]);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Save idea on this device'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Save idea on this device'}));
 await screen.findByRole('button',{name:'Saved on this device'});
 view.unmount();
 render(<IdeasPanel onCreatePrivateCopy={create}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Saved ideas · 1/}));
 const shelf=screen.getByRole('region',{name:'Saved ideas'});
 fireEvent.change(within(shelf).getByRole('searchbox'),{target:{value:'does not exist'}});
 expect(within(shelf).getByText('No saved ideas match.')).toBeInTheDocument();
 fireEvent.change(within(shelf).getByRole('searchbox'),{target:{value:'Nook & Nest'}});
 fireEvent.click(within(shelf).getByRole('button',{name:/^Preview /}));
 fireEvent.click(screen.getByRole('checkbox',{name:/Create a new private project/}));
 fireEvent.click(screen.getByRole('button',{name:'Make my own private copy'}));
 await waitFor(()=>expect(create).toHaveBeenCalledTimes(1));
 expect(create.mock.calls[0]).toEqual([expect.objectContaining({remixAttribution:expect.objectContaining({credits:[expect.objectContaining({source:'builtin',creator:'Nook & Nest'})]})})]);
 expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(within(shelf).getByRole('button',{name:/Remove .* from saved ideas/}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Saved ideas · 0'})).toBeInTheDocument());
 expect(create).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Undo removal'}));
 await screen.findByRole('button',{name:'Saved ideas · 1'});
});

it('enforces imported copy permission and never reports a failed write as saved',async()=>{
 const create=vi.fn(async()=>{}),original=originalRemixExamples()[0];
 render(<IdeasPanel onCreatePrivateCopy={create}/>);
 const importPacket=(allowCopy:boolean)=>{
  const packet={schema:'nook-remix-package/1',snapshot:{...original.snapshot,allowCopy},source:{source:'file',id:'imported-idea',revision:1}};
  const file=new File([JSON.stringify(packet)],'idea.json',{type:'application/json'});
  Object.defineProperty(file,'text',{value:async()=>JSON.stringify(packet)});
  fireEvent.change(screen.getByLabelText('Import package'),{target:{files:[file]}});
 };
 importPacket(false);
 expect(await screen.findByRole('button',{name:'Save idea on this device'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Make my own private copy'})).toBeDisabled();
 importPacket(true);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Save idea on this device'})).toBeEnabled());
 vi.spyOn(savedIdeas,'saveIdea').mockRejectedValueOnce(new Error('Storage is full. Remove a saved copy first.'));
 fireEvent.click(screen.getByRole('button',{name:'Save idea on this device'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full');
 expect(screen.queryByRole('button',{name:'Saved on this device'})).not.toBeInTheDocument();
 expect(await savedIdeas.listSavedIdeas()).toHaveLength(0);
 expect(create).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});

it('uses an already permitted saved gallery snapshot offline while preserving its source revision',async()=>{
 const original=originalRemixExamples()[0],create=vi.fn(async()=>{});
 await savedIdeas.saveIdea({schema:'nook-remix-package/1',snapshot:original.snapshot,source:{source:'gallery',id:'saved-community-design',revision:3}});
 const read=vi.spyOn(remixApi,'readIdea').mockRejectedValue(new Error('Offline'));
 render(<IdeasPanel onCreatePrivateCopy={create}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Saved ideas · 1'}));
 fireEvent.click(within(screen.getByRole('region',{name:'Saved ideas'})).getByRole('button',{name:/^Preview /}));
 fireEvent.click(screen.getByRole('checkbox',{name:/Create a new private project/}));
 fireEvent.click(screen.getByRole('button',{name:'Make my own private copy'}));
 await waitFor(()=>expect(create).toHaveBeenCalledTimes(1));
 expect(create.mock.calls[0]).toEqual([expect.objectContaining({remixAttribution:expect.objectContaining({credits:[expect.objectContaining({source:'gallery',id:'saved-community-design',revision:3})]})})]);
 expect(read).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
