import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as app from '../scripts/catalog-realism-app.mjs';

const head='a'.repeat(40),merge='b'.repeat(40),base='c'.repeat(40);
const event={number:133,repository:{full_name:'FahadArfin/Nook-and-Nest'},pull_request:{head:{sha:head,ref:'codex/catalog-realism-overhaul',repo:{full_name:'FahadArfin/Nook-and-Nest'}},base:{ref:'master',sha:base}}};
const evidence={head,validatedSha:merge,validatedParents:[base,head],result:'success',runId:'37143560111',runAttempt:'1'};

test('stale or null webhook merge metadata cannot replace the successful Validate checkout evidence',()=>{
  for(const stale of [null,'d'.repeat(40),undefined]){
    const payload=structuredClone(event);payload.pull_request.merge_commit_sha=stale;
    const proof=app.featureValidation(payload,evidence);
    assert.equal(proof.validated_sha,merge);assert.equal(proof.source_sha,head);
    assert.deepEqual(proof.validated_parents,[base,head]);assert.equal(proof.base_sha,base);
  }
});

test('missing checkout output, wrong PR parents, feature-only and unrelated merge commits are rejected',()=>{
  for(const edit of [
    {validatedSha:undefined},{validatedSha:head},{validatedSha:base},
    {validatedParents:undefined},{validatedParents:[]},{validatedParents:[base]},
    {validatedParents:[head,base]},{validatedParents:[base,'e'.repeat(40)]},
    {validatedParents:['e'.repeat(40),head]},{validatedParents:[base,head,'e'.repeat(40)]},
  ])assert.throws(()=>app.featureValidation(event,{...evidence,...edit}),/merge|parents/i);
});

test('Validate capture reads actual Git HEAD and ordered parents rather than event merge metadata',t=>{
  const root=mkdtempSync(path.join(tmpdir(),'catalog-validate-git-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const git=(args,input)=>execFileSync('git',args,{cwd:root,encoding:'utf8',input,stdio:['pipe','pipe','pipe']}).trim();
  git(['init','-q']);const tree=git(['write-tree']);
  const commit=(message,parents=[])=>git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit-tree',tree,...parents.flatMap(parent=>['-p',parent])],message+'\n');
  const actualBase=commit('base'),actualHead=commit('head',[actualBase]),actualMerge=commit('merge',[actualBase,actualHead]);
  git(['checkout','--detach',actualMerge]);
  const payload=structuredClone(event);payload.pull_request.head.sha=actualHead;payload.pull_request.base.sha=actualBase;payload.pull_request.merge_commit_sha=null;
  const eventPath=path.join(root,'event.json');writeFileSync(eventPath,JSON.stringify(payload));
  const environment={GITHUB_EVENT_PATH:eventPath,GITHUB_EVENT_NAME:'pull_request',GITHUB_SHA:actualMerge};
  assert.deepEqual(app.captureValidationCheckout(root,environment),{validated_sha:actualMerge,validated_parents:[actualBase,actualHead]});
  assert.throws(()=>app.captureValidationCheckout(root,{...environment,GITHUB_SHA:actualHead}),/workflow SHA/);
  git(['checkout','--detach',actualHead]);
  assert.throws(()=>app.captureValidationCheckout(root,{...environment,GITHUB_SHA:actualHead}),/merge SHA/);
});
