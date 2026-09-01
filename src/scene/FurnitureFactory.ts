import { Color3, Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, TransformNode, Vector3, VertexData } from "@babylonjs/core";
import { variants } from "../catalog";
import type { CatalogItem, FurniturePlacement } from "../types";

type Size = [number, number, number];
type Position = [number, number, number];

export const FURNITURE_STYLE = {
  bevelRatio: 0.075,
  minimumBevel: 0.008,
  legThicknessRatio: 0.095,
  trimDepthRatio: 0.035,
  handleScale: 0.055,
  defaultRoughness: 0.94,
  variationAmount: 0.04,
  wood: { honey: "#bd895a", light: "#d0aa79", dark: "#76503d", chocolate: "#855e46" },
  fabric: { oatmeal: "#dec9a6", sage: "#9fac7d", blue: "#819ba0", rust: "#bd7357", mustard: "#c9a55f" },
  accent: { cream: "#efe0bf", terracotta: "#c67d5d", green: "#73866b", blue: "#78979b", burgundy: "#895d5e" },
} as const;

const hash = (value: string) => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
};

export const furnitureVariation = (seed: string, index: number, amount: number = FURNITURE_STYLE.variationAmount) => {
  let value = hash(`${seed}:${index}`);
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  return 1 + ((((value >>> 0) % 2001) / 1000) - 1) * amount;
};

export class FurnitureFactory {
  private materialCache = new Map<string, StandardMaterial>();

  constructor(private scene: Scene, private shadow: ShadowGenerator) {}

  resetMaterials() { this.materialCache.clear(); }

  private material(name: string, color: string, alpha = 1) {
    const key = `${name}:${color}:${alpha}`;
    const cached = this.materialCache.get(key);
    if (cached) return cached;
    const material = new StandardMaterial(`furniture-${name}`, this.scene);
    material.diffuseColor = Color3.Lerp(Color3.FromHexString(color),Color3.White(),.2);
    material.ambientColor = material.diffuseColor.scale(.24);
    material.specularColor = new Color3(0.055, 0.045, 0.035);
    material.roughness = FURNITURE_STYLE.defaultRoughness;
    material.alpha = alpha;
    this.materialCache.set(key, material);
    return material;
  }

  private register(mesh: Mesh, parent: TransformNode, material: StandardMaterial) {
    mesh.parent = parent;
    mesh.material = material;
    mesh.receiveShadows = true;
    this.shadow.addShadowCaster(mesh);
    return mesh;
  }

