import {STAGING_LIMITS, stagingId, stagingDateRange, parseStockUnit, parseStockUpdate, parseReservation, parseReservationAction, parseWorkspace} from '../src/stagingInventory.ts';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const fail=(error,status)=>json({error},status);
const unit=r=>({id:r.id,stockCode:r.stock_code,label:r.label,catalogId:r.catalog_id,widthMm:r.width_mm,depthMm:r.depth_mm,heightMm:r.height_mm,condition:r.condition,retired:!!r.retired,revision:r.revision});
const booking=r=>({id:r.id,propertyLabel:r.property_label,start:r.start_day,end:r.end_day,state:r.state,revision:r.revision,unitCount:r.unit_count});
const writeRoles="'manager'", readRoles="'manager','viewer'";
// Reused in each SQL statement, including writes after any earlier authorization read.
const authority=(write=false)=>`EXISTS(SELECT 1 FROM staging_workspaces w WHERE w.id=? AND (w.owner_id=? OR EXISTS(SELECT 1 FROM staging_members m WHERE m.workspace_id=w.id AND m.user_id=? AND m.revoked=0 AND m.role IN (${write?writeRoles:readRoles}))))`;
function enrolled(env,actor){try{const a=JSON.parse(env.STAGING_PILOT_OWNER_IDS??'[]');return Array.isArray(a)&&a.length<=100&&a.every(x=>typeof x==='string'&&x.length>0&&x.length<=200)&&a.includes(actor);}catch{return false;}}
async function readBody(request){const reader=request.body?.getReader();if(!reader)throw Error('Missing inventory data.');let bytes=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>STAGING_LIMITS.bodyBytes){await reader.cancel();throw Error('Inventory request is too large.');}chunks.push(value);}const body=new Uint8Array(bytes);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(body));}
const rows=async(stmt)=>(await stmt.all()).results;

