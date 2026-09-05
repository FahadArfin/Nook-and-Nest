"""Compact editable holiday trees using linked copies of one needle-bearing bough."""
import math,bpy
from mathutils import Vector
from detailed_models import Geometry

def holiday_builders(box,cyl,material):
 def build(id,m):
  w,h=(1,1.9) if id=='christmas-tree' else (.65,1.25)
  green=material('foliage-main',(.13,.29,.09),None,.98);gold=material('antique-brass',(.50,.29,.085),None,.49,.55)
  g=Geometry();g.tube('reusable_branch_spine',[(0,0,0),(.48,0,.055),(1,0,-.035)],.023,green,5)
  for j in range(1,11):
   t=j/11
   for side in [-1,1]:
    start=Vector((t,0,.035));end=start+Vector((.15,side*(.28*(1-t)+.07),.045));g.tube('reusable_shoot',[start,end],.007,green,4)
    for k in range(10):
     p=start.lerp(end,k/10);a=k*2.399;g.needle(p,(.5,side*math.cos(a),math.sin(a)),.12,.013,green)
  before=set(bpy.context.scene.objects);g.finish();parts=[o for o in bpy.context.scene.objects if o not in before];bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();template=bpy.context.object;template.name='linked_needle_bough';template['shared_geometry']=True
  for tier in range(13):
   t=tier/13;reach=w*.44*(1-t)**.85
   for arm in range(8):
    o=template if tier==0 and arm==0 else template.copy()
    if o!=template:bpy.context.collection.objects.link(o)
    o.name=f'linked_bough_{tier}_{arm}';o.location=(0,0,h*(.18+t*.78));o.rotation_euler.z=arm*math.tau/8+(tier%2)*math.pi/8;o.scale=(reach,reach,max(reach,h*.14)*1.8)
  cyl('tree_trunk',w*.018,h*.93,(0,0,h*.465),m['wood'],12,taper=.12)
  cyl('woven_tree_basket',w*.17,h*.13,(0,0,h*.065),m['wood'],20,taper=1.15)
  g=Geometry()
  for j in range(8):
   z=h*(.015+j*.015);r=w*(.174+j*.003);g.tube('basket_woven_bands',[(r*math.cos(a*math.tau/32),r*math.sin(a*math.tau/32),z) for a in range(33)],w*.003,m['wood_dark'],5)
  lights=[]
  for name,color in [('red',(1,.025,.012)),('blue',(.03,.18,1)),('yellow',(1,.67,.035))]:
   mat=material('holiday-light-'+name,color,None,.38);bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=2;lights.append(mat)
  wire=[]
  for i in range(145):
   t=i/144;a=t*math.tau*5;r=w*.445*(1-t*.91);p=(r*math.cos(a),r*math.sin(a),h*(.19+t*.69));wire.append(p)
   if i%3==0:cyl('colored_fairy_bulb',w*.012,w*.024,p,lights[(i//3)%3],8)
   if i%12==0:cyl('round_bauble',w*.025,w*.048,(p[0],p[1],p[2]-.025),gold if i%24 else m['fabric'],12)
  g.tube('spiral_light_cord',wire,w*.0015,green,4)
  verts=[(0,-.008,h*.945)]+[(w*(.068 if i%2==0 else .030)*math.cos(math.pi/2+i*math.pi/5),0,h*.945+w*(.068 if i%2==0 else .030)*math.sin(math.pi/2+i*math.pi/5)) for i in range(10)]
  g.add('five_point_star',verts,[(0,i+1,(i+1)%10+1) for i in range(10)],gold);g.finish();return w,w,h
 return {id:lambda m,id=id:build(id,m) for id in ['christmas-tree','christmas-slim-tree']}
