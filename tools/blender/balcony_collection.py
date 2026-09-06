"""Batch 12 original compact joinery, balcony and sunroom models."""
import json,math,bpy
from pathlib import Path
from detailed_models import Geometry
ROWS=json.loads((Path(__file__).resolve().parents[2]/'src/balconyExpansion.json').read_text())
def balcony_builders(box,cyl,material):
 def build(row,m):
  id=row[0];w,d,h=[v/1000 for v in row[3:6]];g=Geometry()
  wood=m['wood'];fabric=m['fabric'];metal=material('variant-surface-metal',(.31,.36,.34),None,.62,.35);stone=material('variant-surface-concrete',(.64,.62,.54),None,.96);dark=material('graphite-hardware',(.045,.052,.05),None,.77);cream=material('variant-surface-enamel',(.78,.79,.71),None,.78)
  glass=material('window-glazing' if row[6]=='window' else 'clear-balcony-glass',(.65,.81,.79),None,.14);glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.20
  def B(n,size,p,mat=wood,b=.006):return box(n,size,p,mat,min(b,min(size)*.2))
  def tube(n,pts,r=.01,mat=wood):g.tube(n,pts,r,mat,12)
  if row[2]=='Doors':
   door=material('door-surface',(.72,.73,.61),None,.92)
   for x in [-w/2+.02,w/2-.02]:B('slim_jamb',(.04,d,h),(x,0,h/2),door)
   B('head_jamb',(w,d,.04),(0,0,h-.02),door)
   count=2 if 'double' in id or 'sliding' in id else 1;ww=(w-.085)/count
   for i in range(count):
    before=set(bpy.context.scene.objects);x=-w/2+.043+ww*(i+.5);y=(-.018 if i==0 else .018) if 'sliding' in id else 0
    B('slim_door_leaf',(ww-.006,.035,h-.075),(x,y,(h-.075)/2+.015),door)
    for z,hh in [(h*.26,h*.38),(h*.72,h*.38)]:
     B('recessed_panel',(ww-.10,.009,hh),(x,y-.022,z),door)
     for xx in [x-ww/2+.055,x+ww/2-.055]:B('panel_stile',(.012,.012,hh),(xx,y-.028,z),door,.002)
     for zz in [z-hh/2,z+hh/2]:B('panel_rail',(ww-.10,.012,.012),(x,y-.028,zz),door,.002)
    hx=x+(ww*.32 if i==0 else -ww*.32)
    B('recessed_pull',(.025,.009,.105),(hx,y-.027,h*.46),metal,.004)
    if 'sliding' in id:
     parts=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
     for o in parts:o.select_set(True)
     bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();obj=bpy.context.object;obj.name='sliding_leaf_'+str(i);obj['motion_role']='sliding_leaf';obj['slide_travel']=ww*.86*(1 if i==0 else -1)
   if 'sliding' in id:
    for y in [-.024,.024]:B('bypass_track',(w,.018,.022),(0,y,h-.057),metal)
  elif id.startswith('balcony-rail-'):
   concrete=id.endswith('concrete');hybrid=id.endswith('hybrid');base=h-.04 if concrete else h*.48 if hybrid else .12
   B('parapet' if concrete or hybrid else 'glazing_base_shoe',(w,d,base),(0,0,base/2),stone if concrete or hybrid else metal,.008)
   if not concrete:
    B('laminated_glass',(w-.05,.018,h-base-.03),(0,0,base+(h-base)/2),glass,.002)
    B('slim_top_cap',(w,.04,.025),(0,0,h-.0125),metal)
    for x in [-w/2+.02,w/2-.02]:B('edge_channel',(.025,.045,h-base),(x,0,base+(h-base)/2),metal,.003)
   else:B('weathered_coping',(w,d,.04),(0,0,h-.02),stone)
  elif id=='balcony-mini-split':
   B('condenser_enclosure',(w,d*.88,h*.82),(0,0,h*.53),cream,.026)
   for x in [-w*.32,w*.32]:B('mounting_foot',(.15,d,.045),(x,0,.023),metal)
   B('service_panel',(w*.20,.018,h*.68),(w*.35,-d*.45,h*.53),cream)
   x=-w*.12;z=h*.54;r=h*.32
   cyl('fan_dark_recess',r,.018,(x,-d*.45,z),dark,64,rot=(math.pi/2,0,0))
   for rr in [.06,.12,.18]:tube('concentric_fan_guard',[(x+rr*math.cos(i*math.tau/64),-d*.49,z+rr*math.sin(i*math.tau/64)) for i in range(65)],.003,metal)
   for i in range(12):a=i*math.tau/12;tube('guard_spoke',[(x,-d*.49,z),(x+r*math.cos(a),-d*.49,z+r*math.sin(a))],.003,metal)
   cyl('fan_hub',.035,.028,(x,-d*.49,z),metal,32,rot=(math.pi/2,0,0))
   for i in range(16):B('side_vent',(.007,d*.56,.007),(w/2+.001,0,h*.24+i*.02),dark,.001)
   for zz in [.19,.27]:tube('service_pipe',[(w*.49,d*.2,zz),(w*.54,d*.2,zz),(w*.54,d*.2,zz-.07)],.012,metal)
  elif id=='low-pile-carpet':
   B('flat_woven_pile',(w,d,h),(0,0,h/2),fabric,.002)
   for x in [-w/2+.012,w/2-.012]:B('bound_side',(.018,d,.002),(x,0,h),wood,.001)
   for y in [-d/2+.012,d/2-.012]:B('bound_end',(w,.018,.002),(0,y,h),wood,.001)
  elif id=='window-solarium':
   for x in [-w/2+.022,0,w/2-.022]:B('slender_mullion',(.044,d,h),(x,0,h/2),metal)
   for z in [.022,h-.022]:B('frame_rail',(w,d,.044),(0,0,z),metal)
   for x in [-w*.25,w*.25]:B('full_height_glazing',(w*.5-.055,.015,h-.08),(x,0,h/2),glass,.002)
  elif id=='breakfast-table':
   cyl('rounded_breakfast_top',w/2,.035,(0,0,h-.0175),wood,96)
   cyl('pedestal_column',.075,h-.06,(0,0,(h-.06)/2),wood,40)
   cyl('weighted_splayed_base',w*.32,.045,(0,0,.0225),wood,64)
   for i in range(5):a=i*math.tau/5;tube('base_rib',[(.04*math.cos(a),.04*math.sin(a),.25),(w*.29*math.cos(a),w*.29*math.sin(a),.04)],.022,wood)
  else:
   rocking='rocker' in id;seat=h*.43;depth=d*.55 if rocking else d*.8
   B('seat_frame',(w*.84,depth,.055),(0,0,seat),wood,.018);B('tailored_seat',(w*.80,depth*.95,.06),(0,0,seat+.05),fabric,.023)
   for x in [-w*.34,w*.34]:
    for y in [-depth*.34,depth*.34]:tube('splayed_leg',[(x,y,.08),(x*.90,y*.88,seat)],.021)
    if rocking:
     tube('curved_rocker',[(x,d*(t/20-.5),.03+.18*((t/20-.5)*2)**2) for t in range(21)],.027)
     tube('arm_post',[(x,-depth*.25,seat),(x,-depth*.25,h*.65)],.016)
     tube('arm_rest',[(x,-depth*.42,h*.64),(x,depth*.45,h*.66)],.026)
   back=depth*.43
   tube('bow_back',[(w*.39*math.cos(a),back+.06*math.sin(a),seat+(h-seat)*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]],.024)
   for i in range(7):x=(i-3)*w*.09;top=seat+(h-seat)*math.sqrt(max(0,1-(x/(w*.39))**2));tube('back_spindle',[(x,back,seat),(x,back+.06,top)],.009)
  g.finish();return w,d,h
 return {r[0]:lambda m,r=r:build(r,m) for r in ROWS}
