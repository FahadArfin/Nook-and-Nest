import {createBlankPlan,rectangleCells} from '../src/domain';
import {collaborationPlan} from '../src/collaborationProtocol';
export function collaborationFixture(){const p=createBlankPlan('Two editor practice room','metric');p.id='practice-source';p.floors[0].id='practice-floor';p.gridSizeMm=500;p.floors[0].cells=rectangleCells(10,8);p.furniture=['piece-a','piece-b'].map((id,i)=>({id,catalogId:'books-upright',floorId:'practice-floor',x:1000+i*1500,z:1000,rotation:0,widthMm:350,depthMm:180,heightMm:280,variant:'natural'}));return collaborationPlan(p);}
