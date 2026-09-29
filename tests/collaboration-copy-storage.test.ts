// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {savePlan,loadPlan,listLocalPlans} from '../src/store';
import {collaborationFixture} from './collaboration-fixture';
it('durably saves an independent recovery copy without changing the private project reopened after a forced close',async()=>{
 const original=collaborationFixture(),copy={...original,id:'saved-collaboration-copy',name:'Independent copy'};
 await savePlan(original);await savePlan(copy,{activate:false});
 expect((await loadPlan())?.id).toBe(original.id);expect((await listLocalPlans()).find(p=>p.id===copy.id)).toEqual(copy);
 await savePlan(copy);expect((await loadPlan())?.id).toBe(copy.id);
});
