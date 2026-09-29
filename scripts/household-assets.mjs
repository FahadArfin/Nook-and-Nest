/** Targeted household metadata/preview maintenance. Never regenerate unrelated assets.
 * node scripts/household-assets.mjs [--ids id,id] [--available] [--canonicalize] [--previews] [--progress] [--check]
 * --check performs read-only metadata/progress comparison and cannot compress previews.
 */
import {existsSync,readdirSync,readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {refreshFamilyObservations,refreshAuditByteCounts} from './household-asset-state.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
const args=process.argv.slice(2),flags=new Set(),requested=[];
for(let i=0;i<args.length;i++){
  if(args[i]==='--ids'){
    if(!args[i+1]||args[i+1].startsWith('--'))throw Error('--ids requires comma-separated household IDs');
    requested.push(...args[++i].split(',').filter(Boolean));
  }else if(['--available','--canonicalize','--previews','--progress','--check'].includes(args[i]))flags.add(args[i]);
  else throw Error('Unknown argument: '+args[i]);
}
if(flags.has('--check')&&flags.has('--previews'))throw Error('--check is read-only; omit --previews');
const expansionFiles=readdirSync(join(root,'src')).filter(f=>/^household\w*Expansion\.json$/.test(f)).sort();
const allRows=expansionFiles.flatMap(f=>readJson('src/'+f)),allIds=allRows.map(r=>r[0]),allowed=new Set(allIds);
if(allowed.size!==allIds.length)throw Error('Duplicate household catalog IDs');
const ids=requested.length?[...new Set(requested)]:allIds;
for(const id of ids)if(!allowed.has(id))throw Error('Not a household collection ID: '+id);
const skipped=[],selected=ids.filter(id=>{
  if(existsSync(join(root,`public/models/furniture/${id}.glb`)))return true;
  if(!flags.has('--available'))throw Error('Missing exported model: '+id);
  skipped.push(id);return false;
});
let canonicalization=null;
if(flags.has('--canonicalize')&&selected.length){
  const p=spawnSync(process.env.PYTHON??'python',[
    join(root,'tools/blender/household_materials.py'),'--root',root,flags.has('--check')?'--check':'--write'
  ],{input:JSON.stringify(selected),encoding:'utf8',windowsHide:true});
  if(p.error||p.status!==0)throw Error('Household key canonicalization failed: '+(p.error?.message??p.stderr));
  canonicalization=JSON.parse(p.stdout.trim());
  if(flags.has('--check')&&(canonicalization.changedModels||canonicalization.mappingUpdated))throw Error('Household keys/source mapping need canonicalization: '+JSON.stringify(canonicalization));
}
const metadata=readJson('src/modelMaterials.json');
const preserved=Object.fromEntries(Object.entries(metadata).filter(([id])=>!allowed.has(id)));
const srgb=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
const hex=values=>'#'+values.slice(0,3).map(v=>Math.round(255*srgb(Math.min(1,Math.max(0,v)))) .toString(16).padStart(2,'0')).join('');
function glbJson(path){
  const b=readFileSync(path);
  if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length||b.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB2: '+path);
  return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));
}
const changed=[];
for(const id of selected){
  const doc=glbJson(join(root,`public/models/furniture/${id}.glb`));
  const materials=(doc.materials??[]).map(m=>{
    if(typeof m.name!=='string'||!m.name.trim())throw Error('Unnamed material in '+id);
    if(flags.has('--check')&&/\.[0-9]+$/.test(m.name))throw Error('Unstable Blender material suffix in '+id+': '+m.name+'; use --canonicalize');
    return {id:m.name,label:m.name.replace(/[-_]/g,' ').replace(/textured/g,'').trim(),color:hex(m.pbrMetallicRoughness?.baseColorFactor??[.7,.7,.7,1])};
  });
  if(!materials.length||new Set(materials.map(m=>m.id)).size!==materials.length)throw Error('Missing or duplicate material keys: '+id);
  if(JSON.stringify(metadata[id])!==JSON.stringify(materials)){changed.push(id);metadata[id]=materials;}
}
if(JSON.stringify(preserved)!==JSON.stringify(Object.fromEntries(Object.entries(metadata).filter(([id])=>!allowed.has(id)))))throw Error('Unrelated material metadata changed');
function atomicJson(relative,value){
  const path=join(root,relative),temporary=path+'.household-'+randomUUID()+'.tmp';
  writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');renameSync(temporary,path);
}
if(flags.has('--check')&&changed.length)throw Error('Stale household material metadata: '+changed.join(', '));
if(!flags.has('--check')&&changed.length)atomicJson('src/modelMaterials.json',metadata);