  private beveledBox(parent: TransformNode, name: string, size: Size, position: Position, material: StandardMaterial, bevel?: number) {
    const [width, height, depth] = size;
    const hx = width / 2, hy = height / 2, hz = depth / 2;
    const b = Math.min(bevel ?? Math.min(width, height, depth) * FURNITURE_STYLE.bevelRatio, Math.min(hx, hy, hz) * 0.42);
    if (b < 0.0015) return this.box(parent, name, size, position, material);
    const positions: number[] = []; const indices: number[] = [];
    const xPoint = (sx:number, sy:number, sz:number):Position => [sx*hx, sy*(hy-b), sz*(hz-b)];
    const yPoint = (sx:number, sy:number, sz:number):Position => [sx*(hx-b), sy*hy, sz*(hz-b)];
    const zPoint = (sx:number, sy:number, sz:number):Position => [sx*(hx-b), sy*(hy-b), sz*hz];
    const face = (points: Position[], outward: Position) => {
      const start = positions.length / 3;
      for (const point of points) positions.push(...point);
      const a = new Vector3(...points[0]), ab = new Vector3(...points[1]).subtract(a), ac = new Vector3(...points[2]).subtract(a);
      const order = Vector3.Dot(Vector3.Cross(ab, ac), new Vector3(...outward)) >= 0 ? points.map((_,i)=>i) : points.map((_,i)=>points.length-1-i);
      for (let i=1;i<order.length-1;i+=1) indices.push(start+order[0],start+order[i],start+order[i+1]);
    };
    for (const sx of [-1,1]) face([xPoint(sx,-1,-1),xPoint(sx,1,-1),xPoint(sx,1,1),xPoint(sx,-1,1)],[sx,0,0]);
    for (const sy of [-1,1]) face([yPoint(-1,sy,-1),yPoint(-1,sy,1),yPoint(1,sy,1),yPoint(1,sy,-1)],[0,sy,0]);
    for (const sz of [-1,1]) face([zPoint(-1,-1,sz),zPoint(1,-1,sz),zPoint(1,1,sz),zPoint(-1,1,sz)],[0,0,sz]);
    for (const sx of [-1,1]) for (const sy of [-1,1]) face([xPoint(sx,sy,-1),xPoint(sx,sy,1),yPoint(sx,sy,1),yPoint(sx,sy,-1)],[sx,sy,0]);
    for (const sx of [-1,1]) for (const sz of [-1,1]) face([xPoint(sx,-1,sz),zPoint(sx,-1,sz),zPoint(sx,1,sz),xPoint(sx,1,sz)],[sx,0,sz]);
    for (const sy of [-1,1]) for (const sz of [-1,1]) face([yPoint(-1,sy,sz),yPoint(1,sy,sz),zPoint(1,sy,sz),zPoint(-1,sy,sz)],[0,sy,sz]);
    for (const sx of [-1,1]) for (const sy of [-1,1]) for (const sz of [-1,1]) face([xPoint(sx,sy,sz),yPoint(sx,sy,sz),zPoint(sx,sy,sz)],[sx,sy,sz]);
    const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new Mesh(name, this.scene); const data = new VertexData(); data.positions=positions; data.indices=indices; data.normals=normals; data.applyToMesh(mesh);
    mesh.position = new Vector3(...position);
    return this.register(mesh,parent,material);
  }

