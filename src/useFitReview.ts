import {useEffect,useMemo,useRef,useState} from 'react';
import {createFitReviewEvaluator,emptyFitReview,normalizeFitReviewSettings,type FitReviewResult,type FitReviewSettings} from './fitReview';
import type {PlanDocumentV1} from './types';

export interface FitReviewState {result:FitReviewResult;pending:boolean;error:string}

/** Keep mounted in the editor so review stays live when its settings dialog closes. */
export function useFitReview(plan:PlanDocumentV1,floorId:string,settings:FitReviewSettings,active=true):FitReviewState {
  const evaluator=useRef<ReturnType<typeof createFitReviewEvaluator>|null>(null);
  const [checked,setChecked]=useState<{plan:PlanDocumentV1;floorId:string;key:string;result:FitReviewResult;error:string}>();
  const empty=useMemo(()=>emptyFitReview(floorId),[floorId]);
  const key=JSON.stringify(normalizeFitReviewSettings(settings));
  const enabled=active&&settings.enabled;
  useEffect(()=>{
    if(!enabled)return;
    const timer=window.setTimeout(()=>{
      if(!evaluator.current)evaluator.current=createFitReviewEvaluator();
      try {setChecked({plan,floorId,key,result:evaluator.current.evaluate(plan,floorId,settings),error:''});}
      catch(e){setChecked({plan,floorId,key,result:emptyFitReview(floorId),error:(e as Error).message||'This floor could not be reviewed.'});}
    },120);
    return()=>window.clearTimeout(timer);
  },[plan,floorId,key,enabled]);
  useEffect(()=>()=>{evaluator.current?.clear();},[]);
  // Suppress old geometry synchronously, even before an effect runs during an active drag.
  const fresh=checked?.plan===plan&&checked.floorId===floorId&&checked.key===key;
  return {result:enabled&&fresh?checked!.result:empty,pending:enabled&&!fresh,error:enabled&&fresh?checked!.error:''};
}
