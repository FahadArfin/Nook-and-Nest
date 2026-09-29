import type {ReservationDetail, StagingReservation, StockUnit, StockCondition, StockUnitDetail} from './stagingInventory';
export type StagingWorkspace={id:string;name:string;role:'owner'|'manager'|'viewer'};
export type StagingCalendar={units:(StockUnit&{available:boolean})[];reservations:StagingReservation[];next:string|null};
export class StagingError extends Error{constructor(message:string,public status:number){super(message);}}
async function request<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch('/api/staging'+path,{credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new StagingError('Real inventory is unavailable in this preview. The sample remains available.',503);
 const data=await response.json();if(!response.ok)throw new StagingError(data.error||'Inventory could not be loaded.',response.status);return data;
}
const part=encodeURIComponent;
export const stagingApi={
 status:()=>request<{enabled:boolean;signedIn:boolean;canEnroll:boolean}>('/status'),
 workspaces:()=>request<{workspaces:StagingWorkspace[]}>(''),
 enroll:(name:string)=>request<{workspace:StagingWorkspace}>('',{name}),
 calendar:(workspace:string,start:string,end:string,after?:string)=>request<StagingCalendar>(`/${part(workspace)}?${new URLSearchParams({start,end,...(after?{after}:{})})}`),
 addUnit:(workspace:string,data:unknown)=>request<{unit:StockUnit}>(`/${part(workspace)}/units`,data),
 updateUnit:(workspace:string,unit:StockUnit,condition:StockCondition,retired:boolean)=>request<{revision:number}>(`/${part(workspace)}/units/${part(unit.id)}`,{expectedRevision:unit.revision,condition,retired}),
 unitDetail:(workspace:string,id:string,after?:number)=>request<StockUnitDetail>(`/${part(workspace)}/units/${part(id)}${after?`?after=${after}`:''}`),
 reserve:(workspace:string,data:unknown)=>request<{reservation:StagingReservation}>(`/${part(workspace)}/reservations`,data),
 detail:(workspace:string,id:string)=>request<ReservationDetail>(`/${part(workspace)}/reservations/${part(id)}`),
 action:(workspace:string,id:string,action:'pack'|'cancel'|'return',data:unknown)=>request<{revision:number}>(`/${part(workspace)}/reservations/${part(id)}/${action}`,data),
};
