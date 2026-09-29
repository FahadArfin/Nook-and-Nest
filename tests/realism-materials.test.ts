import {it,expect} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {PBRMaterial} from '@babylonjs/core/Materials/PBR/pbrMaterial';
import {floorFinishes,wallFinishes,findWallFinish} from '../src/surfaces';
import {createSurfaceMaterial} from '../src/scene/surfaceMaterials';
import {createRealismReview} from '../src/realismReview';
import {parsePlan,serializePlan} from '../src/domain';
import {FurnitureModelLibrary} from '../src/scene/FurnitureModelLibrary';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {variants} from '../src/catalog';

it('retains saved finish IDs and physical slab sizes while shipping licensed PBR maps',()=>{
 const floor=floorFinishes.find(f=>f.id==='honey-oak')!;
 expect(floor.repeatMeters).toEqual([2.08,2.08]);
 expect(floorFinishes.find(f=>f.id==='studio-calacatta-80x160')?.repeatMeters).toEqual([.8,1.6]);
 for(const list of [floorFinishes,wallFinishes]){
  expect(new Set(list.map(f=>f.id)).size).toBe(list.length);
  for(const finish of list)for(const key of ['texture','normalTexture','ormTexture'] as const){const file=finish[key];if(file)expect(existsSync('public'+file),finish.id+'/'+key).toBe(true);}
 }
 const sources=JSON.parse(readFileSync('assets-source/realism-materials.json','utf8'));
 for(const record of Object.values(sources.materials) as {license:string;source:string;repeatM:number}[]){expect(record.license).toBe('CC0-1.0');expect(record.source).toMatch(/^https:\/\/(polyhaven|ambientcg)\.com\//);expect(record.repeatM).toBeGreaterThan(.1);}
 const before=createRealismReview();expect(parsePlan(serializePlan(before))).toEqual(before);
});

it('recolors sofa fabric and seams together while retaining texture maps and independent saved part colors',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),library=new FurnitureModelLibrary(scene,{} as never,()=>{});
 try{
  const sofa=createRealismReview().furniture.find(p=>p.catalogId==='sofa')!;
  const fabric=new PBRMaterial('upholstery-textured',scene),seam=new PBRMaterial('modern-tailored-welting',scene);
  fabric.albedoTexture=new Texture('/textures/realism/material-chenille-color.jpg',scene);fabric.bumpTexture=new Texture('/textures/realism/material-chenille-normal.jpg',scene);fabric.metallicTexture=new Texture('/textures/realism/material-chenille-orm.jpg',scene);
  fabric.bumpTexture.gammaSpace=false;fabric.metallicTexture.gammaSpace=false;fabric.bumpTexture.level=.38;
  const recolor=(source:PBRMaterial,item=sofa)=>(library as any).materialFor(source,item,false) as PBRMaterial;
  const terracotta={...sofa,variant:'terracotta'};
  const changed=recolor(fabric,terracotta),trim=recolor(seam,terracotta),expected=Color3.FromHexString(variants.terracotta).toLinearSpace();
  expect(changed.albedoColor).toEqual(expected);expect(trim.albedoColor).toEqual(expected.scale(.72));
  for(const channel of ['albedoTexture','bumpTexture','metallicTexture'] as const){expect(changed[channel]?.name).toBe(fabric[channel]?.name);expect(changed[channel]?.gammaSpace).toBe(fabric[channel]?.gammaSpace);}
  expect(changed.bumpTexture?.level).toBe(.38);
  const saved=recolor(seam,{...terracotta,materialColors:{'modern-tailored-welting':'#123456'}});
  expect(saved.albedoColor).toEqual(Color3.FromHexString('#123456').toLinearSpace());
  expect(recolor(seam).albedoColor).not.toEqual(trim.albedoColor);
  const independent=recolor(seam,{...terracotta,catalogId:'everyday-sectional-soft-left'});
  expect(independent).toBe(seam);expect(fabric.albedoColor).toEqual(Color3.White());
 }finally{library.dispose();scene.dispose();engine.dispose();}
});

it('uses linear color and data maps without changing smooth custom-paint colors or ghost opacity',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),finish=findWallFinish('paint-1234ab');
 try{
  const material=createSurfaceMaterial(scene,'paint-proof',finish,.18);
  expect(material.albedoColor).toEqual(Color3.FromHexString('#1234ab').toLinearSpace());
  expect(material.albedoTexture).toBeNull();expect(material.bumpTexture?.gammaSpace).toBe(false);
  expect(material.metallicTexture?.gammaSpace).toBe(false);expect(material.bumpTexture?.level).toBe(.07);
  expect(material.invertNormalMapX).toBe(true);expect(material.invertNormalMapY).toBe(false);
  scene.useRightHandedSystem=true;
  const rightHanded=createSurfaceMaterial(scene,'right-handed-paint-proof',finish);
  expect(rightHanded.invertNormalMapX).toBe(false);expect(rightHanded.invertNormalMapY).toBe(true);
  expect(material.useRoughnessFromMetallicTextureGreen).toBe(true);expect(material.useRoughnessFromMetallicTextureAlpha).toBe(false);
  expect(material.transparencyMode).toBe(PBRMaterial.PBRMATERIAL_ALPHABLEND);expect(material.alpha).toBe(.18);expect(material.metallic).toBe(0);
 }finally{scene.dispose();engine.dispose();}
});
