import {TilesRenderer} from '3d-tiles-renderer/babylonjs';
import {LRUCache,DownloadPriorityQueue,PriorityQueue,DEFAULT_LRU_CACHE,DEFAULT_DOWNLOAD_QUEUE,DEFAULT_PARSE_QUEUE} from '3d-tiles-renderer/core';
import {PerformanceConfigurator} from '@babylonjs/core/Engines/performanceConfigurator';
import {PBRMaterial} from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type {Scene} from '@babylonjs/core/scene';
import type {Observer} from '@babylonjs/core/Misc/observable';
import {floorRects} from '../floorGeometry';
import type {PlanDocumentV1} from '../types';
import {googleFrameAllowed,useGoogleScenery} from '../googleScenery';
import {torontoFrame} from './googleCoordinates';

class TorontoTiles extends TilesRenderer {
  origin=torontoFrame().origin;
  // Conservative culling, including all intersecting ancestors, limits exploration to downtown.
  calculateTileViewError(tile:any,target:any){
    (TilesRenderer.prototype as any).calculateTileViewError.call(this,tile,target);
    if(tile.engineData.boundingVolume.distanceToPoint(this.origin)>3500)target.inView=false;
  }
  calculateBytesUsed(tile:any){
    const container=tile.engineData.container;
    if(!container)return 4096;
    let size=0;
    for(const mesh of container.meshes){size+=mesh.getTotalVertices()*48+mesh.getTotalIndices()*4;}
    for(const tex of container.textures){const s=tex.getSize();size+=s.width*s.height*6;}
    return Math.max(4096,size);
  }
}

