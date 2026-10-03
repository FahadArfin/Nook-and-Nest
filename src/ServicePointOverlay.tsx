import {servicePointKinds,servicePointPosition,servicePointStatus,type ServicePoint} from './servicePoints';
import type {PlanDocumentV1} from './types';

export function ServicePointSymbol({point,size,status='unchecked',selected=false}:{point:ServicePoint;size:number;status?:'unchecked'|'verified'|'changed';selected?:boolean}){
  const position=servicePointPosition(point),kind=servicePointKinds.find(k=>k.id===point.kind)!,color=status==='changed'?'#a03b2c':status==='verified'?'#35684b':'#946319';
  return <g data-service-point={point.id} data-service-status={status} transform={`translate(${position.x},${position.z})`} pointerEvents="none">
    <title>{kind.name}: {point.label} · {point.offsetMm} mm from A · {point.heightMm} mm above floor · {point.face} face · {status}</title>
    <circle r={size} fill="#fffaf0" stroke={color} strokeWidth={selected?3:2} vectorEffect="non-scaling-stroke"/>
    <text textAnchor="middle" dominantBaseline="central" fontFamily="Arial,sans-serif" fontSize={size*1.25} fontWeight="bold" fill={color}>{kind.symbol}</text>
    <text x={size*1.5} y={-size*.5} fontFamily="Arial,sans-serif" fontSize={size*1.1} fill={color} stroke="#fffaf0" strokeWidth={size*.14} paintOrder="stroke">{point.label}{status==='changed'?' · RECHECK':''}</text>
    <text x={size*1.5} y={size} fontFamily="Arial,sans-serif" fontSize={size*.9} fill={color} stroke="#fffaf0" strokeWidth={size*.12} paintOrder="stroke">{point.heightMm} mm high · {point.face}</text>
  </g>;
}
/** Rendered SVG is also the export layer. Retained anchors never silently move with a changed wall. */
export function ServicePointOverlay({plan,floorId,size,selectedId}:{plan:PlanDocumentV1;floorId:string;size:number;selectedId?:string}){
  return <g data-service-points-layer="true" aria-label="Service points: O outlet, S switch, D data, V vent" pointerEvents="none">{(plan.siteSurvey?.servicePoints??[]).filter(p=>p.floorId===floorId).map(point=><ServicePointSymbol key={point.id} point={point} size={size} status={servicePointStatus(plan,point).state} selected={point.id===selectedId}/>)}</g>;
}
