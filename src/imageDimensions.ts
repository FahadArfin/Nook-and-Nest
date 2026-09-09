/** Read dimensions before allowing the browser to allocate decoded pixels. */
export function imageDimensions(bytes:Uint8Array):{width:number;height:number}{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=(i:number,n:number)=>String.fromCharCode(...bytes.subarray(i,i+n));
 if(bytes.length>=24&&bytes[0]===137&&text(1,3)==='PNG')return {width:view.getUint32(16),height:view.getUint32(20)};
 if(bytes.length>=30&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
 const kind=text(12,4),u24=(i:number)=>bytes[i]+bytes[i+1]*256+bytes[i+2]*65536;
 if(kind==='VP8X')return {width:u24(24)+1,height:u24(27)+1};
 if(kind==='VP8 ')return {width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};
 if(kind==='VP8L'&&bytes[20]===47)return {width:1+((bytes[21]|bytes[22]<<8)&16383),height:1+((bytes[22]>>6|bytes[23]<<2|bytes[24]<<10)&16383)};
 }
 if(bytes.length>4&&bytes[0]===255&&bytes[1]===216){let i=2;while(i+4<bytes.length){if(bytes[i++]!==255)break;while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;const length=view.getUint16(i);if(length<2||i+length>bytes.length)break;if(marker>=192&&marker<=207&&![196,200,204].includes(marker)&&length>=7)return {width:view.getUint16(i+5),height:view.getUint16(i+3)};i+=length;}}
 throw new Error('This image header could not be read. Export it as PNG or JPEG and try again.');
}
