import {compressGeometry} from './compress-model-geometry.mjs';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Extract identical embedded images without changing geometry or image bytes. */
export function shareImages(input,saveImage){
 const jsonLength=input.readUInt32LE(12),g=JSON.parse(input.subarray(20,20+jsonLength).toString());
 if(!g.images?.some(image=>image.bufferView!==undefined))return input;
 if(g.buffers.length!==1)throw new Error('Expected a single GLB buffer');
 const bin=input.subarray(28+jsonLength),imageViews=new Set();
 for(const image of g.images){if(image.bufferView===undefined)continue;const v=g.bufferViews[image.bufferView];const data=bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);const extension=image.mimeType==='image/png'?'png':image.mimeType==='image/jpeg'?'jpg':null;if(!extension)throw new Error('Unsupported embedded image format');
  const filename=createHash('sha256').update(data).digest('hex')+'.'+extension;saveImage(filename,data);imageViews.add(image.bufferView);delete image.bufferView;image.uri='shared-textures/'+filename;
 }
 // Keep all geometry views byte-for-byte; compact indices after image extraction.
 const mapping=new Map(),views=[],parts=[];let offset=0;
 for(const [i,view] of g.bufferViews.entries()){if(imageViews.has(i))continue;mapping.set(i,views.length);const bytes=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);views.push({...view,byteOffset:offset});parts.push(bytes);offset+=bytes.length;const padding=(4-offset%4)%4;if(padding){parts.push(Buffer.alloc(padding));offset+=padding;}}
 const remap=value=>{if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){if(key==='bufferView'){if(!mapping.has(child))throw new Error('Image data also referenced by geometry');value[key]=mapping.get(child);}else remap(child);}};
 remap(g);g.bufferViews=views;g.buffers[0].byteLength=offset;
 let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const binary=Buffer.concat(parts),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,json,binHeader,binary]);
}
export async function optimizeModels(root='dist/client'){
 const folder=join(root,'models/furniture'),shared=join(folder,'shared-textures');mkdirSync(shared,{recursive:true});const images=new Set();let before=0,after=0,imageBytes=0;
 for(const file of readdirSync(folder).filter(f=>f.endsWith('.glb'))){const path=join(folder,file),input=readFileSync(path);before+=input.length;let output=shareImages(input,(name,data)=>{if(images.has(name))return;images.add(name);writeFileSync(join(shared,name),data);imageBytes+=data.length;});if(output.length>1_000_000)output=await compressGeometry(output);writeFileSync(path,output);after+=output.length;}
 console.log(JSON.stringify({modelBytesBefore:before,modelBytesAfter:after,sharedImages:images.size,sharedImageBytes:imageBytes,savedBytes:before-after-imageBytes}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await optimizeModels();
