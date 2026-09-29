import manifest from './arCatalog.json';

export interface ArMaterial {name:string;textured:boolean;alpha:number;variant:boolean;aliases:string[]}
export interface ArCatalogEntry {name:string;widthMm:number;depthMm:number;heightMm:number;assetPath:string;posterPath:string;authoredSizeM:number[];authoredMinM:number[];sourceSha256:string;vertices:number;materials:ArMaterial[]}
export interface ArPiece {v:1;model:string;widthMm:number;depthMm:number;heightMm:number;colors:Record<string,[number,number,number]>}
export interface ArSelection {catalogId:string;widthMm:number;depthMm:number;heightMm:number;variant?:string;materialColors?:Record<string,string>;personalSurface?:unknown;personalItem?:unknown;surfaceVariant?:string}
export const AR_MAX_PAYLOAD=2400;
export const arModels=manifest.models as Record<string,ArCatalogEntry>;
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const finite=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const round=(n:number)=>Math.round(n*1e6)/1e6;
export function arCatalogEntry(id:string):ArCatalogEntry {if(typeof id!=='string'||!own(arModels,id))throw new Error('This piece is not in the measured phone-preview collection yet.');return arModels[id];}
export function validateArPiece(input:unknown):ArPiece {
  const p=input as ArPiece;if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['v','model','widthMm','depthMm','heightMm','colors'].includes(k))||p.v!==1)throw new Error('This piece-preview link is invalid.');
  const model=arCatalogEntry(p.model);
  for(const key of ['widthMm','depthMm','heightMm'] as const)if(!finite(p[key],50,6000)||!finite(p[key]/model[key],.25,4))throw new Error('Phone preview supports dimensions from 50–6,000 mm, within one quarter to four times the authored piece.');
  if(!p.colors||typeof p.colors!=='object'||Array.isArray(p.colors)||Object.keys(p.colors).length>16)throw new Error('Invalid phone-preview colors.');
  const colors:ArPiece['colors']={};
  for(const key of Object.keys(p.colors).sort()){
    const material=model.materials.find(m=>m.name===key&&!m.textured),value=p.colors[key];
    if(!material||!Array.isArray(value)||value.length!==3||!value.every(c=>finite(c,0,1)))throw new Error('A requested color is not supported by this phone-preview model.');
    colors[key]=value.map(round) as [number,number,number];
  }
  return {v:1,model:p.model,widthMm:p.widthMm,depthMm:p.depthMm,heightMm:p.heightMm,colors};
}
/** Selectively copies public catalog configuration. No plan, name, ID, position or image is serialized. */
export function arPieceFromSelection(selected:ArSelection):{piece:ArPiece;omissions:string[]} {
  const entry=arCatalogEntry(selected.catalogId),colors:ArPiece['colors']={},omissions:string[]=[];
  if(selected.personalSurface||selected.personalItem)throw new Error('Phone preview is available for public catalog pieces without personal artwork or private item data.');
  if(selected.materialColors&&Object.keys(selected.materialColors).length>100)throw new Error('Too many material colors.');
  const variants=manifest.variants as Record<string,string>,variant=own(variants,selected.variant??'')?variants[selected.variant!]:variants.sage;
  const rgb=(hex:string)=>{if(!/^#[0-9a-f]{6}$/i.test(hex))throw new Error('Invalid selected color.');return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);};
  for(const material of entry.materials){
    const custom=selected.materialColors?.[material.name]??material.aliases.map(k=>selected.materialColors?.[k]).find(Boolean);
    if(material.textured){if(custom||material.variant)omissions.push(`The authored ${material.name.replace(/-/g,' ')} texture is used; its tint is not transferred.`);continue;}
    if(custom)colors[material.name]=rgb(custom).map(n=>round(Math.pow(n,2.2))) as [number,number,number];
    else if(material.variant)colors[material.name]=rgb(variant).map(n=>round(.1+.9*n)) as [number,number,number];
  }
  if(selected.surfaceVariant)omissions.push('The authored surface finish is used in this preview.');
  const supportedKeys=new Set(entry.materials.flatMap(m=>[m.name,...m.aliases]));if(Object.keys(selected.materialColors??{}).some(k=>!supportedKeys.has(k)))omissions.push('Colors for unavailable material parts are omitted.');
  return {piece:validateArPiece({v:1,model:selected.catalogId,widthMm:selected.widthMm,depthMm:selected.depthMm,heightMm:selected.heightMm,colors}),omissions};
}
export function arScale(piece:ArPiece):[number,number,number] {
  const p=validateArPiece(piece),a=arCatalogEntry(p.model).authoredSizeM;
  return [p.widthMm/1000/a[0],p.heightMm/1000/a[1],p.depthMm/1000/a[2]];
}
export function verifyArDimensions(piece:ArPiece,actual:{x:number;y:number;z:number}):boolean {
  const p=validateArPiece(piece),expected=[p.widthMm/1000,p.heightMm/1000,p.depthMm/1000];
  return [actual.x,actual.y,actual.z].every((n,i)=>finite(n,.001,100)&&Math.abs(n-expected[i])<=Math.max(.002,expected[i]*.002));
}
export function encodeArPiece(piece:ArPiece):string {const json=JSON.stringify(validateArPiece(piece));const encoded=btoa(json).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');if(encoded.length>AR_MAX_PAYLOAD)throw new Error('This preview contains too many color choices for a phone link.');return encoded;}
export function decodeArPiece(encoded:string):ArPiece {
  if(typeof encoded!=='string'||!encoded.length||encoded.length>AR_MAX_PAYLOAD||!/^[a-zA-Z0-9_-]+$/.test(encoded))throw new Error('This piece-preview link is invalid or too large.');
  try{return validateArPiece(JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/'))));}catch(e){if(e instanceof Error&&e.message.startsWith('This piece'))throw e;throw new Error('This piece-preview link has invalid model, dimensions or colors.');}
}
export function arHandoffUrl(piece:ArPiece,currentUrl:string):string {
  const source=new URL(currentUrl);if(source.protocol!=='https:'&&!(source.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(source.hostname)))throw new Error('Open the published HTTPS site to create a phone link.');
  const url=new URL('/',source.origin);url.search='?piece-preview=1';url.hash=`piece=${encodeArPiece(piece)}`;return url.href;
}
export function arPieceFromUrl(url:string):ArPiece {
  const parsed=new URL(url);if(parsed.searchParams.get('piece-preview')!=='1'||parsed.searchParams.getAll('piece-preview').length!==1||[...parsed.searchParams.keys()].some(k=>k!=='piece-preview')||!parsed.hash.startsWith('#piece='))throw new Error('This is not a piece-preview link.');return decodeArPiece(parsed.hash.slice(7));
}
/** Only authored public GLBs and their deduplicated public images may be fetched by model-viewer. */
export function allowedArResource(input:string,origin:string):string {
  if(input.startsWith('blob:')||/^data:image\/(png|jpeg|webp);base64,/i.test(input))return input;
  const url=new URL(input,origin),base=new URL(origin);
  const model=Object.values(arModels).some(e=>new URL(e.assetPath,base).pathname===url.pathname),texture=/^\/models\/furniture\/shared-textures\/[a-f0-9]{64}\.(png|jpg)$/.test(url.pathname);
  if(url.origin!==base.origin||!model&&!texture)throw new Error('The preview requested an unsupported external resource.');return url.href;
}
