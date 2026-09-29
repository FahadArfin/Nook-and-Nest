import {useEffect,useRef,useState} from 'react';
import type {PlanDocumentV1} from './types';
import type {ReviewStop} from './clientReview';
import type {SceneController} from './scene/SceneController';

/** Dedicated renderer: no editor, store writes, account UI, or WebMCP registration. */
export default function ReviewScene({plan,stop}:{plan:PlanDocumentV1;stop:ReviewStop}){
 const canvas=useRef<HTMLCanvasElement>(null),controller=useRef<SceneController|null>(null),latest=useRef({plan,stop}),[error,setError]=useState('');latest.current={plan,stop};
 useEffect(()=>{let disposed=false;const noop=()=>{};
  void import('./scene/SceneController').then(({SceneController})=>{if(disposed||!canvas.current)return;const scene=new SceneController(canvas.current,{onCell:noop,onWallSegment:noop,onTileDraft:noop,onSelect:noop,onMove:noop,onDraftMove:noop,onRotate:noop,onWall:noop});controller.current=scene;const current=latest.current;scene.update(current.plan,current.stop.floorId);scene.beginHomePreview();scene.restoreCameraShot({...current.stop.camera,kind:'orbit'});}).catch(()=>{if(!disposed)setError('3D is unavailable on this device. Use the floor markers and saved photos.');});
  return()=>{disposed=true;controller.current?.dispose();controller.current=null;};
 },[]);
 useEffect(()=>{try{const scene=controller.current;if(scene){scene.update(plan,stop.floorId);scene.restoreCameraShot({...stop.camera,kind:'orbit'});}}catch{setError('This view is unavailable. Use the floor markers and saved photos.');}},[plan,stop]);
 return error?<p role="status">{error}</p>:<canvas ref={canvas} className="review-scene" tabIndex={-1} aria-label={`Read-only 3D design: ${stop.title}`} style={{pointerEvents:'none'}}/>;
}
