import {PBRMaterial} from '@babylonjs/core/Materials/PBR/pbrMaterial';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {Color3} from '@babylonjs/core/Maths/math.color';
import type {Scene} from '@babylonjs/core/scene';
import type {SurfaceFinish} from '../surfaces';

/** Shared, mipmapped 1K PBR maps; scene disposal releases the owned textures. */
export function createSurfaceMaterial(scene:Scene,name:string,finish:SurfaceFinish,alpha=1){
 const mat=new PBRMaterial(name,scene);
 mat.albedoColor=Color3.FromHexString(finish.color??'#ffffff').toLinearSpace();
 mat.metallic=0;mat.roughness=finish.roughness??.9;mat.alpha=alpha;
 mat.environmentIntensity=.65;mat.directIntensity=1;mat.specularIntensity=.6;
 const texture=(path:string,gamma:boolean)=>{
  const value=new Texture(path,scene,false,false,Texture.TRILINEAR_SAMPLINGMODE);
  value.gammaSpace=gamma;value.wrapU=value.wrapV=Texture.WRAP_ADDRESSMODE;
  value.uScale=value.vScale=finish.scale;value.anisotropicFilteringLevel=4;return value;
 };
 if(finish.texture)mat.albedoTexture=texture(finish.texture,true);
 if(finish.normalTexture){
  mat.bumpTexture=texture(finish.normalTexture,false);mat.bumpTexture.level=finish.normalStrength??.3;
  // NormalGL maps follow the same handedness conversion as Babylon's glTF loader.
  mat.invertNormalMapX=!scene.useRightHandedSystem;mat.invertNormalMapY=scene.useRightHandedSystem;
  mat.forceIrradianceInFragment=true;
 }
 if(finish.ormTexture){
  mat.metallicTexture=texture(finish.ormTexture,false);
  mat.useRoughnessFromMetallicTextureAlpha=false;mat.useRoughnessFromMetallicTextureGreen=true;
  mat.useMetallnessFromMetallicTextureBlue=true;mat.useAmbientOcclusionFromMetallicTextureRed=true;
 }
 if(alpha<1){mat.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;mat.forceDepthWrite=false;}
 return mat;
}
