export type GoogleQuality = 'economy' | 'balanced' | 'retained' | 'high';

/** Decoded geometry/texture estimates, not a promise about total browser/GPU memory. */
export const GOOGLE_QUALITY = {
  economy: {label:'Lighter', error:16, memoryMiB:256, tiles:1200},
  balanced: {label:'Balanced', error:8, memoryMiB:512, tiles:2400},
  retained: {label:'Smooth rotation', error:8, memoryMiB:1024, tiles:4800},
  high: {label:'Sharper nearby', error:4, memoryMiB:1024, tiles:4800},
} as const;

export function defaultGoogleQuality(memoryGiB?:number):GoogleQuality {
  return memoryGiB!==undefined&&memoryGiB<=4?'economy':'balanced';
}

/** Distance to a tile's bounding volume keeps large intersecting ancestors traversable. */
export function nearbyDetailWeight(distance:number) {
  const t=Math.max(0,Math.min(1,(distance-600)/1800));
  return 1+3*t*t*(3-2*t);
}

export function googleQualitySettings(quality:GoogleQuality) {
  const p=GOOGLE_QUALITY[quality];
  return {errorTarget:p.error,maxBytesSize:p.memoryMiB*1024*1024,
    minBytesSize:Math.floor(p.memoryMiB*.85)*1024*1024,
    maxSize:p.tiles,minSize:Math.floor(p.tiles*.85)};
}
