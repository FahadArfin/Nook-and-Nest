import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refreshFamilyObservations,refreshAuditByteCounts} from '../scripts/household-asset-state.mjs';

const complete=[{id:'example',editableSource:true,glb:true,sourcePreview:true,webPreview:true}];
test('file observations never fabricate acceptance',()=>{
  const family={name:'Example',status:'authored-awaiting-export',acceptance:{rendered:'pending'}};
  const updated=refreshFamilyObservations(family,complete);
  assert.equal(updated.status,'exported-awaiting-review');assert.deepEqual(updated.acceptance,family.acceptance);
  assert.equal(family.status,'authored-awaiting-export');
});
test('explicit review validation release and existing coverage survive metadata reruns',()=>{
  for(const status of ['reviewed','reviewed-awaiting-browser','validated','released','covered-existing']){
    assert.equal(refreshFamilyObservations({name:'Example',status},complete).status,status);
  }
});
test('missing files reject explicit acceptance and downgrade export observations',()=>{
  const missing=[{...complete[0],editableSource:false}];
  for(const status of ['reviewed','validated','released'])assert.throws(()=>refreshFamilyObservations({name:'Example',status},missing),/missing required asset/);
  assert.equal(refreshFamilyObservations({name:'Example',status:'exported-awaiting-review'},missing).status,'partially-exported-awaiting-review');
  assert.throws(()=>refreshFamilyObservations({name:'Example',status:'released'},[{...complete[0],webPreview:false}]),/missing required asset/);
});
test('audit byte refresh preserves unrelated entries and all other measurements',()=>{
  const audit={newModel:{glbBytes:100,triangles:321},oldModel:{glbBytes:800,triangles:654}};
  const result=refreshAuditByteCounts(audit,{newModel:96});
  assert.equal(result.updated,1);assert.deepEqual(result.audit.newModel,{glbBytes:96,triangles:321});
  assert.deepEqual(result.audit.oldModel,audit.oldModel);assert.equal(audit.newModel.glbBytes,100);
  assert.throws(()=>refreshAuditByteCounts(audit,{missing:100}),/missing exported model/);
});
