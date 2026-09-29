import {expect,it,vi} from 'vitest';
import {CollaborationEditor,type PrivateEditorReturn} from '../src/collaborationEditor';
import type {CollaborationSession} from '../src/collaborationSession';
import {collaborationFixture} from './collaboration-fixture';
const deferred=()=>{let resolve!:()=>void,reject!:(e:Error)=>void;const promise=new Promise<void>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(){
 const plan=collaborationFixture(),shared={...plan,id:'shared-room',name:'Shared room'};
 const original:PrivateEditorReturn={plan,activeFloorId:plan.floors[0].id,past:[{plan,activeFloorId:plan.floors[0].id}],future:[],selectedIds:['piece-a'],selectedId:'piece-a',view:{version:1,kind:'orbit',floorId:plan.floors[0].id,target:{x:1,y:2,z:3},alpha:1,beta:2,radius:8,mode:0,fov:.8}};
 let current=original;const detach=vi.fn(),save=vi.fn().mockResolvedValue(undefined),changed=vi.fn();
 const session={roomId:'shared-room',getState:()=>({local:shared,busy:false})} as CollaborationSession;
 const connect=vi.fn(()=>{current={...original,plan:shared,past:[],selectedIds:[]};return detach;});
 const restore=vi.fn((next:PrivateEditorReturn)=>{current=next;});
 const editor=new CollaborationEditor({read:()=>current,save,connect,restore,copy:source=>({...structuredClone(source),id:'independent-copy'}),changed});
 return {editor,session,original,shared,connect,detach,restore,save,changed,current:()=>current,setCurrent:(next:PrivateEditorReturn)=>{current=next;}};
}
it('saves before attaching, then returns the exact private plan, history, floor and viewpoint',async()=>{
 const f=fixture(),hold=deferred();f.save.mockReturnValueOnce(hold.promise);const open=f.editor.open(f.session);expect(f.connect).not.toHaveBeenCalled();hold.resolve();await open;expect(f.current().plan.id).toBe('shared-room');f.editor.leave();expect(f.detach).toHaveBeenCalledOnce();expect(f.current()).toBe(f.original);expect(f.current().plan).toBe(f.original.plan);expect(f.current().view).toBe(f.original.view);expect(f.changed.mock.calls.map(c=>c[0])).toEqual([f.session,undefined]);
});
it('keeps the private editor when saving fails or a newer project replaces the captured base',async()=>{
 const f=fixture();f.save.mockRejectedValueOnce(new Error('disk full'));await expect(f.editor.open(f.session)).rejects.toThrow('disk full');expect(f.connect).not.toHaveBeenCalled();expect(f.current()).toBe(f.original);
 const hold=deferred();f.save.mockReturnValueOnce(hold.promise);const open=f.editor.open(f.session);f.setCurrent({...f.original,plan:{...f.original.plan,name:'Newer unsaved name'}});hold.resolve();await expect(open).rejects.toThrow('changed while saving');expect(f.connect).not.toHaveBeenCalled();
});
it('retains the live session on a copy-save failure and detaches only after the independent copy is durable',async()=>{
 const f=fixture();await f.editor.open(f.session);f.save.mockRejectedValueOnce(new Error('quota'));await expect(f.editor.privateCopy(f.shared)).rejects.toThrow('quota');expect(f.editor.session).toBe(f.session);expect(f.detach).not.toHaveBeenCalled();
 const hold=deferred();f.save.mockReturnValueOnce(hold.promise);const copying=f.editor.privateCopy(f.shared);expect(f.detach).not.toHaveBeenCalled();expect(f.save.mock.lastCall?.[1]).toEqual({activate:false});expect(()=>f.editor.leave()).toThrow('Wait');hold.resolve();await copying;expect(f.detach).toHaveBeenCalledOnce();expect(f.current().plan.id).toBe('independent-copy');expect(f.current().past).toEqual([]);expect(f.original.plan.id).toBe('practice-source');
});
it('does not attach after an asynchronous save outlives the editor',async()=>{const f=fixture(),hold=deferred();f.save.mockReturnValueOnce(hold.promise);const opening=f.editor.open(f.session);f.editor.dispose();hold.resolve();await expect(opening).rejects.toThrow('closed while saving');expect(f.connect).not.toHaveBeenCalled();expect(f.current()).toBe(f.original);});
it('unmount restores the private return point and an in-flight copy cannot replace it later',async()=>{const f=fixture();await f.editor.open(f.session);const hold=deferred();f.save.mockReturnValueOnce(hold.promise);const copying=f.editor.privateCopy(f.shared);f.editor.dispose();expect(f.current()).toBe(f.original);hold.resolve();await expect(copying).rejects.toThrow('saved in Your projects');expect(f.current()).toBe(f.original);expect(f.detach).toHaveBeenCalledOnce();});
