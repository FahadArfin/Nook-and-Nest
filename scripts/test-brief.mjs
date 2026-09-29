// Keep complete diagnostics on disk; return bounded, actionable output to humans and agents.
import {spawn} from 'node:child_process';
import {mkdirSync,createWriteStream,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const args=process.argv.slice(2),related=args[0]==='--related';
if(related)args.shift();
if(related&&!args.length){console.error('Pass changed source files: npm run test:related -- src/file.ts');process.exit(2)}
const directory=resolve('.generated/test-logs');mkdirSync(directory,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),base=resolve(directory,stamp);
const log=createWriteStream(base+'.log');
const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs',related?'related':'run',...(related?['--run']:[]),...args,'--reporter=dot','--reporter=json','--outputFile.json='+base+'.json'],{stdio:['inherit','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}});
let tail='';
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);tail=(tail+chunk.toString()).slice(-6000)});
child.on('error',error=>{console.error(error.message);process.exitCode=1;log.end()});
child.on('close',(code,signal)=>{
 log.end();process.exitCode=code??1;
 try{
  const report=JSON.parse(readFileSync(base+'.json','utf8'));
  console.log(`Tests: ${report.numPassedTests} passed, ${report.numFailedTests} failed, ${report.numPendingTests} skipped (${report.testResults.length} files).`);
  if(!(report.numPassedTests+report.numFailedTests)&&!args.includes('--passWithNoTests')){console.error('No tests executed. This run provides no validation; check the supplied paths and name filter.');process.exitCode=1;}
  const failures=report.testResults.flatMap(suite=>suite.assertionResults.filter(t=>t.status==='failed').map(t=>({name:t.fullName,message:t.failureMessages?.join('\n')})));
  for(const failure of failures.slice(0,8))console.error(`${failure.name}\n${(failure.message??'').split('\n').slice(0,8).join('\n').slice(0,1200)}`);
  if(failures.length>8)console.error(`${failures.length-8} more failures in the full log.`);
  if(code!==0&&!failures.length)console.error(tail.slice(-3000));
 }catch{console.error(tail.slice(-3000)||`Test runner ended (${signal??code}).`)}
 console.log(`Full diagnostics: ${base}.log\nStructured results: ${base}.json`);
});
