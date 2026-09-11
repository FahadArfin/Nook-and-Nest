export class FrameBudget {
 private sum=0;private count=0;private slow=0;private fast=0;
 scale=1;
 sample(milliseconds:number){if(!Number.isFinite(milliseconds)||milliseconds<=0||milliseconds>1000)return false;this.sum+=milliseconds;if(++this.count<90)return false;const mean=this.sum/this.count;this.sum=0;this.count=0;this.slow=mean>24?this.slow+1:0;this.fast=mean<11?this.fast+1:0;const previous=this.scale;if(this.slow>=2){this.scale=Math.min(2,this.scale+.15);this.slow=0}if(this.fast>=5){this.scale=Math.max(1,this.scale-.1);this.fast=0}return previous!==this.scale;}
}
