/** Pure evidence maintenance. File presence never grants review/release acceptance. */
export function refreshFamilyObservations(family,assets){
  const complete=assets.length>0&&assets.every(a=>a.editableSource&&a.glb&&a.sourcePreview);
  const explicit=family.status==='covered-existing'||/^(reviewed|validated|accepted|released)(?:$|[- ])/i.test(family.status);
  if(explicit){
    const needsWeb=family.status==='covered-existing'||/^(validated|released)(?:$|[- ])/i.test(family.status);
    if(!complete||(needsWeb&&assets.some(a=>!a.webPreview)))throw Error('Accepted family is missing required asset files: '+family.name+' ('+family.status+')');
    return {...family,assets};
  }
  return {...family,assets,status:complete?'exported-awaiting-review':assets.some(a=>a.glb)?'partially-exported-awaiting-review':'authored-awaiting-export'};
}

export function refreshAuditByteCounts(audit,byteCounts){
  const result={...audit};let updated=0;
  for(const [id,bytes] of Object.entries(byteCounts)){
    if(!audit[id])throw Error('Household audit is missing exported model: '+id);
    if(!Number.isSafeInteger(bytes)||bytes<=0)throw Error('Invalid GLB byte count: '+id);
    if(audit[id].glbBytes!==bytes){result[id]={...audit[id],glbBytes:bytes};updated++;}
  }
  return {audit:result,updated};
}
