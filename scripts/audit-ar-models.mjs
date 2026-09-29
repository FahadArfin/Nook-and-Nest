import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {Matrix4,Quaternion,Vector3} from 'three';
import {build} from 'esbuild';

/** Deliberately small, static, floor-standing pilot. Add models only after this audit passes. */
export const AR_MODEL_IDS=['sofa','loveseat','armchair','ottoman','coffee-table','side-table','dining-table','dining-chair','round-table','bar-stool','desk','office-chair','midcentury-sofa','sleeper-sofa','nesting-tables','drawer-side-table','tray-side-table','c-side-table','wingback-chair','slat-lounge-chair'];
export function inspectArGlb(bytes) {
  const b=Buffer.from(bytes);if(b.length<28||b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length||b.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB');
  const jsonLength=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+jsonLength).toString()),binaryStart=28+jsonLength;
  if(g.animations?.length||g.skins?.length||g.nodes?.length>4096||g.extensionsRequired?.some(x=>x!=='KHR_materials_unlit'))throw Error('Pilot audit requires a static uncompressed authored GLB');
  if(g.buffers?.length!==1||g.buffers[0].uri)throw Error('Unexpected external geometry');
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity],nominals=[],visited=new Set();let vertices=0;
  const visit=(index,parent)=>{
    if(visited.has(index))throw Error('Repeated/cyclic scene nodes are unsupported');visited.add(index);
    const node=g.nodes[index];if(!node||node.extensions?.EXT_mesh_gpu_instancing)throw Error('Unsupported scene node');
    const local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3(...node.translation??[0,0,0]),new Quaternion(...node.rotation??[0,0,0,1]),new Vector3(...node.scale??[1,1,1]));
    const world=parent.clone().multiply(local),extras=node.extras;
    if(extras?.nominal_width_m)nominals.push([extras.nominal_width_m,extras.nominal_height_m,extras.nominal_depth_m]);
    if(node.mesh!==undefined)for(const primitive of g.meshes[node.mesh].primitives){
      const a=g.accessors[primitive.attributes.POSITION],view=g.bufferViews[a.bufferView];
      if(a.type!=='VEC3'||a.componentType!==5126||a.sparse||view.extensions||a.count>1_000_000)throw Error('Pilot audit expects bounded float positions');
      const offset=binaryStart+(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??12;
      for(let i=0;i<a.count;i++){const start=offset+i*stride;if(start+12>b.length)throw Error('Invalid position buffer');const p=new Vector3(b.readFloatLE(start),b.readFloatLE(start+4),b.readFloatLE(start+8)).applyMatrix4(world);for(let axis=0;axis<3;axis++){const n=p.getComponent(axis);if(!Number.isFinite(n))throw Error('Nonfinite geometry');low[axis]=Math.min(low[axis],n);high[axis]=Math.max(high[axis],n);}vertices++;}
    }
    for(const child of node.children??[])visit(child,world);
  };
  for(const root of g.scenes[g.scene??0].nodes)visit(root,new Matrix4());
  if(!vertices)throw Error('Empty model');
  return {low,high,size:high.map((n,i)=>n-low[i]),vertices,nominals,materials:(g.materials??[]).map(m=>({name:m.name,textured:!!m.pbrMetallicRoughness?.baseColorTexture,alpha:m.pbrMetallicRoughness?.baseColorFactor?.[3]??1})),sourceSha256:createHash('sha256').update(b).digest('hex')};
}
export async function auditArCatalog(repo,output){
  const file=p=>JSON.stringify(resolve(repo,p).replace(/\\/g,'/'));
  const bundled=await build({stdin:{contents:`export {catalog,variants} from ${file('src/catalog.ts')}; export {modelAssetPath} from ${file('src/modelAssetPath.ts')}; export {default as aliases} from ${file('src/modernMaterialAliases.json')};`,resolveDir:repo},bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env.DEV':'false'}});
  const {catalog,variants,modelAssetPath,aliases}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  const models={};
  for(const id of AR_MODEL_IDS){
    const c=catalog.find(c=>c.id===id);if(!c||c.mount&&c.mount!=='floor')throw Error(`Invalid floor-standing pilot item: ${id}`);
    const audit=inspectArGlb(readFileSync(resolve(repo,`public/models/furniture/${id}.glb`))),nominal=[c.widthMm,c.heightMm,c.depthMm].map(n=>n/1000);
    if(audit.size.some((n,i)=>Math.abs(n-nominal[i])>Math.max(.001,nominal[i]*.005))||Math.abs(audit.low[1])>.001)throw Error(`Physical authored bounds differ from catalog or ground: ${id}`);
    if(audit.nominals.some(d=>d.some((n,i)=>Math.abs(n-nominal[i])>.00001)))throw Error(`Nominal metadata mismatch: ${id}`);
    if(audit.materials.some(m=>!m.name||m.name.length>100)||new Set(audit.materials.map(m=>m.name)).size!==audit.materials.length)throw Error(`Material identities need review: ${id}`);
    models[id]={name:c.name,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,assetPath:modelAssetPath(id),posterPath:modelAssetPath(id,true),authoredSizeM:audit.size,authoredMinM:audit.low,sourceSha256:audit.sourceSha256,vertices:audit.vertices,materials:audit.materials.map(m=>({...m,variant:m.name.includes('upholstery-textured')||m.name.includes('variant-surface')||m.name.includes('door-surface')||m.name==='ceramic-tiles',aliases:aliases[id]?.[m.name]??[]}))};
  }
  writeFileSync(output,JSON.stringify({version:1,axes:'right-handed-y-up-metres',models,variants},null,2)+'\n');return models;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const models=await auditArCatalog(resolve(process.argv[2]??'.'),resolve(process.argv[3]??'src/arCatalog.json'));console.log(JSON.stringify({auditedModels:Object.keys(models).length,axes:'X width, Y height, Z depth in metres',sourceFilesUnchanged:true}));}
