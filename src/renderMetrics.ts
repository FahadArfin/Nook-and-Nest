/** Local diagnostics only; no telemetry or network transmission. */
export class RenderMetrics {
 private samples:number[]=[];private observer?:PerformanceObserver;longTasks=0;
 constructor(){try{this.observer=new PerformanceObserver(list=>{this.longTasks+=list.getEntries().length});this.observer.observe({type:'longtask',buffered:false})}catch{}}
 record(ms:number){this.samples.push(ms);if(this.samples.length>600)this.samples.shift()}
 get p95(){const sorted=[...this.samples].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*.95)]??0}
 dispose(){this.observer?.disconnect()}
}
