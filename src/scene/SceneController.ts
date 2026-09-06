import {extendFurniture,moduleSegments,isRailing} from '../modularFurniture';
import {configurePlanCoordinates, planViewAngles, applyPlanView, updatePlanProjection} from './planCoordinates';
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Scene } from "@babylonjs/core/scene";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
// These scene features register through side effects; keep them with focused imports.
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Rendering/outlineRenderer";
import { floorBoundaryWalls, floorRects, type MeasuredRegion } from "../floorGeometry";
import { visibleFloorRects } from "../building";
import { splitWallSections } from "../wallSections";
import { cameraUpdatePolicy, comfortableCamera,closeZoomLimit,closeClipPlane,precisionPanSensitivity,detailFocusRadius } from "../cameraPolicy";
import { catalog, isWindow, isDoor, isStairs, isWallOpening, isSurfaceMounted, isKitchenWall } from "../catalog";
import { tabletopPoint, type PlacementPoint } from "../tabletop";
import { snapWindow, windowProblem, windowWallPieces, wallRuns } from "../windows";
import { deriveBoundaryWalls, rectangleBetweenCells } from "../domain";
import { findDoorFinish, findFloorFinish, findWallFinish, type SurfaceFinish } from "../surfaces";
import type { FloorPlan, FurniturePlacement, Opening, PlanDocumentV1, TileCell, Tool, WallSegment } from "../types";
import { OutdoorScene } from "./OutdoorScene";
import { outsidePlacementPoint,landscapeBounds } from "../outdoors";
import { FurnitureFactory } from "./FurnitureFactory";
import { FurnitureModelLibrary } from "./FurnitureModelLibrary";
import { getWallVisibility, isWallHidden, openingHostWall, WallVisibilityController, type WallGeometry } from "../wallVisibility";

import { snapWallStart, snapWallEnd, wallBetween, wallPlateIds } from "../wallEditing";
import { architectureKey } from '../sceneUpdate';
import {TerrainScene} from './TerrainScene';
import {usePlanner} from '../store';
import type {TerrainStroke} from '../terrain';
import {terrainRay} from '../terrain';
import {scatterPlants} from '../planting';
import {cameraFacingRotation} from '../placementFacing';

