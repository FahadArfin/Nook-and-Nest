import {allowedArResource,arCatalogEntry,arScale,validateArPiece,verifyArDimensions,type ArPiece} from './arHandoff';

export interface PieceModelViewer extends HTMLElement {src:string;scale:string;canActivateAR:boolean;updateComplete:Promise<boolean>;getDimensions():{x:number;y:number;z:number};updateFraming():void;activateAR():Promise<void>;model?:{materials:{name:string;pbrMetallicRoughness:{baseColorFactor:readonly number[];setBaseColorFactor(value:number[]):void}}[]}}
let loading:Promise<void>|undefined;
export function loadPieceModelViewer():Promise<void> {
  if(loading)return loading;
  loading=(async()=>{
    // The audited pilot has no Draco/KTX2/Lottie. Keep defaults same-origin even if a future asset is malformed.
    const config={dracoDecoderLocation:'/vendor/ar-unsupported/draco/',ktx2TranscoderLocation:'/vendor/ar-unsupported/basis/',lottieLoaderLocation:'/vendor/ar-unsupported/lottie.js'};
    (globalThis as unknown as {ModelViewerElement:unknown}).ModelViewerElement=config;
    const {ModelViewerElement}=await import('@google/model-viewer');
    Object.assign(ModelViewerElement,config);
    ModelViewerElement.mapURLs(url=>allowedArResource(url,location.origin));
    await customElements.whenDefined('model-viewer');
  })().catch(error=>{loading=undefined;throw error;});return loading;
}
/** Apply only allowlisted untextured base-color factors; originals remain unchanged in the viewer's source cache. */
export async function configurePieceViewer(viewer:PieceModelViewer,piece:ArPiece):Promise<{x:number;y:number;z:number}> {
  const p=validateArPiece(piece),entry=arCatalogEntry(p.model);viewer.scale=arScale(p).join(' ');await viewer.updateComplete;
  if(!viewer.model)throw new Error('The furniture model could not be prepared.');
  for(const [name,rgb] of Object.entries(p.colors)){
    const material=viewer.model.materials.find(m=>m.name===name);if(!material||entry.materials.find(m=>m.name===name)?.textured)throw new Error('This model changed and its selected colors could not be checked.');
    material.pbrMetallicRoughness.setBaseColorFactor([...rgb,material.pbrMetallicRoughness.baseColorFactor[3]??1]);
  }
  await viewer.updateComplete;viewer.updateFraming();
  const dimensions=viewer.getDimensions();if(!verifyArDimensions(p,dimensions))throw new Error('The loaded model dimensions differ from this measured preview. AR is unavailable for this asset.');return dimensions;
}
