import {Matrix,Vector3} from '@babylonjs/core/Maths/math.vector';
// WGS84 -> local east/up/south, in metres. The apartment remains near the origin.
export function torontoFrame(x=0,z=0,height=180,rotation=0){
  const lat=43.6385*Math.PI/180,lon=-79.3855*Math.PI/180;
  const n=6378137/Math.sqrt(1-0.00669437999014*Math.sin(lat)**2);
  const origin=new Vector3((n+height)*Math.cos(lat)*Math.cos(lon),(n+height)*Math.cos(lat)*Math.sin(lon),(n*(1-0.00669437999014)+height)*Math.sin(lat));
  const east=new Vector3(-Math.sin(lon),Math.cos(lon),0);
  const up=new Vector3(Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat));
  const south=Vector3.Cross(east,up);
  const localToEarth=Matrix.FromValues(east.x,east.y,east.z,0,up.x,up.y,up.z,0,south.x,south.y,south.z,0,origin.x,origin.y,origin.z,1);
  return {origin,matrix:localToEarth.invert().multiply(Matrix.RotationY(rotation*Math.PI/180)).multiply(Matrix.Translation(x,0,z))};
}
