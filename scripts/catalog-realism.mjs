#!/usr/bin/env node
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalogInventory,catalogStatus,canonicalJson,hashCatalogInventory,catalogFileRecord} from './lib/catalog-realism-inventory.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifestPath=path.join(root,'assets-source/catalog-realism/catalog.json');
try{
  const [command,...args]=process.argv.slice(2);
  if(!['inventory','status'].includes(command)||args.some(arg=>arg!=='--json')||(command==='inventory'&&args.length))throw new Error('Usage: node scripts/catalog-realism.mjs inventory | status [--json]');
  if(command==='inventory'){
    const manifest=await createCatalogInventory(root),serialized=JSON.stringify(manifest,null,2)+'\n';
    let frozen=manifest;
    if(existsSync(manifestPath)){
      frozen=JSON.parse(readFileSync(manifestPath,'utf8'));
      if(frozen.catalogSha256!==hashCatalogInventory(frozen)||canonicalJson(manifest.items)!==canonicalJson(frozen.items))throw new Error('Frozen catalog contracts differ from the current models. Inventory will not overwrite the original baseline.');
      for(const input of frozen.sourceInputs){const actual=catalogFileRecord(root,input.path);if(actual.sha256!==input.sha256||actual.bytes!==input.bytes)throw new Error('Frozen source input changed: '+input.path);}
    }else{mkdirSync(path.dirname(manifestPath),{recursive:true});writeFileSync(manifestPath,serialized,{flag:'wx'});}
    console.log(`Frozen ${frozen.items.length} catalog contracts; all worklist items start pending. ${frozen.catalogSha256}`);
  }else{
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),status=await catalogStatus(root,manifest);
    if(args.includes('--json'))console.log(JSON.stringify(status,null,2));
    else{
      console.log(`Catalog realism: ${status.total} models. `+Object.entries(status.counts).map(([state,count])=>`${state}: ${count}`).join(', ')+'.');
      for(const item of status.items.filter(item=>item.reason))console.log(`${item.id}: ${item.state} — ${item.reason}`);
      if(status.orphanReceipts.length)console.log('Unknown receipts: '+status.orphanReceipts.join(', '));
      console.log(status.allReviewed?'All catalog candidates have current review evidence.':'Catalog work remains incomplete; processed models are not automatically reviewed.');
    }
    if(status.counts.stale||status.counts.failed||status.orphanReceipts.length)process.exitCode=1;
  }
}catch(error){console.error('Catalog realism: '+error.message);process.exitCode=1;}
