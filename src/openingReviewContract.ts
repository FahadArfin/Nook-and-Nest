export const OPENING_REVIEW_VERSION='opening-review-v1';
export interface Span {ax:number;ay:number;bx:number;by:number}
export interface OpeningChoice extends Span {id:string}
export interface OpeningRequest {version:string;choices:OpeningChoice[]}
export interface OpeningAnswer {choiceId:string;kind:'door'|'window'|'open'|'wall'|'uncertain';confidence:'high'|'medium'|'low';note:string}
export function validateOpeningRequest(value:unknown,width:number,height:number):OpeningRequest {
  const r=value as OpeningRequest;
  if(!r||r.version!==OPENING_REVIEW_VERSION||!Array.isArray(r.choices)||r.choices.length<1||r.choices.length>5)throw new Error('Invalid opening choices.');
  const ids=new Set<string>();
  for(const c of r.choices){if(!c||typeof c.id!=='string'||!/^span-[0-4]$/.test(c.id)||ids.has(c.id)||![c.ax,c.ay,c.bx,c.by].every(Number.isFinite)||Math.min(c.ax,c.bx)<0||Math.max(c.ax,c.bx)>width||Math.min(c.ay,c.by)<0||Math.max(c.ay,c.by)>height||Math.hypot(c.bx-c.ax,c.by-c.ay)<5||(c.ax!==c.bx&&c.ay!==c.by))throw new Error('Invalid opening choices.');ids.add(c.id);}
  return r;
}
export function validateOpeningAnswer(value:unknown,choices:OpeningChoice[]):OpeningAnswer {
  const r=value as OpeningAnswer;
  if(!r||(!choices.some(c=>c.id===r.choiceId)&&r.choiceId!=='none')||!['door','window','open','wall','uncertain'].includes(r.kind)||!['high','medium','low'].includes(r.confidence)||typeof r.note!=='string'||r.note.length>800)throw new Error('Invalid opening review. Please inspect this area manually.');
  return r;
}
export const openingAnswerSchema={type:'object',additionalProperties:false,required:['choiceId','kind','confidence','note'],properties:{choiceId:{type:'string'},kind:{type:'string',enum:['door','window','open','wall','uncertain']},confidence:{type:'string',enum:['high','medium','low']},note:{type:'string'}}};
