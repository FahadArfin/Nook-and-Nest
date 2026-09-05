"""Batch 11: construction-aware detail pass over the existing authored collection.

Details follow each component's local frame, including angled cushions and doors.
Existing silhouettes, materials, support surfaces and nominal sizes are retained.
"""
import json,math
from pathlib import Path
import bpy
from mathutils import Vector
from detailed_models import Geometry
MANIFEST=json.loads((Path(__file__).resolve().parent/'interior_detail_manifest.json').read_text())

def refined_builders(builders,box,cyl,material):
 def refine(row,builder,m):
  dims=builder(m);w,d,h=dims;id=row['id'];category=row['category'];g=Geometry()
  brass=material('joinery-aged-brass',(.41,.29,.13),None,.66,.35)
  seam=material('tailored-tone-on-tone-stitch',(.46,.49,.34),None,.99)
  dark=material('recess-shadow-detail',(.055,.065,.057),None,.97)
  ceramic=material('ceramic-fitting-detail',(.80,.81,.73),None,.55)
  bpy.context.view_layer.update()
  objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];count=0
  def tube(n,points,r,mat):g.tube(n,points,r,mat,6)
  def local_tube(o,n,points,r,mat):tube(n,[o.matrix_world@Vector(p) for p in points],r,mat)
  def perimeter(o,n,a,b,depth,axis,mat,r=.0025):
   # Rounded rectangle on a chosen local face, inset within the authored envelope.
   pts=[];radius=min(a,b)*.11
   for cx,cy,start in [(a/2-radius,b/2-radius,0),(-a/2+radius,b/2-radius,90),(-a/2+radius,-b/2+radius,180),(a/2-radius,-b/2+radius,270)]:
    for j in range(6):
     ang=math.radians(start+j*18);u=cx+radius*math.cos(ang);v=cy+radius*math.sin(ang)
     pts.append((u,v,depth) if axis=='z' else (u,depth,v))
   if n in ['tailored_double_welt','mattress_lower_ticking']:
    fitted=[]
    for p in pts:
     hit,position,normal,_=o.closest_point_on_mesh(Vector(p))
     fitted.append(position+normal*.001 if hit else Vector(p))
    pts=fitted
   local_tube(o,n,pts+[pts[0]],r,mat)
  for o in objects:
   name=o.name.lower();coords=[v.co for v in o.data.vertices]
   if not coords:continue
   low=[min(v[i] for v in coords) for i in range(3)];high=[max(v[i] for v in coords) for i in range(3)];sx,sy,sz=[high[i]-low[i] for i in range(3)]
   # Helpers use mesh-local dimensions; primitives have centered origins.
   if max(abs(high[i]+low[i]) for i in range(3))>.012:continue
   if any(k in name for k in ['cushion','tailored_seat','padded_back','seat_pad','upholstered_top','pillow','mattress','folded_quilt','duvet','blanket']):
    horizontal=sy>sz;axis='z' if horizontal else 'y';a=sx*.93;b=(sy if horizontal else sz)*.93;depth=sz*.35 if horizontal else -sy*.35
    if min(a,b)>.07:
     perimeter(o,'tailored_double_welt',a,b,depth,axis,seam,.0022);count+=1
     if 'mattress' in name:
      perimeter(o,'mattress_lower_ticking',sx*.95,sy*.95,-sz*.34,'z',ceramic,.0018)
      for i in range(10):
       x=(i/9-.5)*sx*.82;local_tube(o,'mattress_side_quilting',[(x,-sy*.49,-sz*.27),(x+.01,-sy*.49,0),(x,-sy*.49,sz*.27)],.0018,seam)
     if 'quilt' in name or 'duvet' in name or 'blanket' in name:
      for i in range(9):
       x=(i/8-.5)*sx*.84;local_tube(o,'quilt_channel_stitch',[(x,-sy*.42,sz*.41),(x,0,sz*.47),(x,sy*.42,sz*.41)],.0012,seam)
   if any(k in name for k in ['drawer_front','cart_door','cabinet_door','door_panel','framed_door','drawer_face','front_panel']) and sy<min(sx,sz)*.6 and min(sx,sz)>.13:
    perimeter(o,'inset_front_bead',sx*.87,sz*.84,-sy*.51,'y',m['wood_dark'],.0026);count+=1
   if any(k in name for k in ['leg','foot','post','spindle']) and min(sx,sy)>.035 and sz>.08 and max(sx,sy)<.24:
    # End-grain plugs locate joints rather than scattering ornamental bolts.
    z=sz*.32;local_tube(o,'joinery_pin',[(0,-sy*.501,z),(0,-sy*.54,z)],min(.005,sx*.065),brass);count+=1
   if any(k in name for k in ['table_top','tabletop','worktop','coffee_top','desk_top','wood_top','counter_top']) and min(sx,sy)>.25 and sz<.18:
    if 'counter' not in name and 'worktop' not in name and o.data.name.startswith('Cube'):perimeter(o,'under_top_edge_bead',sx*.97,sy*.97,-sz*.36,'z',m['wood_dark'],.0028)
    count+=1
   if any(k in name for k in ['tap','faucet','spout','mixer','lever']) and max(sx,sy,sz)<.7:
    # Machined collar around the authored fitting, without capping the basin.
    if sz>sx and sz>sy:
     pts=[(sx*.47*math.cos(i*math.tau/20),sy*.47*math.sin(i*math.tau/20),-sz*.34) for i in range(21)];local_tube(o,'faucet_sealing_collar',pts,.002,brass);count+=1
   if 'drain' in name and sx>.018 and sy>.018:
    for i in [-1,0,1]:local_tube(o,'drain_strainer_slots',[(-sx*.27,i*sy*.16,sz*.52),(sx*.27,i*sy*.16,sz*.52)],.0014,dark)
    count+=1
   if any(k in name for k in ['shower_head','rain_head','rainfall_head']):
    for x in range(7):
     for y in range(7):
      p=(sx*(x-3)*.115,sy*(y-3)*.115,-sz*.52);local_tube(o,'individual_silicone_nozzle',[p,(p[0],p[1],p[2]-.002)],.0022,ceramic)
    count+=1
   if any(k in name for k in ['screen','display']) and sx>.13 and sz>.05 and sy<.10:
    perimeter(o,'screen_inner_bezel',sx*.98,sz*.98,-sy*.51,'y',dark,.0014);count+=1
   if any(k in name for k in ['burner','control_knob','heat_control','dial']) and sx>.015:
    # Fine index markings around a circular controller.
    for i in range(12):
     a=i*math.tau/12;local_tube(o,'calibrated_control_ticks',[(sx*.34*math.cos(a),-sy*.53,sz*.34*math.sin(a)),(sx*.41*math.cos(a),-sy*.53,sz*.41*math.sin(a))],.0008,brass)
    count+=1
   if 'shade' in name and category=='Lighting':
    for z in [low[2]+sz*.04,high[2]-sz*.04]:
     closest=sorted(coords,key=lambda p:abs(p.z-z))[:max(8,len(coords)//4)];rx=max(abs(p.x) for p in closest);ry=max(abs(p.y) for p in closest)
     pts=[(rx*math.cos(i*math.tau/40),ry*math.sin(i*math.tau/40),z) for i in range(41)];local_tube(o,'lampshade_bound_hem',pts,.0018,seam)
    count+=1
  # Construction-specific additions for each room family.
  if category=='Living' and row['shape']=='seat':
   if 'chester' in id:
    for rowi in range(3):
     for col in range(10):
      x=(col-4.5)*w*.077;z=h*(.56+rowi*.105);tube('chesterfield_diamond_pull',[(x-w*.034,d*.286,z-.04),(x,d*.274,z),(x+w*.034,d*.286,z+.04)],.0022,seam)
  if category=='Living' and ('stand' in id or 'media-bench' in id):
   for i in range(15):
    x=(i-7)*w*.035;tube('rear_equipment_vent',[(x,d*.42,h*.36),(x,d*.42,h*.43)],.004,dark)
   for x in [-w*.28,w*.28]:
    pts=[(x+.027*math.cos(i*math.tau/24),d*.41,h*.61+.027*math.sin(i*math.tau/24)) for i in range(25)];tube('cable_grommet_ring',pts,.004,brass)
  if category=='Living' and any(k in id for k in ['speaker','soundbar','subwoofer']):
   for i in range(24):
    x=(i/23-.5)*w*.73;tube('woven_speaker_grille',[(x,-d*.49,h*.17),(x,-d*.49,h*.80)],.0015,dark)
  if category=='Bathroom':
   if 'shower' in id or 'wetroom' in id:
    for z in [h*.25,h*.72]:
     box('glass_hinge_clamp',(.027,.018,.055),(w*.39,-d*.42,z),brass,.003)
   if 'toilet' in id:
    for x in [-w*.16,w*.16]:cyl('soft_close_seat_hinge',.018,.023,(x,d*.14,h*.50),brass,16)
   if any(k in id for k in ['tub','bathtub','bath-shower']):
    # Overflow trim on the inner end wall above the waterline.
    pts=[(.024*math.cos(i*math.tau/24),d*.37,h*.62+.016*math.sin(i*math.tau/24)) for i in range(25)];tube('bath_overflow_trim',pts,.003,brass)
  # Already-detailed fireplaces retain their flame material groups for animation.
  if 'fireplace' in id or 'stove' in id:
   for i in range(13):
    x=(i-6)*w*.037;tube('charcoal_ember_splinters',[(x,-d*.12,h*.16),(x+.012,-d*.06,h*.18)],.004,dark)
  g.finish();bpy.context.scene['detail_pass']='Batch 11';bpy.context.scene['construction_components_refined']=count
  return tuple(row[k]/1000 for k in ['widthMm','depthMm','heightMm'])
 return {row['id']:(lambda m,row=row,builder=builders[row['id']]:refine(row,builder,m)) for row in MANIFEST if row['id'] in builders}
