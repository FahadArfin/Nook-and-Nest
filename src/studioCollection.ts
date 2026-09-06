import rows from './studioExpansion.json';
export const studioIds=new Set(rows.map(r=>String(r[0])));
export const studioBathroomIds=['pedestal-sink','wall-hung-sink','vessel-sink','single-bath-vanity','double-bath-vanity','floating-bath-vanity','two-piece-toilet','one-piece-toilet','wall-hung-toilet','console-vanity','reed-double-vanity'];
export const studioMountHeight=(id:string):number|undefined=>id==='toilet-neorest-wall'?150:id.startsWith('recessed-')?2450:id==='ceiling-opal-flush'?2400:id.startsWith('shelf-floating-')?1400:id==='unifi-g6-bullet'||id==='unifi-g6-instant'?2100:id.includes('doorbell')?1200:undefined;
export const hasStudioAsset=(id:string)=>studioIds.has(id)||studioBathroomIds.includes(id);
