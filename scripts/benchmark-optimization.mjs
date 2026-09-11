import {build} from 'esbuild';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
mkdirSync('.generated',{recursive:true});
await build({stdin:{contents:"export {terrainSampler} from './src/terrain';export {createBlankPlan} from './src/domain';export {paintGrassCoverage} from './src/grassCoverage';export {boundedHistory} from './src/historyBudget';",resolveDir:process.cwd()},outfile:'.generated/bench-module.mjs',bundle:true,format:'esm',platform:'node'});
const {terrainSampler,createBlankPlan,paintGrassCoverage,boundedHistory}=await import(pathToFileURL(process.cwd()+'/.generated/bench-module.mjs'));
const baselineSource=execFileSync('git',['show','e18646e0031efce8d08e060054c5b32e3054064d:src/terrain.ts'],{encoding:'utf8'});
await build({stdin:{contents:baselineSource,resolveDir:process.cwd()+'/src',loader:'ts'},outfile:'.generated/baseline-terrain.mjs',bundle:true,format:'esm',platform:'node'});
const baseline=await import(pathToFileURL(process.cwd()+'/.generated/baseline-terrain.mjs'));
const terrain=[];
for(const count of [64,1024,4096,8192]){const p=createBlankPlan();p.floors=[];p.environment={background:'plain',grass:'off',terrain:[{kind:'lower',radius:2,strength:.5,points:Array.from({length:count},(_,i)=>({x:-100+(i%128)*1.5,z:-100+Math.floor(i/128)*1.5}))}]};const start=performance.now(),sample=terrainSampler(p);let sum=0;for(let z=0;z<161;z++)for(let x=0;x<161;x++)sum+=sample(x-80,z-80).height;const elapsed=performance.now()-start,oldStart=performance.now(),oldSample=baseline.terrainSampler(p);let oldSum=0;for(let z=0;z<161;z++)for(let x=0;x<161;x++)oldSum+=oldSample(x-80,z-80).height;assert(Math.abs(oldSum-sum)<1e-6);terrain.push({points:count,gridSamples:25921,ms:elapsed,baselineMs:performance.now()-oldStart,checksum:sum})}
const p=createBlankPlan();p.floors=[];const points=[];for(let z=-196;z<=196;z+=6){const reverse=points.length%2;for(let x=-196;x<=196;x+=6)points.push({x:reverse?-x:x,z})}const start=performance.now(),coverage=paintGrassCoverage(p,points,{catalogId:'grass-clump',radius:4,spacing:.2,density:9});
const result={runtime:process.version,terrain,coverage:{tiles:Object.keys(coverage).length,jsonBytes:Buffer.byteLength(JSON.stringify(coverage)),paintMs:performance.now()-start,savedFurniture:0,detailedInstanceBudget:12000}};
writeFileSync('.generated/optimization-benchmark.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
