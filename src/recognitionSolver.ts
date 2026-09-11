import {scaleAssessment,type Recognition} from './recognitionContract';
import type {WallCandidate} from './recognitionEvidence';
/** Parse only recognized unit forms; ambiguous text is never silently converted. */
export function printedMillimetres(text:string):number|undefined {
  const s=text.trim().replace(/[′’]/g,"'").replace(/[″“”]/g,'"');
  const imperial=s.match(/^(\d+)\s*(?:'|ft|feet)\s*[- ]?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inches))?$/i);
  if(imperial&&Number(imperial[2]??0)<12)return Number(imperial[1])*304.8+Number(imperial[2]??0)*25.4;
  const metric=s.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m)$/i);if(metric)return Number(metric[1])*({mm:1,cm:10,m:1000}[metric[2].toLowerCase()]!);
}
export function solveRecognition(input:Recognition,walls:WallCandidate[],inventory:{name:string;x:number;y:number}[]=[]):Recognition {
  const result=structuredClone(input),notes:string[]=[];
  // Snap only tiny coordinate discrepancies to supported wall centre lines.
  const xs=walls.filter(w=>w.axis==='v').map(w=>w.x+w.width/2),ys=walls.filter(w=>w.axis==='h').map(w=>w.y+w.height/2);
  const snap=(n:number,values:number[])=>values.reduce((best,v)=>Math.abs(v-n)<Math.abs(best-n)?v:best,n+3.01);
  const near=(n:number,values:number[])=>{const v=snap(n,values);return Math.abs(v-n)<=3?Math.round(v*10)/10:n;};
  for(const r of result.rooms){const x=near(r.x,xs),right=near(r.x+r.width,xs),y=near(r.y,ys),bottom=near(r.y+r.height,ys);if(right-x>=5&&bottom-y>=5){r.x=x;r.y=y;r.width=right-x;r.height=bottom-y;}}
  for(const d of result.dimensions){const value=printedMillimetres(d.text);if(value!==undefined&&value>=100&&value<=60000){if(Math.abs(d.millimetres-value)>.1)notes.push(`Converted printed measurement ${d.text} from its units.`);d.millimetres=value;}}
  for(let i=0;i<result.rooms.length;i++)for(let j=i+1;j<result.rooms.length;j++){const a=result.rooms[i],b=result.rooms[j],area=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));if(area>9)notes.push(`Check overlapping room areas: ${a.name} / ${b.name}.`);}
  for(const item of inventory)if(!result.rooms.some(r=>item.x>=r.x&&item.x<=r.x+r.width&&item.y>=r.y&&item.y<=r.y+r.height))notes.push(`Check missing area near label: ${item.name}.`);
  const evidence=result.dimensions.map(d=>({axis:Math.abs(d.bx-d.ax)>=Math.abs(d.by-d.ay)?'x':'y',scale:d.millimetres/Math.hypot(d.bx-d.ax,d.by-d.ay)}));
  const median=(n:number[])=>n.sort((a,b)=>a-b)[Math.floor(n.length/2)];const x=evidence.filter(d=>d.axis==='x').map(d=>d.scale),y=evidence.filter(d=>d.axis==='y').map(d=>d.scale);
  if(x.length&&y.length&&Math.max(median(x)/median(y),median(y)/median(x))>1.2)notes.push('Horizontal and vertical measurements disagree. This drawing may not be to scale; review calibration before creating 3D.');
  result.fixtures=[];result.warnings=[...new Set([...notes,...scaleAssessment(result).warnings,...result.warnings])].slice(0,30);return result;
}