/** One renderer per editor lifetime. Plan edits never construct a second root session. */
export class GoogleTorontoScene {
  private tiles?:TorontoTiles;private disposed=false;private active=false;private started=0;
  private plan?:PlanDocumentV1;private observer:Observer<Scene>|null;private unsubscribe:()=>void;
  private lastFrame=0;private dirty=true;private cameraStamp='';private running=0;private lastDownload=0;
  private generation=0;private restart=useGoogleScenery.getState().restart;private abort=new AbortController();
  private waiters=new Set<()=>void>();private frameKey='';private failed=false;
  constructor(private scene:Scene){
    // ECEF positions are millions of metres; preserve precision before subtracting the origin.
    PerformanceConfigurator.SetMatrixPrecision(true);
    this.observer=scene.onBeforeRenderObservable.add(()=>this.tick());
    this.unsubscribe=useGoogleScenery.subscribe((s,previous)=>{
      if(s.restart!==this.restart){this.restart=s.restart;this.reset();if(this.active)this.start();}
      if(s.paused!==previous.paused)this.wake();
    });
    document.addEventListener('visibilitychange',this.wake);
  }
  private allowed(){return googleFrameAllowed(this.active,useGoogleScenery.getState().paused,document.hidden,this.expired())&&!this.failed&&!this.disposed;}
  private expired(){return this.started>0&&Date.now()-this.started>170*60*1000;}
  private wake=()=>{this.dirty=true;if(this.allowed())for(const wake of [...this.waiters])wake();};
  private async waitForLoading(signal:AbortSignal){
    if(signal.aborted||this.abort.signal.aborted)throw new DOMException('Cancelled','AbortError');
    if(this.allowed())return;
    await new Promise<void>((resolve,reject)=>{
      const ownSignal=this.abort.signal;
      const cleanup=()=>{this.waiters.delete(wake);signal.removeEventListener('abort',cancel);ownSignal.removeEventListener('abort',cancel);};
      const wake=()=>{if(this.allowed()){cleanup();resolve();}};
      const cancel=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
      this.waiters.add(wake);signal.addEventListener('abort',cancel,{once:true});ownSignal.addEventListener('abort',cancel,{once:true});
    });
  }
  update(plan:PlanDocumentV1){
    this.plan=plan;this.active=plan.environment?.background==='city'&&plan.environment.citySource==='google';
    if(this.active&&!this.tiles&&!this.failed)this.start();
    if(this.tiles){this.tiles.group.setEnabled(this.active);this.position();}
    this.wake();
  }
  private position(){
    if(!this.plan||!this.tiles)return;
    const rects=this.plan.floors.flatMap(f=>floorRects(f,this.plan!.gridSizeMm));
    const x=rects.length?(Math.min(...rects.map(r=>r.x))+Math.max(...rects.map(r=>r.x+r.width)))/2000:0;
    const z=rects.length?(Math.min(...rects.map(r=>r.z))+Math.max(...rects.map(r=>r.z+r.depth)))/2000:0;
    const env=this.plan.environment, key=JSON.stringify([x,z,env?.cityHeight,env?.backdropRotation]);
    if(key===this.frameKey)return;this.frameKey=key;
    const frame=torontoFrame(x,z,env?.cityHeight??180,env?.backdropRotation??0);
    this.tiles.origin=frame.origin;this.tiles.group.freezeWorldMatrix(frame.matrix);
  }
  private start(){
    if(this.disposed||this.tiles)return;
    this.started=Date.now();this.failed=false;const generation=++this.generation;
    const tiles=this.tiles=new TorontoTiles(new URL('/api/google-tiles/v1/3dtiles/root.json',location.origin).href,this.scene);
    tiles.lruCache=new LRUCache();tiles.lruCache.unloadPriorityCallback=DEFAULT_LRU_CACHE.unloadPriorityCallback;tiles.lruCache.minSize=180;tiles.lruCache.maxSize=600;
    tiles.lruCache.minBytesSize=96*1024*1024;tiles.lruCache.maxBytesSize=256*1024*1024;
    tiles.downloadQueue=new DownloadPriorityQueue();tiles.downloadQueue.priorityCallback=DEFAULT_DOWNLOAD_QUEUE.priorityCallback;tiles.downloadQueue.maxJobsPerOrigin=4;
    tiles.parseQueue=new PriorityQueue();tiles.parseQueue.priorityCallback=DEFAULT_PARSE_QUEUE.priorityCallback;tiles.parseQueue.maxJobs=2;
    tiles.errorTarget=16;tiles.loadSiblings=false;tiles.maxTilesProcessed=200;
    useGoogleScenery.setState({status:'Loading Toronto…',visible:false,credits:'',requests:0});
    const lifetime=this.abort.signal;
    tiles.registerPlugin({name:'NOOK_GOOGLE_STREAM',fetchData:async(url:string,options:RequestInit={})=>{
      const target=new URL(url,location.origin);
      if(target.origin!==location.origin||!target.pathname.startsWith('/api/google-tiles/v1/3dtiles/'))throw new Error('Unexpected scenery source');
      const signal=AbortSignal.any([lifetime,...(options.signal?[options.signal]:[])]);
      await this.waitForLoading(signal);this.running++;this.lastDownload=performance.now();
      try{
        const response=await fetch(target,{...options,signal,cache:'default',credentials:'same-origin'});
        if(generation!==this.generation)throw new DOMException('Cancelled','AbortError');
        useGoogleScenery.setState(s=>({requests:s.requests+1}));
        if(!response.ok){let message='Google scenery is unavailable.';try{message=(await response.json()).error??message;}catch{/* Generic error */}this.failed=true;useGoogleScenery.setState({status:message});throw new Error(message);}
        return response;
      } finally {if(generation===this.generation){this.running--;this.dirty=true;this.lastDownload=performance.now();}}
    }});
    tiles.addEventListener('needs-update',()=>{this.dirty=true;});
    tiles.addEventListener('load-model',({scene:root})=>{
      for(const mesh of root.getChildMeshes()){
        mesh.isPickable=false;mesh.receiveShadows=false;
        if(mesh.material instanceof PBRMaterial){mesh.material.unlit=true;mesh.material.imageProcessingConfiguration=this.scene.imageProcessingConfiguration;}
      }
      this.dirty=true;
    });
    tiles.addEventListener('load-error',()=>{if(generation===this.generation&&!this.disposed&&!this.failed){this.failed=true;useGoogleScenery.setState({status:'Some city detail could not load. Start a new session to retry.'});}});
    tiles.addEventListener('tile-visibility-change',()=>this.attribution());
    this.frameKey='';this.position();this.dirty=true;
  }
  private attribution(){
    if(!this.tiles)return;
    const providers=new Set<string>();
    for(const tile of this.tiles.visibleTiles){const copyright=(tile as any).engineData?.metadata?.asset?.copyright??'';for(const p of copyright.split(';'))if(p.trim())providers.add(p.trim());}
    useGoogleScenery.setState({visible:this.tiles.visibleTiles.size>0,credits:[...providers].sort().join('; ')});
  }
  private tick(){
    if(!this.tiles||!this.active)return;
    if(this.expired()){const status='Session ended. Loaded scenery stays visible. Start a new session for more detail.';if(useGoogleScenery.getState().status!==status)useGoogleScenery.setState({status});return;}
    if(!this.allowed())return;
    const now=performance.now();if(now-this.lastFrame<150)return;this.lastFrame=now;
    const camera=this.scene.activeCamera;if(!camera)return;
    const stamp=[...camera.getViewMatrix().m,...camera.getProjectionMatrix().m].map(n=>n.toFixed(5)).join(',');
    if(stamp!==this.cameraStamp){this.cameraStamp=stamp;this.dirty=true;}
    if(!this.dirty)return;
    this.dirty=false;this.tiles.group.computeWorldMatrix(true);this.tiles.update();
    if(!this.failed)useGoogleScenery.setState({status:this.running||now-this.lastDownload<500?'Loading city detail…':this.tiles.visibleTiles.size?'Toronto ready':'Finding Toronto…'});
  }
  private reset(){this.generation++;this.abort.abort();this.abort=new AbortController();this.tiles?.dispose();this.tiles=undefined;this.running=0;this.failed=false;this.frameKey='';}
  dispose(){this.disposed=true;this.unsubscribe();document.removeEventListener('visibilitychange',this.wake);this.scene.onBeforeRenderObservable.remove(this.observer);this.reset();}
}
