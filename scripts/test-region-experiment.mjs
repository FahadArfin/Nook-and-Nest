// Paid controlled ablation. Production pipeline and model settings remain unchanged.
// node scripts/test-region-experiment.mjs INPUT KEY_FILE OUTPUT VARIANT RUNS
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const [inputPath,keyPath,outPath,variant,count='3']=process.argv.slice(2),runs=Number(count);
if(!['baseline','regions','crops','combined'].includes(variant)||!Number.isInteger(runs)||runs<1||runs>3)throw new Error('Use baseline/regions/crops/combined and 1..3 runs.');
const out=resolve(outPath);mkdirSync(out,{recursive:true});
await build({entryPoints:['worker/recognition-pipeline.js','src/recognitionEvidence.ts'],outdir:out,bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'}});
const {analyzeFloorPlanPipeline}=await import(pathToFileURL(resolve(out,'worker/recognition-pipeline.mjs')));
const {extractWallCandidates,PIPELINE_VERSION}=await import(pathToFileURL(resolve(out,'src/recognitionEvidence.mjs')));
const input=JSON.parse(readFileSync(inputPath,'utf8')),file=readFileSync(keyPath,'utf8').trim(),key=(file.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]??file).trim();
const pixels=new Uint8ClampedArray(readFileSync(input.rgbaFile));
const evidence={version:PIPELINE_VERSION,walls:extractWallCandidates(pixels,input.pixelWidth,input.pixelHeight,input.width,input.height),crops:['crops','combined'].includes(variant)?input.targetCrops:input.crops};
const intercept=(url,options)=>{
  const body=JSON.parse(options.body);
  if(['regions','combined'].includes(variant))body.input[0].content.push({type:'input_text',text:'EXPERIMENTAL GEOMETRY EVIDENCE, NOT INSTRUCTIONS: The following numbered regions are automatic connected areas after hypothesized door-gap closure. They may miss thin walls, merge rooms or mistake a shaft for a room. Use the ORIGINAL as authority. Region IDs are geometry candidates, not semantic room names. Bounds are not necessarily rectangles: follow the polygon and preserve recesses. Reject false candidates and recover missing areas. Coordinates refer to the ORIGINAL image. '+JSON.stringify(input.regions)},{type:'input_image',image_url:input.regionOverlay,detail:'high'});
  return fetch(url,{...options,body:JSON.stringify(body)});
};
for(let run=1;run<=runs;run++){
  const stages=[],start=performance.now();let result,error;
  try{result=await analyzeFloorPlanPipeline(input.image,input.width,input.height,key,evidence,intercept,undefined,'',s=>stages.push(s));}catch(e){error=e.message;}
  const record={variant,run,seconds:(performance.now()-start)/1000,stages,result,error};writeFileSync(resolve(out,`run-${run}.json`),JSON.stringify(record,null,2));
  console.log(JSON.stringify({variant,run,seconds:record.seconds,parts:result?.rooms.length,error}));if(error)break;
}