interface Callbacks { onCell(x: number, z: number): void; onWallSegment(wall:Omit<WallSegment,"id">):void; onTileDraft(cells: TileCell[], present: boolean): void; onSelect(id?: string): void; onMove(id: string, xMm: number, zMm: number, elevationMm?:number,rotation?:number): void; onDraftMove(xMm: number, zMm: number, elevationMm?:number,rotation?:number): void; onRotate(id:string|undefined,rotation:number):void; onWall(id: string): void }
export class SceneController {
  private plantingPoints?:Array<{x:number;z:number}>;
  private plantingNodes=new Map<string,{node:TransformNode;born:number;loaded:boolean}>();
  private plantingItems:FurniturePlacement[]=[];
  private plantingAnchor?:Vector3;
  private terrainStarted=0;private terrainLastPreview=0;private terrainBase?:PlanDocumentV1;
  private plantingBase?:PlanDocumentV1;
  private terrain!:TerrainScene;
  private terrainStroke?:TerrainStroke;
  private terrainCue?:Mesh;
  private architectureStamp = '';
  private retainFloorTiles=false;
  private rotationDrag?:{item:FurniturePlacement;node:TransformNode;startX:number;rotation:number;draft:boolean};
  private architectureTool?:Tool;private architectureWall?:string;
  private refreshModels = new Set<string>();
  private furnitureNodes = new Map<string, {node:TransformNode; signature:string}>();
  private solidMaterials=new Map<string,StandardMaterial>();
  private outdoors:OutdoorScene;
  private selectedWallId?:string;
  private selectedWallIds=new Set<string>();
  private wallSnapMarkers:Mesh[]=[];
  setWallSelection(id?:string){this.selectedWallId=id;}
  private wallVisibility = new WallVisibilityController();
  private floorWallGeometry = new Map<string, WallGeometry[]>();
  private engine: Engine; private scene: Scene; private camera: ArcRotateCamera; private root: TransformNode; private callbacks: Callbacks; private tool: Tool = "select"; private dragging?: string; private draggedPosition?: PlacementPoint; private draggingDraft = false; private tileDragStart?: TileCell; private tileDragCurrent?: TileCell; private tileDraftRoot?: TransformNode; private tileDraftCells: TileCell[]=[]; private tileDraftPresent=true; private measuredDraft?:MeasuredRegion; private tileDraftAnchor?: Vector3; private wallDragStart?:TileCell; private wallDragCurrent?:TileCell; private wallDraft?:Omit<WallSegment,"id">; private wallDraftMesh?:Mesh; private surfaceMaterials=new Map<string,StandardMaterial>(); private activePlan?: PlanDocumentV1; private activeFloorId = ""; private selectedId?: string; private activeDraft?: FurniturePlacement; private previewNode?: TransformNode; private selectedNode?: TransformNode; private draftPosition?: PlacementPoint; private shadow: ShadowGenerator; private furnitureFactory: FurnitureFactory; private furnitureModels: FurnitureModelLibrary;
  constructor(private canvas: HTMLCanvasElement, callbacks: Callbacks) {
    this.callbacks = callbacks; this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
    this.scene = new Scene(this.engine); configurePlanCoordinates(this.scene); this.scene.clearColor = new Color4(0.72, 0.78, 0.62, 1); this.scene.ambientColor = new Color3(.12,.11,.09); this.scene.imageProcessingConfiguration.exposure=.72; this.scene.imageProcessingConfiguration.contrast=1.12;
    this.camera = new ArcRotateCamera("camera", planViewAngles("isometric").alpha, planViewAngles("isometric").beta, 18, new Vector3(2, 0, 2), this.scene); this.camera.attachControl(canvas, true); this.camera.lowerRadiusLimit = closeZoomLimit; this.camera.minZ=closeClipPlane; this.camera.upperRadiusLimit = 80; this.camera.wheelPrecision = 35; Object.assign(this.camera, comfortableCamera);
    const hemi = new HemisphericLight("sky", new Vector3(0.2, 1, 0.1), this.scene); hemi.intensity = .62; hemi.diffuse = new Color3(1, .91, .78); hemi.groundColor = new Color3(.3,.37,.28);
    const sun = new DirectionalLight("sun", new Vector3(-.8, -1.5, .7), this.scene); sun.position = new Vector3(10, 18, -10); sun.intensity = .72; sun.diffuse=new Color3(1,.86,.68); this.shadow = new ShadowGenerator(1024, sun); this.shadow.useBlurExponentialShadowMap = true; this.shadow.blurKernel = 24; this.shadow.setDarkness(.3); this.shadow.customAllowRendering=subMesh=>this.wallVisibility.allowsShadow(subMesh.getMesh());
    this.root = new TransformNode("root", this.scene); this.furnitureFactory = new FurnitureFactory(this.scene,this.shadow); this.furnitureModels = new FurnitureModelLibrary(this.scene,this.shadow,(ids)=>{ids.forEach(id=>this.refreshModels.add(id));if(this.plantingItems.length)this.renderPlantingPreview(this.plantingItems,true);if(this.activePlan&&!this.dragging&&!this.draggingDraft&&!this.rotationDrag)this.update(this.activePlan,this.activeFloorId,this.selectedId,this.activeDraft)}); this.makeMeadow(); this.outdoors=new OutdoorScene(this.scene); this.terrain=new TerrainScene(this.scene); this.bindPointers();this.canvas.addEventListener('contextmenu',this.contextMenu);this.canvas.addEventListener('pointercancel',this.cancelOutdoorStroke);window.addEventListener('blur',this.cancelOutdoorStroke); let frame=0; this.engine.runRenderLoop(() => {this.camera.panningSensibility=precisionPanSensitivity(this.camera.radius);this.camera.minZ=Math.max(closeClipPlane,Math.min(1,this.camera.radius*.001));const start=performance.now();this.scene.render();const renderMs=performance.now()-start;frame+=1;if(frame%30===0){this.canvas.dataset.fps=this.engine.getFps().toFixed(1);this.canvas.dataset.renderMs=renderMs.toFixed(1);this.canvas.dataset.cameraRadius=this.camera.radius.toFixed(3);}}); window.addEventListener("resize", this.resize);
    // Hover does not select furniture; dragging already uses explicit picking.
    this.scene.skipPointerMovePicking = true;
    this.scene.onBeforeRenderObservable.add(() => {
      updatePlanProjection(this.camera,this.engine.getRenderWidth()/this.engine.getRenderHeight());
      if(!this.plantingPoints&&!usePlanner.getState().plantingDraft&&this.plantingNodes.size)this.clearPlantingPreview();
      for(const p of this.plantingNodes.values()){const a=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,(performance.now()-p.born)/300);p.node.scaling.setAll(.8+.2*a);for(const m of p.node.getChildMeshes())m.visibility=.7*a;}
      if(this.terrainStroke&&this.terrainBase&&performance.now()-this.terrainLastPreview>65){this.terrainLastPreview=performance.now();const strength=this.terrainStroke.strength*Math.min(1,(performance.now()-this.terrainStarted)/900);this.terrain.update({...this.terrainBase,environment:{background:'plain',grass:'off',...this.terrainBase.environment,terrain:[...(this.terrainBase.environment?.terrain??[]),{...this.terrainStroke,strength}]}});this.scene.getMeshByName('meadow')?.setEnabled(false);}
      if (this.activePlan) this.wallVisibility.update(getWallVisibility(this.activePlan.camera), this.camera.position, this.camera.target, this.engine.getDeltaTime(), window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??false);
    });
  }
  viewSurroundings(){if(!this.activePlan)return;const b=landscapeBounds(this.activePlan);this.camera.setTarget(new Vector3(b.x,0,b.z));this.camera.mode=0;this.camera.beta=1.05;this.camera.alpha=Math.PI/2;this.camera.upperRadiusLimit=Math.max(100,b.radius*2.5);this.camera.radius=this.activePlan.environment?.background==='city'?650:Math.max(40,b.radius*2.2);this.camera.upperRadiusLimit=Math.max(this.camera.upperRadiusLimit??100,this.camera.radius*2);this.camera.inertialRadiusOffset=0;}
  zoom(factor:number){this.camera.radius=Math.max(closeZoomLimit,Math.min(this.camera.upperRadiusLimit??80,this.camera.radius*factor));this.camera.inertialRadiusOffset=0;}
  focusFloor(plan:PlanDocumentV1,floorId:string){
    applyPlanView(this.camera, plan.camera.mode);
    this.camera.inertialAlphaOffset=0;this.camera.inertialBetaOffset=0;
    const floor=plan.floors.find(f=>f.id===floorId);if(!floor?.cells.length)return;
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(const r of floorRects(floor,plan.gridSizeMm)){left=Math.min(left,r.x);right=Math.max(right,r.x+r.width);top=Math.min(top,r.z);bottom=Math.max(bottom,r.z+r.depth);}
    this.camera.inertialPanningX=0;this.camera.inertialPanningY=0;this.camera.inertialRadiusOffset=0;
    this.camera.setTarget(new Vector3((left+right)/2000,floor.elevationMm/1000+.3,(top+bottom)/2000));const radius=Math.max(6,Math.max(right-left,bottom-top)/1000*1.8);this.camera.upperRadiusLimit=Math.max(80,radius);this.camera.radius=radius;
  }
  placementRotation(id:string,x:number,z:number){return cameraFacingRotation(id,this.camera.position,{x:x/1000,z:z/1000});}
  focusSelected(){const item=this.activePlan?.furniture.find(i=>i.id===this.selectedId);if(!item||!this.selectedNode)return;this.camera.inertialPanningX=0;this.camera.inertialPanningY=0;this.camera.inertialRadiusOffset=0;this.camera.setTarget(this.selectedNode.position.add(new Vector3(0,item.heightMm/2000,0)));this.camera.radius=detailFocusRadius(item.widthMm,item.depthMm,item.heightMm);}
  private cancelOutdoorStroke=()=>{if(this.rotationDrag){this.rotationDrag.node.rotation.y=this.rotationDrag.item.rotation*Math.PI/180;this.rotationDrag=undefined;}if(this.terrainStroke){this.terrainStroke=undefined;if(this.activePlan){this.terrain.update(this.activePlan);this.scene.getMeshByName('meadow')?.setEnabled(!this.activePlan.environment?.terrain?.length&&this.activePlan.environment?.background!=='city');}}if(this.plantingPoints){this.plantingPoints=undefined;this.clearPlantingPreview();}this.camera.attachControl(this.canvas,true);};
  private contextMenu=(event:Event)=>{if(this.selectedId||this.activeDraft)event.preventDefault();};
  private resize = () => this.engine.resize();
  dispose() { this.canvas.removeEventListener('contextmenu',this.contextMenu);this.canvas.removeEventListener('pointercancel',this.cancelOutdoorStroke);window.removeEventListener('blur',this.cancelOutdoorStroke);this.clearPlantingPreview();window.removeEventListener("resize", this.resize); this.outdoors.dispose();this.terrain.dispose(); this.furnitureModels.dispose(); this.scene.dispose(); this.engine.dispose(); }
  setTool(tool: Tool) { if(tool!==this.tool){this.plantingPoints=undefined;this.clearPlantingPreview();this.terrainStroke=undefined;if(this.activePlan){this.terrain.update(this.activePlan);this.scene.getMeshByName('meadow')?.setEnabled(!this.activePlan.environment?.terrain?.length&&this.activePlan.environment?.background!=='city');}this.terrainCue?.dispose();this.terrainCue=undefined;this.camera.attachControl(this.canvas,true);this.cancelTileDraft();this.cancelWallDraft();} this.tool = tool; }
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
  private positionForItem(screenX:number,screenY:number,item?:FurniturePlacement):PlacementPoint|undefined {
    const ray=this.scene.createPickingRay(screenX,screenY,Matrix.Identity(),this.camera);
    const movable=item&&!isRailing(item.catalogId)&&!isWallOpening(item.catalogId)&&!isKitchenWall(item.catalogId)&&!isStairs(item.catalogId)&&catalog.find(c=>c.id===item.catalogId)?.mount==="floor";
    const floorPoint=item&&this.activePlan&&(movable||isSurfaceMounted(item.catalogId))?outsidePlacementPoint(this.activePlan,item,ray.origin,ray.direction):this.pointOnActiveFloor(screenX,screenY);
    if(item&&isSurfaceMounted(item.catalogId)&&this.activePlan){
      const ray=this.scene.createPickingRay(screenX,screenY,Matrix.Identity(),this.camera);
      return tabletopPoint(this.activePlan,item,ray.origin,ray.direction)??floorPoint;
    }
    if(!item||(!isWallOpening(item.catalogId)&&!isKitchenWall(item.catalogId))||!this.activePlan)return floorPoint;
    const floor=this.activePlan.floors.find(f=>f.id===item.floorId);if(!floor)return floorPoint;
    const hits=wallRuns(floor,this.activePlan.gridSizeMm,(wall,boundary)=>{const s=this.activePlan!.gridSizeMm/1000;const geometry={ax:wall.ax*s,az:wall.az*s,bx:wall.bx*s,bz:wall.bz*s,boundary};return !isWallHidden(getWallVisibility(this.activePlan!.camera),geometry,this.camera.position,this.camera.target)&&this.wallVisibility.allowsInteraction(geometry);}).filter(run=>run.end-run.start>=item.widthMm+(isKitchenWall(item.catalogId)?0:40)).flatMap(run=>{
      const direction=run.horizontal?ray.direction.z:ray.direction.x;
      if(Math.abs(direction)<.0001)return [];
      const origin=run.horizontal?ray.origin.z:ray.origin.x;
      const distance=(run.line/1000-origin)/direction;if(distance<=0)return [];
      const point=ray.origin.add(ray.direction.scale(distance)),along=(run.horizontal?point.x:point.z)*1000;
      if(along<run.start||along>run.end||point.y*1000<floor.elevationMm||point.y*1000>floor.elevationMm+floor.heightMm)return [];
      return [{x:point.x*1000,z:point.z*1000,y:point.y*1000,distance,run}];
    }).sort((a,b)=>a.distance-b.distance);
    const point=hits[0];
    return point?snapWindow(this.activePlan,{...item,x:point.x,z:point.z,...(isKitchenWall(item.catalogId)?{
      elevationMm:Math.max(0,point.y-floor.elevationMm-item.heightMm/2-50),
      rotation:point.run.horizontal?(ray.origin.z*1000>=point.run.line?0:180):(ray.origin.x*1000>=point.run.line?90:270)
    }:{})},[point.run]):undefined;
  }
  private applyPreviewPosition(position: PlacementPoint) {
    if (!this.previewNode) return;
    const mounted=this.activePlan&&this.activeDraft?snapWindow(this.activePlan,{...this.activeDraft,...position}):undefined;
    if(mounted){position=mounted;this.previewNode.rotation.y=mounted.rotation*Math.PI/180;}
    this.previewNode.position.x = position.x / 1000;
    this.previewNode.position.z = position.z / 1000;
    if(position.elevationMm!==undefined&&this.activePlan){const floor=this.activePlan.floors.find(f=>f.id===this.activeFloorId);this.previewNode.position.y=(floor?.elevationMm??0)/1000+(this.activeDraft&&isWallOpening(this.activeDraft.catalogId)?0:.05)+position.elevationMm/1000;}
    this.draftPosition = position;
  }
  movePreviewFromClient(clientX: number, clientY: number, item?:FurniturePlacement) {
    const rect = this.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return undefined;
    const position = this.positionForItem(clientX - rect.left, clientY - rect.top,item??this.activeDraft);
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
    const occupied=new Set(floor.cells.map((cell)=>`${cell.x},${cell.z}`)); const all=rectangleBetweenCells(start,end); this.tileDraftCells=all.filter((cell)=>this.tool==="floor-finish"?occupied.has(`${cell.x},${cell.z}`):present?(!occupied.has(`${cell.x},${cell.z}`)||!!floor.cellRects?.[`${cell.x},${cell.z}`]):occupied.has(`${cell.x},${cell.z}`)); this.tileDraftPresent=present;
    if(!this.tileDraftCells.length)return;
    const scale=this.activePlan.gridSizeMm/1000; const root=new TransformNode("tile-draft",this.scene); root.parent=this.root; this.tileDraftRoot=root; const material=this.material("tile-draft-mat",present?"#80bd55":"#d27b67",.58);
    for(const cell of this.tileDraftCells){const tile=MeshBuilder.CreateBox("tile-draft-preview",{width:scale*.91,depth:scale*.91,height:.055},this.scene);tile.parent=root;tile.position=new Vector3((cell.x+.5)*scale,floor.elevationMm/1000+.085,(cell.z+.5)*scale);tile.material=material;tile.isPickable=false;tile.renderOutline=true;tile.outlineColor=Color3.FromHexString(present?"#568d35":"#a55242");tile.outlineWidth=.018;}
    const xs=this.tileDraftCells.map((cell)=>cell.x),zs=this.tileDraftCells.map((cell)=>cell.z);this.tileDraftAnchor=new Vector3((Math.min(...xs)+Math.max(...xs)+1)*scale/2,floor.elevationMm/1000+.38,(Math.min(...zs)+Math.max(...zs)+1)*scale/2);
  }
  projectTileDraft(){if(!this.tileDraftAnchor)return undefined;const viewport=this.camera.viewport.toGlobal(this.engine.getRenderWidth(),this.engine.getRenderHeight());const projected=Vector3.Project(this.tileDraftAnchor,Matrix.Identity(),this.scene.getTransformMatrix(),viewport);return{x:projected.x*this.canvas.clientWidth/this.engine.getRenderWidth(),y:projected.y*this.canvas.clientHeight/this.engine.getRenderHeight()};}
  previewMeasuredRoom(region:MeasuredRegion){
    this.cancelTileDraft();this.measuredDraft=region;if(!this.activePlan)return;const floor=this.activePlan.floors.find(f=>f.id===this.activeFloorId);if(!floor)return;
    const root=new TransformNode("measured-room-preview",this.scene);root.parent=this.root;this.tileDraftRoot=root;
    const rect=Object.values(region.rects).flat(),mat=this.material("measured-preview","#83b863",.6);
    for(const r of rect){const mesh=MeshBuilder.CreateBox("measured-tile",{width:r.width/1000,depth:r.depth/1000,height:.025},this.scene);mesh.parent=root;mesh.position=new Vector3((r.x+r.width/2)/1000,floor.elevationMm/1000+.06,(r.z+r.depth/2)/1000);mesh.material=mat;mesh.isPickable=false;}
    this.tileDraftAnchor=new Vector3((region.origin.x*this.activePlan.gridSizeMm+region.widthMm/2)/1000,floor.elevationMm/1000+.25,(region.origin.z*this.activePlan.gridSizeMm+region.depthMm/2)/1000);
  }
  cancelTileDraft(){this.measuredDraft=undefined;this.tileDraftRoot?.dispose(false,false);this.tileDraftRoot=undefined;this.tileDraftCells=[];this.tileDraftAnchor=undefined;this.tileDragStart=undefined;this.tileDragCurrent=undefined;}
  private wallPointAtPointer(screenX:number,screenY:number) {
    if(!this.activePlan)return;
    const ray=this.scene.createPickingRay(screenX,screenY,Matrix.Identity(),this.camera);
    const y=(this.activePlan.floors.find(f=>f.id===this.activeFloorId)?.elevationMm??0)/1000;
    const t=(y-ray.origin.y)/ray.direction.y;if(!Number.isFinite(t)||t<=0)return;
    const point=ray.origin.add(ray.direction.scale(t)),s=this.activePlan.gridSizeMm/1000;
    return {x:point.x/s,z:point.z/s};
  }
  private renderWallDraft(start:TileCell,point:TileCell) {
    if(!this.activePlan)return;
    this.wallDraftMesh?.dispose();this.wallDraftMesh=undefined;
    for(const m of this.wallSnapMarkers)m.dispose();this.wallSnapMarkers=[];
    const floor=this.activePlan.floors.find(f=>f.id===this.activeFloorId);if(!floor)return;
    const {end,connected}=snapWallEnd(floor,this.activePlan.gridSizeMm,start,point);
    this.wallDraft=wallBetween(start,end);
    const s=this.activePlan.gridSizeMm/1000,y=floor.elevationMm/1000,h=floor.heightMm/1000;
    // Ground-level connection targets remain legible beside a full-height preview.
    for(const [index,p] of [start,end].entries()){
      const marker=MeshBuilder.CreateCylinder("wall-snap-target",{diameter:.16,height:.035,tessellation:16},this.scene);
      marker.parent=this.root;marker.position=new Vector3(p.x*s,y+.07,p.z*s);
      marker.material=this.material("wall-snap-target-mat",index===1&&connected?"#f9d478":"#f8f2df");marker.isPickable=false;marker.renderingGroupId=1;this.wallSnapMarkers.push(marker);
    }
    if(!this.wallDraft)return;
    const a=this.wallDraft,ax=a.ax*s,az=a.az*s,bx=a.bx*s,bz=a.bz*s;
    const mesh=MeshBuilder.CreateBox("inside-wall-preview",{width:Math.hypot(bx-ax,bz-az),height:h,depth:.1},this.scene);
    mesh.parent=this.root;mesh.position=new Vector3((ax+bx)/2,y+h/2,(az+bz)/2);mesh.rotation.y=-Math.atan2(bz-az,bx-ax);
    mesh.material=this.material("inside-wall-preview-mat",this.tool==="wall-cut"?"#ce6253":connected?"#c1b36c":"#79ad58",.52);
    mesh.renderOutline=true;mesh.outlineColor=Color3.FromHexString(connected?"#f9d478":"#527d3e");mesh.outlineWidth=.018;mesh.isPickable=false;this.wallDraftMesh=mesh;
  }
  private cancelWallDraft(){for(const m of this.wallSnapMarkers)m.dispose();this.wallSnapMarkers=[];this.wallDraftMesh?.dispose();this.wallDraftMesh=undefined;this.wallDragStart=undefined;this.wallDragCurrent=undefined;this.wallDraft=undefined;}
  private material(name: string, hex: string, alpha = 1) { const key=`${name}:${hex}:${alpha}`,cached=this.solidMaterials.get(key);if(cached)return cached;const mat = new StandardMaterial(name, this.scene); mat.diffuseColor = Color3.FromHexString(hex); mat.roughness = .92; mat.specularColor = new Color3(.08,.07,.05); mat.alpha = alpha;this.solidMaterials.set(key,mat);return mat; }
  private surfaceMaterial(name:string,finish:SurfaceFinish,alpha=1){
    const key=`${finish.id}:${alpha}`,cached=this.surfaceMaterials.get(key);if(cached)return cached;
    const mat=this.material(`${name}:${finish.id}`,finish.color??"#ffffff",alpha);
    if(finish.texture){const texture=new Texture(finish.texture,this.scene,false,false,Texture.TRILINEAR_SAMPLINGMODE);texture.wrapU=Texture.WRAP_ADDRESSMODE;texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.uScale=finish.scale;texture.vScale=finish.scale;texture.anisotropicFilteringLevel=4;mat.diffuseTexture=texture;}
    mat.specularColor=new Color3(.035,.03,.022);mat.roughness=.96;this.surfaceMaterials.set(key,mat);return mat;
  }

  private makeMeadow() { const ground = MeshBuilder.CreateDisc("meadow", { radius: 15, tessellation: 64 }, this.scene); ground.rotation.x = Math.PI / 2; ground.position.y = -.15; ground.material = this.material("meadow-mat", "#9cab77"); ground.receiveShadows = true; }
  private updateDraft(plan:PlanDocumentV1,floorId:string,draft?:FurniturePlacement,refresh=false){
    const previous=this.activeDraft;
    const signature=(p:FurniturePlacement)=>JSON.stringify({...p,x:0,z:0,rotation:0,elevationMm:0});
    this.activeDraft=draft;
    for(const id of new Set([previous?.id,draft?.id])){if(id)this.furnitureNodes.get(id)?.node.setEnabled(id!==draft?.id);}
    const floor=plan.floors.find(f=>f.id===floorId);
    if(draft&&previous&&this.previewNode&&!refresh&&signature(draft)===signature(previous)){
      this.previewNode.scaling.setAll(1);
      this.previewNode.position.set(draft.x/1000,((floor?.elevationMm??0)+(draft.elevationMm??0)+(isWallOpening(draft.catalogId)?0:50))/1000,draft.z/1000);
      this.previewNode.rotation.y=draft.rotation*Math.PI/180;
    }else{
      this.previewNode?.dispose(false,false);this.previewNode=undefined;
      if(draft&&floor)this.buildFurniture(draft,floor.elevationMm/1000,false,true);
    }
    this.draftPosition=draft?{x:draft.x,z:draft.z,elevationMm:draft.elevationMm}:undefined;
  }
  resizePreview(base:FurniturePlacement,side:-1|1,clientX:number,clientY:number){
    const rect=this.canvas.getBoundingClientRect(),ray=this.scene.createPickingRay(clientX-rect.left,clientY-rect.top,Matrix.Identity(),this.camera);
    const floor=this.activePlan?.floors.find(f=>f.id===base.floorId),y=((floor?.elevationMm??0)+(base.elevationMm??0)+base.heightMm/2)/1000;
    const distance=(y-ray.origin.y)/ray.direction.y;if(!Number.isFinite(distance)||distance<=0)return;
    const p=ray.origin.add(ray.direction.scale(distance)),a=base.rotation*Math.PI/180;
    const along=(p.x*1000-base.x)*Math.cos(a)-(p.z*1000-base.z)*Math.sin(a);
    const next=extendFurniture(base,side*along+base.widthMm/2,side);
    if(this.previewNode){this.previewNode.scaling.x=next.widthMm/base.widthMm;this.previewNode.position.x=next.x/1000;this.previewNode.position.z=next.z/1000;}
    return next;
  }
  projectDraftEnd(side:-1|1){
    if(!this.previewNode||!this.activeDraft)return;
    const p=Vector3.TransformCoordinates(new Vector3(side*this.activeDraft.widthMm/2000,this.activeDraft.heightMm/2000,0),this.previewNode.computeWorldMatrix(true));
    const point=Vector3.Project(p,Matrix.Identity(),this.scene.getTransformMatrix(),this.camera.viewport.toGlobal(this.engine.getRenderWidth(),this.engine.getRenderHeight()));
    return {x:point.x*this.canvas.clientWidth/this.engine.getRenderWidth(),y:point.y*this.canvas.clientHeight/this.engine.getRenderHeight()};
  }
  update(plan: PlanDocumentV1, activeFloorId: string, selectedId?: string, draft?: FurniturePlacement) {
    const previous=this.activePlan;
    if(previous&&previous.id===plan.id&&previous.gridSizeMm===plan.gridSizeMm&&previous.floors===plan.floors&&previous.furniture===plan.furniture&&previous.environment===plan.environment&&JSON.stringify(previous.camera)===JSON.stringify(plan.camera)&&this.activeFloorId===activeFloorId&&this.selectedId===selectedId&&!this.refreshModels?.size&&this.architectureTool===this.tool&&this.architectureWall===this.selectedWallId){
      this.activePlan=plan;this.updateDraft(plan,activeFloorId,draft);return;
    }
    this.architectureTool=this.tool;this.architectureWall=this.selectedWallId;
    this.scene.clearColor=plan.environment?.background==='city'?(plan.camera.darkMode?new Color4(.14,.21,.27,1):new Color4(.65,.78,.85,1)):plan.camera.darkMode?new Color4(.12,.16,.13,1):new Color4(.72,.78,.62,1);
    const night=!!plan.camera.darkMode;const sun=this.scene.getLightByName('sun'),sky=this.scene.getLightByName('sky');if(sun)sun.intensity=night?.12:.72;if(sky)sky.intensity=night?.36:.62;
    this.camera.maxZ=plan.environment?.background==='city'?30000:10000;
    const previousDraft=this.activeDraft,refreshPreview=!!draft&&this.refreshModels?.has(draft.catalogId);
    this.terrain.update(plan);this.scene.getMeshByName('meadow')?.setEnabled(!plan.environment?.terrain?.length&&plan.environment?.background!=='city');
    const stamp=architectureKey(plan,activeFloorId,this.tool,this.selectedWallId);
    if(stamp===this.architectureStamp){
      this.activePlan=plan;this.selectedId=selectedId;this.activeDraft=draft;
      if(!usePlanner.getState().turnId)this.outdoors.update(plan);
      const ids=new Set(plan.furniture.map(f=>f.id));
      for(const [id,entry] of this.furnitureNodes)if(!ids.has(id)){entry.node.dispose(false,false);this.furnitureNodes.delete(id);}
      for(const item of plan.furniture){
        const entry=this.furnitureNodes.get(item.id);if(!entry)continue;
        const signature=JSON.stringify({...item,x:0,z:0,rotation:0,elevationMm:0});
        const floor=plan.floors.find(f=>f.id===item.floorId)!;
        if(entry.signature!==signature||this.refreshModels?.has(item.catalogId)){entry.node.dispose(false,false);this.buildFurniture(item,floor.elevationMm/1000,item.floorId!==activeFloorId);}
        else {entry.node.position.set(item.x/1000,(floor.elevationMm+(item.elevationMm??0)+(isWallOpening(item.catalogId)?0:isStairs(item.catalogId)?40:50))/1000,item.z/1000);entry.node.rotation.y=item.rotation*Math.PI/180;}
      }
      for(const item of plan.furniture)if(!this.furnitureNodes.has(item.id)){
        const index=plan.floors.findIndex(f=>f.id===item.floorId),active=plan.floors.findIndex(f=>f.id===activeFloorId);
        if(plan.camera.mode==='dollhouse'||index===active||(plan.camera.ghostBelow&&index===active-1))this.buildFurniture(item,plan.floors[index].elevationMm/1000,index!==active);
      }
      this.refreshModels?.clear();
      this.selectedNode=this.furnitureNodes.get(selectedId??'')?.node;
      for(const [id,{node}] of this.furnitureNodes)for(const mesh of node.getChildMeshes()){mesh.renderOutline=id===selectedId;mesh.outlineColor=new Color3(.42,.57,.31);mesh.outlineWidth=.025;}
      this.activeDraft=previousDraft;
      this.updateDraft(plan,activeFloorId,draft,refreshPreview);
      return;
    }
    this.architectureStamp=stamp;
    const retainFurniture=!!previous&&previous.id===plan.id&&this.activeFloorId===activeFloorId&&previous.camera.mode===plan.camera.mode&&previous.camera.ghostBelow===plan.camera.ghostBelow&&previous.camera.showClearance===plan.camera.showClearance;
    this.retainFloorTiles=retainFurniture&&previous!.floors===plan.floors&&previous!.gridSizeMm===plan.gridSizeMm&&previous!.camera.showGrid===plan.camera.showGrid;
    const floorTiles=this.retainFloorTiles?this.root.getChildMeshes(true).filter(m=>m.name.startsWith('cell:')):[];
    for(const tile of floorTiles)tile.parent=null;
    if(retainFurniture)for(const {node} of this.furnitureNodes.values())node.parent=null;
    else this.furnitureNodes.clear();

    const ground=this.scene.getMaterialByName("meadow-mat");if(ground instanceof StandardMaterial)ground.diffuseColor=Color3.FromHexString(plan.camera.darkMode?"#455748":"#9cab77");
    this.outdoors.update(plan);
    const landscape=landscapeBounds(plan),meadow=this.scene.getMeshByName("meadow");if(meadow){meadow.scaling.setAll(Math.max(35,landscape.radius+8)/15);meadow.position.x=landscape.x;meadow.position.z=landscape.z;}
    const cameraPolicy = cameraUpdatePolicy(this.activePlan,plan,this.activeFloorId,activeFloorId);
    this.wallVisibility.clear(this.activePlan?.id===plan.id);
    this.floorWallGeometry.clear();
    this.activePlan = plan; this.activeFloorId = activeFloorId; this.selectedId = selectedId; this.activeDraft = draft; this.draftPosition = draft ? { x: draft.x, z: draft.z, elevationMm:draft.elevationMm } : undefined; this.previewNode = undefined; this.selectedNode = undefined; this.tileDraftRoot=undefined; this.tileDraftCells=[]; this.tileDraftAnchor=undefined; for (const node of [...this.root.getChildren()]) node.dispose(false, false); if(!retainFurniture)this.furnitureFactory.resetMaterials();
    const activeIndex = plan.floors.findIndex((f) => f.id === activeFloorId); const floors = plan.camera.mode === "dollhouse" ? plan.floors : plan.floors.filter((f, i) => f.id === activeFloorId || (plan.camera.ghostBelow && i === activeIndex - 1));
    for (const floor of floors) this.buildFloor(plan, floor, floor.id !== activeFloorId);
    for(const tile of floorTiles)tile.parent=this.root;
    for(const [id,entry] of this.furnitureNodes)if(entry.node.parent!==this.root){entry.node.dispose(false,false);this.furnitureNodes.delete(id);}
    this.refreshModels?.clear();
    const activeFloor = plan.floors[activeIndex];
    if (draft && activeFloor && draft.floorId === activeFloor.id) {this.buildFurniture(draft, activeFloor.elevationMm / 1000, false, true);this.furnitureNodes.get(draft.id)?.node.setEnabled(false);}
    if (cameraPolicy.reframe && activeFloor?.cells.length) { const xs=activeFloor.cells.map(c=>c.x); const zs=activeFloor.cells.map(c=>c.z); const scale=plan.gridSizeMm/1000; const width=(Math.max(...xs)-Math.min(...xs)+1)*scale; const depth=(Math.max(...zs)-Math.min(...zs)+1)*scale; this.camera.setTarget(new Vector3((Math.min(...xs)+Math.max(...xs)+1)*scale/2, activeFloor.elevationMm/1000+.3, (Math.min(...zs)+Math.max(...zs)+1)*scale/2)); this.camera.radius=Math.max(6,Math.max(width,depth)*1.8); }
    if (activeFloor && (this.tool === "paint" || this.tool === "erase" || (this.tool === "wall" || this.tool === "wall-cut") || this.tool === "stairs" || this.tool === "measured-room")) { const editGrid = MeshBuilder.CreateGround("edit-grid", { width: 40, height: 40, subdivisions: 1 }, this.scene); editGrid.parent = this.root; editGrid.position = new Vector3(5, activeFloor.elevationMm / 1000 - .055, 5); editGrid.material = this.material("edit-grid-mat", "#f7f1e3", .001); editGrid.isPickable = true; }
    if (cameraPolicy.orient) {
      applyPlanView(this.camera, plan.camera.mode);
      if (plan.camera.mode === 'top') this.camera.radius = Math.max(7, this.camera.radius * .95);
      else if (plan.camera.mode === 'dollhouse') this.camera.radius = Math.max(9, this.camera.radius * 1.3);
    }
    if(this.measuredDraft)this.previewMeasuredRoom(this.measuredDraft);
    this.canvas.dataset.meshes = String(this.scene.meshes.length);
    this.wallVisibility.update(getWallVisibility(plan.camera), this.camera.position, this.camera.target, 0, window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??false);
  }
  private buildFloor(plan: PlanDocumentV1, floor: FloorPlan, ghost: boolean) {
    const scale = plan.gridSizeMm / 1000; const elevation = floor.elevationMm / 1000; const tileMat = this.surfaceMaterial(`tile-${floor.id}`,findFloorFinish(floor.floorFinishId),ghost ? .22 : 1);
    for (const rect of this.retainFloorTiles?[]:visibleFloorRects(plan,floor.id)) {const cell=rect.cell, width=rect.width/1000,depth=rect.depth/1000;
      const finish=findFloorFinish(floor.cellFinishes?.[`${cell.x},${cell.z}`]??floor.floorFinishId);
      const tile=MeshBuilder.CreateBox(`cell:${cell.x}:${cell.z}`,{width:plan.camera.showGrid&&!finish.repeatMeters?Math.max(.001,width-.006):width,depth:plan.camera.showGrid&&!finish.repeatMeters?Math.max(.001,depth-.006):depth,height:.08},this.scene);
      tile.parent=this.root;tile.position=new Vector3((rect.x+rect.width/2)/1000,elevation,(rect.z+rect.depth/2)/1000);
      if(finish.repeatMeters){const positions=tile.getVerticesData('position')!,uvs=tile.getVerticesData('uv')!;for(let i=0;i<positions.length/3;i++){uvs[i*2]=(positions[i*3]+tile.position.x)/finish.repeatMeters[0];uvs[i*2+1]=(positions[i*3+2]+tile.position.z)/finish.repeatMeters[1];}tile.setVerticesData('uv',uvs);}
      tile.material=floor.cellFinishes?.[`${cell.x},${cell.z}`]?this.surfaceMaterial(`tile-${floor.id}`,findFloorFinish(floor.cellFinishes[`${cell.x},${cell.z}`]),ghost?.22:1):tileMat;tile.receiveShadows=true;tile.isPickable=!ghost;
    }
    const boundaries=floorBoundaryWalls(floor,plan.gridSizeMm);
    const walls = [...boundaries, ...floor.walls];
    this.selectedWallIds=new Set(!ghost&&this.selectedWallId?wallPlateIds(floor,plan.gridSizeMm,this.selectedWallId):[]);
    this.floorWallGeometry.set(floor.id, walls.map(wall => ({ ax:wall.ax*scale, az:wall.az*scale, bx:wall.bx*scale, bz:wall.bz*scale, boundary:boundaries.includes(wall) })));
    const validOpenings=plan.furniture.filter(item=>item.floorId===floor.id&&isWallOpening(item.catalogId)&&!windowProblem(plan,item));
    for(const wall of walls)this.buildWall(wall.id,wall.ax*scale,wall.az*scale,wall.bx*scale,wall.bz*scale,elevation,ghost,findWallFinish(floor.wallFinishId),floor.openings.find(o=>o.wallKey===wall.id),floor.heightMm,windowWallPieces(wall,plan.gridSizeMm,floor.heightMm,validOpenings),floor.wallFinishes,boundaries.includes(wall));
    for (const stair of floor.stairs) this.buildStairs(stair.x/1000, stair.z/1000, stair.widthMm/1000, stair.lengthMm/1000, elevation, ghost);
    for (const item of plan.furniture.filter((f) => f.floorId === floor.id)) this.buildFurniture(item, elevation, ghost);
  }
  private buildWall(id: string, ax:number,az:number,bx:number,bz:number,y:number,ghost:boolean,finish:SurfaceFinish,opening:Opening|undefined,heightMm:number,pieces:ReturnType<typeof windowWallPieces>,finishes?:Record<string,string>,boundary=true) {
    const horizontal=Math.abs(az-bz)<.001;
    const geometry: WallGeometry = {ax,az,bx,bz,boundary};
    const wall={position:new Vector3((ax+bx)/2,y+heightMm/2000,(az+bz)/2),rotation:{y:-Math.atan2(bz-az,bx-ax)}};
    for(const piece of splitWallSections(id,pieces,this.activePlan?.gridSizeMm??250)){
      const center=(piece.start+piece.end)/2000;
      const mesh=MeshBuilder.CreateBox(`wall:${id}`,{width:(piece.end-piece.start)/1000,height:(piece.top-piece.bottom)/1000,depth:.1},this.scene);
      mesh.parent=this.root;mesh.position=new Vector3(horizontal?center:ax,y+(piece.bottom+piece.top)/2000,horizontal?az:center);
      mesh.rotation.y=wall.rotation.y;const wallFinish=findWallFinish(finishes?.[piece.paintKey]??finishes?.[id]??finish.id);mesh.material=this.surfaceMaterial(`wall-mat-${id}`,wallFinish,ghost?.18:1);
      if(wallFinish.repeatMeters){const p=mesh.getVerticesData('position')!,uv=mesh.getVerticesData('uv')!;for(let i=0;i<p.length/3;i++){uv[i*2]=(p[i*3]+center)/wallFinish.repeatMeters[0];uv[i*2+1]=(p[i*3+1]+mesh.position.y)/wallFinish.repeatMeters[1];}mesh.setVerticesData('uv',uv);}
      this.wallVisibility.add(mesh, geometry);
      mesh.isPickable=!ghost&&(this.tool==="select"||this.tool==="door"||this.tool==="window"||this.tool==="wall-finish");mesh.receiveShadows=true;this.shadow.addShadowCaster(mesh);
      if(this.selectedWallIds?.has(id)){mesh.renderOverlay=true;mesh.overlayColor=Color3.FromHexString("#e8c775");mesh.overlayAlpha=.22;}
    }
    if(opening?.kind==="window"){ const marker=MeshBuilder.CreateBox(`opening:${id}`,{width:.8,height:.68,depth:.12},this.scene); marker.parent=this.root; marker.position=wall.position.clone(); marker.position.y=y+1.02; marker.rotation.y=wall.rotation.y; marker.material=this.material(`opening-mat-${id}`,"#9ec8c3",ghost?.15:.65); this.wallVisibility.add(marker,geometry); marker.isPickable=!ghost&&(this.tool==="door"||this.tool==="window"||this.tool==="wall-finish"); }else if(opening?.kind==="door"){const root=new TransformNode(`door:${opening.id}`,this.scene);root.parent=this.root;this.wallVisibility.add(root,geometry);root.position=new Vector3((ax+bx)/2,y,(az+bz)/2);root.rotation.y=wall.rotation.y;const alpha=ghost?.16:1,doorMat=this.surfaceMaterial(`door-mat-${opening.id}`,findDoorFinish(opening.finishId),alpha),frameMat=this.material(`door-frame-${opening.id}`,"#6f533d",alpha);const slab=this.addBox(root,`opening:${id}`,[.78,1.38,.13],[0,.69,-.02],doorMat);slab.isPickable=!ghost&&(this.tool==="door"||this.tool==="window"||this.tool==="wall-finish");for(const x of [-.45,.45])this.addBox(root,"door-frame",[.09,1.52,.16],[x,.76,0],frameMat);this.addBox(root,"door-header",[.99,.09,.16],[0,1.48,0],frameMat);for(const z of [.38,.72,1.06])this.addBox(root,"door-panel",[.58,.035,.025],[0,z,-.09],frameMat);const knob=MeshBuilder.CreateSphere("door-knob",{diameter:.08,segments:10},this.scene);knob.parent=root;knob.position=new Vector3(.28,.72,-.11);knob.material=this.material("door-knob-mat","#9d7446",alpha);}
  }
  private addBox(parent:TransformNode,name:string,size:[number,number,number],pos:[number,number,number],mat:StandardMaterial){const box=MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},this.scene);box.parent=parent;box.position=new Vector3(...pos);box.material=mat;box.receiveShadows=true;this.shadow.addShadowCaster(box);return box;}
  private buildFurniture(item:FurniturePlacement,elevation:number,ghost:boolean,preview=false){
    const def=catalog.find((c)=>c.id===item.catalogId); if(!def)return;
    const signature=JSON.stringify({...item,x:0,z:0,rotation:0,elevationMm:0});
    const existing=preview?undefined:this.furnitureNodes.get(item.id);
    if(existing&&!existing.node.isDisposed()&&existing.signature===signature&&!this.refreshModels?.has(item.catalogId)){
      const node=existing.node;node.parent=this.root;node.setEnabled(true);
      node.position.set(item.x/1000,elevation+(isWallOpening(item.catalogId)?0:isStairs(item.catalogId)?.04:.05)+(item.elevationMm??0)/1000,item.z/1000);node.rotation.y=item.rotation*Math.PI/180;
      if(isWallOpening(item.catalogId)){const wall=openingHostWall(this.floorWallGeometry.get(item.floorId)??[],{x:item.x/1000,z:item.z/1000},item.rotation);if(wall)this.wallVisibility.add(node,wall);}
      if(!ghost&&item.id===this.selectedId)this.selectedNode=node;
      for(const mesh of node.getChildMeshes())mesh.renderOutline=!ghost&&item.id===this.selectedId;
      return;
    }
    existing?.node.dispose(false,false);
    const node=new TransformNode(preview?"draft-furniture":`item:${item.id}`,this.scene); node.parent=this.root; node.position=new Vector3(item.x/1000,elevation+(isWallOpening(item.catalogId)?0:isStairs(item.catalogId)?.04:.05)+(item.elevationMm??0)/1000,item.z/1000); node.rotation.y=item.rotation*Math.PI/180;
    if(!preview)this.furnitureNodes.set(item.id,{node,signature:JSON.stringify({...item,x:0,z:0,rotation:0,elevationMm:0})}); if(!preview&&!ghost&&item.id===this.selectedId)this.selectedNode=node;
    const w=item.widthMm/1000,d=item.depthMm/1000,h=item.heightMm/1000;
    if(!(isDoor(item.catalogId)&&item.doorless))for(const segment of moduleSegments(item)){
      const part=new TransformNode(`module:${item.id}`,this.scene);part.parent=node;part.position.x=segment.offset/1000;
      if(!this.furnitureModels.build(part,def,item,segment.width/1000,d,h,ghost))this.furnitureFactory.build(part,def,item,segment.width/1000,d,h,ghost);
    }
    if (!preview && isWallOpening(item.catalogId)) {
      const wall = openingHostWall(this.floorWallGeometry.get(item.floorId) ?? [], {x:item.x/1000,z:item.z/1000}, item.rotation);
      if (wall) this.wallVisibility.add(node, wall);
    }
    if(preview){
      this.previewNode=node;
      const footprint=this.addBox(node,"draft-footprint",[w+.08,.025,d+.08],[0,-.02,0],this.material(`draft-footprint-${item.id}`,"#8bbf58",.42)); footprint.isPickable=false;
    } else if(this.activePlan?.camera.showClearance&&!ghost){
      const clearance=this.addBox(node,"clearance",[w+.6,.018,d+.6],[0,.012,0],this.material(`clear-${item.id}`,"#d89a73",.22)); clearance.isPickable=false;
    }
    node.getChildMeshes().forEach((mesh)=>{
      if(preview&&mesh.name!=="draft-footprint"){
        mesh.name="draft-preview"; mesh.isPickable=true; mesh.visibility=.92; mesh.renderOutline=false; mesh.outlineColor=new Color3(.47,.78,.25); mesh.outlineWidth=.035;
      }else if(mesh.name!=="clearance"&&mesh.name!=="draft-footprint"){
        mesh.name=`item:${item.id}`; mesh.isPickable=!ghost;
      }
      if(!preview&&item.id===this.selectedId){mesh.renderOutline=true;mesh.outlineColor=new Color3(.42,.57,.31);mesh.outlineWidth=.025;}
    });
  }
  private buildStairs(x:number,z:number,w:number,d:number,y:number,ghost:boolean){const mat=this.material(`stairs-${x}-${z}`,"#a9815f",ghost?.18:1);for(let i=0;i<10;i++){const step=this.addBox(this.root,"stairs",[w,.12,d/10],[x,y+.06+i*.12,z+i*d/10],mat);step.isPickable=!ghost;}}
  private clearPlantingPreview(){for(const p of this.plantingNodes.values())p.node.dispose(false,false);this.plantingNodes.clear();this.plantingItems=[];this.plantingAnchor=undefined;}
  private renderPlantingPreview(items:FurniturePlacement[],refresh=false){
    this.plantingItems=items;const ids=new Set(items.map(p=>p.id));for(const [id,p] of this.plantingNodes)if(!ids.has(id)){p.node.dispose(false,false);this.plantingNodes.delete(id);}
    for(const item of items){const existing=this.plantingNodes.get(item.id);if(existing&&(!refresh||existing.loaded))continue;existing?.node.dispose(false,false);const node=new TransformNode(`garden-preview:${item.id}`,this.scene),def=catalog.find(c=>c.id===item.catalogId)!;
      const floor=this.activePlan?.floors.find(f=>f.id===item.floorId);node.position.set(item.x/1000,((floor?.elevationMm??0)+(item.elevationMm??0)+50)/1000,item.z/1000);node.rotation.y=item.rotation*Math.PI/180;
      const loaded=this.furnitureModels.build(node,def,item,item.widthMm/1000,item.depthMm/1000,item.heightMm/1000,false);if(!loaded)this.furnitureFactory.build(node,def,item,item.widthMm/1000,item.depthMm/1000,item.heightMm/1000,false);
      for(const mesh of node.getChildMeshes()){mesh.isPickable=false;this.shadow.removeShadowCaster(mesh);}this.plantingNodes.set(item.id,{node,born:existing?.born??performance.now(),loaded});
    }
  }
  projectPlantingDraft(){if(!this.plantingAnchor)return;const v=this.camera.viewport.toGlobal(this.engine.getRenderWidth(),this.engine.getRenderHeight()),p=Vector3.Project(this.plantingAnchor,Matrix.Identity(),this.scene.getTransformMatrix(),v);return {x:Math.max(90,Math.min(this.canvas.clientWidth-90,p.x*this.canvas.clientWidth/this.engine.getRenderWidth())),y:Math.max(50,Math.min(this.canvas.clientHeight-70,p.y*this.canvas.clientHeight/this.engine.getRenderHeight()))};}
  private bindPointers(){
    let moved=false;
    this.scene.onPointerObservable.add((info)=>{
      if(this.tool==='planting'){
        const s=usePlanner.getState(),ray=this.scene.createPickingRay(this.scene.pointerX,this.scene.pointerY,Matrix.Identity(),this.camera);
        const hit=terrainRay(s.plan,ray.origin,ray.direction);
        if(info.type===PointerEventTypes.POINTERDOWN&&info.event.button===0&&hit&&!s.plantingDraft){this.canvas.setPointerCapture?.((info.event as PointerEvent).pointerId);this.plantingPoints=[];this.plantingBase=s.plan;this.camera.detachControl();}
        if(this.plantingPoints&&hit&&(info.type===PointerEventTypes.POINTERMOVE||info.type===PointerEventTypes.POINTERDOWN)){
          const last=this.plantingPoints.at(-1);if(!last||Math.hypot(hit.x-last.x,hit.z-last.z)>.2){
            if(this.plantingPoints.length<128)this.plantingPoints.push({x:hit.x,z:hit.z});
            this.renderPlantingPreview(scatterPlants(s.plan,this.plantingPoints,s.plantingBrush));
            this.plantingAnchor=new Vector3(hit.x,hit.y+.1,hit.z);
          }
        }
        if(info.type===PointerEventTypes.POINTERUP&&info.event.button===0&&this.plantingPoints){const points=this.plantingPoints;this.plantingPoints=undefined;this.camera.attachControl(this.canvas,true);if(s.plan===this.plantingBase)s.previewPlanting(points);else this.clearPlantingPreview();}
        return;
      }
      if(this.tool.startsWith('terrain-')){
        const ray=this.scene.createPickingRay(this.scene.pointerX,this.scene.pointerY,Matrix.Identity(),this.camera);
        const hit=this.activePlan?terrainRay(this.activePlan,ray.origin,ray.direction):undefined;
        const point=hit?{x:hit.x*1000,z:hit.z*1000}:undefined;
        if(info.type===PointerEventTypes.POINTERDOWN&&info.event.button===0&&point){
          this.canvas.setPointerCapture?.((info.event as PointerEvent).pointerId);this.terrainBase=usePlanner.getState().plan;this.terrainStarted=performance.now();const state=usePlanner.getState();this.terrainStroke={kind:this.tool.slice(8) as TerrainStroke['kind'],radius:state.terrainRadius,strength:state.terrainStrength,points:[{x:point.x/1000,z:point.z/1000}]};this.camera.detachControl();
        }
        if(info.type===PointerEventTypes.POINTERMOVE&&point){
          if(!this.terrainCue){this.terrainCue=MeshBuilder.CreateTorus('terrain-brush',{diameter:2,thickness:.025,tessellation:48},this.scene);this.terrainCue.material=this.material('terrain-cue','#e6c46a');this.terrainCue.isPickable=false;}
          this.terrainCue.scaling.set(usePlanner.getState().terrainRadius,1,usePlanner.getState().terrainRadius);this.terrainCue.position.set(point.x/1000,(hit?.y??0)+.06,point.z/1000);
          const stroke=this.terrainStroke,last=stroke?.points.at(-1);if(stroke&&last&&stroke.points.length<64&&Math.hypot(point.x/1000-last.x,point.z/1000-last.z)>.35)stroke.points.push({x:point.x/1000,z:point.z/1000});
        }
        if(info.type===PointerEventTypes.POINTERUP&&this.terrainStroke){const stroke=this.terrainStroke;this.terrainStroke=undefined;this.camera.attachControl(this.canvas,true);if(usePlanner.getState().plan===this.terrainBase){stroke.strength=Math.max(.1,stroke.strength*Math.min(1,(performance.now()-this.terrainStarted)/900));usePlanner.getState().addTerrainStroke(stroke);}else if(this.activePlan)this.terrain.update(this.activePlan);}
        return;
      }
      if(info.type===PointerEventTypes.POINTERDOWN && info.event.button===2 && this.tool==='select'){
        const item=this.activeDraft??this.activePlan?.furniture.find(f=>f.id===this.selectedId),node=this.activeDraft?this.previewNode:this.selectedNode;
        if(item&&node){this.camera.detachControl();this.canvas.setPointerCapture?.((info.event as PointerEvent).pointerId);this.rotationDrag={item:{...item},node,startX:info.event.clientX,rotation:item.rotation,draft:!!this.activeDraft};info.event.preventDefault();}return;
      }
      if(this.rotationDrag){
        const drag=this.rotationDrag;
        if(info.type===PointerEventTypes.POINTERMOVE){
          let angle=drag.item.rotation+(info.event.clientX-drag.startX)*.5;
          if(isWallOpening(drag.item.catalogId)||isKitchenWall(drag.item.catalogId))angle=drag.item.rotation+Math.round((angle-drag.item.rotation)/180)*180;
          else if(info.event.shiftKey)angle=Math.round(angle/15)*15;
          drag.rotation=((angle%360)+360)%360;drag.node.rotation.y=drag.rotation*Math.PI/180;
        }else if(info.type===PointerEventTypes.POINTERUP){
          this.rotationDrag=undefined;this.camera.attachControl(this.canvas,true);
          if(drag.rotation!==drag.item.rotation)this.callbacks.onRotate(drag.draft?undefined:drag.item.id,drag.rotation);
        }return;
      }
      if(info.type===PointerEventTypes.POINTERDOWN){
        if(info.event.button!==0)return;
        moved=false;
        const pick=this.scene.pick(this.scene.pointerX,this.scene.pointerY); const name=pick?.pickedMesh?.name||"";
        if(this.tool==="measured-room"){const cell=this.cellAtPointer(this.scene.pointerX,this.scene.pointerY);if(cell)this.callbacks.onCell(cell.x,cell.z);return;
        }else if(this.tool==="paint"||this.tool==="erase"||this.tool==="floor-finish"){
          const cell=this.cellAtPointer(this.scene.pointerX,this.scene.pointerY); if(!cell)return; this.tileDragStart=cell; this.tileDragCurrent=cell; this.renderTileDraft(cell,cell,this.tool!=="erase"); this.callbacks.onSelect(undefined); this.camera.detachControl();
        }else if(this.tool==="wall"||this.tool==="wall-cut"){
          const point=this.wallPointAtPointer(this.scene.pointerX,this.scene.pointerY),floor=this.activePlan?.floors.find(f=>f.id===this.activeFloorId);if(!point||!floor)return;const start=snapWallStart(floor,this.activePlan!.gridSizeMm,point);this.wallDragStart=start;this.wallDragCurrent=point;this.renderWallDraft(start,start);this.callbacks.onSelect(undefined);this.camera.detachControl();
        }else if(name==="draft-preview"&&this.tool==="select"){
          this.draggingDraft=true; this.camera.detachControl();
        }else if(name.startsWith("item:")&&this.tool==="select"){
          this.draggedPosition=undefined; this.dragging=name.split(":")[1]; this.callbacks.onSelect(this.dragging); this.selectedNode=this.furnitureNodes.get(this.dragging!)?.node; this.camera.detachControl();
        }else if(name.startsWith("cell:")){
          const[,x,z]=name.split(":"); this.callbacks.onCell(Number(x),Number(z));
        }else if(name==="edit-grid"&&pick?.pickedPoint&&this.activePlan){
          const grid=this.activePlan.gridSizeMm/1000; this.callbacks.onCell(Math.floor(pick.pickedPoint.x/grid),Math.floor(pick.pickedPoint.z/grid));
        }else if(name.startsWith("wall:"))this.callbacks.onWall(name.slice(5));
        else this.callbacks.onSelect(undefined);
      }
      if(info.type===PointerEventTypes.POINTERMOVE&&this.tileDragStart){
        const cell=this.cellAtPointer(this.scene.pointerX,this.scene.pointerY); if(cell&&(cell.x!==this.tileDragCurrent?.x||cell.z!==this.tileDragCurrent?.z)){this.tileDragCurrent=cell;this.renderTileDraft(this.tileDragStart,cell,this.tool!=="erase");}
      }else if(info.type===PointerEventTypes.POINTERMOVE&&this.wallDragStart){
        const point=this.wallPointAtPointer(this.scene.pointerX,this.scene.pointerY);if(point){this.wallDragCurrent=point;this.renderWallDraft(this.wallDragStart,point);}
      }else if(info.type===PointerEventTypes.POINTERMOVE&&this.draggingDraft){
        const position=this.positionForItem(this.scene.pointerX,this.scene.pointerY,this.activeDraft); if(position)this.applyPreviewPosition(position);
      }else if(info.type===PointerEventTypes.POINTERMOVE&&this.dragging){
        const item=this.activePlan?.furniture.find(f=>f.id===this.dragging);
        const position=this.positionForItem(this.scene.pointerX,this.scene.pointerY,item);
        if(position&&item&&this.selectedNode){const mounted=this.activePlan?snapWindow(this.activePlan,{...item,...position}):item;this.selectedNode.position.x=mounted.x/1000;this.selectedNode.position.z=mounted.z/1000;if(mounted.elevationMm!==undefined){const floor=this.activePlan?.floors.find(f=>f.id===item.floorId);this.selectedNode.position.y=((floor?.elevationMm??0)+(mounted.elevationMm??0)+50)/1000;}this.selectedNode.rotation.y=mounted.rotation*Math.PI/180;this.draggedPosition=mounted;moved=true;}
      }
      if(info.type===PointerEventTypes.POINTERUP&&this.tileDragStart){
        const cells=[...this.tileDraftCells],present=this.tileDraftPresent; this.tileDragStart=undefined; this.tileDragCurrent=undefined; this.camera.attachControl(this.canvas,true); if(cells.length)this.callbacks.onTileDraft(cells,present);else this.cancelTileDraft();
      }else if(info.type===PointerEventTypes.POINTERUP&&this.wallDragStart){
        const wall=this.wallDraft;this.cancelWallDraft();this.camera.attachControl(this.canvas,true);if(wall)this.callbacks.onWallSegment(wall);
      }else if(info.type===PointerEventTypes.POINTERUP&&this.draggingDraft){
        this.draggingDraft=false; this.camera.attachControl(this.canvas,true); if(this.draftPosition)this.callbacks.onDraftMove(this.draftPosition.x,this.draftPosition.z,this.draftPosition.elevationMm,this.draftPosition.rotation);
      }else if(info.type===PointerEventTypes.POINTERUP&&this.dragging){
        if(moved&&this.draggedPosition)this.callbacks.onMove(this.dragging,this.draggedPosition.x,this.draggedPosition.z,this.draggedPosition.elevationMm,this.draggedPosition.rotation);
        this.draggedPosition=undefined;this.dragging=undefined; this.camera.attachControl(this.canvas,true);
      }
    });
  }
}