/** Returns null outside /api/staging. Catalog is the existing public catalog, not user data. */
export async function stagingInventoryApi(request,env,catalog,clock=()=>new Date()){
 const url=new URL(request.url),prefix='/api/staging';if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))return null;
 const actor=request.headers.get('oai-authenticated-user-id'),db=env.DB,enabled=env.STAGING_PILOT_ENABLED==='true';
 if(url.pathname===prefix+'/status'&&request.method==='GET')return json({enabled:enabled&&!!db,signedIn:!!actor,canEnroll:enabled&&!!db&&!!actor&&enrolled(env,actor)});
 if(!actor)return fail('Sign in to use private staging inventory.',401);
 if(!enabled||!db)return fail('Real reservations are available only in the enrolled staging pilot. Explore the read-only sample instead.',503);
 if(!Array.isArray(catalog)||!catalog.length)return fail('The catalog proxy library is unavailable.',503);
 if(request.method!=='GET'&&request.method!=='POST')return fail('Method not allowed.',405);
 if(request.method==='POST'){
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return fail('Use inventory from this website.',403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return fail('Send JSON inventory data.',415);
 }
 const path=url.pathname.slice(prefix.length),match=/^\/([A-Za-z0-9_-]{1,80})(?:\/(units|reservations)(?:\/([A-Za-z0-9_-]{1,80}))?(?:\/(pack|return|cancel))?)?$/.exec(path);
 if(path&&!match)return fail('Inventory route not found.',404);
 const workspace=match?.[1],collection=match?.[2],id=match?.[3],action=match?.[4],now=clock().toISOString(),today=now.slice(0,10);
 const authArgs=[workspace,actor,actor];
 const can=async(write=false)=>!!await db.prepare(`SELECT 1 AS allowed WHERE ${authority(write)}`).bind(...authArgs).first();
 const q=(sql,args=[])=>db.prepare(sql).bind(...args);
 const ownedBooking=async()=>q(`SELECT * FROM staging_reservations WHERE workspace_id=? AND id=? AND state!='building' AND ${authority()}`,[workspace,id,...authArgs]).first();
 try{
  if(!path&&request.method==='GET')return json({workspaces:await rows(q(`SELECT w.id,w.name,CASE WHEN w.owner_id=? THEN 'owner' ELSE m.role END AS role FROM staging_workspaces w LEFT JOIN staging_members m ON m.workspace_id=w.id AND m.user_id=? AND m.revoked=0 AND m.role IN (${readRoles}) WHERE w.owner_id=? OR m.user_id IS NOT NULL ORDER BY w.created_at,w.id LIMIT 25`,[actor,actor,actor]))});
  if(!path&&request.method==='POST'){
   if(!enrolled(env,actor))return fail('This account has not been enrolled in the staging-business pilot.',403);
   let data;try{data=parseWorkspace(await readBody(request));}catch{return fail('Enter an inventory name, up to 80 characters.',400);}
   const workspaceId=crypto.randomUUID();const result=await q('INSERT INTO staging_workspaces(id,owner_id,name,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM staging_workspaces WHERE owner_id=?)<?',[workspaceId,actor,data.name,now,actor,STAGING_LIMITS.workspaces]).run();
   return result.meta.changes?json({workspace:{id:workspaceId,name:data.name,role:'owner'}},201):fail('This pilot account has reached its inventory limit.',409);
  }
  if(!await can(request.method==='POST'))return fail('Inventory not found or this action is not permitted.',404);
  if(!collection&&request.method==='GET'){
   let range,after;try{if([...url.searchParams.keys()].some(k=>!['start','end','after'].includes(k)))throw Error();range=stagingDateRange(url.searchParams.get('start'),url.searchParams.get('end'));after=url.searchParams.get('after')??'';if(after&&!stagingId(after))throw Error();}catch{return fail('Choose valid calendar dates.',400);}
   // A packed unit blocks new reservations even when overdue. Cancelled/completed rows remain visible history.
   const stock=await rows(q(`SELECT u.*,EXISTS(SELECT 1 FROM staging_reservation_units b JOIN staging_reservations r ON r.workspace_id=b.workspace_id AND r.id=b.reservation_id WHERE b.workspace_id=u.workspace_id AND b.unit_id=u.id AND (b.status='packed' OR (b.status='reserved' AND r.start_day<? AND ?<r.end_day))) AS booked FROM staging_units u WHERE u.workspace_id=? AND ${authority()} ORDER BY u.stock_code LIMIT 500`,[range.end,range.start,workspace,...authArgs]));
   const reservations=await rows(q(`SELECT * FROM staging_reservations WHERE workspace_id=? AND state!='building' AND (start_day<? AND ?<end_day OR state='packed') AND id>? AND ${authority()} ORDER BY id LIMIT 101`,[workspace,range.end,range.start,after,...authArgs]));
   if(!await can())return fail('Inventory access changed. Refresh to continue.',403);
   return json({units:stock.map(r=>({...unit(r),available:!r.retired&&['good','fair'].includes(r.condition)&&!r.booked})),reservations:reservations.slice(0,100).map(booking),next:reservations.length>100?reservations[99].id:null});
  }
  if(collection==='units'&&id&&!action&&request.method==='GET'){
   const after=Number(url.searchParams.get('after')??Number.MAX_SAFE_INTEGER);
   if([...url.searchParams.keys()].some(k=>k!=='after')||!Number.isSafeInteger(after)||after<1)return fail('Invalid ledger page.',400);
   const stock=await q(`SELECT * FROM staging_units WHERE workspace_id=? AND id=? AND ${authority()}`,[workspace,id,...authArgs]).first();if(!stock)return fail('Stock unit not found.',404);
   const events=await rows(q(`SELECT id,unit_id,reservation_id,kind,at,detail FROM staging_events WHERE workspace_id=? AND unit_id=? AND id<? AND ${authority()} ORDER BY id DESC LIMIT 101`,[workspace,id,after,...authArgs]));
   if(!await can())return fail('Inventory access changed.',403);
   return json({unit:unit(stock),events:events.slice(0,100).map(r=>({id:r.id,unitId:r.unit_id,reservationId:r.reservation_id,kind:r.kind,at:r.at,detail:JSON.parse(r.detail)})),next:events.length>100?events[99].id:null});
  }
  if(collection==='units'&&!id&&request.method==='POST'){
   let data;try{data=parseStockUnit(await readBody(request),catalog);}catch(error){return fail(error.message,400);}
   const serialized=JSON.stringify(data),prior=await q(`SELECT * FROM staging_units WHERE workspace_id=? AND request_id=? AND ${authority(true)}`,[workspace,data.requestId,...authArgs]).first();
   if(prior)return prior.request_json===serialized?json({unit:unit(prior)}):fail('This request identifier was already used for different stock.',409);
   const unitId=crypto.randomUUID();const result=await q(`INSERT INTO staging_units(workspace_id,id,request_id,request_json,stock_code,label,catalog_id,width_mm,depth_mm,height_mm,condition,updated_at,actor_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${authority(true)}`,[workspace,unitId,data.requestId,serialized,data.stockCode,data.label,data.catalogId,data.widthMm,data.depthMm,data.heightMm,data.condition,now,actor,...authArgs]).run();
   return result.meta.changes?json({unit:{id:unitId,...data,revision:1,retired:false}},201):fail('Inventory access changed.',403);
  }
  if(collection==='units'&&id&&!action&&request.method==='POST'){
   let data;try{data=parseStockUpdate(await readBody(request));}catch(error){return fail(error.message,400);}
   const result=await q(`UPDATE staging_units SET condition=?,retired=?,revision=revision+1,updated_at=?,actor_id=? WHERE workspace_id=? AND id=? AND revision=? AND ${authority(true)} AND NOT EXISTS(SELECT 1 FROM staging_reservation_units b WHERE b.workspace_id=staging_units.workspace_id AND b.unit_id=staging_units.id AND b.status='packed')`,[data.condition,Number(data.retired),now,actor,workspace,id,data.expectedRevision,...authArgs]).run();
   return result.meta.changes?json({revision:data.expectedRevision+1}):fail('Stock changed, reached its pilot revision limit, or is packed. Refresh; use the return list for packed stock.',409);
  }
  if(collection==='reservations'&&!id&&request.method==='POST'){
   let data;try{data=parseReservation(await readBody(request));}catch(error){return fail(error.message,400);}
   if(data.start<today)return fail('New reservations must start today or later (UTC calendar).',400);
   const serialized=JSON.stringify(data),prior=await q(`SELECT * FROM staging_reservations WHERE workspace_id=? AND request_id=? AND ${authority(true)}`,[workspace,data.requestId,...authArgs]).first();
   if(prior)return prior.request_json===serialized?json({reservation:booking(prior)}):fail('This request identifier was already used for a different reservation.',409);
   const reservationId=crypto.randomUUID(),operation=crypto.randomUUID();
   const guard=`SELECT 1 FROM staging_reservations WHERE workspace_id=? AND id=? AND operation=? AND state='building'`;
   const statements=[q(`INSERT INTO staging_reservations(workspace_id,id,request_id,request_json,property_label,start_day,end_day,state,unit_count,operation,created_at,updated_at,actor_id) SELECT ?,?,?,?,?,?,?,'building',?,?,?,?,? WHERE ${authority(true)}`,[workspace,reservationId,data.requestId,serialized,data.propertyLabel,data.start,data.end,data.unitIds.length,operation,now,now,actor,...authArgs])];
   for(const unitId of data.unitIds)statements.push(q(`INSERT INTO staging_reservation_units(workspace_id,reservation_id,unit_id,stock_code,label,catalog_id,width_mm,depth_mm,height_mm,condition_out,status,updated_at,actor_id) SELECT workspace_id,?,id,stock_code,label,catalog_id,width_mm,depth_mm,height_mm,condition,'reserved',?,? FROM staging_units WHERE workspace_id=? AND id=? AND EXISTS(${guard})`,[reservationId,now,actor,workspace,unitId,workspace,reservationId,operation]));
   statements.push(q(`UPDATE staging_reservations SET state='reserved' WHERE workspace_id=? AND id=? AND operation=?`,[workspace,reservationId,operation]));
   const result=await db.batch(statements);
   return result[0].meta.changes?json({reservation:{id:reservationId,propertyLabel:data.propertyLabel,start:data.start,end:data.end,state:'reserved',revision:1,unitCount:data.unitIds.length}},201):fail('Inventory access changed.',403);
  }
  if(collection==='reservations'&&id&&!action&&request.method==='GET'){
   const reservation=await ownedBooking();if(!reservation)return fail('Reservation not found.',404);
   const packed=await rows(q(`SELECT b.*,u.revision,u.retired,u.condition FROM staging_reservation_units b JOIN staging_units u ON u.workspace_id=b.workspace_id AND u.id=b.unit_id WHERE b.workspace_id=? AND b.reservation_id=? AND ${authority()} ORDER BY b.stock_code LIMIT 50`,[workspace,id,...authArgs]));
   const events=await rows(q(`SELECT id,unit_id,reservation_id,kind,at,detail FROM staging_events WHERE workspace_id=? AND reservation_id=? AND ${authority()} ORDER BY id LIMIT 500`,[workspace,id,...authArgs]));
   if(!await can())return fail('Inventory access changed.',403);
   return json({reservation:booking(reservation),units:packed.map(r=>({...unit({...r,id:r.unit_id}),status:r.status,conditionOut:r.condition_out,conditionIn:r.condition_in,returnNote:r.return_note,packedAt:r.packed_at,returnedAt:r.returned_at})),events:events.map(r=>({id:r.id,unitId:r.unit_id,reservationId:r.reservation_id,kind:r.kind,at:r.at,detail:JSON.parse(r.detail)}))});
  }
  if(collection==='reservations'&&id&&action&&request.method==='POST'){
   let data;try{data=parseReservationAction(await readBody(request),action);}catch(error){return fail(error.message,400);}
   const operation=crypto.randomUUID();
   const extra=action==='pack'?"AND state='reserved' AND start_day<=? AND ?<end_day":action==='cancel'?"AND state='reserved'":"AND state='packed' AND EXISTS(SELECT 1 FROM staging_reservation_units b WHERE b.workspace_id=staging_reservations.workspace_id AND b.reservation_id=staging_reservations.id AND b.unit_id=? AND b.status='packed')";
   const newState=action==='pack'?'packed':action==='cancel'?'cancelled':'packed';
   const statements=[q(`UPDATE staging_reservations SET state=?,revision=revision+1,operation=?,updated_at=?,actor_id=? WHERE workspace_id=? AND id=? AND revision=? AND revision<200 AND ${authority(true)} ${extra}`,[newState,operation,now,actor,workspace,id,data.expectedRevision,...authArgs,...(action==='pack'?[today,today]:action==='return'?[data.unitId]:[])])];
   const guard='EXISTS(SELECT 1 FROM staging_reservations r WHERE r.workspace_id=? AND r.id=? AND r.operation=?)';
   if(action==='pack')statements.push(q(`UPDATE staging_reservation_units SET status='packed',condition_out=(SELECT condition FROM staging_units u WHERE u.workspace_id=staging_reservation_units.workspace_id AND u.id=staging_reservation_units.unit_id),packed_at=?,updated_at=?,actor_id=? WHERE workspace_id=? AND reservation_id=? AND status='reserved' AND ${guard}`,[now,now,actor,workspace,id,workspace,id,operation]));
   else if(action==='cancel')statements.push(q(`UPDATE staging_reservation_units SET status='cancelled',updated_at=?,actor_id=? WHERE workspace_id=? AND reservation_id=? AND status='reserved' AND ${guard}`,[now,actor,workspace,id,workspace,id,operation]));
   else{
    statements.push(q(`UPDATE staging_reservation_units SET status='returned',condition_in=?,return_note=?,returned_at=?,updated_at=?,actor_id=? WHERE workspace_id=? AND reservation_id=? AND unit_id=? AND status='packed' AND ${guard}`,[data.condition,data.note,now,now,actor,workspace,id,data.unitId,workspace,id,operation]));
    statements.push(q(`UPDATE staging_units SET condition=?,revision=revision+1,updated_at=?,actor_id=? WHERE workspace_id=? AND id=? AND ${guard}`,[data.condition,now,actor,workspace,data.unitId,workspace,id,operation]));
    statements.push(q(`UPDATE staging_reservations SET state='completed' WHERE workspace_id=? AND id=? AND operation=? AND NOT EXISTS(SELECT 1 FROM staging_reservation_units b WHERE b.workspace_id=? AND b.reservation_id=? AND b.status!='returned')`,[workspace,id,operation,workspace,id]));
   }
   const result=await db.batch(statements);return result[0].meta.changes?json({revision:data.expectedRevision+1}):fail('Reservation changed or this action is unavailable. Refresh the pack list. Packing is available during its booked UTC dates.',409);
  }
  return fail('Inventory route not found.',404);
 }catch(error){
  if(/staging_overlap|staging_unavailable|staging_missing_unit|staging_bad_transition|staging_bad_state/.test(String(error?.message)))return fail('One or more physical units are unavailable. No part of this reservation was changed. Refresh the calendar.',409);
  if(/staging_.*limit|UNIQUE constraint failed|CHECK constraint failed|staging_finished|staging_stale/.test(String(error?.message)))return fail('This record conflicts with existing stock, changed elsewhere, or reached a pilot limit. Refresh before trying again.',409);
  return fail('Private inventory is temporarily unavailable. Refresh to check the ledger before retrying; no automatic retry was made.',503);
 }
}
