/** Package an exact feature-HEAD app after the PR merge check succeeds. No deployment. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,readdirSync,copyFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {catalogCacheRevision,verifyArtifactInventory,verifyFinalAppSourceInputs} from './build-catalog-realism-beta.mjs';
import {resolveRepoPath} from './lib/model-pipeline-inspect.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const repository='FahadArfin/Nook-and-Nest',branch='codex/catalog-realism-overhaul';
const commit=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
function featurePullRequest(event) {
  const pr=event.pull_request;
  assert(event.repository?.full_name===repository&&pr?.head.repo?.full_name===repository,'Beta artifacts require the same repository');
  assert(pr.head.ref===branch&&pr.base.ref==='master','Only the catalog feature PR is eligible');
  return pr;
}
function validateMergeCheckout(pr,head,parents) {
  assert(commit(head)&&commit(pr.base.sha)&&commit(pr.head.sha)&&head!==pr.head.sha&&head!==pr.base.sha,'Validate must identify a distinct PR merge SHA');
  assert(Array.isArray(parents)&&parents.length===2&&parents[0]===pr.base.sha&&parents[1]===pr.head.sha,'Validate merge parents must match the event base and feature HEAD');
}
export function captureValidationCheckout(root,environment=process.env) {
  assert(environment.GITHUB_EVENT_NAME==='pull_request','Validate checkout evidence requires a pull request');
  const event=JSON.parse(readFileSync(environment.GITHUB_EVENT_PATH,'utf8')),pr=featurePullRequest(event);
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const head=git('rev-parse','HEAD'),parents=git('show','-s','--format=%P','HEAD').split(/\s+/);
  assert.equal(head,environment.GITHUB_SHA,'Validate checkout must match the workflow SHA');
  validateMergeCheckout(pr,head,parents);
  return {validated_sha:head,validated_parents:parents};
}
export function featureValidation(event,{head,validatedSha,validatedParents,result,runId,runAttempt='1'}) {
  const pr=featurePullRequest(event);
  assert(commit(head)&&head===pr.head.sha,'Actual checkout must be exact feature HEAD');
  validateMergeCheckout(pr,validatedSha,validatedParents);
  assert(result==='success'&&/^\d+$/.test(runId)&&Number.isSafeInteger(event.number)&&event.number>0,'Successful Validate evidence required');
  return {check:'Validate',conclusion:'success',event:'pull_request',run_id:runId,run_attempt:runAttempt,pr_number:event.number,repository,head_ref:branch,source_sha:head,validated_sha:validatedSha,base_sha:pr.base.sha,validated_parents:[...validatedParents]};
}
function files(root,relative='') {
  return readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>{
    const name=relative?relative+'/'+entry.name:entry.name;assert(!entry.isSymbolicLink(),'App links are forbidden');
    return entry.isDirectory()?files(root,name):(assert(entry.isFile(),'Unexpected app entry'),[name]);
  }).sort();
}
export function snapshotApp(source,output,library) {
  assert(!existsSync(output),'App snapshot already exists');mkdirSync(output,{recursive:true});const records={};
  for(const name of files(source)) {
    assert(!name.startsWith('client/experiments/catalog-realism/'),'Build unexpectedly contains candidate authoring assets');
    const bytes=readFileSync(resolveRepoPath(source,name)),record={sha256:sha(bytes),size:bytes.length};
    const external=name.startsWith('client/')?library.assets['/'+name.slice(7)]:undefined;
    if(external){assert.equal(record.sha256,external.sha256,'Build library hash differs');assert.equal(record.size,external.size,'Build library size differs');continue;}
    const target=resolveRepoPath(output,name);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(resolveRepoPath(source,name),target);records[name]=record;
  }
  const inventory={files:records};verifyArtifactInventory(output,inventory);return inventory;
}
export function packageFeatureApp(root,output,environment=process.env) {
  assert(!existsSync(output),'Use a new immutable app artifact directory');
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const head=git('rev-parse','HEAD');assert.equal(git('status','--porcelain'),'','Feature checkout must be clean');
  const event=JSON.parse(readFileSync(environment.GITHUB_EVENT_PATH,'utf8'));
  const validation=featureValidation(event,{head,validatedSha:environment.VALIDATE_SHA,validatedParents:JSON.parse(environment.VALIDATE_PARENTS??'null'),result:environment.VALIDATE_RESULT,runId:environment.GITHUB_RUN_ID,runAttempt:environment.GITHUB_RUN_ATTEMPT});
  const catalog=JSON.parse(readFileSync(path.join(root,'assets-source/catalog-realism/catalog.json'),'utf8'));
  const revision=catalogCacheRevision(catalog.catalogSha256,head);assert.equal(environment.VITE_CATALOG_REALISM_VERSION,revision,'Build revision does not match exact feature HEAD');
  const sourceInputs=['src/catalogRealism.ts','src/catalogRealismBeds.json','src/modelAssetPath.ts','src/scene/FurnitureModelLibrary.ts'].map(name=>({path:name,sha256:sha(readFileSync(path.join(root,name)))}));
  verifyFinalAppSourceInputs(root,sourceInputs);
  const library=JSON.parse(readFileSync(path.join(root,'.generated/library-manifest.json'),'utf8'));
  mkdirSync(output,{recursive:true});const inventory=snapshotApp(path.join(root,'dist'),path.join(output,'app'),library),inventoryBytes=json(inventory);
  const scripts=Object.keys(inventory.files).filter(n=>n.startsWith('client/')&&n.endsWith('.js')).map(n=>readFileSync(path.join(output,'app',n),'utf8'));
  assert(scripts.some(text=>text.includes(revision))&&scripts.some(text=>text.includes('?catalog_realism=')),'Compiled Beta cache overlay is missing');
  writeFileSync(path.join(output,'inventory.json'),inventoryBytes,{flag:'wx'});
  const python=environment.PYTHON??(process.platform==='win32'?'python':'python3');
  const sourceArchive=JSON.parse(execFileSync(python,[path.join(root,'scripts/catalog-realism-source.py'),'feature','--root',root,'--commit',head,'--output',path.join(output,'sites-source.tar.gz')],{encoding:'utf8'}));
  const provenance={version:1,scope:'beta-only',commit_sha:head,catalogSha256:catalog.catalogSha256,catalogRevision:revision,validation,inventorySha256:sha(inventoryBytes),cacheOverlay:{decision:'validated',query:`catalog_realism=${revision}`,sourceInputs},sourceArchive:{path:'sites-source.tar.gz',...sourceArchive}};
  assert.equal(git('rev-parse','HEAD'),head,'Feature HEAD changed');assert.equal(git('status','--porcelain'),'','Feature source changed');verifyArtifactInventory(path.join(output,'app'),inventory);
  writeFileSync(path.join(output,'provenance.json'),json(provenance),{flag:'wx'});return provenance;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const root=fileURLToPath(new URL('../',import.meta.url)),command=process.argv[2];
  if(command==='validation-checkout') {
    assert(process.argv.length===3&&process.env.GITHUB_OUTPUT,'GitHub job output path is required');
    const evidence=captureValidationCheckout(root);
    appendFileSync(process.env.GITHUB_OUTPUT,`validated_sha=${evidence.validated_sha}\nvalidated_parents=${JSON.stringify(evidence.validated_parents)}\n`);
    console.log(json(evidence));
  } else if(command==='revision') {
    const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),catalog=JSON.parse(readFileSync(path.join(root,'assets-source/catalog-realism/catalog.json'),'utf8'));
    console.log(catalogCacheRevision(catalog.catalogSha256,head));
  } else {assert(command==='package'&&process.argv.length===4,'Usage: node scripts/catalog-realism-app.mjs revision | package OUTPUT');console.log(json(packageFeatureApp(root,resolveRepoPath(root,process.argv[3]))));}
}
