"""Build a bounded, attributed Toronto mesh from Overture + OSM. Metres, Z up.
pip install shapely; then run from repository root. Heights are never invented
as measured values: the downloadable source and manifest retain provenance.
"""
import json, math, hashlib, gzip
from pathlib import Path
from collections import Counter
from shapely.geometry import shape, Polygon, LineString, Point, box
from shapely.ops import transform, polygonize, unary_union
from shapely import constrained_delaunay_triangles

ROOT=Path('.'); DATA=ROOT/'assets-source/geodata'; OUT=ROOT/'public/data/toronto';OUT.mkdir(parents=True,exist_ok=True)
LON,LAT=-79.3825,43.6400
def xy(x,y,z=None): return ((x-LON)*111320*math.cos(math.radians(LAT)),(y-LAT)*111320)
def projected(g):return transform(xy,shape(g))
mesh={};stats=Counter(); source_sets=set(); points=[]
def face(material,vertices,faces):
 v,f=mesh.setdefault(material,[[],[]]);offset=len(v);v.extend([[round(c,3) for c in p] for p in vertices]);f.extend([[i+offset for i in t] for t in faces])
def surface(poly,z,material):
 for tri in constrained_delaunay_triangles(poly).geoms:
  c=list(tri.exterior.coords)[:3];face(material,[(x,y,z) for x,y in c],[[0,1,2]])
def polygons(g):return [g] if g.geom_type=='Polygon' else list(g.geoms) if g.geom_type=='MultiPolygon' else []
def extrude(poly,base,height,material,windows=False,seed=0):
 surface(poly,height,material+'-roof')
 for ring in [poly.exterior,*poly.interiors]:
  coords=list(ring.coords)
  for (x,y),(xx,yy) in zip(coords,coords[1:]):
   face(material,[(x,y,base),(xx,yy,base),(xx,yy,height),(x,y,height)],[[0,1,2,3]])
   length=math.hypot(xx-x,yy-y)
   if windows and length>3:
    ux=(xx-x)/length;uy=(yy-y)/length
    # A subset of individually lit windows, bounded by facade area.
    for level in range(1,min(95,int((height-base)/3.3))):
     for j in range(int(length/4)):
      if (j*13+level*7+seed)%5>1:continue
      a=1+j*4;b=min(a+1.6,length-.6);z=base+level*3.3
      if b<=a:continue
      face('city-window-lights',[(x+ux*a+uy*.06,y+uy*a-ux*.06,z),(x+ux*b+uy*.06,y+uy*b-ux*.06,z),(x+ux*b+uy*.06,y+uy*b-ux*.06,z+1.6),(x+ux*a+uy*.06,y+uy*a-ux*.06,z+1.6)],[[0,1,2,3]])

buildings=json.loads((DATA/'toronto-buildings.geojson').read_text(encoding='utf-8'))['features']
parts=json.loads((DATA/'toronto-building-parts.geojson').read_text(encoding='utf-8'))['features']
parents={f['properties'].get('building_id') for f in parts}
for kind,features in [('building',buildings),('part',parts)]:
 for f in features:
  p=f['properties'];g=projected(f['geometry']).buffer(0).simplify(.25,preserve_topology=True)
  if p.get('is_underground') or g.is_empty:continue
  if g.distance(Point(0,0))<45:stats['excluded_for_editable_home']+=1;continue
  measured=p.get('height');floors=p.get('num_floors');height=measured or (floors*3.2 if floors else 9)
  base=p.get('min_height') or (p.get('min_floor') or 0)*3.2
  if height<=base:height=base+3
  if kind=='building' and f['id'] in parents:height=min(height,4);stats['parent_podiums']+=1
  stats[kind+'s']+=1;stats['explicit_height' if measured else 'floor_count_height' if floors else 'default_height']+=1
  for s in p.get('sources',[]):source_sets.add(s.get('dataset',''))
  seed=int(hashlib.sha256(f['id'].encode()).hexdigest()[:8],16)
  material='glass' if height>35 else 'brick' if p.get('facade_material')=='brick' else 'stone'+str(seed%3)
  for poly in polygons(g):extrude(poly,-80+base,-80+height,material,g.distance(Point(0,0))<1200 and height>12,seed)
  if kind=='building':points.append(g.representative_point())

osm=json.loads((DATA/'toronto-osm-context.json').read_text(encoding='utf-8'))
coast=[]
for e in osm['elements']:
 coords=[xy(p['lon'],p['lat']) for p in e.get('geometry',[])];tags=e.get('tags',{})
 if len(coords)<2:continue
 if tags.get('natural')=='coastline':coast.append(LineString(coords))
 elif tags.get('highway'):
  w={'primary':8,'secondary':7,'tertiary':5,'residential':3,'pedestrian':2}.get(tags['highway'],3)
  for p in polygons(LineString(coords).buffer(w,cap_style=2,join_style=2)):surface(p,-79.85,'road')
  stats['street_ways']+=1
 elif tags.get('leisure')=='park' and coords[0]==coords[-1]:
  for p in polygons(Polygon(coords).buffer(0)):surface(p,-79.75,'park')
  stats['parks']+=1
# Lake Ontario is mapped as an OSM water multipolygon, not ocean coastline.
boundary=box(-15000,-15000,15000,15000)
lake=json.loads((DATA/'toronto-osm-lake.json').read_text(encoding='utf-8'))
outer=[];inner=[]
for relation in lake['elements']:
 for member in relation.get('members',[]):
  coords=[xy(p['lon'],p['lat']) for p in member.get('geometry',[]) if p]
  if len(coords)>1:(inner if member.get('role')=='inner' else outer).append(LineString(coords))
water=unary_union(list(polygonize(unary_union(outer))))
islands=unary_union(list(polygonize(unary_union(inner))))
water=water.difference(islands).intersection(boundary).simplify(.7,preserve_topology=True)
if water.is_empty:raise RuntimeError('Incomplete OSM lake polygon')
land_polys=polygons(boundary.difference(water));land_count=len(land_polys)
for poly in land_polys:surface(poly,-80,'land')
assert not any(p.contains(Point(*xy(-79.38,43.632))) for p in land_polys),'Harbour test point must be water'
assert any(p.contains(Point(*xy(-79.387,43.645))) for p in land_polys),'Downtown test point must be land'
surface(box(-15000,-15000,15000,15000),-80.2,'water')
stats['shoreline_land_polygons']=land_count
if land_count==0:raise RuntimeError('OSM coastline did not form land polygons; refuse unverified water-only backdrop')
(DATA/'toronto-mesh.json').write_text(json.dumps(mesh,separators=(',',':')),encoding='utf-8')
manifest=dict(release='2026-08-19.0',bbox=[-79.425,43.625,-79.35,43.675],origin=[LON,LAT],groundElevation=-80,units='metres',statistics=dict(stats),sources=sorted(source_sets),license='ODbL-1.0',heightPolicy='Explicit height; otherwise floors x 3.2 m; otherwise 9 m. Parent footprints with parts use a 4 m podium. Facade colors and window lighting are illustrative.',scope='Downtown Toronto and harbour; not the entire municipality. A 45 m clear area preserves the editable home.')
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
for name in ['toronto-buildings.geojson','toronto-building-parts.geojson','toronto-osm-context.json','toronto-osm-lake.json']:
 with gzip.open(OUT/(name+'.gz'),'wb') as f:f.write((DATA/name).read_bytes())
print(json.dumps(manifest,indent=2));print('Mesh vertices',sum(len(v) for v,f in mesh.values()))
