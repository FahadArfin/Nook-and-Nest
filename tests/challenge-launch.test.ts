import {describe,it,expect,vi} from 'vitest';
import {createBlankPlan} from '../src/domain';
import {challengeBrief,createChallengeProject} from '../src/creativeChallenges';
import {launchCreativeProject} from '../src/challengeLaunch';

describe('launching a separate creative project',()=>{
  const setup=()=>{const base=createBlankPlan(),brief=challengeBrief('reading-nook',25),abort=new AbortController();const candidate=createChallengeProject(brief,base.units);return {base,candidate,abort,request:{base,brief,signal:abort.signal,createPlan:()=>candidate}};};
  it('keeps both projects and opens only after durable writes complete',async()=>{
    const {base,candidate,request}=setup(),events:string[]=[];
    expect(await launchCreativeProject(request,{current:()=>base,save:async plan=>{events.push('saved:'+plan.id)},open:plan=>events.push('opened:'+plan.id)})).toBe(true);
    expect(events).toEqual(['saved:'+base.id,'saved:'+candidate.id,'opened:'+candidate.id]);expect(candidate.id).not.toBe(base.id);
  });
  it.each([1,2])('preserves an edit made during asynchronous save %i',async changedAt=>{
    const {base,request}=setup(),edited={...base,name:'Newer working edit'},saved:string[]=[],open=vi.fn();let current=base,count=0;
    expect(await launchCreativeProject(request,{current:()=>current,save:async plan=>{saved.push(plan.name);if(++count===changedAt)current=edited},open})).toBe(false);
    expect(open).not.toHaveBeenCalled();expect(saved.at(-1)).toBe('Newer working edit');
  });
  it('leaves the working editor unchanged when storage fails or launch is cancelled',async()=>{
    const {base,request,abort}=setup(),open=vi.fn(),save=vi.fn().mockRejectedValue(new Error('Storage full'));
    await expect(launchCreativeProject(request,{current:()=>base,save,open})).rejects.toThrow('Storage full');expect(open).not.toHaveBeenCalled();
    abort.abort();save.mockClear();await expect(launchCreativeProject(request,{current:()=>base,save,open})).rejects.toThrow('project changed');expect(save).not.toHaveBeenCalled();
  });
});
