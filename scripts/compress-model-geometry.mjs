import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';

export const parseGlb = data => {
 const length=data.readUInt32LE(12);
 return {g:JSON.parse(data.subarray(20,20+length)),bin:data.subarray(28+length)};
};
function pack(g,bin){
 let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const header=Buffer.alloc(20),tail=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(bin.length);tail.writeUInt32LE(0x004e4942,4);
 return Buffer.concat([header,json,tail,bin]);
}
/** Lossless storage only: no quantization, simplification, filters or triangle reordering. */
export async function compressGeometry(input){
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
 const {g,bin}=parseGlb(input);
 if(g.extensionsUsed?.includes('EXT_meshopt_compression'))return input;
 const parts=[];let offset=0,fallbackOffset=0,compressed=0;
 for(const [index,view] of g.bufferViews.entries()){
  const raw=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  const accessors=(g.accessors??[]).filter(a=>a.bufferView===index);
  const a=accessors.length===1?accessors[0]:null;
  const isIndex=view.target===34963&&a?.type==='SCALAR'&&[5123,5125].includes(a.componentType);
  const mode=isIndex?'INDICES':'ATTRIBUTES';
  const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const stride=isIndex?(a.componentType===5123?2:4):(view.byteStride??(a?.componentType===5126?components[a.type]*4:4));
  const eligible=stride>=2&&stride<=256&&raw.length%stride===0&&(isIndex||stride%4===0);
  let encoded=eligible?Buffer.from(MeshoptEncoder.encodeGltfBuffer(raw,raw.length/stride,stride,mode,0)):raw;
  if(eligible&&encoded.length+180<raw.length){
   const decoded=new Uint8Array(raw.length);MeshoptDecoder.decodeGltfBuffer(decoded,raw.length/stride,stride,encoded,mode);
   if(!raw.equals(decoded))throw new Error('Compression changed geometry bytes');
   view.extensions={...view.extensions,EXT_meshopt_compression:{buffer:0,byteOffset:offset,byteLength:encoded.length,byteStride:stride,count:raw.length/stride,mode,filter:'NONE'}};
   view.buffer=1;view.byteOffset=fallbackOffset;fallbackOffset+=raw.length;fallbackOffset+=(4-fallbackOffset%4)%4;compressed++;
  }else{encoded=raw;view.buffer=0;view.byteOffset=offset;}
  parts.push(encoded);offset+=encoded.length;const padding=(4-offset%4)%4;parts.push(Buffer.alloc(padding));offset+=padding;
 }
 if(!compressed)return input;
 g.buffers=[{byteLength:offset},{byteLength:fallbackOffset,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 g.extensionsUsed=[...new Set([...(g.extensionsUsed??[]),'EXT_meshopt_compression'])];
 g.extensionsRequired=[...new Set([...(g.extensionsRequired??[]),'EXT_meshopt_compression'])];
 const output=pack(g,Buffer.concat(parts));return output.length<input.length?output:input;
}
