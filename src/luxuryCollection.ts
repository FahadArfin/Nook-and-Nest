import rows from './luxuryExpansion.json';
export const luxuryIds=rows.map(row=>String(row[0]));
export const luxurySinkIds=new Set(['luxury-workstation-sink','luxury-farmhouse-sink','luxury-double-workstation']);
export const luxuryMountHeight=(id:string)=>({'luxury-wall-oven-single':750,'luxury-wall-oven-double':250,'luxury-steam-oven':1150} as Record<string,number>)[id];
