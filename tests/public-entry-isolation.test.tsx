// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {PublicEntry,publicEntryLocation} from '../src/PublicEntry';
import {pendingCollaborationInvitation,rememberCollaborationInvitation,clearCollaborationInvitation} from '../src/invitationRoute';
vi.mock('../src/store',()=>{throw Error('Editor store must stay unloaded in public previews');});
beforeEach(()=>{sessionStorage.clear();vi.stubGlobal('fetch',vi.fn());window.history.replaceState(null,'','/');});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('opens original ideas before its editor child or store and does not save or request network data',async()=>{
  window.history.replaceState(null,'','/#idea=original-starter-reading');const editor=vi.fn(()=> <p>Editor mounted</p>);
  const Editor=editor;render(<PublicEntry><Editor/></PublicEntry>);await screen.findByRole('heading',{name:'Preview first. Make it yours.'});await screen.findByText('Quiet reading nook');
  expect(editor).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Make my own private copy'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Back to Nook & Nest'}));await waitFor(()=>expect(editor).toHaveBeenCalled());expect(location.hash).toBe('');
});
it('malformed and mixed public routes fail closed before mounting normal content',()=>{
  for(const hash of ['#review=bad','#remix=bad','#idea=original-starter-reading&plan=private','#collaboration-invite=bad'])expect(publicEntryLocation(hash)?.kind).toBe('invalid');
  window.history.replaceState(null,'','/#review=bad');render(<PublicEntry><p>Editor mounted</p></PublicEntry>);expect(screen.getByRole('alert')).toHaveTextContent('could not open');expect(screen.queryByText('Editor mounted')).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
it('keeps an invitation inactive, preserves it across same-tab sign-in without putting its capability into a return URL, and can leave it',()=>{
  const token='a'.repeat(43);rememberCollaborationInvitation(token);window.history.replaceState(null,'','/?projects=1');expect(pendingCollaborationInvitation()).toBe(token);
  render(<PublicEntry><p>Editor mounted</p></PublicEntry>);expect(screen.getByRole('heading',{name:'Private design invitation'})).toBeInTheDocument();expect(screen.queryByText('Editor mounted')).toBeNull();expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Back to Nook & Nest'}));expect(screen.getByText('Editor mounted')).toBeInTheDocument();expect(pendingCollaborationInvitation()).toBeUndefined();expect(location.search).not.toContain(token);clearCollaborationInvitation();
});
