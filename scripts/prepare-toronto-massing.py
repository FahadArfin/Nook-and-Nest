"""Extract bounded 2025 City multipatch surfaces in the existing local metre frame.
Requires fiona, pyproj, shapely. Raw GDB stays outside the deployed release.
"""
import json,math,hashlib,gzip
from pathlib import Path
import fiona
from pyproj import Transformer
from shapely.geometry import Polygon,Point
from shapely import constrained_delaunay_triangles
root=Path(__file__).resolve().parents[1]; data=root/'assets-source/geodata'
gdb=data/'3DMassingMultipatch_2025_WGS84.gdb'
mesh={};count=0;tiles=[];triangles=0;window_panels=0

def add(name,verts,faces):
 global window_panels
 if name=='city-window-lights':
  if window_panels>=24000:return
  window_panels+=1
 v,f=mesh.setdefault(name,[[],[]]);o=len(v);v.extend(verts);f.extend([[a+o for a in face] for face in faces])

def xyz(p,t):
 lon,lat=t.transform(p[0],p[1]);return ((lon+79.3825)*111320*math.cos(math.radians(43.64)),(lat-43.64)*111320,p[2]-80)
def polygons(g):
 if g['type']=='Polygon':return [g['coordinates']]
 if g['type']=='MultiPolygon':return g['coordinates']
 return [p for child in g.get('geometries',[]) for p in polygons(child)]

for name in fiona.listlayers(gdb):
 if not name.startswith('Multipatch'):continue
 with fiona.open(gdb,layer=name) as layer:
  to=Transformer.from_crs(4326,layer.crs,always_xy=True);back=Transformer.from_crs(layer.crs,4326,always_xy=True)
  x0,y0=to.transform(-79.425,43.625);x1,y1=to.transform(-79.35,43.675);b=layer.bounds
  if b[0]>x1 or b[2]<x0 or b[1]>y1 or b[3]<y0:continue
  used=0
  for feat in layer.filter(bbox=(x0,y0,x1,y1)):
   if feat.geometry is None:continue
   polys=polygons(feat.geometry.__geo_interface__)
   points=[xyz(p,back) for rings in polys for ring in rings for p in ring]
   if not points:continue
   xs=[p[0] for p in points];ys=[p[1] for p in points];zs=[p[2] for p in points]
   xmin,xmax,ymin,ymax,zmin,zmax=min(xs),max(xs),min(ys),max(ys),min(zs),max(zs)
   if xmin<45 and xmax>-45 and ymin<45 and ymax>-45:continue
   if zmax-zmin<.5:continue
   seed=int(hashlib.sha256((name+feat.id).encode()).hexdigest()[:8],16)
   mat='glass' if zmax>-45 else 'stone'+str(seed%3)
   for rings in polys:
    rings=[[xyz(p,back) for p in ring] for ring in rings]
    r=rings[0]
    if len(r)<4:continue
    # Newell normal handles concave faces and redundant initial vertices.
    normal=[sum((p[(a+1)%3]-q[(a+1)%3])*(p[(a+2)%3]+q[(a+2)%3]) for p,q in zip(r,r[1:]+r[:1])) for a in range(3)]
    dominant=max(range(3),key=lambda a:abs(normal[a]));axes=[a for a in range(3) if a!=dominant]
    if abs(normal[dominant])<1e-8:continue
    if dominant==2 and max(p[2] for p in r)<-79.9:continue
    flat=[[(p[axes[0]],p[axes[1]]) for p in ring] for ring in rings]
    poly=Polygon(flat[0],flat[1:])
    if not poly.is_valid:poly=poly.buffer(0)
    if poly.is_empty:continue
    lookup={(p[axes[0]],p[axes[1]]):p for ring in rings for p in ring}
    roof=dominant==2
    for tri in constrained_delaunay_triangles(poly).geoms:
     verts=[]
     for u,v in list(tri.exterior.coords)[:3]:
      p=lookup.get((u,v))
      if p is None:
       out=list(r[0]);out[axes[0]]=u;out[axes[1]]=v;out[dominant]=r[0][dominant]-sum(normal[a]*(out[a]-r[0][a]) for a in axes)/normal[dominant];p=out
      verts.append([round(c,3) for c in p])
     add(mat+'-roof' if roof else mat,verts,[[0,1,2]]);triangles+=1
    # Illustrative lit windows stay on the actual vertical facade planes.
    if not roof and len(r)==5 and zmax>-65 and min(abs(xmin),abs(xmax))<1200 and min(abs(ymin),abs(ymax))<1200:
     bottom=sorted(r[:-1],key=lambda p:p[2])[:2];a,b=bottom;length=math.hypot(b[0]-a[0],b[1]-a[1]);height=max(p[2] for p in r)-max(a[2],b[2])
     if length>3 and height>4:
      ux=(b[0]-a[0])/length;uy=(b[1]-a[1])/length
      for level in range(1,min(95,int(height/3.3))):
       for j in range(int(length/4)):
        if (j*13+level*7+seed)%5>1:continue
        lo=1+j*4;hi=min(lo+1.6,length-.6);z=max(a[2],b[2])+level*3.3
        if hi<=lo:continue
        for offset in [-.04,.04]:
         add('city-window-lights',[(a[0]+ux*d+uy*offset,a[1]+uy*d-ux*offset,zz) for d,zz in [(lo,z),(hi,z),(hi,z+1.6),(lo,z+1.6)]],[[0,1,2,3]])
   count+=1;used+=1
   if used%100==0:print(name,'processed',used,'triangles',triangles,'windows',window_panels,flush=True)
  if used:tiles.append(name);print(name,used,flush=True)
out={'buildings':count,'triangles':triangles,'tiles':tiles,'year':2025,'source':'https://open.toronto.ca/dataset/3d-massing/','sourceCRS':'EPSG:3857','bounds':[-79.425,43.625,-79.35,43.675],'localOrigin':[-79.3825,43.64],'groundY':-80}
(data/'toronto-massing-mesh.json').write_text(json.dumps(mesh,separators=(',',':')))
(root/'public/data/toronto/massing-manifest.json').write_text(json.dumps(out,indent=2))
with gzip.open(data/'massing-mesh.json.gz','wt') as f:json.dump(mesh,f,separators=(',',':'))
print(out,flush=True)



