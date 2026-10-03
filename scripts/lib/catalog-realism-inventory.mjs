import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,realpathSync,existsSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';

export const CATALOG_REALISM_COUNT=902;
export const REQUIRED_REVIEW_VIEWS=Object.freeze(['front','rear','detail','underside','clay']);
const SHA256=/^[a-f0-9]{64}$/;
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):Object.is(value,-0)?0:value;
export const canonicalJson=value=>JSON.stringify(sorted(value));
export function hashCatalogContract(item){
  const {contractSha256,state,...contract}=item;
  return sha256(canonicalJson(contract));
}
export function hashCatalogInventory(manifest){
  const {catalogSha256,...contract}=manifest;
  // Relocating exact baseline source bytes into immutable storage does not
  // create a new catalog. Bind their original path and hash as before, while
  // allowing only the deterministic snapshot location (never an arbitrary alias).
  if(contract.sourceInputs)contract.sourceInputs=contract.sourceInputs.map(record=>{
    if(record.sourcePath===undefined)return record;
    const {sourcePath,...original}=record;
    assert(typeof sourcePath==='string'&&sourcePath.startsWith('src/')&&!sourcePath.includes('\\')&&!sourcePath.split('/').some(part=>!part||part==='.'||part==='..'),'Invalid original snapshot source path');
    assert.equal(record.path,'assets-source/catalog-realism/baseline-inputs/'+sourcePath,'Invalid immutable snapshot path');
    return {...original,path:sourcePath};
  });
  return sha256(canonicalJson(contract));
}

/** A local repository path, never an absolute path or an escaping symlink. */
export function resolveCatalogPath(root,relative){
  assert(typeof relative==='string'&&relative.length&&!path.isAbsolute(relative)&&!relative.includes('\\')&&!relative.split('/').includes('..'),'Invalid repository-relative asset path');
  root=realpathSync(root);
  const filename=path.resolve(root,relative),inside=path.relative(root,filename);
  assert(inside&&!inside.startsWith('..'+path.sep)&&inside!=='..'&&!path.isAbsolute(inside),'Asset path escapes repository');
  // Check existing parents as well as existing files, so a future output cannot
  // traverse a directory junction out of this checkout.
  let current=filename;
  while(!existsSync(current))current=path.dirname(current);
  const realRelative=path.relative(root,realpathSync(current));
  assert(!realRelative.startsWith('..'+path.sep)&&realRelative!=='..'&&!path.isAbsolute(realRelative),'Asset symlink escapes repository');
  return filename;
}
export function catalogFileRecord(root,relative){
  const filename=resolveCatalogPath(root,relative),bytes=readFileSync(filename);
  assert(bytes.length>0,`Empty asset: ${relative}`);
  return {path:relative,sha256:sha256(bytes),bytes:bytes.length};
}

export function readGlbDocument(bytes){
  assert(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array,'GLB bytes required');
  bytes=Buffer.from(bytes);
  assert(bytes.length>=20&&bytes.toString('ascii',0,4)==='glTF'&&bytes.readUInt32LE(4)===2,'Invalid GLB header');
  assert(bytes.readUInt32LE(8)===bytes.length,'GLB length mismatch');
  let offset=12,document,binary=Buffer.alloc(0),chunks=0;
  while(offset<bytes.length){
    assert(offset+8<=bytes.length,'Truncated GLB chunk');
    const length=bytes.readUInt32LE(offset),kind=bytes.readUInt32LE(offset+4);offset+=8;
    assert(length%4===0&&offset+length<=bytes.length,'Invalid GLB chunk length');
    const contents=bytes.subarray(offset,offset+length);
    if(chunks===0)assert(kind===0x4e4f534a,'GLB first chunk must be JSON');
    if(kind===0x4e4f534a){assert(document===undefined,'Duplicate GLB JSON chunk');document=JSON.parse(contents.toString('utf8').trimEnd());}
    else if(kind===0x004e4942){assert(binary.length===0,'Duplicate GLB binary chunk');binary=contents;}
    offset+=length;chunks++;
  }
  assert(document?.asset?.version==='2.0','GLB glTF 2.0 document required');
  return {document,binary};
}

