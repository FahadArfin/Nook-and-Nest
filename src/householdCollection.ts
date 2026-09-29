import bathLaundry from './householdBathLaundryExpansion.json';
import entry from './householdEntryExpansion.json';
import utilities from './householdUtilitiesExpansion.json';
import lightingOffice from './householdLightingOfficeExpansion.json';
import specialty from './householdSpecialtyExpansion.json';
import entryVariety from './householdEntryVarietyExpansion.json';
import lightingVariety from './householdLightingVarietyExpansion.json';
import specialtyVariety from './householdSpecialtyVarietyExpansion.json';
import fixtureVariety from './householdFixtureVarietyExpansion.json';
import architecture from './householdArchitectureExpansion.json';
import surfaces from './householdShelfSurfaces.json';

export const householdRows=[...bathLaundry,...entry,...utilities,...lightingOffice,...specialty,...entryVariety,...lightingVariety,...specialtyVariety,...fixtureVariety,...architecture];
export const householdWallIds=new Set(householdRows.filter(r=>r[8]==='wall'&&r[2]!=='Doors').map(r=>String(r[0])));
export const householdWindowTreatmentIds=new Set(['vertical-patio-door-blinds','interior-louvered-shutters']);
export const householdSurfaceHostIds=new Set(Object.keys(surfaces));
const wallHeights:Record<string,number>={
 'bath-grab-bar':800,'bath-grab-bar-vertical':750,'bath-towel-bar':1100,
 'bath-tissue-holder':600,'bath-towel-ring':1050,'bath-robe-hook':1600,
 'bath-shower-caddy':1000,'bath-shower-curtain':300,'bath-folding-shower-seat':350,
 'duplex-electrical-outlet-plate':250,'utility-panel-radiator':150,
 'utility-electrical-panel':700,'utility-return-grille':100,'wall-switch-dimmer-plate':1050,
 'utility-thermostat':1400,'safety-fire-extinguisher':450,'utility-indoor-mini-split':2050,
 'porch-wall-lantern':1700,'under-cabinet-light-bar':1450,'vertical-patio-door-blinds':0,
 'kitchen-pot-filler':1200,'bath-heated-towel-rail':650,'utility-tankless-water-heater':1100,
 'cat-wall-bridge':1200,'wall-bicycle-storage':350,'stored-commuter-bicycle':150,'wall-hose-reel':700,
 'art-picture-light':1700,'low-level-wall-night-light':250,'interior-louvered-shutters':650,
};
export function householdMountHeight(id:string,floorHeightMm=2500):number|undefined {
 if(id==='wall-drop-leaf-table-open')return Math.max(0,Math.round(750-50-surfaces[id].find(s=>s.id==='worktop')!.height));
 if(id==='wall-drop-leaf-table')return Math.max(0,Math.round(750-50-surfaces[id].find(s=>s.id==='lower')!.height));
 const row=householdRows.find(r=>r[0]===id);
 return row?.[8]==='ceiling'?Math.max(0,floorHeightMm-Number(row[5])-50):wallHeights[id];
}
