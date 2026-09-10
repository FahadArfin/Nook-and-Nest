// Explicit opt-in paid diagnostic. Never records the key or publishes input images.
// node scripts/test-luna-pipeline.mjs INPUT_JSON KEY_FILE OUTPUT_DIRECTORY [1..3]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const [inputPath,keyPath,outPath,count='1']=process.argv.slice(2),runs=Number(count);
if(!inputPath||!keyPath||!outPath||!Number.isInteger(runs)||runs<1||runs>3)throw new Error('Provide input JSON, key file, output directory, and 1 to 3 runs.');
const out=resolve(outPath);mkdirSync(out,{recursive:true});
await build({entryPoints:['worker/recognition-pipeline.js','src/recognitionEvidence.ts'],outdir:out,bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'}});
const {analyzeFloorPlanPipeline}=await import(pathToFileURL(resolve(out,'worker/recognition-pipeline.mjs')));
const {extractWallCandidates,PIPELINE_VERSION}=await import(pathToFileURL(resolve(out,'src/recognitionEvidence.mjs')));
const input=JSON.parse(readFileSync(inputPath,'utf8')),file=readFileSync(keyPath,'utf8').trim(),key=(file.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]??file).trim();
const pixels=new Uint8ClampedArray(readFileSync(input.rgbaFile));const start=performance.now();
input.evidence={version:PIPELINE_VERSION,walls:extractWallCandidates(pixels,input.pixelWidth,input.pixelHeight,input.width,input.height),crops:input.crops};
console.log(JSON.stringify({preprocessMs:performance.now()-start,wallCandidates:input.evidence.walls.length}));
const summary=[];let spend=0;
for(let run=1;run<=runs;run++){
  const stages=[],start=performance.now();let result,error;
  try {result=await analyzeFloorPlanPipeline(input.image,input.width,input.height,key,input.evidence,fetch,undefined,'',stage=>stages.push(stage));}catch(e){error=e.message;}
  const cost=stages.reduce((sum,s)=>sum+((s.usage?.input_tokens??0)-(s.usage?.input_tokens_details?.cached_tokens??0))*.2/1e6+(s.usage?.input_tokens_details?.cached_tokens??0)*.02/1e6+(s.usage?.output_tokens??0)*1.2/1e6+(s.usage?.input_tokens_details?.cache_write_tokens??0)*.05/1e6,0);spend+=cost;
  const record={run,seconds:(performance.now()-start)/1000,estimatedUsd:cost,stages,result,error};writeFileSync(resolve(out,`run-${run}.json`),JSON.stringify(record,null,2));
  summary.push({...record,result:result?{roomParts:result.rooms.length,names:[...new Set(result.rooms.map(r=>r.name))],warnings:result.warnings}:undefined});console.log(JSON.stringify(summary.at(-1)));
  if(error||spend>.5)break;
}
writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2));
