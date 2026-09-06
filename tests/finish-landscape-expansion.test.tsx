// @vitest-environment jsdom
import React from 'react';
import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {existsSync,readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {PBRMaterial} from '@babylonjs/core/Materials/PBR/pbrMaterial';
import {OutdoorScene} from '../src/scene/OutdoorScene';
import {floorFinishes,wallFinishes,findWallFinish} from '../src/surfaces';
import {PaintPicker,hsvHex} from '../src/PaintPicker';
import {usePlanner} from '../src/store';
import {createSamplePlan,serializePlan,parsePlan,encodeShare,decodeShare} from '../src/domain';
import {terrainSampler} from '../src/terrain';
import {validatePlan} from '../src/planValidation';
afterEach(cleanup);
it('ships material files and keeps original IDs alongside modern slab sizes',()=>{
 expect(floorFinishes.length).toBeGreaterThanOrEqual(46);expect(wallFinishes.length).toBeGreaterThanOrEqual(24);
 for(const list of [floorFinishes,wallFinishes]){expect(new Set(list.map(f=>f.id)).size).toBe(list.length);for(const f of list)expect(existsSync('public'+f.texture)).toBe(true)}
 expect(floorFinishes.find(f=>f.id==='gold-vein-marble-large')?.repeatMeters).toEqual([.6,1.2]);expect(floorFinishes.find(f=>f.id==='gold-vein-marble-square')?.repeatMeters).toEqual([.9,.9]);expect(floorFinishes.find(f=>f.id==='honey-oak')?.repeatMeters).toBeUndefined();
});
it('custom paint previews a choice without emitting edits for every wheel movement',()=>{
 const ids:string[]=[];render(<PaintPicker onChoose={id=>ids.push(id)}/>);
 fireEvent.change(screen.getByLabelText('Paint hue'),{target:{value:'180'}});fireEvent.change(screen.getByLabelText('Paint saturation'),{target:{value:'100'}});expect(ids).toHaveLength(0);
 fireEvent.change(screen.getByLabelText('Paint hex color'),{target:{value:'#1234ab'}});fireEvent.click(screen.getByRole('button',{name:'Use color'}));expect(ids).toEqual(['paint-1234ab']);expect(findWallFinish(ids[0]).color).toBe('#1234ab');expect(hsvHex(0,1,1)).toBe('#ff0000');expect(hsvHex(120,1,1)).toBe('#00ff00');
});
it('custom paint and scenery orientation survive save/share and undo',()=>{
 const s=usePlanner.getState();s.replacePlan(createSamplePlan());s.setFloorFinish('wallFinishId','paint-1234ab');s.setEnvironment({background:'city',backdropRotation:180});const p=usePlanner.getState().plan;
 expect(parsePlan(serializePlan(p))).toEqual(p);expect(decodeShare(encodeShare(p)).environment?.backdropRotation).toBe(180);s.undo();expect(usePlanner.getState().plan.environment?.background).not.toBe('city');s.undo();expect(usePlanner.getState().plan.floors[0].wallFinishId).toBe('cream-plaster');
 expect(()=>validatePlan({...p,environment:{...p.environment,backdropRotation:NaN}})).toThrow();
});
it('height controls keep other floor elevations and reject crossing the floor above',()=>{
 const s=usePlanner.getState();s.replacePlan(createSamplePlan());const above=usePlanner.getState().plan.floors[1].elevationMm;s.setWallHeight(3048);expect(usePlanner.getState().plan.floors[0].heightMm).toBe(2438);expect(usePlanner.getState().placementNotice).toContain('floor above');s.setWallHeight(2600);expect(usePlanner.getState().plan.floors[0].heightMm).toBe(2600);expect(usePlanner.getState().plan.floors[1].elevationMm).toBe(above);s.undo();expect(usePlanner.getState().plan.floors[0].heightMm).toBe(2438);
});
it('terrain blends continuously outside protected foundations',()=>{
 const p=createSamplePlan();p.environment={background:'plain',grass:'off',terrain:[{kind:'raise',radius:3,strength:2,points:[{x:-.5,z:1}]}]};const sample=terrainSampler(p);expect(sample(0,1).height).toBe(-.15);expect(Math.abs(sample(-.251,1).height-sample(-.249,1).height)).toBeLessThan(.002);expect(sample(-1.2,1).height).toBeGreaterThan(sample(-.3,1).height);
});

it('ships attributed Toronto data and changes window emission without mutating the apartment',()=>{
 const manifest=JSON.parse(readFileSync('public/data/toronto/manifest.json','utf8'));expect(manifest.release).toBe('2026-08-19.0');expect(manifest.statistics.buildings).toBeGreaterThan(19000);expect(manifest.statistics.parts).toBeGreaterThan(5900);expect(manifest.statistics.shoreline_land_polygons).toBeGreaterThan(1);
 expect(readFileSync('public/data/toronto/attribution.html','utf8')).toContain('Open Database License');expect(existsSync('public/data/toronto/toronto-buildings.geojson.gz')).toBe(true);
 const engine=new NullEngine(),scene=new Scene(engine),outdoor=new OutdoorScene(scene);const light=new PBRMaterial('city-window-lights',scene);const p=createSamplePlan();p.environment={background:'plain',grass:'off'};
 (outdoor as any).assets.set('backdrop-city',{materials:[light],dispose:()=>{}});
 try{outdoor.update(p);expect(light.emissiveColor.r).toBe(0);p.camera.darkMode=true;const saved=JSON.stringify(p);outdoor.update(p);expect(light.emissiveColor.r).toBe(1);expect(JSON.stringify(p)).toBe(saved);p.camera.darkMode=false;outdoor.update(p);expect(light.emissiveColor.r).toBe(0)}finally{outdoor.dispose();scene.dispose();engine.dispose()}
});
