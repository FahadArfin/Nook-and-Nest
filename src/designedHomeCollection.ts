import rows from './designedHomeExpansion.json';
export const designedHomeIds=new Set(rows.map(r=>String(r[0])));
export const designedHomeTopIds=new Set(rows.filter(r=>String(r[0]).includes('-media-')||String(r[0]).includes('-dresser-')).map(r=>String(r[0])));
export const designedHomeRoundIds=new Set(['designed-coffee-travertine','designed-coffee-fluted','designed-sunroom-table']);
export const designedHomeCounterIds=new Set(['designed-sink-farmhouse','designed-sink-fluted']);
export const designedHomeMountHeight=(id:string):number|undefined=>id==='designed-media-floating'?250:id==='designed-basin-wall'?650:id.startsWith('designed-mirror-')?950:undefined;
