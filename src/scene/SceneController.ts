import { ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight, Matrix, Mesh, MeshBuilder, PointerEventTypes, Scene, ShadowGenerator, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import { catalog } from "../catalog";
import { deriveBoundaryWalls, rectangleBetweenCells } from "../domain";
import type { FloorPlan, FurniturePlacement, PlanDocumentV1, TileCell, Tool } from "../types";
import { FurnitureFactory } from "./FurnitureFactory";
import { FurnitureModelLibrary } from "./FurnitureModelLibrary";

interface Callbacks { onCell(x: number, z: number): void; onTileDraft(cells: TileCell[], present: boolean): void; onSelect(id?: string): void; onMove(id: string, xMm: number, zMm: number): void; onDraftMove(xMm: number, zMm: number): void; onWall(id: string): void }
export class SceneController {
  private engine: Engine; private scene: Scene; private camera: ArcRotateCamera; private root: TransformNode; private callbacks: Callbacks; private tool: Tool = "select"; private dragging?: string; private draggingDraft = false; private tileDragStart?: TileCell; private tileDragCurrent?: TileCell; private tileDraftRoot?: TransformNode; private tileDraftCells: TileCell[]=[]; private tileDraftPresent=true; private tileDraftAnchor?: Vector3; private activePlan?: PlanDocumentV1; private activeFloorId = ""; private selectedId?: string; private activeDraft?: FurniturePlacement; private previewNode?: TransformNode; private selectedNode?: TransformNode; private draftPosition?: { x: number; z: number }; private shadow: ShadowGenerator; private furnitureFactory: FurnitureFactory; private furnitureModels: FurnitureModelLibrary;
  constructor(private canvas: HTMLCanvasElement, callbacks: Callbacks) {
    this.callbacks = callbacks; this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
    this.scene = new Scene(this.engine); this.scene.clearColor = new Color4(0.72, 0.78, 0.62, 1); this.scene.ambientColor = new Color3(.12,.11,.09); this.scene.imageProcessingConfiguration.exposure=.72; this.scene.imageProcessingConfiguration.contrast=1.12;
    this.camera = new ArcRotateCamera("camera", -Math.PI / 4, Math.PI / 3.1, 18, new Vector3(2, 0, 2), this.scene); this.camera.attachControl(canvas, true); this.camera.lowerRadiusLimit = 4; this.camera.upperRadiusLimit = 40; this.camera.wheelPrecision = 35; this.camera.panningSensibility = 100;
    const hemi = new HemisphericLight("sky", new Vector3(0.2, 1, 0.1), this.scene); hemi.intensity = .62; hemi.diffuse = new Color3(1, .91, .78); hemi.groundColor = new Color3(.3,.37,.28);
    const sun = new DirectionalLight("sun", new Vector3(-.8, -1.5, .7), this.scene); sun.position = new Vector3(10, 18, -10); sun.intensity = .72; sun.diffuse=new Color3(1,.86,.68); this.shadow = new ShadowGenerator(1024, sun); this.shadow.useBlurExponentialShadowMap = true; this.shadow.blurKernel = 24; this.shadow.setDarkness(.3);
    this.root = new TransformNode("root", this.scene); this.furnitureFactory = new FurnitureFactory(this.scene,this.shadow); this.furnitureModels = new FurnitureModelLibrary(this.scene,this.shadow,()=>{if(this.activePlan)this.update(this.activePlan,this.activeFloorId,this.selectedId,this.activeDraft)}); this.makeMeadow(); this.bindPointers(); let frame=0; this.engine.runRenderLoop(() => {this.scene.render();frame+=1;if(frame%30===0)this.canvas.dataset.fps=this.engine.getFps().toFixed(1);}); window.addEventListener("resize", this.resize);
  }
  private resize = () => this.engine.resize();
  dispose() { window.removeEventListener("resize", this.resize); this.furnitureModels.dispose(); this.scene.dispose(); this.engine.dispose(); }
  setTool(tool: Tool) { if(tool!==this.tool)this.cancelTileDraft(); this.tool = tool; }
  screenshot() { return this.canvas.toDataURL("image/png"); }
  private pointOnActiveFloor(screenX: number, screenY: number) {
    if (!this.activePlan) return undefined;
    const ray = this.scene.createPickingRay(screenX, screenY, Matrix.Identity(), this.camera);
    const floorY = (this.activePlan.floors.find((floor) => floor.id === this.activeFloorId)?.elevationMm ?? 0) / 1000;
    const distance = (floorY - ray.origin.y) / ray.direction.y;
    if (!Number.isFinite(distance) || distance <= 0) return undefined;
    const point = ray.origin.add(ray.direction.scale(distance));
    return { x: Math.round(point.x * 20) * 50, z: Math.round(point.z * 20) * 50 };
  }
  private applyPreviewPosition(position: { x: number; z: number }) {
    if (!this.previewNode) return;
    this.previewNode.position.x = position.x / 1000;
    this.previewNode.position.z = position.z / 1000;
    this.draftPosition = position;
  }
  movePreviewFromClient(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return undefined;
    const position = this.pointOnActiveFloor(clientX - rect.left, clientY - rect.top);
    if (position) this.applyPreviewPosition(position);
    return position;
  }
  projectPreview() {
    if (!this.previewNode || !this.activeDraft) return undefined;
    const viewport = this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
    const anchor = this.previewNode.getAbsolutePosition().add(new Vector3(0, this.activeDraft.heightMm / 1000 + 0.22, 0));
    const projected = Vector3.Project(anchor, Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
    return { x: projected.x * this.canvas.clientWidth / this.engine.getRenderWidth(), y: projected.y * this.canvas.clientHeight / this.engine.getRenderHeight() };
  }
  projectSelected() {
    if (!this.selectedNode || !this.activePlan || !this.selectedId) return undefined;
    const item = this.activePlan.furniture.find((placement) => placement.id === this.selectedId);
    if (!item) return undefined;
    const viewport = this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
    const anchor = this.selectedNode.getAbsolutePosition().add(new Vector3(0, item.heightMm / 1000 + 0.22, 0));
    const projected = Vector3.Project(anchor, Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
    return { x: projected.x * this.canvas.clientWidth / this.engine.getRenderWidth(), y: projected.y * this.canvas.clientHeight / this.engine.getRenderHeight() };
  }
  private cellAtPointer(screenX:number,screenY:number){if(!this.activePlan)return undefined;const point=this.pointOnActiveFloor(screenX,screenY);if(!point)return undefined;const grid=this.activePlan.gridSizeMm;return{x:Math.floor(point.x/grid),z:Math.floor(point.z/grid)};}
  private renderTileDraft(start:TileCell,end:TileCell,present:boolean){
    this.tileDraftRoot?.dispose(false,false); this.tileDraftRoot=undefined; this.tileDraftCells=[]; this.tileDraftAnchor=undefined; if(!this.activePlan)return;
    const floor=this.activePlan.floors.find((item)=>item.id===this.activeFloorId); if(!floor)return;
    const occupied=new Set(floor.cells.map((cell)=>`${cell.x},${cell.z}`)); const all=rectangleBetweenCells(start,end); this.tileDraftCells=all.filter((cell)=>present?!occupied.has(`${cell.x},${cell.z}`):occupied.has(`${cell.x},${cell.z}`)); this.tileDraftPresent=present;
    if(!this.tileDraftCells.length)return;
    const scale=this.activePlan.gridSizeMm/1000; const root=new TransformNode("tile-draft",this.scene); root.parent=this.root; this.tileDraftRoot=root; const material=this.material("tile-draft-mat",present?"#80bd55":"#d27b67",.58);
    for(const cell of this.tileDraftCells){const tile=MeshBuilder.CreateBox("tile-draft-preview",{width:scale*.91,depth:scale*.91,height:.055},this.scene);tile.parent=root;tile.position=new Vector3((cell.x+.5)*scale,floor.elevationMm/1000+.085,(cell.z+.5)*scale);tile.material=material;tile.isPickable=false;tile.renderOutline=true;tile.outlineColor=Color3.FromHexString(present?"#568d35":"#a55242");tile.outlineWidth=.018;}
    const xs=this.tileDraftCells.map((cell)=>cell.x),zs=this.tileDraftCells.map((cell)=>cell.z);this.tileDraftAnchor=new Vector3((Math.min(...xs)+Math.max(...xs)+1)*scale/2,floor.elevationMm/1000+.38,(Math.min(...zs)+Math.max(...zs)+1)*scale/2);
  }
  projectTileDraft(){if(!this.tileDraftAnchor)return undefined;const viewport=this.camera.viewport.toGlobal(this.engine.getRenderWidth(),this.engine.getRenderHeight());const projected=Vector3.Project(this.tileDraftAnchor,Matrix.Identity(),this.scene.getTransformMatrix(),viewport);return{x:projected.x*this.canvas.clientWidth/this.engine.getRenderWidth(),y:projected.y*this.canvas.clientHeight/this.engine.getRenderHeight()};}
  cancelTileDraft(){this.tileDraftRoot?.dispose(false,false);this.tileDraftRoot=undefined;this.tileDraftCells=[];this.tileDraftAnchor=undefined;this.tileDragStart=undefined;this.tileDragCurrent=undefined;}
  private material(name: string, hex: string, alpha = 1) { const mat = new StandardMaterial(name, this.scene); mat.diffuseColor = Color3.FromHexString(hex); mat.roughness = .92; mat.specularColor = new Color3(.08,.07,.05); mat.alpha = alpha; return mat; }
  private makeMeadow() { const ground = MeshBuilder.CreateDisc("meadow", { radius: 15, tessellation: 64 }, this.scene); ground.rotation.x = Math.PI / 2; ground.position.y = -.15; ground.material = this.material("meadow-mat", "#9cab77"); ground.receiveShadows = true; }
  update(plan: PlanDocumentV1, activeFloorId: string, selectedId?: string, draft?: FurniturePlacement) {
    this.activePlan = plan; this.activeFloorId = activeFloorId; this.selectedId = selectedId; this.activeDraft = draft; this.draftPosition = draft ? { x: draft.x, z: draft.z } : undefined; this.previewNode = undefined; this.selectedNode = undefined; this.tileDraftRoot=undefined; this.tileDraftCells=[]; this.tileDraftAnchor=undefined; for (const node of [...this.root.getChildren()]) node.dispose(false, false); this.furnitureFactory.resetMaterials();
    const activeIndex = plan.floors.findIndex((f) => f.id === activeFloorId); const floors = plan.camera.mode === "dollhouse" ? plan.floors : plan.floors.filter((f, i) => f.id === activeFloorId || (plan.camera.ghostBelow && i === activeIndex - 1));
    for (const floor of floors) this.buildFloor(plan, floor, floor.id !== activeFloorId);
    const activeFloor = plan.floors[activeIndex];
    if (draft && activeFloor && draft.floorId === activeFloor.id) this.buildFurniture(draft, activeFloor.elevationMm / 1000, false, true);
    if (activeFloor?.cells.length) { const xs=activeFloor.cells.map(c=>c.x); const zs=activeFloor.cells.map(c=>c.z); const scale=plan.gridSizeMm/1000; const width=(Math.max(...xs)-Math.min(...xs)+1)*scale; const depth=(Math.max(...zs)-Math.min(...zs)+1)*scale; this.camera.setTarget(new Vector3((Math.min(...xs)+Math.max(...xs)+1)*scale/2, activeFloor.elevationMm/1000+.3, (Math.min(...zs)+Math.max(...zs)+1)*scale/2)); this.camera.radius=Math.max(6,Math.max(width,depth)*1.8); }
    if (activeFloor && (this.tool === "paint" || this.tool === "erase" || this.tool === "wall" || this.tool === "stairs")) { const editGrid = MeshBuilder.CreateGround("edit-grid", { width: 40, height: 40, subdivisions: 1 }, this.scene); editGrid.parent = this.root; editGrid.position = new Vector3(5, activeFloor.elevationMm / 1000 - .055, 5); editGrid.material = this.material("edit-grid-mat", "#f7f1e3", .001); editGrid.isPickable = true; }
    if (plan.camera.mode === "top") { this.camera.alpha = -Math.PI / 2; this.camera.beta = .05; this.camera.radius = Math.max(7,this.camera.radius*.95); } else if (plan.camera.mode === "dollhouse") { this.camera.alpha = -Math.PI / 4; this.camera.beta = Math.PI / 2.8; this.camera.radius = Math.max(9,this.camera.radius*1.3); } else { this.camera.alpha = -Math.PI / 4; this.camera.beta = Math.PI / 3.1; }
    this.canvas.dataset.meshes = String(this.scene.meshes.length);
  }
  private buildFloor(plan: PlanDocumentV1, floor: FloorPlan, ghost: boolean) {
    const scale = plan.gridSizeMm / 1000; const elevation = floor.elevationMm / 1000; const tileMat = this.material(`tile-${floor.id}`, ghost ? "#d6cfb4" : "#d8bd91", ghost ? .22 : 1); const groutMat = this.material(`grout-${floor.id}`, "#a98e6b", ghost ? .15 : .65);
    for (const cell of floor.cells) { const tile = MeshBuilder.CreateBox(`cell:${cell.x}:${cell.z}`, { width: plan.camera.showGrid ? scale*.94 : scale, depth: plan.camera.showGrid ? scale*.94 : scale, height: .08 }, this.scene); tile.parent=this.root; tile.position=new Vector3((cell.x+.5)*scale,elevation,(cell.z+.5)*scale); tile.material=tileMat; tile.receiveShadows=true; tile.isPickable=!ghost; if(plan.camera.showGrid){ const grout=MeshBuilder.CreateBox(`grout:${cell.x}:${cell.z}`,{width:scale,depth:scale,height:.025},this.scene); grout.parent=this.root; grout.position=new Vector3((cell.x+.5)*scale,elevation-.035,(cell.z+.5)*scale); grout.material=groutMat; } }
    const boundaries = deriveBoundaryWalls(floor.cells); for (const wall of [...boundaries, ...floor.walls]) this.buildWall(wall.id, wall.ax*scale, wall.az*scale, wall.bx*scale, wall.bz*scale, elevation, ghost, floor.openings.some((o)=>o.wallKey===wall.id) ? floor.openings.find((o)=>o.wallKey===wall.id)?.kind : undefined);
    for (const stair of floor.stairs) this.buildStairs(stair.x/1000, stair.z/1000, stair.widthMm/1000, stair.lengthMm/1000, elevation, ghost);
    for (const item of plan.furniture.filter((f) => f.floorId === floor.id)) this.buildFurniture(item, elevation, ghost);
  }
  private buildWall(id: string, ax:number,az:number,bx:number,bz:number,y:number,ghost:boolean,opening?:"door"|"window") { const length=Math.hypot(bx-ax,bz-az); const horizontal=Math.abs(az-bz)<.001; const facesCamera=(horizontal&&bx>ax)||(!horizontal&&bz>az); const wall=MeshBuilder.CreateBox(`wall:${id}`,{width:length,height:1.65,depth:.1},this.scene); wall.parent=this.root; wall.position=new Vector3((ax+bx)/2,y+.84,(az+bz)/2); wall.rotation.y=-Math.atan2(bz-az,bx-ax); wall.material=this.material(`wall-mat-${id}`,"#eadbb7",ghost?.18:facesCamera?.22:.94); wall.isPickable=!ghost&&(this.tool==="door"||this.tool==="window"); wall.receiveShadows=true; this.shadow.addShadowCaster(wall); if(opening){ const marker=MeshBuilder.CreateBox(`opening:${id}`,{width:opening==="door"?.68:.8,height:opening==="door"?1.25:.68,depth:.12},this.scene); marker.parent=this.root; marker.position=wall.position.clone(); marker.position.y=y+(opening==="door"?.64:1.02); marker.rotation.y=wall.rotation.y; marker.material=this.material(`opening-mat-${id}`,opening==="door"?"#8a6046":"#9ec8c3",ghost?.15:facesCamera?.25:.95); marker.isPickable=!ghost&&(this.tool==="door"||this.tool==="window"); } }
  private addBox(parent:TransformNode,name:string,size:[number,number,number],pos:[number,number,number],mat:StandardMaterial){const box=MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},this.scene);box.parent=parent;box.position=new Vector3(...pos);box.material=mat;box.receiveShadows=true;this.shadow.addShadowCaster(box);return box;}
  private buildFurniture(item:FurniturePlacement,elevation:number,ghost:boolean,preview=false){
    const def=catalog.find((c)=>c.id===item.catalogId); if(!def)return;
    const node=new TransformNode(preview?"draft-furniture":`item:${item.id}`,this.scene); node.parent=this.root; node.position=new Vector3(item.x/1000,elevation+.05,item.z/1000); node.rotation.y=item.rotation*Math.PI/180;
    if(!preview&&!ghost&&item.id===this.selectedId)this.selectedNode=node;
    const w=item.widthMm/1000,d=item.depthMm/1000,h=item.heightMm/1000;
    if(!this.furnitureModels.build(node,def,item,w,d,h,ghost))this.furnitureFactory.build(node,def,item,w,d,h,ghost);
    if(preview){
      this.previewNode=node;
      const footprint=this.addBox(node,"draft-footprint",[w+.08,.025,d+.08],[0,-.02,0],this.material(`draft-footprint-${item.id}`,"#8bbf58",.42)); footprint.isPickable=false;
    } else if(this.activePlan?.camera.showClearance&&!ghost){
      const clearance=this.addBox(node,"clearance",[w+.6,.018,d+.6],[0,.012,0],this.material(`clear-${item.id}`,"#d89a73",.22)); clearance.isPickable=false;
    }
    node.getChildMeshes().forEach((mesh)=>{
      if(preview&&mesh.name!=="draft-footprint"){
        mesh.name="draft-preview"; mesh.isPickable=true; mesh.visibility=.55; mesh.renderOutline=true; mesh.outlineColor=new Color3(.47,.78,.25); mesh.outlineWidth=.035;
      }else if(mesh.name!=="clearance"&&mesh.name!=="draft-footprint"){
        mesh.name=`item:${item.id}`; mesh.isPickable=!ghost;
      }
      if(!preview&&item.id===this.selectedId){mesh.renderOutline=true;mesh.outlineColor=new Color3(.42,.57,.31);mesh.outlineWidth=.025;}
    });
  }
  private buildStairs(x:number,z:number,w:number,d:number,y:number,ghost:boolean){const mat=this.material(`stairs-${x}-${z}`,"#a9815f",ghost?.18:1);for(let i=0;i<10;i++){const step=this.addBox(this.root,"stairs",[w,.12,d/10],[x,y+.06+i*.12,z+i*d/10],mat);step.isPickable=!ghost;}}
  private bindPointers(){
    let moved=false;
    this.scene.onPointerObservable.add((info)=>{
      if(info.type===PointerEventTypes.POINTERDOWN){
        moved=false;
        const pick=this.scene.pick(this.scene.pointerX,this.scene.pointerY); const name=pick?.pickedMesh?.name||"";
        if(this.tool==="paint"||this.tool==="erase"){
          const cell=this.cellAtPointer(this.scene.pointerX,this.scene.pointerY); if(!cell)return; this.tileDragStart=cell; this.tileDragCurrent=cell; this.renderTileDraft(cell,cell,this.tool==="paint"); this.callbacks.onSelect(undefined); this.camera.detachControl();
        }else if(name==="draft-preview"&&this.tool==="select"){
          this.draggingDraft=true; this.camera.detachControl();
        }else if(name.startsWith("item:")&&this.tool==="select"){
          this.dragging=name.split(":")[1]; this.callbacks.onSelect(this.dragging); this.camera.detachControl();
        }else if(name.startsWith("cell:")){
          const[,x,z]=name.split(":"); this.callbacks.onCell(Number(x),Number(z));
        }else if(name==="edit-grid"&&pick?.pickedPoint&&this.activePlan){
          const grid=this.activePlan.gridSizeMm/1000; this.callbacks.onCell(Math.floor(pick.pickedPoint.x/grid),Math.floor(pick.pickedPoint.z/grid));
        }else if(name.startsWith("wall:"))this.callbacks.onWall(name.slice(5));
        else this.callbacks.onSelect(undefined);
      }
      if(info.type===PointerEventTypes.POINTERMOVE&&this.tileDragStart){
        const cell=this.cellAtPointer(this.scene.pointerX,this.scene.pointerY); if(cell&&(cell.x!==this.tileDragCurrent?.x||cell.z!==this.tileDragCurrent?.z)){this.tileDragCurrent=cell;this.renderTileDraft(this.tileDragStart,cell,this.tool==="paint");}
      }else if(info.type===PointerEventTypes.POINTERMOVE&&this.draggingDraft){
        const position=this.pointOnActiveFloor(this.scene.pointerX,this.scene.pointerY); if(position)this.applyPreviewPosition(position);
      }else if(info.type===PointerEventTypes.POINTERMOVE&&this.dragging){
        const position=this.pointOnActiveFloor(this.scene.pointerX,this.scene.pointerY);
        if(position){this.callbacks.onMove(this.dragging,position.x,position.z);moved=true;}
      }
      if(info.type===PointerEventTypes.POINTERUP&&this.tileDragStart){
        const cells=[...this.tileDraftCells],present=this.tileDraftPresent; this.tileDragStart=undefined; this.tileDragCurrent=undefined; this.camera.attachControl(this.canvas,true); if(cells.length)this.callbacks.onTileDraft(cells,present);else this.cancelTileDraft();
      }else if(info.type===PointerEventTypes.POINTERUP&&this.draggingDraft){
        this.draggingDraft=false; this.camera.attachControl(this.canvas,true); if(this.draftPosition)this.callbacks.onDraftMove(this.draftPosition.x,this.draftPosition.z);
      }else if(info.type===PointerEventTypes.POINTERUP&&this.dragging){
        this.dragging=undefined; this.camera.attachControl(this.canvas,true); if(moved)this.update(this.activePlan!,this.activeFloorId,this.selectedId,this.activeDraft);
      }
    });
  }
}
