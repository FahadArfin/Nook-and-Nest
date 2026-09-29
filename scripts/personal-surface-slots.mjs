import {readFileSync,writeFileSync} from 'node:fs';
const materials=JSON.parse(readFileSync('src/modelMaterials.json','utf8'));
const slots=Object.fromEntries(Object.entries(materials).map(([id,rows])=>[id,rows.filter(m=>/upholstery|fabric|linen|cloth|cotton|wool|carpet|leather|velvet/i.test(m.id)&&!m.id.includes('artwork')).map(m=>m.id)]).filter(([,names])=>names.length));
const roles=[...new Set(Object.values(slots).flat())];
const models=Object.fromEntries(Object.entries(slots).map(([id,names])=>[id,names.map(name=>roles.indexOf(name))]));
const output=JSON.stringify({roles,models})+'\n',path='src/personalSurfaceSlots.json';
if(process.argv.includes('--check')){if(readFileSync(path,'utf8').replace(/\r\n/g,'\n')!==output)throw new Error('Regenerate personal surface slots with node scripts/personal-surface-slots.mjs');}
else writeFileSync(path,output);
console.log(JSON.stringify({models:Object.keys(models).length,roles:roles.length,bytes:Buffer.byteLength(output)}));