let auditBytesUpdated=0;
if(flags.has('--canonicalize')){
  const path='assets-source/household-collection-audit.json',audit=readJson(path);
  const byteCounts=Object.fromEntries(selected.map(id=>[id,readFileSync(join(root,`public/models/furniture/${id}.glb`)).length]));
  const refreshed=refreshAuditByteCounts(audit,byteCounts);auditBytesUpdated=refreshed.updated;
  if(flags.has('--check')&&auditBytesUpdated)throw Error('Household audit GLB byte counts are stale');
  if(!flags.has('--check')&&auditBytesUpdated)atomicJson(path,refreshed.audit);
}

let previews=null;
if(flags.has('--previews')){
  const previewIds=selected.filter(id=>{
    if(existsSync(join(root,`assets-source/previews/${id}.png`)))return true;
    if(!flags.has('--available'))throw Error('Missing reviewed source preview: '+id);
    skipped.push(id+' (preview)');return false;
  });
  mkdirSync(join(root,'public/models/previews'),{recursive:true});
  // Import only compress(), avoiding compress-previews.py's all-library PNG migration.
  // One worker bounds memory/CPU, and exact RGBA comparison verifies losslessness.
  const code=`import importlib.util,json,sys\nfrom pathlib import Path\nroot=Path(sys.argv[1]);ids=json.load(sys.stdin)\nspec=importlib.util.spec_from_file_location('nook_preview_compressor',root/'scripts/compress-previews.py')\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\ntotals=[m.compress(root/'assets-source/previews'/f'{i}.png') for i in ids]\nprint(json.dumps({'previews':len(totals),'beforeBytes':sum(a for a,b in totals),'afterBytes':sum(b for a,b in totals),'pixelIdentical':True}))`;
  const p=spawnSync(process.env.PYTHON??'python',['-c',code,root],{input:JSON.stringify(previewIds),encoding:'utf8',windowsHide:true});
  if(p.error||p.status!==0)throw Error('Targeted preview compression failed: '+(p.error?.message??p.stderr));
  previews=JSON.parse(p.stdout.trim());
}

let progressUpdated=false;
if(flags.has('--progress')){
  const progress=readJson('assets-source/household-progress.json');
  const before=JSON.stringify(progress);
  for(const [key,family] of Object.entries(progress.families)){
    const assets=(family.catalogIds??[]).map(id=>({id,
      editableSource:existsSync(join(root,`assets-source/blender/${id}.blend`)),
      glb:existsSync(join(root,`public/models/furniture/${id}.glb`)),
      sourcePreview:existsSync(join(root,`assets-source/previews/${id}.png`)),
      webPreview:existsSync(join(root,`public/models/previews/${id}.webp`))}));
    progress.families[key]=refreshFamilyObservations(family,assets);
  }
  progressUpdated=before!==JSON.stringify(progress);
  if(flags.has('--check')&&progressUpdated)throw Error('Progress file observations are stale; rerun with --progress');
  if(!flags.has('--check')&&progressUpdated)atomicJson('assets-source/household-progress.json',progress);
}
console.log(JSON.stringify({householdIds:allIds.length,selected:selected.length,metadataUpdated:flags.has('--check')?0:changed.length,skipped,canonicalization,auditBytesUpdated,previews,progressUpdated,readOnly:flags.has('--check')}));
