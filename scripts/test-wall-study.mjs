// Explicit paid diagnostic. All private inputs/results stay in caller-provided paths.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const [inputPath,keyPath,outPath,variant,count='3']=process.argv.slice(2),runs=Number(count);
if(!['baseline','upstream','supported','topology','topology-mask'].includes(variant)||!Number.isInteger(runs)||runs<1||runs>3)throw new Error('Use baseline/upstream/supported/topology/topology-mask and 1..3 runs.');
const out=resolve(outPath);mkdirSync(out,{recursive:true});
await build({entryPoints:['worker/recognition-pipeline.js','src/recognitionEvidence.ts'],outdir:out,bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'}});
const {analyzeFloorPlanPipeline}=await import(pathToFileURL(resolve(out,'worker/recognition-pipeline.mjs')));
const {extractWallCandidates,PIPELINE_VERSION}=await import(pathToFileURL(resolve(out,'src/recognitionEvidence.mjs')));
const input=JSON.parse(readFileSync(inputPath,'utf8')),file=readFileSync(keyPath,'utf8').trim(),key=(file.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]??file).trim();
const pixels=new Uint8ClampedArray(readFileSync(input.rgbaFile));
const evidence={version:PIPELINE_VERSION,walls:extractWallCandidates(pixels,input.pixelWidth,input.pixelHeight,input.width,input.height),crops:input.crops};
const intercept=(url,options)=>{
  const body=JSON.parse(options.body);
  if(['upstream','supported','topology-mask'].includes(variant))body.input[0].content.push({type:'input_text',text:'Auxiliary wall-stroke view, aligned with the ORIGINAL image. Black pixels are filtered dark strokes, not guaranteed walls; thin partitions and windows may be absent and cabinet edges may remain. It supplies no room labels or inferred doorway closures. Use the ORIGINAL and broad crops to verify boundaries, doors and measurements.'},{type:'input_image',image_url:input[(variant==='topology-mask'?'supported':variant)+'Mask'],detail:'high'});
  if(variant.startsWith('topology')){
    if(body.text.format.name==='room_inventory'){
      const properties={hingeX:{type:'number'},hingeY:{type:'number'},closedEndX:{type:'number'},closedEndY:{type:'number'},swingsInto:{type:'string'},otherSide:{type:'string'},uncertainty:{type:'string'}};
      body.text.format.schema.properties.doorways={type:'array',items:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}};body.text.format.schema.required.push('doorways');
      body.instructions+=' Also inventory visible doorways. Locate the hinge and opposite jamb of the CLOSED door span in original pixels. Trace the quarter-circle arc and door leaf to identify which room the door swings into. Distinguish the door leaf from the closed-door boundary. An entry recess beyond that closed span belongs to the room it leads into, even if its label lies elsewhere. Report uncertain ownership honestly; do not invent missing door symbols.';
    }else body.instructions+=' Use the inventory doorway spans as uncertain topology evidence. For each entry recess, trace the floor from its closed-door boundary into the main room; preserve that room identity throughout the recess. Door swing arcs and open leaves are not walls. A bathroom door only divides the bathroom from its parent room; it does not turn the parent room vestibule into a public hall. Recheck all inferred closed spans against the original image before using them.';
  }
  return fetch(url,{...options,body:JSON.stringify(body)});
};
for(let run=1;run<=runs;run++){
  const stages=[],start=performance.now();let result,error;
  try{result=await analyzeFloorPlanPipeline(input.image,input.width,input.height,key,evidence,intercept,undefined,'',s=>stages.push(s));}catch(e){error=e.message;}
  const record={variant,run,seconds:(performance.now()-start)/1000,stages,result,error};writeFileSync(resolve(out,`run-${run}.json`),JSON.stringify(record,null,2));
  console.log(JSON.stringify({variant,run,seconds:record.seconds,parts:result?.rooms.length,error}));if(error)break;
}
