import garage from './garageExpansion.json';
import outdoor from './outdoorLivingExpansion.json';
export const garageOutdoorRows=[...garage,...outdoor];
export const garageOutdoorIds=new Set(garageOutdoorRows.map(r=>String(r[0])));
export const garageOutdoorWallIds=new Set(garageOutdoorRows.filter(r=>r[8]==='wall'&&r[2]!=='Doors').map(r=>String(r[0])));
const heights:Record<string,number>={
  "garage-wall-cabinet": 1400,
  "garage-folding-wall-bench": 470,
  "garage-tire-rack": 1200,
  "garage-lumber-rack": 650,
  "garage-pegboard-tools": 1050,
  "garage-hook-rail": 1550,
  "garage-extension-ladder": 1850,
  "garage-cord-reel": 1650,
  "garage-air-hose-reel": 1600,
  "garage-ev-charger": 700,
  "garage-wall-fan": 1550,
  "garage-first-aid-cabinet": 1200,
  "garage-garden-tool-rack": 1200,
  "garage-wall-opener": 1880,
  "garage-door-keypad": 1100,
  "outdoor-retractable-awning": 2150
};
export function garageOutdoorMountHeight(id:string,floorHeightMm=2500):number|undefined{
 const row=garageOutdoorRows.find(r=>r[0]===id);
 if(!row)return;
 if(row[8]==='ceiling')return Math.max(0,floorHeightMm-Number(row[5])-50);
 return heights[id];
}