function gltfContract(document,binary){
  const images=(document.images??[]).map((image,index)=>{
    assert(image.bufferView!==undefined,`Baseline image ${index} must be embedded in its GLB`);
    const view=document.bufferViews?.[image.bufferView];
    assert(view&&view.buffer===0&&Number.isInteger(view.byteLength)&&view.byteLength>0,'Invalid baseline image buffer view');
    const offset=view.byteOffset??0;assert(Number.isInteger(offset)&&offset>=0&&offset+view.byteLength<=binary.length,'Baseline image escapes GLB buffer');
    const bytes=binary.subarray(offset,offset+view.byteLength);
    return {index,name:image.name,mimeType:image.mimeType,sha256:sha256(bytes),bytes:bytes.length};
  });
  return sorted({materials:document.materials??[],nodes:document.nodes??[],scenes:document.scenes??[],scene:document.scene??0,
    animations:document.animations??[],skins:document.skins??[],extensionsUsed:document.extensionsUsed??[],extensionsRequired:document.extensionsRequired??[],
    images,textures:document.textures??[],samplers:document.samplers??[]});
}
function gltfCost(document,bytes){
  const primitives=(document.meshes??[]).flatMap(mesh=>mesh.primitives??[]);
  const triangles=primitives.reduce((sum,primitive)=>{
    const count=document.accessors?.[primitive.indices??primitive.attributes?.POSITION]?.count??0;
    return sum+((primitive.mode??4)===4?count/3:0);
  },0);
  return {bytes,triangles,primitives:primitives.length};
}

