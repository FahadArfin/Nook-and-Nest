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
    material.diffuseColor = Color3.Lerp(Color3.FromHexString(color),Color3.White(),.08);
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
    const bevel=Math.min(size[0],size[1],size[2])*.34;
    const mesh=this.beveledBox(parent,name,size,position,material,bevel);
    mesh.rotation.y=rotationY;
    return mesh;
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

  private knob(parent:TransformNode,name:string,size:number,position:Position,material:StandardMaterial){
    const knob=this.cylinder(parent,name,size,size*.7,position,material,10,size*.78);
    knob.rotation.x=Math.PI/2;
    return knob;
  }

  private leaf(parent:TransformNode,name:string,width:number,height:number,position:Position,material:StandardMaterial){
    const outline:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
      [0,.5],[.3,.31],[.5,0],[.28,-.3],[0,-.5],[-.28,-.3],[-.5,0],[-.3,.31],
    ];
    const thickness=Math.min(width,height)*.06;
    const positions:number[]=[];
    for(const z of [-thickness/2,thickness/2]) for(const [x,y] of outline) positions.push(x*width,y*height,z);
    const indices:number[]=[];
    for(let i=1;i<7;i+=1) indices.push(0,i,i+1,8,8+i+1,8+i);
    for(let i=0;i<8;i+=1){const next=(i+1)%8;indices.push(i,next,8+next,i,8+next,8+i);}
    const normals:number[]=[];VertexData.ComputeNormals(positions,indices,normals);
    const mesh=new Mesh(name,this.scene);const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.applyToMesh(mesh);
    mesh.position=new Vector3(...position);
    return this.register(mesh,parent,material);
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
    this.beveledBox(parent,"bookcase-crest",[w*.46,shelf*1.5,d*.72],[0,h+shelf*.12,0],p.main,.022);
    this.beveledBox(parent,"bookcase-plinth",[w,shelf*1.7,d],[0,shelf*.85,0],p.woodDark,.018);
    for(const x of [-w*.38,w*.38])this.taperedLeg(parent,"bookcase-foot",h*.075,post*.82,[x,h*.037,d*.23],p.woodDark,x>0?.025:-.025);
    const levels=[.25,.43,.61,.79];
    for(const level of levels) this.beveledBox(parent,"bookcase-shelf",[innerW,shelf,d*.9],[0,h*level,0],p.woodLight,.01);
    const bookMaterials=[p.terracotta,p.green,p.blue,p.mustard,p.burgundy,p.cream];
    let bookIndex=0;
    for(let row=0;row<3;row+=1){let cursor=-innerW*.43;const baseY=h*(levels[row]+.02);while(cursor<innerW*.29&&bookIndex<18){const bw=Math.max(.035,w*(.045+(bookIndex%3)*.009));const bh=h*(.105+(bookIndex%4)*.014)*furnitureVariation(item.id,bookIndex,.08);this.book(parent,item.id,bookIndex,[bw,bh,d*.42],[cursor+bw/2,baseY+bh/2,-d*.16],bookMaterials[bookIndex%bookMaterials.length]);cursor+=bw*.98;bookIndex+=1;}}
    this.pot(parent,"shelf-pot",w*.13,h*.1,[innerW*.27,h*.86,-d*.08],p.terracotta);
    this.cushion(parent,"shelf-plant",[w*.11,h*.1,d*.2],[innerW*.27,h*.93,-d*.08],p.green,.2);
  }

  private storage({parent,definition,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    const foot=Math.min(h*.1,.12), cap=Math.max(.055,h*.06), front=-d*.47;
    if(definition.id==="nightstand"){
      const post=Math.max(.055,w*.1);
      this.beveledBox(parent,"nightstand-top",[w,cap,d],[0,h-cap/2,0],p.woodLight,.025);
      for(const x of [-w*.42,w*.42]) this.beveledBox(parent,"nightstand-side",[post,h*.76,d*.86],[x,h*.53,0],p.wood,.018);
      this.beveledBox(parent,"nightstand-back",[w*.78,h*.7,d*.06],[0,h*.51,d*.4],p.woodDark,.012);
      this.beveledBox(parent,"nightstand-drawer-box",[w*.76,h*.24,d*.72],[0,h*.72,0],p.wood,.018);
      this.beveledBox(parent,"nightstand-drawer",[w*.7,h*.18,d*.055],[0,h*.72,front],p.main,.012);
      this.knob(parent,"nightstand-knob",w*.075,[0,h*.72,front-.045],p.woodDark);
      this.beveledBox(parent,"nightstand-shelf",[w*.76,.055,d*.74],[0,h*.3,0],p.woodLight,.012);
      for(const x of [-w*.4,w*.4])for(const z of [-d*.34,d*.34])this.taperedLeg(parent,"nightstand-foot",foot,post*.82,[x,foot/2,z],p.woodDark,x>0?.025:-.025,z>0?.025:-.025);
      this.book(parent,item.id,61,[w*.3,h*.055,d*.42],[-w*.15,h*.35,0],p.burgundy);
      return;
    }
    const bodyH=h-foot-cap*.62;
    this.beveledBox(parent,"storage-body",[w*.94,bodyH,d*.92],[0,foot+bodyH/2,0],p.wood,.028);
    this.beveledBox(parent,"storage-cap",[w,cap,d],[0,h-cap/2,0],p.woodLight,.022);
    this.beveledBox(parent,"storage-plinth",[w*.98,cap*.85,d*.96],[0,foot+cap*.42,0],p.woodDark,.014);
    for(const x of [-w*.38,w*.38])for(const z of [-d*.32,d*.32])this.taperedLeg(parent,"storage-foot",foot,Math.min(.095,w*.1),[x,foot/2,z],p.woodDark,x>0?.018:-.018,z>0?.012:-.012);
    if(definition.id==="dresser"){
      for(let row=0;row<3;row+=1)for(let col=0;col<2;col+=1){const x=(col-.5)*w*.43,y=h*(.28+row*.22);this.beveledBox(parent,"dresser-drawer",[w*.39,h*.17,d*.055],[x,y,front],row===1?p.main:p.woodLight,.014);this.knob(parent,`dresser-knob-${row}-${col}`,w*.042,[x,y,front-.046],p.woodDark);}
      this.beveledBox(parent,"dresser-scallop",[w*.32,.025,d*.03],[0,h-.012,-d*.2],p.main,.008);
      return;
    }
    const doorH=bodyH*(definition.id==="wardrobe"?.82:.72);
    for(const side of [-1,1]){const x=side*w*.235;this.beveledBox(parent,"cabinet-door",[w*.42,doorH,d*.06],[x,foot+bodyH*.53,front],side===1?p.main:p.woodLight,.018);this.beveledBox(parent,"door-panel",[w*.31,doorH*.72,d*.03],[x,foot+bodyH*.53,front-.045],side===1?p.woodLight:p.main,.012);this.knob(parent,"cabinet-knob",w*.045,[x-side*w*.13,foot+bodyH*.53,front-.075],p.woodDark);}
    if(definition.id==="wardrobe"){
      this.beveledBox(parent,"wardrobe-crown",[w*1.04,cap*.72,d*1.04],[0,h-cap*.1,0],p.woodDark,.018);
      for(const side of [-1,1]) this.beveledBox(parent,"wardrobe-hinge",[w*.025,h*.095,d*.025],[side*w*.43,h*.67,front-.07],p.burgundy,.006);
    }else{
      this.pot(parent,"cabinet-pot",w*.17,h*.09,[w*.27,h-h*.045,0],p.terracotta);
      this.cylinder(parent,"cabinet-vase-stem",w*.025,h*.12,[w*.27,h+h*.05,0],p.green,6);
    }
  }

  private table({parent,definition,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    if(definition.id==="round-table"||definition.id==="side-table"){
      const topH=Math.max(.075,h*.12),diameter=Math.min(w,d);
      this.cylinder(parent,"round-top",diameter,topH,[0,h-topH/2,0],definition.id==="side-table"?p.main:p.woodLight,18);
      this.cylinder(parent,"round-top-rim",diameter*1.025,topH*.24,[0,h-topH*.16,0],p.woodDark,18);
      const stem=diameter*(definition.id==="side-table"?.18:.15);
      this.cylinder(parent,"round-pedestal",stem,h-topH,[0,(h-topH)/2,0],p.wood,10,stem*.82);
      const feet=definition.id==="side-table"?3:4;
      for(let i=0;i<feet;i+=1){const a=i*Math.PI*2/feet;const foot=this.beveledBox(parent,"pedestal-foot",[diameter*.34,.06,stem*.72],[0,.05,0],p.woodDark,.014);foot.rotation.y=-a;foot.position.x=Math.cos(a)*diameter*.14;foot.position.z=Math.sin(a)*diameter*.14;}
      if(definition.id==="side-table"){this.pot(parent,"acorn-bowl",diameter*.26,h*.095,[0,h+h*.047,0],p.terracotta);this.cylinder(parent,"acorn-lid",diameter*.18,h*.035,[0,h+h*.112,0],p.cream,10);}
      return;
    }
    const topH=Math.max(.075,h*.13), legH=h-topH, leg=Math.max(.065,Math.min(w,d)*FURNITURE_STYLE.legThicknessRatio);
    this.beveledBox(parent,"table-top",[w,topH,d],[0,h-topH/2,0],definition.id==="coffee-table"?p.main:p.woodLight,Math.min(.045,topH*.3));
    if(definition.id==="coffee-table"){
      for(const x of [-w*.4,w*.4])for(const z of [-d*.35,d*.35])this.taperedLeg(parent,"coffee-leg",legH,leg*1.05,[x,legH/2,z],p.woodDark,x>0?.025:-.025,z>0?.018:-.018);
      this.beveledBox(parent,"coffee-shelf",[w*.76,.05,d*.68],[0,h*.31,0],p.wood,.014);
      this.beveledBox(parent,"coffee-book",[w*.25,.04,d*.3],[-w*.18,h+.025,0],p.burgundy,.008);
      this.cylinder(parent,"coffee-cup",Math.min(w,d)*.13,h*.12,[w*.24,h+h*.06,-d*.08],p.cream,10,Math.min(w,d)*.11);
      return;
    }
    if(definition.id==="desk"){
      this.beveledBox(parent,"desk-apron",[w*.82,h*.1,d*.06],[-w*.03,h-topH-h*.055,d*.39],p.woodDark,.012);
      this.beveledBox(parent,"desk-drawer-bank",[w*.3,legH*.58,d*.7],[w*.29,legH*.49,0],p.wood,.025);
      for(let i=0;i<2;i+=1){const y=legH*(.37+i*.25);this.beveledBox(parent,"desk-drawer",[w*.24,legH*.19,.055],[w*.29,y,-d*.37],i?p.main:p.woodLight,.012);this.knob(parent,"desk-knob",w*.035,[w*.29,y,-d*.41],p.woodDark);}
      for(const x of [-w*.39,w*.08])for(const z of [-d*.32,d*.32])this.taperedLeg(parent,"desk-leg",legH,leg,[x,legH/2,z],p.woodDark,x>0?.018:-.018,z>0?.014:-.014);
      this.book(parent,"desk-book",71,[w*.23,h*.045,d*.28],[-w*.22,h+.025,d*.05],p.green);
      this.pot(parent,"desk-pencil-cup",w*.085,h*.11,[w*.34,h+h*.055,d*.08],p.terracotta);
      return;
    }
    // Harvest table: chunky trestles and a visible stretcher read clearly at miniature scale.
    for(const x of [-w*.34,w*.34]){
      this.beveledBox(parent,"trestle-post",[leg*1.45,legH,d*.18],[x,legH/2,0],p.wood,.02);
      this.beveledBox(parent,"trestle-foot",[w*.19,.075,d*.76],[x,.055,0],p.woodDark,.018);
      this.beveledBox(parent,"trestle-cap",[w*.2,.07,d*.72],[x,legH-.04,0],p.woodDark,.016);
    }
    this.beveledBox(parent,"table-stretcher",[w*.68,leg*.72,leg*.72],[0,legH*.38,0],p.woodDark,.014);
    for(const x of [-w*.25,0,w*.25])this.beveledBox(parent,"table-plank-line",[.012,.01,d*.9],[x,h-.006,0],p.woodDark,.003);
    this.cylinder(parent,"table-vase",Math.min(w,d)*.13,h*.17,[w*.1,h+h*.085,0],p.terracotta,10,Math.min(w,d)*.09);
  }

  private chair({parent,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    if(item.catalogId==="office-chair"){
      const seatY=h*.48,seatH=h*.13;
      this.cylinder(parent,"task-hub",w*.17,h*.13,[0,h*.2,0],p.woodDark,10,w*.13);
      this.cylinder(parent,"task-column",w*.075,h*.32,[0,h*.34,0],p.wood,10,w*.065);
      for(let i=0;i<5;i+=1){const a=i*Math.PI*2/5;const spoke=this.beveledBox(parent,"task-spoke",[w*.34,.045,w*.075],[0,h*.1,0],p.woodDark,.012);spoke.rotation.y=-a;spoke.position.x=Math.cos(a)*w*.15;spoke.position.z=Math.sin(a)*w*.15;const wheel=this.cylinder(parent,"task-wheel",w*.105,w*.065,[Math.cos(a)*w*.31,h*.065,Math.sin(a)*w*.31],p.burgundy,8);wheel.rotation.z=Math.PI/2;}
      this.cushion(parent,"task-seat",[w*.78,seatH,d*.67],[0,seatY,0],p.main,(furnitureVariation(item.id,3,.06)-1)*.1);
      const back=this.cushion(parent,"task-back",[w*.7,h*.34,d*.14],[0,h*.76,-d*.29],p.main);back.rotation.x=-.08;
      this.beveledBox(parent,"task-back-brace",[w*.08,h*.35,d*.08],[0,h*.62,-d*.25],p.woodDark,.014);
      for(const x of [-w*.38,w*.38]){this.beveledBox(parent,"task-arm-post",[w*.06,h*.22,w*.06],[x,h*.58,0],p.wood,.012);this.cushion(parent,"task-arm-pad",[w*.18,h*.055,d*.34],[x,h*.69,-d*.02],p.main);}
      return;
    }
    const seatY=h*.48,seatH=h*.115,legH=seatY-seatH/2,leg=Math.max(.05,w*.11);
    this.beveledBox(parent,"chair-seat-frame",[w*.9,seatH,d*.76],[0,seatY,0],p.wood,.025);
    this.cushion(parent,"chair-cushion",[w*.74,seatH*.72,d*.58],[0,seatY+seatH*.62,d*.015],p.main,(furnitureVariation(item.id,3,.08)-1)*.12);
    for(const x of [-w*.34,w*.34])for(const z of [-d*.29,d*.29])this.taperedLeg(parent,"chair-leg",legH,leg,[x,legH/2,z],p.woodDark,x>0?.02:-.02,z<0?.045:-.02);
    const postH=h-seatY+legH*.03;
    for(const x of [-w*.35,w*.35]){const post=this.taperedLeg(parent,"back-post",postH,leg,[x,seatY+postH/2-.01,-d*.34],p.wood,x>0?-.025:.025,.08);post.rotation.x=.05;}
    this.beveledBox(parent,"chair-back-crest",[w*.72,h*.085,.075],[0,h*.92,-d*.36],p.woodLight,.02);
    for(let i=0;i<3;i+=1){const slat=this.beveledBox(parent,"chair-slat",[w*.1,h*.32,.055],[(i-1)*w*.2,h*.73,-d*.35],i===1?p.main:p.woodLight,.016);slat.rotation.z=(i-1)*.035;}
  }

  private stool({parent,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    const diameter=Math.min(w,d),seatH=h*.15;
    this.cylinder(parent,"stool-seat-base",diameter*.9,seatH,[0,h-seatH/2,0],p.wood,16,diameter*.82);
    this.cylinder(parent,"stool-seat-cushion",diameter,seatH*.58,[0,h-seatH*.13,0],p.main,16,diameter*.86);
    const leg=diameter*.14;
    for(let i=0;i<3;i+=1){const a=Math.PI/2+i*Math.PI*2/3;this.taperedLeg(parent,"stool-leg",h*.82,leg,[Math.cos(a)*w*.25,h*.41,Math.sin(a)*d*.25],p.woodDark,Math.cos(a)*.055,Math.sin(a)*.055);}
    this.cylinder(parent,"stool-foot-ring",diameter*.58,.045,[0,h*.35,0],p.wood,12);
    this.beveledBox(parent,"stool-foot-rest",[diameter*.5,.05,diameter*.09],[0,h*.37,-d*.23],p.woodLight,.014);
  }

  private bed({parent,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    const single=item.catalogId==="single-bed",frameY=h*.24,railH=Math.max(.12,h*.18),mattressH=Math.max(.18,h*.24),headDepth=Math.max(.09,d*.052);
    this.beveledBox(parent,"bed-platform",[w*.97,railH,d*.9],[0,frameY,0],p.woodDark,.03);
    this.beveledBox(parent,"bed-foot-rail",[w,railH*1.05,headDepth],[0,frameY,d*.47],p.wood,.022);
    for(const x of [-w*.43,w*.43])for(const z of [-d*.42,d*.42])this.taperedLeg(parent,"bed-foot",h*.17,w*.055,[x,h*.085,z],p.woodDark,x>0?.01:-.01,z>0?.012:-.012);
    if(single){
      for(const x of [-w*.43,w*.43])this.beveledBox(parent,"single-head-post",[w*.08,h*.78,headDepth],[x,h*.61,-d*.47],p.wood,.018);
      this.beveledBox(parent,"single-head-crest",[w*.94,h*.1,headDepth*1.2],[0,h*.94,-d*.47],p.woodLight,.025);
      for(let i=0;i<4;i+=1){const spindle=this.taperedLeg(parent,"single-spindle",h*.48,w*.055,[(i-1.5)*w*.19,h*.63,-d*.47],i===1?p.main:p.woodDark,(i-1.5)*.01);spindle.rotation.z=(i-1.5)*.02;}
    }else{
      this.beveledBox(parent,"queen-headboard-frame",[w,h*.78,headDepth],[0,h*.61,-d*.47],p.wood,.04);
      this.cushion(parent,"queen-headboard-upholstery",[w*.86,h*.53,headDepth*.62],[0,h*.64,-d*.51],p.main);
      for(const x of [-w*.22,w*.22])for(const y of [h*.54,h*.73])this.knob(parent,"headboard-tuft",w*.025,[x,y,-d*.55],p.cream);
      this.beveledBox(parent,"queen-headboard-cap",[w,railH*.34,headDepth*1.3],[0,h-railH*.17,-d*.47],p.woodLight,.018);
    }
    this.cushion(parent,"mattress",[w*.91,mattressH,d*.8],[0,frameY+railH*.55+mattressH*.45,d*.005],p.cream);
    const blanketY=frameY+railH*.55+mattressH*.9;
    this.cushion(parent,"duvet",[w*.88,mattressH*.2,d*.5],[0,blanketY,d*.17],p.main);
    for(let i=0;i<3;i+=1)this.beveledBox(parent,"duvet-stitch",[w*.82,.014,.022],[0,blanketY+.035,d*(.04+i*.1)],i===1?p.cream:p.woodLight,.005);
    const pillowW=w*(single?.62:.34);
    for(const side of single?[0]:[-1,1]){const pillow=this.cushion(parent,"pillow",[pillowW,mattressH*.52,d*.2],[side*w*.22,blanketY+.095,-d*.29],p.cream,(furnitureVariation(item.id,side+8,.08)-1)*.18);pillow.rotation.x=-.08;}
  }

  private seat({parent,definition,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    if(definition.id==="bar-stool") return this.stool({parent,definition,item,width:w,depth:d,height:h,palette:p});
    if(definition.id==="bench"){
      this.beveledBox(parent,"bench-seat-frame",[w*.96,h*.12,d*.88],[0,h*.7,0],p.wood,.024);
      this.cushion(parent,"bench-cushion",[w*.9,h*.2,d*.82],[0,h*.82,0],p.main);
      for(const x of [-w*.4,w*.4])for(const z of [-d*.31,d*.31])this.taperedLeg(parent,"bench-leg",h*.68,w*.075,[x,h*.34,z],p.woodDark,x>0?.02:-.02,z>0?.012:-.012);
      this.beveledBox(parent,"bench-shelf",[w*.78,.06,d*.7],[0,h*.27,0],p.woodLight,.014);
      for(const x of [-w*.2,w*.18]){this.cushion(parent,"bench-basket",[w*.28,h*.22,d*.5],[x,h*.4,0],x<0?p.cream:p.terracotta);this.handle(parent,"basket-handle",w*.09,[x,h*.49,-d*.27],p.woodDark);}
      return;
    }
    if(definition.id==="ottoman"){
      this.beveledBox(parent,"ottoman-base",[w*.86,h*.43,d*.84],[0,h*.28,0],p.woodDark,.045);
      for(const x of [-w*.33,w*.33])for(const z of [-d*.32,d*.32])this.taperedLeg(parent,"ottoman-foot",h*.18,w*.07,[x,h*.09,z],p.woodDark,x>0?.025:-.025,z>0?.02:-.02);
      this.cushion(parent,"ottoman-top",[w,h*.54,d],[0,h*.69,0],p.main);
      this.beveledBox(parent,"ottoman-piping-x",[w*.86,.018,.022],[0,h*.96,0],p.cream,.005);
      this.beveledBox(parent,"ottoman-piping-z",[.022,.018,d*.86],[0,h*.96,0],p.cream,.005);
      for(const x of [-w*.2,w*.2])for(const z of [-d*.19,d*.19])this.knob(parent,"ottoman-tuft",w*.035,[x,h*.965,z],p.woodDark);
      return;
    }
    const armchair=definition.id==="armchair",cushionCount=definition.id==="sofa"?3:definition.id==="loveseat"?2:1;
    const baseH=h*.24,seatY=h*.39,seatH=h*.18,armW=armchair?w*.2:w*.14;
    this.beveledBox(parent,"upholstered-base",[w*.9,baseH,d*.78],[0,baseH/2,d*.01],p.main,.045);
    this.beveledBox(parent,"wooden-lower-rail",[w*.84,h*.075,d*.72],[0,h*.105,d*.02],p.woodDark,.018);
    for(const x of [-w*.39,w*.39])for(const z of [-d*.28,d*.28])this.taperedLeg(parent,"sofa-foot",h*.14,Math.max(.055,w*.045),[x,h*.07,z],p.woodDark,x>0?.025:-.025,z>0?.018:-.018);
    this.beveledBox(parent,"sofa-back-frame",[w*.72,h*.48,d*.11],[0,h*.63,-d*.34],p.wood,.035);
    const innerW=w-armW*2.05,gap=w*.016,each=(innerW-gap*(cushionCount-1))/cushionCount;
    for(let i=0;i<cushionCount;i+=1){
      const x=-innerW/2+each/2+i*(each+gap),tilt=(furnitureVariation(item.id,i,.06)-1)*.12;
      this.cushion(parent,"seat-cushion",[each*.94,seatH,d*.58],[x,seatY,d*.02],p.main,tilt);
      const back=this.cushion(parent,"back-cushion",[each*.91,h*.38,d*.16],[x*furnitureVariation(item.id,i+10,.025),h*.68,-d*.28],i===1&&cushionCount===3?p.cream:p.main,tilt);back.rotation.x=-.08;back.rotation.z=(furnitureVariation(item.id,i+20,.05)-1)*.08;
    }
    for(const x of [-w/2+armW*.52,w/2-armW*.52]){
      this.cushion(parent,"sofa-arm",[armW,h*.46,d*.72],[x,h*.43,0],p.main);
      this.beveledBox(parent,"arm-cap",[armW*.86,h*.045,d*.57],[x,h*.675,-d*.005],p.cream,.014);
    }
    if(armchair){
      const pillow=this.cushion(parent,"reading-pillow",[w*.42,h*.28,d*.12],[w*.11,h*.66,-d*.17],p.mustard);pillow.rotation.z=-.12;
    }else{
      for(const side of [-1,1]){const pillow=this.cushion(parent,"throw-pillow",[w*.16,h*.24,d*.12],[side*(innerW*.41),h*.57,-d*.1],side<0?p.terracotta:p.mustard);pillow.rotation.z=side*.12;}
    }
  }

  private lamp({parent,definition,width:w,height:h,palette:p}:BuilderArgs){
    if(definition.id==="table-lamp"){
      this.cylinder(parent,"lamp-foot",w*.62,h*.055,[0,h*.028,0],p.woodDark,14,w*.54);
      this.cylinder(parent,"ceramic-lamp-body",w*.58,h*.37,[0,h*.23,0],p.terracotta,12,w*.42);
      this.cylinder(parent,"lamp-neck",w*.16,h*.12,[0,h*.47,0],p.wood,10,w*.13);
      const shade=MeshBuilder.CreateCylinder("linen-shade",{diameterTop:w*.56,diameterBottom:w,height:h*.38,tessellation:14},this.scene);shade.position=new Vector3(0,h*.76,0);this.register(shade,parent,p.cream);
      this.cylinder(parent,"shade-trim-top",w*.58,h*.025,[0,h*.94,0],p.main,14);
      this.cylinder(parent,"shade-trim-bottom",w,h*.025,[0,h*.58,0],p.main,14);
      this.cylinder(parent,"lamp-finial",w*.09,h*.06,[0,h*.98,0],p.woodDark,8,w*.055);
      return;
    }
    this.cylinder(parent,"floor-lamp-base",w*.72,h*.055,[0,h*.028,0],p.woodDark,16,w*.64);
    this.cylinder(parent,"floor-lamp-pole",Math.max(.045,w*.1),h*.69,[0,h*.39,0],p.wood,10,Math.max(.038,w*.075));
    this.beveledBox(parent,"floor-lamp-arm",[w*.38,h*.055,w*.055],[w*.15,h*.74,0],p.wood,.014).rotation.z=-.18;
    this.cylinder(parent,"lamp-collar",w*.17,h*.07,[w*.31,h*.76,0],p.terracotta,10);
    const shade=MeshBuilder.CreateCylinder("bell-shade",{diameterTop:w*.4,diameterBottom:w*.92,height:h*.24,tessellation:14},this.scene);shade.position=new Vector3(w*.31,h*.87,0);shade.rotation.z=-.08;this.register(shade,parent,p.main);
    this.cylinder(parent,"shade-rim",w*.94,h*.025,[w*.31,h*.755,0],p.cream,14);
    this.cylinder(parent,"lamp-finial",w*.075,h*.055,[w*.31,h*.995,0],p.woodDark,8,w*.045);
  }

  private plant({parent,definition,item,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    const large=definition.id==="large-plant",potH=h*(large?.27:.33),potW=w*(large?.62:.68);
    this.pot(parent,"plant-pot",potW,potH,[0,potH/2,0],large?p.terracotta:p.main);
    this.cylinder(parent,"pot-foot",potW*.76,potH*.12,[0,potH*.06,0],p.woodDark,10,potW*.7);
    this.cylinder(parent,"pot-rim",potW*1.08,potH*.17,[0,potH*.88,0],p.cream,12,potW*1.02);
    this.cylinder(parent,"plant-soil",potW*.78,.025,[0,potH*.98,0],p.woodDark,12);
    const count=large?9:5;
    for(let i=0;i<count;i+=1){
      const a=i*2.399+(furnitureVariation(item.id,i,.08)-1),stemH=h*(large?(.3+(i%4)*.075):(.25+(i%3)*.085));
      const sx=Math.cos(a)*w*(large?.1:.07),sz=Math.sin(a)*d*(large?.1:.07);
      const stem=this.cylinder(parent,"plant-stem",Math.max(.018,w*.035),stemH,[sx,potH+stemH/2,sz],i%3?p.green:p.woodDark,7,Math.max(.012,w*.022));stem.rotation.z=Math.cos(a)*.12;stem.rotation.x=Math.sin(a)*.12;
      const leaf=this.leaf(parent,"plant-leaf",w*(large?.39:.45),h*(large?.25:.28),[sx+Math.cos(a)*w*.18,potH+stemH,sz+Math.sin(a)*d*.14],i%4===0?p.green:p.main);
      leaf.rotation.y=-a;leaf.rotation.z=Math.cos(a)*.48;leaf.rotation.x=-.18+Math.sin(a)*.2;
      if(large||i%2===0){const sideA=a+Math.PI*.78;const sideLeaf=this.leaf(parent,"plant-side-leaf",w*(large?.3:.34),h*(large?.2:.21),[sx+Math.cos(sideA)*w*.13,potH+stemH*.68,sz+Math.sin(sideA)*d*.11],i%3===0?p.mustard:p.green);sideLeaf.rotation.y=-sideA;sideLeaf.rotation.z=Math.cos(sideA)*.52;sideLeaf.rotation.x=-.12;}
    }
    if(large){const newLeaf=this.leaf(parent,"new-leaf",w*.2,h*.22,[0,h*.93,0],p.mustard);newLeaf.rotation.z=.18;}
  }

  private rug({parent,definition,width:w,depth:d,palette:p}:BuilderArgs){
    if(definition.id==="round-rug"){
      const diameter=Math.min(w,d);
      this.cylinder(parent,"round-rug",diameter,.028,[0,.018,0],p.main,32);
      this.cylinder(parent,"round-rug-border",diameter*.84,.012,[0,.036,0],p.cream,28);
      this.cylinder(parent,"round-rug-field",diameter*.69,.013,[0,.043,0],p.main,28);
      this.cylinder(parent,"round-rug-medallion",diameter*.3,.014,[0,.051,0],p.terracotta,18);
      for(let i=0;i<8;i+=1){const a=i*Math.PI/4;this.cylinder(parent,"rug-dot",diameter*.055,.014,[Math.cos(a)*diameter*.24,.054,Math.sin(a)*diameter*.24],i%2?p.mustard:p.green,8);}
      return;
    }
    this.beveledBox(parent,"runner-rug",[w,.028,d],[0,.018,0],p.main,.055);
    this.beveledBox(parent,"runner-inner-field",[w*.72,.014,d*.83],[0,.039,0],p.cream,.035);
    for(let i=-3;i<=3;i+=1){const stripe=this.beveledBox(parent,"runner-stripe",[w*.66,.012,d*.035],[0,.049,i*d*.105],i%2?p.terracotta:p.green,.006);stripe.rotation.y=(i%2)*.025;}
    for(let i=0;i<12;i+=1){const x=-w*.44+i*w*.08;this.beveledBox(parent,"rug-fringe",[w*.025,.02,d*.055],[x,.02,d*.52],i%2?p.cream:p.main,.004);this.beveledBox(parent,"rug-fringe",[w*.025,.02,d*.055],[x,.02,-d*.52],i%2?p.cream:p.main,.004);}
  }

  private decor({parent,definition,width:w,depth:d,height:h,palette:p}:BuilderArgs){
    if(definition.id==="mirror"){
      const frame=Math.max(.05,w*.09);
      this.beveledBox(parent,"mirror-glass",[w-frame*2,h-frame*2,d*.24],[0,h*.5,-d*.2],p.blue,Math.min(w,h)*.1);
      this.beveledBox(parent,"mirror-bottom",[w,frame,d],[0,frame*.6,0],p.woodDark,.018);
      for(const x of [-w/2+frame/2,w/2-frame/2])this.beveledBox(parent,"mirror-side",[frame,h,d],[x,h*.5,0],p.wood,.02);
      this.cushion(parent,"mirror-top",[w,frame*1.45,d],[0,h-frame*.55,0],p.woodLight);
      const sun=this.cylinder(parent,"sun-medallion",w*.19,d*.65,[0,h+frame*.5,0],p.terracotta,14);sun.rotation.x=Math.PI/2;
      for(let i=0;i<7;i+=1){const a=Math.PI*(.15+i*.116);const ray=this.beveledBox(parent,"sun-ray",[frame*.38,h*.11,d*.4],[Math.cos(a)*w*.24,h+frame*.5+Math.sin(a)*w*.24,0],i%2?p.woodLight:p.main,.01);ray.rotation.z=-a;}
      for(const x of [-w*.3,w*.3]){const foot=this.beveledBox(parent,"mirror-foot",[w*.22,h*.055,d*2.2],[x,h*.04,d*.35],p.woodDark,.014);foot.rotation.y=x>0?.08:-.08;}
      return;
    }
    const baseH=h*.32;
    this.cushion(parent,"pet-bed-base",[w*.9,baseH,d*.88],[0,baseH*.5,0],p.woodDark);
    this.cushion(parent,"pet-bed-cushion",[w*.72,h*.36,d*.65],[0,h*.28,0],p.cream);
    this.cushion(parent,"pet-bed-back",[w*.82,h*.52,d*.2],[0,h*.48,d*.35],p.main);
    for(const x of [-w*.4,w*.4])this.cushion(parent,"pet-bed-side",[w*.2,h*.44,d*.68],[x,h*.39,0],p.main);
    this.cushion(parent,"pet-bed-front",[w*.48,h*.32,d*.18],[0,h*.27,-d*.34],p.main);
    this.beveledBox(parent,"pet-bed-patch",[w*.16,.016,d*.13],[w*.16,h*.48,-d*.03],p.terracotta,.018);
  }
}

interface Palette { main:StandardMaterial; wood:StandardMaterial; woodLight:StandardMaterial; woodDark:StandardMaterial; cream:StandardMaterial; terracotta:StandardMaterial; green:StandardMaterial; blue:StandardMaterial; burgundy:StandardMaterial; mustard:StandardMaterial }
interface BuilderArgs { parent:TransformNode; definition:CatalogItem; item:FurniturePlacement; width:number; depth:number; height:number; palette:Palette }
