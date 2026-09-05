// Shared, bounded contract for untrusted vision output. Coordinates are in image pixels.
export const detectedKinds=['Living','Bedroom','Dining','Office','Kitchen','Bathroom','Laundry','Hall','Outdoor','Closet'] as const;
export const fixtureKinds=['window-picture','door-flush','door-bifold','refrigerator','range-oven','dishwasher','sink-cabinet','kitchen-counter','washer','dryer','stacked-laundry','single-bath-vanity','two-piece-toilet','alcove-bathtub','corner-shower'] as const;
export interface ScanRoom {roomId?:string;name:string;kind:typeof detectedKinds[number];x:number;y:number;width:number;height:number;enclosed:boolean;note:string}
export interface ScanDimension {text:string;millimetres:number;ax:number;ay:number;bx:number;by:number}
export interface ScanFixture {catalogId:typeof fixtureKinds[number];x:number;y:number;width:number;depth:number;rotation:number}
export interface Recognition {rooms:ScanRoom[];dimensions:ScanDimension[];fixtures:ScanFixture[];warnings:string[]}
const number={type:'number'},string={type:'string',maxLength:1000};
const obj=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const array=(items:unknown)=>({type:'array',items});
export const recognitionSchema=obj({
  rooms:array(obj({roomId:{type:'string',maxLength:100},name:string,kind:{type:'string',enum:detectedKinds},x:number,y:number,width:number,height:number,enclosed:{type:'boolean'},note:string})),
  dimensions:array(obj({text:string,millimetres:number,ax:number,ay:number,bx:number,by:number})),
  fixtures:array(obj({catalogId:{type:'string',enum:fixtureKinds},x:number,y:number,width:number,depth:number,rotation:{type:'number',enum:[0,90,180,270]}})),warnings:array(string),
});
export function validateRecognition(value:unknown,width:number,height:number):Recognition {
  const r=value as Recognition;
  const finite=(...ns:number[])=>ns.every(n=>typeof n==='number'&&Number.isFinite(n));
  const text=(s:string,max=1000)=>typeof s==='string'&&s.length<=max;
  const point=(x:number,y:number)=>finite(x,y)&&x>=0&&y>=0&&x<=width&&y<=height;
  if(!r||!Array.isArray(r.rooms)||!r.rooms.length||r.rooms.length>100||!Array.isArray(r.dimensions)||r.dimensions.length>30||!Array.isArray(r.fixtures)||r.fixtures.length>150||!Array.isArray(r.warnings)||r.warnings.length>30)throw new Error('The scan did not produce a usable floor plan. Try a clearer floor-plan page.');
  for(const room of r.rooms)if(!room||!text(room.name,100)||!room.name.trim()||!detectedKinds.includes(room.kind)||!point(room.x,room.y)||!finite(room.width,room.height)||room.width<1||room.height<1||!point(room.x+room.width,room.y+room.height)||typeof room.enclosed!=='boolean'||!text(room.note))throw new Error('The detected room geometry is invalid. Try analyzing again.');
  for(const room of r.rooms)if(room.roomId!==undefined&&(!text(room.roomId,100)||!room.roomId.trim()))throw new Error('The detected room identity is invalid. Try analyzing again.');
  for(const d of r.dimensions)if(!d||!text(d.text,100)||!d.text.trim()||!finite(d.millimetres)||d.millimetres<100||d.millimetres>60000||!point(d.ax,d.ay)||!point(d.bx,d.by)||Math.hypot(d.bx-d.ax,d.by-d.ay)<5)throw new Error('A printed dimension could not be read reliably. Try a clearer image.');
  for(const f of r.fixtures)if(!f||!fixtureKinds.includes(f.catalogId)||!point(f.x,f.y)||!finite(f.width,f.depth,f.rotation)||f.width<1||f.depth<1||f.width>width||f.depth>height||![0,90,180,270].includes(f.rotation))throw new Error('The detected fixtures are invalid. Try analyzing again.');
  if(r.warnings.some(w=>!text(w)))throw new Error('Invalid analysis notes.');
  return r;
}
export function scaleAssessment(r:Recognition):{scale?:number;warnings:string[]} {
  const evidence=r.dimensions.map((d,index)=>({index,scale:d.millimetres/Math.hypot(d.bx-d.ax,d.by-d.ay)}));
  const usable=evidence.filter(e=>e.scale>=.1&&e.scale<=200).sort((a,b)=>a.scale-b.scale);
  // A unique, strict majority must agree within a 20% total range. Tied clusters
  // (including two incompatible dimensions) require human review, not guessing.
  const clusters=usable.map((start,i)=>usable.slice(i).filter(e=>e.scale/start.scale<=1.2));
  const size=Math.max(0,...clusters.map(c=>c.length)),best=clusters.filter(c=>c.length===size);
  if(!size||best.length!==1||size<=evidence.length/2)return {warnings:[evidence.length?'The detected measurements imply different scales. Check one printed measurement and its highlighted endpoints.':'No printed measurement was read. Mark one measured span and enter its printed length.']};
  const chosen=best[0],scale=chosen[Math.floor(chosen.length/2)].scale;
  const ignored=evidence.filter(e=>!chosen.some(c=>c.index===e.index));
  return {scale,warnings:ignored.length?[`Scale uses ${chosen.length} consistent measurements. Check these conflicting readings: ${ignored.map(e=>r.dimensions[e.index].text).join(', ')}. They were excluded from scaling.`]:[]};
}
export function recognizedScale(r:Recognition):number {
  const assessment=scaleAssessment(r);
  if(assessment.scale===undefined)throw new Error(r.dimensions.length?'The detected measurements disagree. Review one printed dimension to set scale without another analysis.':'No readable printed dimensions were found. Set one measured span without another analysis.');
  return assessment.scale;
}
