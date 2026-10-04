import {loadEnv} from 'vite';

// This reviewed asset-set revision does not depend on the later merge commit.
export const productionCatalogRevision='93a1350377b0a81b4c9dad3ca14b6f46c7043cf00ae76049630929ca2e7abb79';

export function catalogProductionDefine(command,revision){
  if(command!=='build')return {};
  return {'import.meta.env.VITE_CATALOG_REALISM_VERSION':JSON.stringify(/^[a-f0-9]{64}$/.test(revision??'')?revision:productionCatalogRevision)};
}

/** Keep the frozen render-source module intact; activate canonical delivery at build time. */
export function catalogProductionActivation(){
  return {name:'catalog-production-activation',config(config,environment){
    if(environment.command!=='build')return;
    const env=loadEnv(environment.mode,config.envDir??config.root??process.cwd(),'VITE_');
    return {define:catalogProductionDefine(environment.command,env.VITE_CATALOG_REALISM_VERSION)};
  }};
}
