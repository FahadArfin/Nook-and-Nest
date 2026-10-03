#!/usr/bin/env node
/** Explicit, hash-bound visual decisions and independent format checks. Never auto-approves. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {canonicalJson,sha256,hashCatalogInventory,resolveCatalogPath,REQUIRED_REVIEW_VIEWS as VIEWS} from './lib/catalog-realism-inventory.mjs';
import {inspectCandidate,validateKhronosCandidate,verifyRenderConfiguration} from './lib/catalog-realism-validate.mjs';

const HASH=/^[a-f0-9]{64}$/;
function verify(root,record){
  assert(record&&HASH.test(record.sha256),'File record requires a SHA256 hash');
  const file=resolveCatalogPath(root,record.path),size=statSync(file).size;
  assert(size>0&&size<=256*1024*1024,'File byte limit exceeded: '+record.path);
  assert(record.bytes===undefined||record.bytes===size,'File byte count changed: '+record.path);
  assert.equal(sha256(readFileSync(file)),record.sha256,'File hash changed: '+record.path);
}
function readReceipt(root,item){
  const file=resolveCatalogPath(root,item.outputs.receipt);assert(statSync(file).size<=2*1024*1024,'Receipt exceeds 2 MiB');
  const bytes=readFileSync(file);return {file,bytes,receipt:JSON.parse(bytes.toString('utf8'))};
}
function commitReceipt(snapshot,receipt){
  assert(readFileSync(snapshot.file).equals(snapshot.bytes),'Receipt changed during validation; rerun against current artifacts');
  const temporary=snapshot.file+'.review-'+randomUUID()+'.tmp';
  try{writeFileSync(temporary,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});assert(readFileSync(snapshot.file).equals(snapshot.bytes),'Receipt changed before commit');renameSync(temporary,snapshot.file);}
  finally{if(existsSync(temporary))unlinkSync(temporary);}
}
export function loadReviewCatalog(root){
  const file=resolveCatalogPath(root,'assets-source/catalog-realism/catalog.json');assert(statSync(file).size<=16*1024*1024,'Catalog exceeds 16 MiB');
  const manifest=JSON.parse(readFileSync(file,'utf8'));
  assert(manifest.version===1&&manifest.scope==='beta-only'&&manifest.expectedCount===manifest.items?.length&&manifest.items.length>0,'Incomplete Beta catalog');
  assert.equal(hashCatalogInventory(manifest),manifest.catalogSha256,'Frozen catalog hash changed');
  assert(Array.isArray(manifest.sourceInputs)&&manifest.sourceInputs.length,'Frozen catalog source inputs missing');
  for(const input of manifest.sourceInputs)verify(root,input);
  assert.equal(new Set(manifest.items.map(i=>i.id)).size,manifest.items.length,'Duplicate catalog IDs');return manifest;
}
export function verifyRenderEvidence(root,receipt){
  const binding=receipt.renderBinding,inputs=binding?.inputs;
  assert(Array.isArray(inputs)&&inputs.length>0&&inputs.length<=1024,'Current render binding is required');
  assert.equal(new Set(inputs.map(r=>r.path)).size,inputs.length,'Duplicate render input');
  const inputHash=sha256(canonicalJson(inputs));
  assert(binding.beforeSha256===inputHash&&binding.afterSha256===inputHash,'Render input binding is stale');
  verifyRenderConfiguration(binding);
  for(const input of inputs)verify(root,input);
  for(const output of Object.values(receipt.outputs))assert(inputs.some(i=>i.path===output.path&&i.sha256===output.sha256),'Render input does not bind the current model output');
  assert(receipt.renders?.length===5&&new Set(receipt.renders.map(r=>r.view)).size===5,'All five current rendered views are required');
  for(const view of VIEWS){
    const render=receipt.renders.find(r=>r.view===view);assert(render,'Missing rendered view: '+view);verify(root,render);
    assert(render.glbSha256===receipt.outputs.glb.sha256&&render.inputSetSha256===inputHash&&render.renderConfigSha256===binding.configurationSha256,'Render is stale: '+view);
  }
}
export function inspectReviewItem(root,item,receipt){
  receipt??=readReceipt(root,item).receipt;
  const processed={...receipt,state:'processed'};delete processed.review;delete processed.artifactSetSha256;
  const result=inspectCandidate(root,item,processed);assert(result.ok,result.issues.join('; '));verifyRenderEvidence(root,processed);
  return {...result,id:item.id,renders:VIEWS.map(view=>{const r=receipt.renders.find(r=>r.view===view);return {view,path:r.path,sha256:r.sha256};})};
}
function validateDecision(decision,item,receipt,result){
  assert(decision?.catalogId===item.id&&['approved','changes-requested'].includes(decision.decision),'Explicit model review decision required');
  assert(typeof decision.reviewer==='string'&&decision.reviewer.trim().length>=2&&decision.reviewer.length<=200,'Reviewer identity required');
  assert(HASH.test(decision.artifactSetSha256)&&decision.artifactSetSha256===result.artifactSetSha256,'Review artifact hash is stale or mismatched');
  assert(decision.views&&Object.keys(decision.views).length===5,'Exactly five explicit view notes required');
  const notes={},unique=new Set();
  for(const view of VIEWS){
    const value=decision.views[view],render=receipt.renders.find(r=>r.view===view);
    assert(value&&value.sha256===render.sha256,'Viewed image hash differs: '+view);
    assert(typeof value.note==='string'&&value.note.trim().length>=12&&value.note.length<=2000,'Specific inspection note of 12–2000 characters required: '+view);
    const note=value.note.trim(),normalized=note.toLowerCase().replace(/\s+/g,' ');assert(!unique.has(normalized),'Each view requires a unique inspection note');unique.add(normalized);notes[view]=note;
  }
  return {decision:decision.decision,reviewer:decision.reviewer.trim(),artifactSetSha256:result.artifactSetSha256,views:notes};
}
export async function recordFormatValidation(root,item){
  const snapshot=readReceipt(root,item),before=inspectCandidate(root,item,snapshot.receipt);assert(before.ok,before.issues.join('; '));
  const format=await validateKhronosCandidate(root,item);
  assert(format.sha256===snapshot.receipt.outputs.glb.sha256&&format.numErrors===0&&typeof format.validatorVersion==='string','Khronos validation failed or candidate changed');
  const after=inspectCandidate(root,item,snapshot.receipt);assert(after.ok&&after.artifactSetSha256===before.artifactSetSha256,after.issues.join('; ')||'Artifacts changed during format validation');
  commitReceipt(snapshot,{...snapshot.receipt,formatValidation:format});
  return {id:item.id,artifactSetSha256:after.artifactSetSha256,formatValidation:format,visualReview:after.stats.visualReview};
}
export async function recordReviewDecision(root,item,decision){
  const snapshot=readReceipt(root,item),before=inspectReviewItem(root,item,snapshot.receipt);
  const review=validateDecision(decision,item,snapshot.receipt,before);
  const format=await validateKhronosCandidate(root,item);
  assert(format.sha256===snapshot.receipt.outputs.glb.sha256&&format.numErrors===0&&typeof format.validatorVersion==='string','Khronos validation failed or candidate changed');
  const after=inspectReviewItem(root,item,snapshot.receipt);assert.equal(after.artifactSetSha256,before.artifactSetSha256,'Artifacts changed during visual-decision validation');
  const receipt={...snapshot.receipt,formatValidation:format,review,state:review.decision==='approved'?'reviewed':'processed'};
  if(review.decision==='approved'){const final=inspectCandidate(root,item,receipt);assert(final.ok&&final.stats.visualReview==='approved',final.issues.join('; '));}
  commitReceipt(snapshot,receipt);return {id:item.id,decision:review.decision,artifactSetSha256:after.artifactSetSha256};
}

async function main(args){
  const root=fileURLToPath(new URL('../',import.meta.url)),[command,...rest]=args;
  assert(['inspect','record-format','record'].includes(command),'Usage: node scripts/catalog-realism-review.mjs inspect|record-format IDS... [--category CATEGORY | --all] [--json] | record DECISIONS.json');
  const manifest=loadReviewCatalog(root),lookup=new Map(manifest.items.map(i=>[i.id,i]));
  if(command==='record'){
    assert(rest.length===1,'record requires one explicit decision JSON file');const file=path.resolve(root,rest[0]);assert(statSync(file).size<=4*1024*1024,'Decision file exceeds 4 MiB');
    const envelope=JSON.parse(readFileSync(file,'utf8'));assert(envelope.version===1&&Array.isArray(envelope.decisions)&&envelope.decisions.length>0&&envelope.decisions.length<=902,'Expected {version:1,decisions:[...]}');
    assert.equal(new Set(envelope.decisions.map(d=>d.catalogId)).size,envelope.decisions.length,'Duplicate model decisions');
    // Validate all decisions before the first mutation; each commit rechecks its
    // artifacts after asynchronous Khronos validation and compares receipt bytes.
    for(const decision of envelope.decisions){const item=lookup.get(decision.catalogId);assert(item,'Unknown catalog ID: '+decision.catalogId);const snapshot=readReceipt(root,item);validateDecision(decision,item,snapshot.receipt,inspectReviewItem(root,item,snapshot.receipt));}
    for(const decision of envelope.decisions)console.log(JSON.stringify(await recordReviewDecision(root,lookup.get(decision.catalogId),decision)));
    return;
  }
  const ids=[];let category,all=false,json=false;
  for(let i=0;i<rest.length;i++){const arg=rest[i];if(arg==='--category'){assert(!category&&rest[i+1]&&!rest[i+1].startsWith('--'),'--category requires a value');category=rest[++i];}else if(arg==='--all')all=true;else if(arg==='--json')json=true;else{assert(!arg.startsWith('-'),'Unknown option: '+arg);ids.push(arg);}}
  assert(Number(ids.length>0)+Number(Boolean(category))+Number(all)===1,'Choose explicit IDs, --category, or --all');
  const selected=ids.length?ids.map(id=>{assert(lookup.has(id),'Unknown catalog ID: '+id);return lookup.get(id);}):manifest.items.filter(i=>all||i.category===category);
  assert(selected.length&&new Set(selected.map(i=>i.id)).size===selected.length,'Empty or duplicate model selection');
  let failures=0;const results=[];
  // Deliberately serial: glTF validation expands geometry and textures in memory.
  for(const item of selected){let result;try{result=command==='record-format'?await recordFormatValidation(root,item):inspectReviewItem(root,item);}catch(error){failures++;result={id:item.id,ok:false,issues:[error.message]};}results.push(result);if(!json)console.log(JSON.stringify(result));}
  if(json)console.log(JSON.stringify({count:results.length,failures,results},null,2));if(failures)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(error=>{console.error('Catalog review: '+error.message);process.exitCode=1;});
