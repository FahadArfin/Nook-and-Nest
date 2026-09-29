import type {SurfaceFinish} from './surfaces';

const root='/textures/realism/';
function scan(id:string,repeat:[number,number],normalStrength=.3):Partial<SurfaceFinish>{
 return {texture:root+id+'-color.jpg',normalTexture:root+id+'-normal.jpg',ormTexture:root+id+'-orm.jpg',repeatMeters:repeat,scale:1,normalStrength,roughness:1};
}
const carpetColors:Record<string,string>={oat:'#d9c9ac',oatmeal:'#d9c9ac',charcoal:'#696a6c',rose:'#b38687',cream:'#e5dfcf',moss:'#7e896c',navy:'#576577',taupe:'#a69587',ivory:'#e8e0cf',linen:'#cec5b2',silver:'#b0b2b2',sage:'#9ba78e',blush:'#c69b94',blue:'#8aabbd',honey:'#c9ad76',lavender:'#aaa0b6'};

/** Upgrade visual materials without changing saved finish identifiers or tile formats. */
export function realisticFinish(f:SurfaceFinish):SurfaceFinish {
 const id=f.id;
 if(f.family==='Paint'){
  const color=f.color??({'cream-plaster':'#e6dcc9','sage-plaster':'#a8b7a1','terracotta-plaster':'#c4937c','blue-plaster':'#a5bac5'} as Record<string,string>)[id]??'#f5f4ef';
  return {...f,texture:'',color,normalTexture:root+'neutral-paint-normal.jpg',ormTexture:root+'neutral-paint-orm.jpg',normalStrength:.07,roughness:1,scale:1,repeatMeters:[2,2]};
 }
 if(f.family==='Wood'||f.family==='Laminate'){
  // Chevron's mitered V joints must not silently become a herringbone pattern.
  if(/chevron/.test(id))return {...f,normalTexture:root+'material-walnut-normal.jpg',ormTexture:root+'material-walnut-orm.jpg',normalStrength:.12,roughness:1};
  const parquet=/parquet|herringbone|chevron/.test(id),light=/white|light|bleached|maple/.test(id),dark=/walnut|smoked|espresso/.test(id);
  const bleached=/whitewash|bleached/.test(id);
  const source=bleached?'bleached-floor':parquet?'herringbone_parquet':light?'wooden_floor_02':dark?'wood_floor':'laminate_floor_03';
  const repeat: [number,number]=parquet?[3.4,3.4]:light?[1.942,1.942]:dark?[1.7,1.7]:[2.08,2.08];
  return {...f,...scan(source,repeat,.3),color:dark?'#ae8b70':/cherry/.test(id)?'#edbd9a':bleached?'#eee7d9':'#ffffff',description:'Natural grain, fine pores and satin variation at measured scale'};
 }
 if(f.family==='Carpet'){
  const patterned=/diamond|chevron|rib/.test(id);
  const color=Object.entries(carpetColors).find(([key])=>id.includes(key))?.[1]??'#b4b5a3';
  return {...f,...scan('neutral-carpet',f.repeatMeters??[1.7,1.7],.35),...(patterned?{texture:f.texture,color:f.color}: {color}),description:'Soft fiber pile with varied matte response'};
 }
 const marble=id!=='marble-check'&&/marble|calacatta|carrara/.test(id),travertine=/travertine/.test(id),terrazzo=/terrazzo/.test(id),quartzite=/quartzite/.test(id);
 if(marble||travertine||terrazzo||quartzite){
  const source=travertine?'Travertine009':terrazzo?'terrazzo_tiles':quartzite?'Onyx015':/noir|nero/.test(id)?'Marble016':/calacatta|gold/.test(id)?'Marble021':'Marble012';
  const color=quartzite?'#b6cfc0':/gold|taupe/.test(id)?'#eadbc3':'#ffffff';
  return {...f,...scan(source,f.repeatMeters??[1.2,1.2],.18),color,roughness:travertine?.9:terrazzo?.8:.62,description:'Scanned mineral variation with a restrained honed sheen'};
 }
 if(/brick/.test(id))return {...f,...scan('red_brick',[1.4,1.4],.55),description:'Photographic clay, recessed mortar and individual brick variation'};
 if(/limestone|lime-stone|pale-limestone/.test(id))return {...f,...scan('marble_01',f.repeatMeters??[1.5,1.5],.35),description:'Honed warm stone with natural pores and fine tonal variation'};
 // Existing decorative motifs remain recognizable; fine ceramic relief adds material depth.
 if(f.family==='Tile')return {...f,normalTexture:root+'Marble012-normal.jpg',ormTexture:root+'Marble012-orm.jpg',normalStrength:.06,roughness:.85};
 if(f.family==='Wallpaper')return {...f,normalTexture:root+'material-canvas-normal.jpg',ormTexture:root+'material-canvas-orm.jpg',normalStrength:.06,roughness:1};
 return f;
}

function finish(id:string,name:string,family:string,source:string,repeat:[number,number],description:string,strength=.35):SurfaceFinish {
 return {id,name,family,description,...scan(source,repeat,strength)} as SurfaceFinish;
}
export const realismFloorFinishes:SurfaceFinish[]=[
 finish('realism-garage-rubber','Interlocking charcoal rubber','Utility','rubber_tiles',[2,2],'Soft matte shop tiles with recessed joints'),
 finish('realism-troweled-concrete','Troweled warm concrete','Concrete','Concrete034',[1.1,.55],'Subtle trowel marks and soft mineral clouding',.2),
 finish('realism-weathered-pavers','Weathered garden pavers','Outdoor','large_grey_tiles',[3,3],'Large worn paving slabs with natural edge variation',.55),
 finish('realism-aged-deck','Aged timber deck','Outdoor','wood_floor_deck',[1.8,1.8],'Weathered outdoor boards and uneven warm grain',.38),
 finish('realism-cream-honed-stone','Honed cream stone','Stone','marble_01',[1.5,1.5],'Warm stone blocks with fine pores and restrained sheen'),
 finish('realism-fine-terrazzo','Warm aggregate terrazzo','Terrazzo','terrazzo_tiles',[2,2],'Fine multicolored mineral aggregate',.15),
];
export const realismWallFinishes:SurfaceFinish[]=[
 finish('realism-limewash','Soft mineral limewash','Plaster','painted_plaster_wall',[2,2],'Natural plaster clouding under a chalky finish',.22),
 finish('realism-grey-plaster','Grey Venetian plaster','Plaster','plaster_grey_04',[1.5,1.5],'Layered trowel marks and mineral color depth',.24),
 finish('realism-raw-plaster','Warm unfinished plaster','Plaster','white_plaster_02',[1,1],'Fine grains, pores and naturally varied plaster',.28),
 finish('realism-microcement','Soft concrete wall','Concrete','Concrete034',[1.1,.55],'Quiet troweled concrete with a matte surface',.18),
 finish('realism-travertine-wall','Natural travertine','Stone','Travertine009',[1.2,2.4],'Cream bands and small naturally recessed pores',.3),
 finish('realism-onyx-wall','Pale onyx wall','Stone','Onyx015',[1.2,2.4],'Clouded translucent-looking mineral bands',.1),
 finish('realism-white-ceramic','White square ceramic','Tile','Tiles107',[1,1],'Clean glazed tiles with slender pale joints',.28),
 finish('realism-exposed-brick','Warm exposed brick','Masonry','red_brick',[1.4,1.4],'Individual clay bricks with recessed grey mortar',.55),
];
