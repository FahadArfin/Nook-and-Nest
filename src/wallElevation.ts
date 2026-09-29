import {catalog,isWallOpening,defaultMountHeight} from './catalog';
import {floorQuantityGeometry,pointOnPlate,type QuantityWallPlate} from './surfaceGeometry';
import {remainingWallSurface,defaultTakeoffSettings,parseSurfaceTakeoffSettings,surfaceRevision,type SurfaceTakeoffSettings,type TakeoffPlan} from './surfaceTakeoff';
import {geometryParts,unionShapes} from './polygonGeometry';
import {subtractShapes} from './surfaceGeometry';
import type {FloorRect} from './floorGeometry';
export interface WallElevation {projectName:string;floorName:string;wallKey:string;revision:string;lengthMm:number;heightMm:number|null;face:'front'|'back';scale:number;wallPieces:FloorRect[];openings:FloorRect[];fixtures:Array<{name:string;x:number;width:number;bottom:number;height:number;approximate:boolean}>;warnings:string[];notes:string}
export const elevationScales=[10,20,25,50,100] as const;
const names=new Map(catalog.map(c=>[c.id,c.name]));
export function wallElevation(plan:TakeoffPlan,floorId:string,wallKey:string,settings:SurfaceTakeoffSettings=plan.surfaceTakeoffSettings??defaultTakeoffSettings(),options:{face?:'front'|'back';scale?:number;notes?:string}={}):WallElevation {
  const checked=parseSurfaceTakeoffSettings(settings),geometry=floorQuantityGeometry(plan,floorId),plate=geometry.plates.find(p=>p.key===wallKey);if(!plate)throw new Error('This wall changed. Choose a current wall again.');
  const scale=options.scale??50;if(!elevationScales.includes(scale as typeof elevationScales[number]))throw new Error('Choose a supported drawing scale.');
  const face=options.face??'front';if(face!=='front'&&face!=='back')throw new Error('Choose the front or back wall face.');
  const notes=options.notes??'';if(notes.length>1500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(notes))throw new Error('Keep drawing notes within 1,500 characters.');
  // Elevations always show measured openings, regardless of the quantity gross-area option.
  const remaining=remainingWallSurface(geometry,plate,{...checked,deductOpenings:true}),height=plate.heightMm;
  const full=height===null?[]:unionShapes([{x:0,z:0,width:plate.lengthMm,depth:height}]),openings=geometryParts(subtractShapes(full,unionShapes(remaining.pieces))),side=face==='front'?1:-1;
  const warnings=[...remaining.warnings,'Furniture outlines are projected model bounds, not shop drawings. Verify all measurements and mounting details.'];
  if(remaining.unavailable)warnings.push('Some opening measurements are missing; do not use this elevation as a complete opening schedule.');
  const fixtures:WallElevation['fixtures']=[];
  for(const piece of plan.furniture){if(piece.floorId!==floorId||isWallOpening(piece.catalogId))continue;
    const perpendicular=-plate.uz*piece.x+plate.ux*piece.z-plate.line,angle=piece.rotation*Math.PI/180,axisX={x:Math.cos(angle),z:-Math.sin(angle)},axisZ={x:Math.sin(angle),z:Math.cos(angle)};
    const extentNormal=(Math.abs(-plate.uz*axisX.x+plate.ux*axisX.z)*piece.widthMm+Math.abs(-plate.uz*axisZ.x+plate.ux*axisZ.z)*piece.depthMm)/2;
    if(perpendicular*side<-.1||Math.abs(perpendicular)-extentNormal>150||Math.abs(perpendicular)>2000)continue;
    const center=plate.ux*piece.x+plate.uz*piece.z-plate.start,width=Math.abs(plate.ux*axisX.x+plate.uz*axisX.z)*piece.widthMm+Math.abs(plate.ux*axisZ.x+plate.uz*axisZ.z)*piece.depthMm,x=center-width/2;
    if(x+width<0||x>plate.lengthMm)continue;
    const bottom=piece.elevationMm??defaultMountHeight(piece.catalogId)??0;
    if(![x,width,bottom,piece.heightMm].every(Number.isFinite))continue;
    fixtures.push({name:piece.personalItem?.name??names.get(piece.catalogId)??'Unavailable furniture',x,width,bottom,height:piece.heightMm,approximate:true});
  }
  if(fixtures.length>200)throw new Error('This elevation has too many projected fixtures. Select a shorter wall.');
  const mirror=(rect:FloorRect)=>({...rect,x:plate.lengthMm-rect.x-rect.width,...(rect.polygon?{polygon:rect.polygon.map(point=>({...point,x:plate.lengthMm-point.x})).reverse()}:{})});
  return {projectName:plan.name,floorName:geometry.floor.name,wallKey,revision:surfaceRevision(plan,checked),lengthMm:plate.lengthMm,heightMm:height,face,scale,wallPieces:face==='back'?remaining.pieces.map(mirror):remaining.pieces,openings:face==='back'?openings.map(mirror):openings,fixtures:face==='back'?fixtures.map(f=>({...f,x:plate.lengthMm-f.x-f.width})):fixtures,warnings:[...new Set(warnings)],notes};
}
export const escapeDrawingText=(text:unknown)=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const num=(value:number)=>Number(value.toFixed(4));
/** Physical mm SVG: a 1,000 mm model scale bar is exactly 1,000/scale mm on paper. */
export function wallElevationSvg(elevation:WallElevation):string {
  if(elevation.heightMm===null)throw new Error('A measured wall height is required before exporting an elevation.');
  const e=elevation,s=e.scale,measuredHeight=elevation.heightMm,width=e.lengthMm/s,height=measuredHeight/s,left=24,top=32,pageWidth=Math.max(210,width+48),pageHeight=height+105,y=(bottom:number,h=0)=>top+height-(bottom+h)/s;
  const line=(x1:number,y1:number,x2:number,y2:number,extra='')=>`<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" ${extra}/>`;
  const text=(x:number,y:number,value:unknown,size=3)=>`<text x="${num(x)}" y="${num(y)}" font-size="${size}">${escapeDrawingText(value)}</text>`;
  const shape=(p:FloorRect,style:string)=>p.polygon?`<polygon points="${p.polygon.map(point=>`${num(left+point.x/s)},${num(y(point.z))}`).join(' ')}" ${style}/>`:`<rect x="${num(left+p.x/s)}" y="${num(y(p.z,p.depth))}" width="${num(p.width/s)}" height="${num(p.depth/s)}" ${style}/>`;
  const wall=e.wallPieces.map(p=>shape(p,'fill="#eff2e9"')).join('')+`<rect x="${left}" y="${top}" width="${num(width)}" height="${num(height)}" fill="none" stroke="#374c42" stroke-width=".2"/>`;
  const openings=e.openings.map(o=>shape(o,'fill="#fff" stroke="#4d8490" stroke-width=".25" stroke-dasharray="1 .6"')+(o.width/s>12&&o.depth/s>8?text(left+o.x/s+1,y(o.z,o.depth)+4,`${Math.round(o.width)} × ${Math.round(o.depth)} mm`,2.3)+text(left+o.x/s+1,y(o.z,o.depth)+7,`sill ${Math.round(o.z)} mm`,2.1):'')).join('');
  const fixtures=e.fixtures.map(f=>`<rect x="${num(left+f.x/s)}" y="${num(y(f.bottom,f.height))}" width="${num(f.width/s)}" height="${num(f.height/s)}" fill="#e6d2ad" fill-opacity=".2" stroke="#926d37" stroke-width=".25" stroke-dasharray="1 .6"/>${text(left+Math.max(0,f.x)/s+1,y(f.bottom,f.height)+3,f.name,2.1)}${text(left+Math.max(0,f.x)/s+1,y(f.bottom)+3,`base ${Math.round(f.bottom)} mm`,2.1)}`).join('');
  const base=top+height,barLength=1000/s,barY=base+18;
  const wrap=(value:string)=>{const result:string[]=[];let line='';for(const word of value.split(/\s+/)){if((line+' '+word).length>Math.floor(pageWidth*.62)&&line){result.push(line);line='';}line+=(line?' ':'')+word;}if(line)result.push(line);return result;};
  const noteLines=[...e.warnings.flatMap(wrap),...(e.notes?wrap('Notes: '+e.notes):[])],warnings=noteLines.map((warning,i)=>text(10,base+39+i*4,warning,2.5)).join('');
  const contentHeight=base+44+noteLines.length*4;if(pageWidth>1500||Math.max(pageHeight,contentHeight)>1500)throw new Error('Choose a smaller drawing scale or a shorter wall for a printable sheet.');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(pageWidth)}mm" height="${num(Math.max(pageHeight,contentHeight))}mm" viewBox="0 0 ${num(pageWidth)} ${num(Math.max(pageHeight,contentHeight))}" role="img" aria-label="Wall elevation"><title>${escapeDrawingText(e.projectName)} — ${escapeDrawingText(e.floorName)} wall elevation</title><defs><clipPath id="wall-bounds"><rect x="${left}" y="${top}" width="${num(width)}" height="${num(height)}"/></clipPath></defs><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif" fill="#20342b" stroke="none">${text(10,10,`${e.projectName} · ${e.floorName}`,4)}${text(10,16,`Planning elevation · ${e.face} face · 1:${s} · dimensions in mm`,3)}${text(10,21,`Model revision: ${e.revision}`,2.5)}${text(10,26,'Source: saved model dimensions; verify against measured site conditions.',2.5)}<g>${wall}${openings}<g clip-path="url(#wall-bounds)">${fixtures}</g></g><g stroke="#20342b" stroke-width=".2">${line(left,base+8,left+width,base+8)}${line(left,base+5,left,base+11)}${line(left+width,base+5,left+width,base+11)}${line(left-10,top,left-10,base)}${line(left-13,top,left-7,top)}${line(left-13,base,left-7,base)}${line(left,barY,left+barLength,barY,'stroke-width=".7" data-scale-bar-mm="1000"')}${line(left,barY-1,left,barY+1)}${line(left+barLength,barY-1,left+barLength,barY+1)}</g>${text(left+width/2-6,base+6,`${Math.round(e.lengthMm)} mm`)}${text(2,top+height/2,`${Math.round(measuredHeight)} mm`,2.5)}${text(left,barY+5,`Scale check: 1,000 mm = ${num(barLength)} mm printed. Print at 100%; disable fit-to-page.`,2.5)}${text(10,base+31,'Not for construction, structural, electrical or plumbing certification.',2.7)}${warnings}</g></svg>`;
}
export function wallPlateLabel(plate:QuantityWallPlate,index:number){const a=pointOnPlate(plate,0),b=pointOnPlate(plate,plate.lengthMm);return `Wall ${index+1} · ${(plate.lengthMm/1000).toFixed(2)} m · ${plate.boundary?'floor boundary':'partition'} · (${Math.round(a.x)}, ${Math.round(a.z)}) to (${Math.round(b.x)}, ${Math.round(b.z)}) mm`;}
