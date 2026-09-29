import {captureItems,confirmCaptureMeasurement,createCaptureReview,decideCaptureItem,type CaptureReviewSnapshot,type CaptureSource} from '../src/captureReview';
import type {Recognition} from '../src/recognitionContract';
export const source:CaptureSource={id:'local-reference-1',page:1,rotation:0,widthPx:1000,heightPx:800,method:'online-recognition',pipelineVersion:'regions-v1'};
export const detection:Recognition={rooms:[{name:'Kitchen',kind:'Kitchen',x:10,y:20,width:400,height:300,enclosed:true,note:'Check the faint left edge.'}],walls:[{ax:10,ay:20,bx:410,by:20}],fixtures:[{catalogId:'door-flush',x:200,y:20,width:80,depth:10,rotation:0}],dimensions:[{text:'4 m',millimetres:4000,ax:10,ay:20,bx:410,by:20}],warnings:['An opening may be missing.'],regionReview:true};
export function reviewed():CaptureReviewSnapshot {
  let review=createCaptureReview(detection,source,'draft-1',1000);for(const item of captureItems(review))review=decideCaptureItem(review,item.id,'keep');
  review=confirmCaptureMeasurement(review,{ax:10,ay:20,bx:410,by:20,millimetres:4000});review.checklist={boundaries:true,openings:true,labels:true};return review;
}
