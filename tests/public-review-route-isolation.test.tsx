// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {PublicEntry} from '../src/PublicEntry';
import {createSamplePlan} from '../src/domain';
import {parseReviewSnapshot,type ReviewView} from '../src/clientReview';
import * as api from '../src/clientReviewApi';

vi.mock('../src/clientReviewApi',async importOriginal=>{
  const real=await importOriginal<typeof import('../src/clientReviewApi')>();
  return {...real,getClientReview:vi.fn(),getReviewMedia:vi.fn(),submitReviewFeedback:vi.fn()};
});
vi.mock('../src/ReviewScene',()=>({default:()=> <div>Read-only scene</div>}));

function review(title:string,revision=1):ReviewView {
  const plan=createSamplePlan(),floorId=plan.floors[0].id;
  return {revision,currentRevision:revision,expiresAt:Date.now()+3600000,media:[],feedback:[],snapshot:parseReviewSnapshot({
    version:1,title,plan,stops:[{id:'stop1',title:'Reading corner',caption:'A quiet room',narration:'A quiet place to read.',floorId,
      camera:{version:1,kind:'orbit',floorId,target:{x:1,y:1,z:1},alpha:1,beta:1,radius:6,mode:0,fov:.8},
      marker:{xMm:1000,zMm:1000,facingDeg:90}}],
  })};
}
function navigate(id:string,token:string,revision=1){
  window.history.replaceState(null,'',`/#review=${id}&key=${token}&revision=${revision}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
afterEach(()=>{cleanup();vi.resetAllMocks();window.history.replaceState(null,'','/');});

describe('public review route isolation',()=>{
  it('drops an uncertain response when another capability is opened, without mounting the private editor',async()=>{
    vi.mocked(api.getClientReview).mockImplementation(async id=>review(id==='review-a'?'Home A':'Home B'));
    vi.mocked(api.submitReviewFeedback).mockRejectedValue(new Error('Connection interrupted'));
    navigate('review-a','a'.repeat(43));
    const privateEditor=vi.fn(()=> <div>Private editor</div>),PrivateEditor=privateEditor;
    render(<PublicEntry><PrivateEditor/></PublicEntry>);
    await screen.findByRole('heading',{name:'Home A'});
    fireEvent.change(screen.getByRole('textbox',{name:'Your name (self-reported)'}),{target:{value:'Alex'}});
    fireEvent.change(screen.getByRole('textbox',{name:'Your response'}),{target:{value:'Confidential feedback for A'}});
    fireEvent.click(screen.getByRole('button',{name:'Save response'}));
    await screen.findByRole('button',{name:'Retry same response'});
    act(()=>navigate('review-b','b'.repeat(43)));
    await screen.findByRole('heading',{name:'Home B'});
    expect(screen.queryByRole('button',{name:'Retry same response'})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox',{name:'Your name (self-reported)'})).toHaveValue('');
    expect(screen.getByRole('textbox',{name:'Your response'})).toHaveValue('');
    expect(api.submitReviewFeedback).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitReviewFeedback).mock.calls[0][0]).toBe('review-a');
    expect(privateEditor).not.toHaveBeenCalled();
  });

  it('opens the exact revision from a new link even when the review identity is unchanged',async()=>{
    vi.mocked(api.getClientReview).mockImplementation(async(_id,_token,revision)=>review('Revision '+revision,revision));
    navigate('review-a','a'.repeat(43));
    render(<PublicEntry><div>Private editor</div></PublicEntry>);
    await screen.findByRole('heading',{name:'Revision 1'});
    act(()=>navigate('review-a','a'.repeat(43),2));
    await screen.findByRole('heading',{name:'Revision 2'});
    expect(vi.mocked(api.getClientReview).mock.calls.at(-1)?.[2]).toBe(2);
    expect(screen.getByRole('group',{name:'Respond to revision 2'})).toBeInTheDocument();
    expect(screen.queryByText('Private editor')).not.toBeInTheDocument();
  });
});
