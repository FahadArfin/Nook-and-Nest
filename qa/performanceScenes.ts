import {createBlankPlan,rectangleCells} from '../src/domain';
import {catalog} from '../src/catalog';
import type {HomeShot} from '../src/previewShots';
export const sceneIds=['small-home','dense-meadow','mixed-vegetation','water-edit','two-million-grass','two-million-mixed'] as const;
export type PerformanceSceneId=typeof sceneIds[number];
export function performanceScene(id:PerformanceSceneId){
 const plan=createBlankPlan('Performance: '+id);plan.id='perf-'+id;plan.createdAt=plan.updatedAt='2026-09-09T00:00:00.000Z';plan.floors[0].id='perf-floor';plan.gridSizeMm=500;plan.floors[0].cells=rectangleCells(12,10);plan.camera.showGrid=false;
 const add=(catalogId:string,x:number,z:number,index:number)=>{const c=catalog.find(c=>c.id===catalogId);if(!c)throw Error('Missing fixture model '+catalogId);plan.furniture.push({id:'perf-item-'+index,catalogId,floorId:'perf-floor',x,z,rotation:(index*137.508)%360,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'cream',elevationMm:0});};
 plan.environment={background:'plain',grass:'off'};
 let shot:HomeShot={name:id,x:3,y:0,z:2.5,radius:14,alpha:-Math.PI/2,beta:.7};
 if(id==='small-home'){add('sofa',1500,1500,0);add('dining-table',4000,2500,1);}
 if(id==='dense-meadow'){const coverage:Record<string,number>={};for(let x=-100;x<100;x++)for(let z=-100;z<100;z++)if(!(x>=0&&x<6&&z>=0&&z<5))coverage[x+':'+z]=9;plan.environment.grassCoverage=coverage;shot={...shot,x:-20,z:-20,radius:35};}
 if(id==='mixed-vegetation'){const ids=catalog.filter(c=>c.category==='Outdoor'&&c.shape==='plant').slice(0,8).map(c=>c.id);for(let i=0;i<2000;i++)add(ids[i%ids.length],-10000-(i%50)*1800,-10000-Math.floor(i/50)*1800,i);shot={...shot,x:-30,z:-30,radius:55};}
 if(id==='two-million-grass'||id==='two-million-mixed'){const cells:Record<string,number>={};const ids=id==='two-million-grass'?['grass-clump']:['grass-clump','lavender-clump','daisy-clump','spruce-tree'];for(let x=-50;x<50;x++)for(let z=-50;z<50;z++)cells[ids[((Math.imul(x+50,73856093)^Math.imul(z+50,19349663))>>>0)%ids.length]+'|'+x+'|'+z]=200;plan.environment.vegetationField={cells,removed:{}};shot={...shot,x:-30,z:-30,radius:55};}
 if(id==='water-edit'){plan.environment.terrain=[{kind:'lower',radius:4,strength:1,points:[{x:-10,z:-10},{x:-15,z:-10}]},{kind:'river',carve:false,radius:2,strength:1,points:[{x:-10,z:-10}]}];shot={...shot,x:-12,z:-10,radius:20};}
 return {version:1,id,plan,shot};
}