/** Bundle the app's real joins and mounting helpers; no regex catalog parsing. */
export async function readRuntimeCatalog(root){
  root=realpathSync(root);
  const compiled=await build({absWorkingDir:root,stdin:{contents:`
    export {catalog,defaultMountHeight,isDoor,isWindow,isStairs,isWallOpening} from './src/catalog.ts';
    export {furnitureType} from './src/library.ts';
    export {shelfSurfaces} from './src/shelfSurfaces.ts';
    export {supportsDesktop} from './src/tabletop.ts';
    export {supportFootprint} from './src/supportFootprint.ts';
  `,resolveDir:root,sourcefile:'catalog-realism-runtime.ts',loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,metafile:true,logLevel:'silent'});
  const runtime=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const materialControls=JSON.parse(readFileSync(path.join(root,'src/modelMaterials.json'),'utf8'));
  const aliases=JSON.parse(readFileSync(path.join(root,'src/modernMaterialAliases.json'),'utf8'));
  const slots=JSON.parse(readFileSync(path.join(root,'src/personalSurfaceSlots.json'),'utf8'));
  const contractFiles=['src/modelMaterials.json','src/modernMaterialAliases.json','src/personalSurfaceSlots.json',
    'src/scene/LivingModels.ts','src/scene/LiveClocks.ts','src/scene/SlidingDoors.ts','src/scene/HolidayBranches.ts','src/scene/FurnitureModelLibrary.ts','src/scene/planCoordinates.ts'];
  const inputPaths=[...new Set([...Object.keys(compiled.metafile.inputs).filter(name=>name!=='catalog-realism-runtime.ts'&&!name.startsWith('<')).map(name=>name.replaceAll('\\','/')),...contractFiles])].sort();
  const details={};
  for(const item of runtime.catalog){
    const placement={...item,id:'inventory:'+item.id,catalogId:item.id,floorId:'inventory',x:0,z:0,rotation:0,elevationMm:0};
    details[item.id]={family:runtime.furnitureType(item),materialControls:materialControls[item.id],materialAliases:aliases[item.id]??{},personalSurfaceSlots:(slots.models[item.id]??[]).map(index=>slots.roles[index]),
      supportSurfaces:{shelves:runtime.shelfSurfaces(placement),supportsDesktop:runtime.supportsDesktop(placement),footprint:runtime.supportFootprint(placement),defaultMountHeightMm:runtime.defaultMountHeight(item.id)??null},
      placementCapabilities:{door:runtime.isDoor(item.id),window:runtime.isWindow(item.id),stairs:runtime.isStairs(item.id),wallOpening:runtime.isWallOpening(item.id)}};
  }
  return {catalog:runtime.catalog,details,sourceInputs:inputPaths.map(relative=>catalogFileRecord(root,relative))};
}

export async function createCatalogInventory(root,{runtime,expectedCount=CATALOG_REALISM_COUNT}={}){
  root=realpathSync(root);runtime??=await readRuntimeCatalog(root);
  assert(Array.isArray(runtime.catalog),'Runtime catalog required');
  assert.equal(runtime.catalog.length,expectedCount,`Catalog coverage differs from the frozen ${expectedCount}-item scope`);
  const seen=new Set(),items=[];
  for(const item of [...runtime.catalog].sort((a,b)=>a.id.localeCompare(b.id,'en'))){
    assert(ID.test(item.id),`Invalid catalog id: ${item.id}`);assert(!seen.has(item.id),`Duplicate catalog id: ${item.id}`);seen.add(item.id);
    const dimensionsMm=[item.widthMm,item.depthMm,item.heightMm];
    assert(dimensionsMm.every(value=>Number.isFinite(value)&&value>0),`Invalid dimensions: ${item.id}`);
    const sourceBlend=catalogFileRecord(root,`assets-source/blender/${item.id}.blend`),baselineGlb=catalogFileRecord(root,`public/models/furniture/${item.id}.glb`),preview=catalogFileRecord(root,`public/models/previews/${item.id}.webp`);
    const {document,binary}=readGlbDocument(readFileSync(resolveCatalogPath(root,baselineGlb.path)));
    const detail=runtime.details[item.id];assert(detail?.materialControls?.length,`Missing material controls: ${item.id}`);
    const materialKeys=(document.materials??[]).map(material=>material.name);
    assert(materialKeys.length&&materialKeys.every(name=>typeof name==='string'&&name.length)&&new Set(materialKeys).size===materialKeys.length,`Invalid material keys: ${item.id}`);
    const record=sorted({id:item.id,name:item.name,category:item.category,family:detail.family,shape:item.shape,mount:item.mount,dimensionsMm,
      sourceBlend,baselineGlb,preview,materialKeys,materialControls:detail.materialControls,materialAliases:detail.materialAliases??{},personalSurfaceSlots:detail.personalSurfaceSlots??[],
      baselineGltf:gltfContract(document,binary),supportSurfaces:detail.supportSurfaces,placementCapabilities:detail.placementCapabilities??{},baselineCost:gltfCost(document,baselineGlb.bytes),
      outputs:{sourceBlend:`assets-source/catalog-realism/candidates/${item.id}.blend`,glb:`public/experiments/catalog-realism/models/${item.id}.glb`,receipt:`assets-source/catalog-realism/receipts/${item.id}.json`},state:'pending'});
    record.contractSha256=hashCatalogContract(record);items.push(record);
  }
  const sourceInputs=runtime.sourceInputs.map(record=>catalogFileRecord(root,record.path)).sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const manifest={version:1,scope:'beta-only',expectedCount,sourceInputs,items};
  return {...manifest,catalogSha256:hashCatalogInventory(manifest)};
}

function requireRecord(root,record,expectedPath,label){
  assert(record&&typeof record.path==='string'&&SHA256.test(record.sha256??''),`Invalid ${label} hash record`);
  if(expectedPath)assert.equal(record.path,expectedPath,`${label} path differs from frozen output`);
  const actual=catalogFileRecord(root,record.path);
  if(actual.sha256!==record.sha256||(record.bytes!==undefined&&actual.bytes!==record.bytes))throw Object.assign(new Error(`${label} hash changed: ${record.path}`),{stale:true});
  return actual;
}
function validateManifest(manifest){
  assert(manifest?.version===1&&manifest.scope==='beta-only'&&Array.isArray(manifest.items)&&Array.isArray(manifest.sourceInputs),'Invalid catalog manifest');
  assert.equal(manifest.items.length,manifest.expectedCount,'Manifest coverage mismatch');
  assert.equal(new Set(manifest.items.map(item=>item.id)).size,manifest.items.length,'Duplicate manifest catalog IDs');
  assert.equal(manifest.catalogSha256,hashCatalogInventory(manifest),'Catalog manifest hash changed');
  for(const item of manifest.items){assert(ID.test(item.id),'Invalid catalog id');assert.equal(item.contractSha256,hashCatalogContract(item),`Item contract changed: ${item.id}`);}
}

/** Read-only progress. File presence or a generator's success is never review. */
export async function catalogStatus(root,manifest,{inspectCandidate}={}){
  root=realpathSync(root);validateManifest(manifest);
  let sourceFailure;
  try{for(const record of manifest.sourceInputs)requireRecord(root,record,record.path,'Source input');}catch(error){sourceFailure=error.message;}
  const counts={pending:0,processed:0,reviewed:0,stale:0,failed:0},items=[];
  for(const item of manifest.items){
    let state='pending',reason;
    try{
      if(sourceFailure)throw Object.assign(new Error(sourceFailure),{stale:true});
      try{for(const field of ['sourceBlend','baselineGlb','preview'])requireRecord(root,item[field],item[field].path,'Baseline '+field);}catch(error){throw Object.assign(error,{stale:true});}
      const receiptPath=resolveCatalogPath(root,item.outputs.receipt);
      if(existsSync(receiptPath)){
        assert(statSync(receiptPath).size<=4*1024*1024,'Receipt exceeds 4 MiB');
        const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
        assert(receipt.version===1&&receipt.catalogId===item.id,'Receipt catalog identity mismatch');
        if(receipt.inputContractSha256!==item.contractSha256)throw Object.assign(new Error('Receipt input contract is stale'),{stale:true});
        assert(['processed','reviewed'].includes(receipt.state),receipt.error??'Receipt has not completed processing');
        assert(Array.isArray(receipt.inputs)&&receipt.inputs.length,'Receipt must bind builder and material inputs');
        for(const input of receipt.inputs)requireRecord(root,input,null,'Receipt input');
        assert(Array.isArray(receipt.changes)&&receipt.changes.length&&receipt.changes.every(change=>change&&typeof change.kind==='string'&&change.kind),'Receipt requires explicit nonempty changes');
        for(const field of ['sourceBlend','glb'])requireRecord(root,receipt.outputs?.[field],item.outputs[field],'Candidate '+field);
        const inspect=inspectCandidate??(await import('./catalog-realism-validate.mjs')).inspectCandidate;
        const result=await inspect(root,item,receipt);
        assert(result?.ok,result?.issues?.map(issue=>typeof issue==='string'?issue:issue.message??JSON.stringify(issue)).join('; ')||'Candidate validation failed');
        state='processed';
        if(receipt.state==='reviewed'||receipt.review?.decision==='approved'){
          assert(receipt.review?.decision==='approved','Reviewed receipt requires explicit approval');
          if(receipt.review.artifactSetSha256!==result.artifactSetSha256)throw Object.assign(new Error('Review artifact set is stale'),{stale:true});
          assert(Array.isArray(receipt.renders)&&receipt.renders.length===REQUIRED_REVIEW_VIEWS.length,'Review requires exactly five rendered views');
          for(const view of REQUIRED_REVIEW_VIEWS){
            const matches=receipt.renders.filter(render=>render.view===view);assert.equal(matches.length,1,`Review is missing ${view}`);
            requireRecord(root,matches[0],null,'Review '+view);
            assert(typeof receipt.review.views?.[view]==='string'&&receipt.review.views[view].trim().length>=12,`Review needs ${view} observations`);
          }
          assert.equal(result.stats?.visualReview,'approved','Candidate visual review is not current');state='reviewed';
        }
      }
    }catch(error){state=error.stale?'stale':'failed';reason=error.message;}
    counts[state]++;items.push({id:item.id,state,...(reason?{reason}:{})});
  }
  const receiptsDirectory=resolveCatalogPath(root,'assets-source/catalog-realism/receipts');
  const knownIds=new Set(manifest.items.map(item=>item.id));
  const orphanReceipts=existsSync(receiptsDirectory)?readdirSync(receiptsDirectory).filter(name=>name.endsWith('.json')&&!knownIds.has(name.slice(0,-5))).sort():[];
  return {version:1,scope:'beta-only',total:items.length,catalogSha256:manifest.catalogSha256,counts,allReviewed:counts.reviewed===items.length&&!orphanReceipts.length,orphanReceipts,items};
}