  private box(parent:TransformNode,name:string,size:Size,position:Position,material:StandardMaterial){
    const mesh=MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},this.scene);mesh.position=new Vector3(...position);return this.register(mesh,parent,material);
  }

  private cushion(parent:TransformNode,name:string,size:Size,position:Position,material:StandardMaterial,rotationY=0){
    const mesh=MeshBuilder.CreateSphere(name,{diameter:1,segments:10},this.scene);mesh.scaling=new Vector3(size[0],size[1],size[2]);mesh.position=new Vector3(...position);mesh.rotation.y=rotationY;return this.register(mesh,parent,material);
  }

  private cylinder(parent:TransformNode,name:string,diameter:number,height:number,position:Position,material:StandardMaterial,tessellation=10,diameterTop=diameter){
    const mesh=MeshBuilder.CreateCylinder(name,{diameterBottom:diameter,diameterTop,height,tessellation},this.scene);mesh.position=new Vector3(...position);return this.register(mesh,parent,material);
  }

  private taperedLeg(parent:TransformNode,name:string,height:number,thickness:number,position:Position,material:StandardMaterial,leanX=0,leanZ=0){
    const leg=this.cylinder(parent,name,thickness,height,position,material,4,thickness*.82);leg.rotation.y=Math.PI/4;leg.rotation.x=leanZ;leg.rotation.z=leanX;return leg;
  }

  private handle(parent:TransformNode,name:string,width:number,position:Position,material:StandardMaterial){
    this.cylinder(parent,`${name}-left`,Math.max(.018,width*.16),width*.16,[position[0]-width*.34,position[1],position[2]],material,8).rotation.x=Math.PI/2;
    this.cylinder(parent,`${name}-right`,Math.max(.018,width*.16),width*.16,[position[0]+width*.34,position[1],position[2]],material,8).rotation.x=Math.PI/2;
    return this.beveledBox(parent,`${name}-bar`,[width,width*.14,width*.12],position,material,width*.045);
  }

  private book(parent:TransformNode,seed:string,index:number,size:Size,position:Position,material:StandardMaterial){
    const book=this.beveledBox(parent,`book-${index}`,[size[0]*furnitureVariation(seed,index),size[1]*furnitureVariation(seed,index+19),size[2]],position,material,.006);book.rotation.z=(furnitureVariation(seed,index+41,.25)-1)*.45;return book;
  }

  private pot(parent:TransformNode,name:string,width:number,height:number,position:Position,material:StandardMaterial){
    return this.cylinder(parent,name,width,height,position,material,10,width*.82);
  }

  build(parent:TransformNode, definition:CatalogItem, item:FurniturePlacement, width:number, depth:number, height:number, ghost:boolean){
    const alpha=ghost?.2:1; const variant=variants[item.variant as keyof typeof variants] ?? variants.sage;
    const palette={main:this.material(`main-${item.variant}`,variant,alpha),wood:this.material("wood-honey",FURNITURE_STYLE.wood.honey,alpha),woodLight:this.material("wood-light",FURNITURE_STYLE.wood.light,alpha),woodDark:this.material("wood-dark",FURNITURE_STYLE.wood.dark,alpha),cream:this.material("cream",FURNITURE_STYLE.accent.cream,alpha),terracotta:this.material("terracotta",FURNITURE_STYLE.accent.terracotta,alpha),green:this.material("green",FURNITURE_STYLE.accent.green,alpha),blue:this.material("blue",FURNITURE_STYLE.accent.blue,alpha),burgundy:this.material("burgundy",FURNITURE_STYLE.accent.burgundy,alpha),mustard:this.material("mustard",FURNITURE_STYLE.fabric.mustard,alpha)};
    const args={parent,definition,item,width,depth,height,palette};
    if(definition.id==="bookshelf") return this.bookshelf(args);
    if(definition.shape==="storage") return this.storage(args);
    if(definition.shape==="bed") return this.bed(args);
    if(definition.id==="dining-chair"||definition.id==="office-chair") return this.chair(args);
    if(definition.id==="bar-stool") return this.stool(args);
    if(definition.shape==="table") return this.table(args);
    if(definition.shape==="seat") return this.seat(args);
    if(definition.shape==="lamp") return this.lamp(args);
    if(definition.shape==="plant") return this.plant(args);
    if(definition.shape==="rug") return this.rug(args);
    return this.decor(args);
  }

  private bookshelf({parent,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    const post=Math.max(.075,w*.085), shelf=Math.max(.045,h*.032), innerW=w-post*2, back=Math.max(.035,d*.09);
    this.beveledBox(parent,"bookcase-back",[innerW,h*.88,back],[0,h*.49,d*.43],p.woodDark,.012);
    for(const x of [-w/2+post/2,w/2-post/2]) this.beveledBox(parent,"bookcase-post",[post,h*.94,d],[x,h*.48,0],p.wood,.015);
    this.beveledBox(parent,"bookcase-cap",[w,shelf*1.35,d],[0,h-shelf*.68,0],p.woodLight,.018);
    this.beveledBox(parent,"bookcase-plinth",[w,shelf*1.7,d],[0,shelf*.85,0],p.woodDark,.018);
    const levels=[.25,.43,.61,.79];
    for(const level of levels) this.beveledBox(parent,"bookcase-shelf",[innerW,shelf,d*.9],[0,h*level,0],p.woodLight,.01);
    const bookMaterials=[p.terracotta,p.green,p.blue,p.mustard,p.burgundy,p.cream];
    let bookIndex=0;
    for(let row=0;row<3;row+=1){let cursor=-innerW*.43;const baseY=h*(levels[row]+.02);while(cursor<innerW*.29&&bookIndex<18){const bw=Math.max(.035,w*(.045+(bookIndex%3)*.009));const bh=h*(.105+(bookIndex%4)*.014)*furnitureVariation(item.id,bookIndex,.08);this.book(parent,item.id,bookIndex,[bw,bh,d*.42],[cursor+bw/2,baseY+bh/2,-d*.16],bookMaterials[bookIndex%bookMaterials.length]);cursor+=bw*.98;bookIndex+=1;}}
    this.pot(parent,"shelf-pot",w*.13,h*.1,[innerW*.27,h*.86,-d*.08],p.terracotta);
    this.cushion(parent,"shelf-plant",[w*.11,h*.1,d*.2],[innerW*.27,h*.93,-d*.08],p.green,.2);
  }

  private storage({parent,definition,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    const foot=Math.min(h*.09,.11), cap=Math.max(.045,h*.055), bodyH=h-foot-cap*.7;
    this.beveledBox(parent,"storage-body",[w*.94,bodyH,d*.92],[0,foot+bodyH/2,0],p.wood,.025);
    this.beveledBox(parent,"storage-cap",[w,cap,d],[0,h-cap/2,0],p.woodLight,.018);
    this.beveledBox(parent,"storage-plinth",[w*.98,cap*.8,d*.96],[0,foot+cap*.4,0],p.woodDark,.012);
    for(const x of [-w*.36,w*.36]) this.taperedLeg(parent,"storage-foot",foot,Math.min(.09,w*.1),[x,foot/2,d*.31],p.woodDark);
    const front=-d*.47;
    if(definition.id==="nightstand"){
      this.beveledBox(parent,"nightstand-drawer",[w*.78,h*.19,d*.05],[0,h*.68,front],p.main,.012);this.handle(parent,"nightstand-handle",w*.18,[0,h*.68,front-.035],p.woodDark);
      this.beveledBox(parent,"nightstand-shelf",[w*.72,.035,d*.72],[0,h*.31,0],p.woodLight,.008);
    }else if(definition.id==="dresser"){
      for(let row=0;row<3;row+=1)for(let col=0;col<2;col+=1){const x=(col-.5)*w*.43,y=h*(.27+row*.22);this.beveledBox(parent,"dresser-drawer",[w*.39,h*.17,d*.05],[x,y,front],row===1?p.main:p.woodLight,.01);this.handle(parent,`dresser-handle-${row}-${col}`,w*.12,[x,y,front-.034],p.woodDark);}
    }else{
      for(const side of [-1,1]){const x=side*w*.235;this.beveledBox(parent,"cabinet-door",[w*.42,bodyH*.78,d*.055],[x,foot+bodyH*.53,front],side===1?p.main:p.woodLight,.016);this.beveledBox(parent,"door-trim",[w*.32,bodyH*.67,d*.025],[x,foot+bodyH*.53,front-.04],side===1?p.woodLight:p.main,.01);this.handle(parent,"cabinet-handle",w*.08,[x-side*w*.12,foot+bodyH*.53,front-.075],p.woodDark);}
    }
    if(definition.id==="cabinet") this.pot(parent,"cabinet-pot",w*.16,h*.09,[w*.27,h-h*.045,0],p.terracotta);
    void item;
  }

  private table({parent,definition,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    if(definition.id==="round-table"||definition.id==="side-table"){
      const topH=Math.max(.075,h*.12);this.cylinder(parent,"round-top",Math.min(w,d),topH,[0,h-topH/2,0],p.main,16);
      const stem=Math.min(w,d)*.16;this.taperedLeg(parent,"round-pedestal",h-topH,stem,[0,(h-topH)/2,0],p.wood);
      for(let i=0;i<4;i+=1){const foot=this.beveledBox(parent,"pedestal-foot",[Math.min(w,d)*.34,.055,stem*.7],[0,.05,0],p.woodDark,.012);foot.rotation.y=i*Math.PI/2;foot.position.x=Math.cos(i*Math.PI/2)*Math.min(w,d)*.13;foot.position.z=Math.sin(i*Math.PI/2)*Math.min(w,d)*.13;}return;
    }
    const topH=Math.max(.075,h*.13), legH=h-topH, leg=Math.max(.065,Math.min(w,d)*FURNITURE_STYLE.legThicknessRatio);
    this.beveledBox(parent,"table-top",[w,topH,d],[0,h-topH/2,0],p.main,Math.min(.035,topH*.28));
    if(definition.id==="dining-table") for(const x of [-w*.24,w*.24]) this.beveledBox(parent,"table-plank-line",[.012,.009,d*.9],[x,h-.008,0],p.woodDark,.003);
    this.beveledBox(parent,"table-apron-front",[w*.78,h*.1,.045],[0,h-topH-h*.055,-d*.39],p.woodDark,.01);this.beveledBox(parent,"table-apron-side",[.045,h*.1,d*.7],[-w*.39,h-topH-h*.055,0],p.woodDark,.01);this.beveledBox(parent,"table-apron-side",[.045,h*.1,d*.7],[w*.39,h-topH-h*.055,0],p.woodDark,.01);
    if(definition.id==="desk"){
      this.beveledBox(parent,"desk-drawer-bank",[w*.29,legH*.58,d*.72],[w*.29,legH*.49,0],p.wood,.02);for(let i=0;i<2;i+=1){const y=legH*(.37+i*.25);this.beveledBox(parent,"desk-drawer",[w*.23,legH*.19,.045],[w*.29,y,-d*.38],p.main,.009);this.handle(parent,"desk-handle",w*.1,[w*.29,y,-d*.414],p.woodDark);}for(const x of [-w*.39,w*.08])for(const z of [-d*.33,d*.33])this.taperedLeg(parent,"desk-leg",legH,leg,[x,legH/2,z],p.woodDark);return;
    }
    for(const x of [-w*.4,w*.4])for(const z of [-d*.38,d*.38])this.taperedLeg(parent,"table-leg",legH,leg,[x,legH/2,z],p.wood,x>0?.015:-.015,z>0?.015:-.015);
    if(definition.id==="coffee-table") this.beveledBox(parent,"coffee-shelf",[w*.72,.045,d*.68],[0,h*.34,0],p.woodLight,.012);
  }

  private chair({parent,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    const seatY=h*.48,seatH=h*.105,legH=seatY-seatH/2,leg=Math.max(.045,w*.105);
    this.beveledBox(parent,"chair-seat",[w*.9,seatH,d*.76],[0,seatY,0],p.wood,.025);this.cushion(parent,"chair-cushion",[w*.75,seatH*.72,d*.58],[0,seatY+seatH*.62,d*.01],p.main,(furnitureVariation(item.id,3,.12)-1)*.2);
    for(const x of [-w*.34,w*.34])for(const z of [-d*.29,d*.29])this.taperedLeg(parent,"chair-leg",legH,leg,[x,legH/2,z],p.woodDark,x>0?.018:-.018,z<0?.05:-.02);
    const postH=h-seatY+legH*.03;for(const x of [-w*.35,w*.35]){const post=this.taperedLeg(parent,"back-post",postH,leg,[x,seatY+(postH/2)-.01,-d*.34],p.wood,x>0?-.025:.025,.08);post.rotation.x=.05;}
    if(item.catalogId==="office-chair") this.cushion(parent,"chair-back",[w*.69,h*.32,d*.16],[0,h*.76,-d*.34],p.main,0);
    else for(let i=0;i<3;i+=1)this.beveledBox(parent,"chair-slat",[w*.58,h*.065,.055],[0,h*(.65+i*.105),-d*.35],i===1?p.main:p.woodLight,.012);
  }

  private stool({parent,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    this.cylinder(parent,"stool-seat",Math.min(w,d)*.92,h*.12,[0,h*.94,0],p.main,14);const leg=Math.min(w,d)*.13;for(let i=0;i<4;i+=1){const a=Math.PI/4+i*Math.PI/2;this.taperedLeg(parent,"stool-leg",h*.86,leg,[Math.cos(a)*w*.27,h*.43,Math.sin(a)*d*.27],p.woodDark,Math.cos(a)*.04,Math.sin(a)*.04);}this.cylinder(parent,"stool-ring",Math.min(w,d)*.6,.035,[0,h*.38,0],p.wood,12);
  }

  private bed({parent,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    const frameY=h*.25,railH=Math.max(.12,h*.18),mattressH=Math.max(.18,h*.25),headDepth=Math.max(.1,d*.055);
    this.beveledBox(parent,"bed-base",[w*.98,railH,d*.92],[0,frameY,0],p.woodDark,.028);this.beveledBox(parent,"bed-foot-rail",[w,railH*.9,headDepth],[0,frameY,d*.47],p.wood,.02);
    this.beveledBox(parent,"bed-headboard",[w,h*.76,headDepth],[0,h*.62,-d*.47],p.wood,.035);this.beveledBox(parent,"headboard-panel",[w*.83,h*.5,headDepth*.38],[0,h*.64,-d*.505],p.main,.024);this.beveledBox(parent,"headboard-cap",[w,railH*.32,headDepth*1.25],[0,h-railH*.16,-d*.47],p.woodLight,.016);
    this.cushion(parent,"mattress",[w*.92,mattressH,d*.82],[0,frameY+railH*.55+mattressH*.44,d*.01],p.cream);
    const blanketY=frameY+railH*.55+mattressH*.88;this.beveledBox(parent,"blanket",[w*.9,mattressH*.18,d*.48],[0,blanketY,d*.18],p.main,.025);for(let i=0;i<3;i+=1)this.beveledBox(parent,"blanket-fold",[w*.86,.018,.025],[0,blanketY+.025,d*(.03+i*.09)],p.woodLight,.006);
    const pillowW=w*(item.catalogId==="single-bed"?.62:.35);for(const side of item.catalogId==="single-bed"?[0]:[-1,1])this.cushion(parent,"pillow",[pillowW,mattressH*.55,d*.2],[side*w*.22,blanketY+.08,-d*.3],p.cream,(furnitureVariation(item.id,side+8,.12)-1)*.35);
  }

  private seat({parent,definition,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    if(definition.id==="bar-stool") return this.stool({parent,definition,item,width:w,depth:d,height:h,palette:p});
    if(definition.id==="bench"){
      this.cushion(parent,"bench-cushion",[w*.92,h*.23,d*.88],[0,h*.79,0],p.main);for(const x of [-w*.39,w*.39])for(const z of [-d*.31,d*.31])this.taperedLeg(parent,"bench-leg",h*.68,w*.07,[x,h*.34,z],p.woodDark);this.beveledBox(parent,"bench-shelf",[w*.78,.05,d*.72],[0,h*.28,0],p.woodLight,.012);return;
    }
    if(definition.id==="ottoman"){
      this.beveledBox(parent,"ottoman-base",[w*.88,h*.5,d*.88],[0,h*.27,0],p.woodDark,.04);this.cushion(parent,"ottoman-top",[w,h*.62,d],[0,h*.69,0],p.main);for(const x of [-w*.2,w*.2])for(const z of [-d*.2,d*.2])this.cushion(parent,"tuft",[.025,.018,.025],[x,h*.985,z],p.woodDark);return;
    }
    const cushionCount=definition.id==="sofa"?3:definition.id==="loveseat"?2:1;const baseH=h*.28,seatY=h*.38,seatH=h*.22;
    this.beveledBox(parent,"sofa-plinth",[w*.9,baseH,d*.82],[0,baseH/2,d*.02],p.woodDark,.035);for(const x of [-w*.4,w*.4])for(const z of [-d*.3,d*.3])this.taperedLeg(parent,"sofa-foot",h*.12,w*.045,[x,h*.06,z],p.woodDark);
    const innerW=w*.73,gap=w*.012,each=(innerW-gap*(cushionCount-1))/cushionCount;for(let i=0;i<cushionCount;i+=1){const x=-innerW/2+each/2+i*(each+gap);this.cushion(parent,"seat-cushion",[each*.95,seatH,d*.64],[x,seatY,d*.05],p.main,(furnitureVariation(item.id,i,.09)-1)*.18);this.cushion(parent,"back-cushion",[each*.96,h*.43,d*.2],[x*furnitureVariation(item.id,i+10,.03),h*.68,-d*.29],i%2?p.cream:p.main,(furnitureVariation(item.id,i+20,.08)-1)*.2);}
    for(const x of [-w*.43,w*.43])this.cushion(parent,"sofa-arm",[w*.18,h*.54,d*.76],[x,h*.42,0],p.main);
  }

  private lamp({parent,width:w,height:h,palette:p}:BuilderArgs){
    this.cylinder(parent,"lamp-base",w*.72,h*.06,[0,h*.03,0],p.woodDark,14);this.cylinder(parent,"lamp-pole",Math.max(.035,w*.1),h*.67,[0,h*.39,0],p.wood,10);this.cylinder(parent,"lamp-collar",w*.18,h*.06,[0,h*.72,0],p.terracotta,10);const shade=MeshBuilder.CreateCylinder("lamp-shade",{diameterTop:w*.46,diameterBottom:w,height:h*.25,tessellation:14},this.scene);shade.position=new Vector3(0,h*.84,0);this.register(shade,parent,p.main);this.cylinder(parent,"lamp-finial",w*.08,h*.06,[0,h*.97,0],p.woodDark,8);
  }

  private plant({parent,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    this.pot(parent,"plant-pot",w*.63,h*.28,[0,h*.14,0],p.terracotta);this.cylinder(parent,"pot-rim",w*.7,h*.055,[0,h*.28,0],p.cream,12);this.cylinder(parent,"plant-soil",w*.52,.025,[0,h*.305,0],p.woodDark,12);
    for(let i=0;i<9;i+=1){const leaf=this.cushion(parent,"plant-leaf",[w*(.21+(i%3)*.025),h*(.25+(i%2)*.05),d*.12],[Math.sin(i*2.2)*w*.2,h*(.49+(i%4)*.105),Math.cos(i*2.2)*d*.15],i%3?p.green:p.main);leaf.rotation.z=(i-4)*.19+(furnitureVariation(item.id,i,.12)-1);leaf.rotation.x=Math.cos(i)*.22;}
  }

  private rug({parent,definition,width:w,depth:d,palette:p}:BuilderArgs){
    const rug=MeshBuilder.CreateCylinder("rug",{diameter:Math.min(w,d),height:.025,tessellation:28},this.scene);rug.scaling.x=w/Math.min(w,d);rug.scaling.z=d/Math.min(w,d);rug.position.y=.018;this.register(rug,parent,p.main);
    if(definition.id==="runner-rug")for(let i=0;i<12;i+=1){const x=-w*.44+i*w*.08;this.beveledBox(parent,"rug-fringe",[w*.025,.018,d*.045],[x,.02,d*.49],i%2?p.cream:p.main,.004);this.beveledBox(parent,"rug-fringe",[w*.025,.018,d*.045],[x,.02,-d*.49],i%2?p.cream:p.main,.004);}
    this.cylinder(parent,"rug-medallion",Math.min(w,d)*.34,.012,[0,.036,0],p.cream,18);
  }

  private decor({parent,definition,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    if(definition.id==="mirror"){
      const frame=Math.max(.045,w*.09);this.beveledBox(parent,"mirror-top",[w,frame,d],[0,h-frame/2,0],p.woodLight,.015);this.beveledBox(parent,"mirror-bottom",[w,frame,d],[0,frame/2,0],p.woodDark,.015);for(const x of [-w/2+frame/2,w/2-frame/2])this.beveledBox(parent,"mirror-side",[frame,h,d],[x,h/2,0],p.wood,.015);this.beveledBox(parent,"mirror-glass",[w-frame*2,h-frame*2,d*.25],[0,h/2,-d*.35],p.blue,.018);return;
    }
    const baseH=h*.48;this.cushion(parent,"pet-bed-base",[w,baseH,d],[0,baseH*.45,0],p.main);this.cushion(parent,"pet-bed-cushion",[w*.72,h*.34,d*.68],[0,h*.32,0],p.cream);for(let i=0;i<10;i+=1){const a=i*Math.PI*2/10;const rim=this.cushion(parent,"pet-bed-rim",[w*.2,h*.36,d*.2],[Math.cos(a)*w*.4,h*.45,Math.sin(a)*d*.4],i%3?p.main:p.cream);rim.rotation.y=-a;}
  }
}

interface Palette { main:StandardMaterial; wood:StandardMaterial; woodLight:StandardMaterial; woodDark:StandardMaterial; cream:StandardMaterial; terracotta:StandardMaterial; green:StandardMaterial; blue:StandardMaterial; burgundy:StandardMaterial; mustard:StandardMaterial }
interface BuilderArgs { parent:TransformNode; definition:CatalogItem; item:FurniturePlacement; width:number; depth:number; height:number; palette:Palette }
