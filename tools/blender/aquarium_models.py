"""Original aquascapes with separate editable fish, tails and air bubbles."""
import math,random
import bpy
from mathutils import Vector
from detailed_models import Geometry
SIZES={'desktop-aquarium':(.60,.35,.45),'planted-aquarium':(1.2,.45,1.25),'reef-aquarium':(.65,.60,1.35)}
def aquarium_builders(box,cyl,material,finish):
 def build(id,m):
  w,d,h=SIZES[id];reef=id=='reef-aquarium';desktop=id=='desktop-aquarium';base=.025 if desktop else h*.53;tank=h-base
  rng=random.Random(id);g=Geometry()
  metal=material('aquarium-charcoal-frame',(.055,.075,.070),None,.8);sand=material('aquarium-river-sand',(.49,.40,.26),None,.99)
  glass=material('aquarium-clear-glass',(.70,.89,.86),None,.16);glass.diffuse_color=(.70,.89,.86,.09);glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.09
  water=material('aquarium-water-surface',(.23,.58,.61),None,.19);water.diffuse_color=(.23,.58,.61,.16);water.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.16
  green=material('aquatic-leaf-emerald',(.09,.29,.13),None,.95);tip=material('aquatic-leaf-tips',(.27,.44,.14),None,.98)
  rock=material('aquascape-weathered-stone',(.32,.33,.29),None,.99);pink=material('reef-coral-rose',(.60,.23,.31),None,.94)
  light=material('aquarium-led-strip',(.72,.88,1),None,.3);bs=light.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.5,.75,1,1);bs.inputs['Emission Strength'].default_value=1.8
  def B(n,size,p,mat=m['wood'],bevel=.005):return box(n,size,p,mat,min(bevel,min(size)*.2))
  def tube(n,pts,r,mat):g.tube(n,pts,r,mat,8)
  if not desktop:
   B('cabinet_recessed_plinth',(w*.88,d*.87,.065),(0,0,.0325),metal)
   B('cabinet_case',(w,d,base-.07),(0,0,(base+.07)/2),m['wood'])
   for x in [-w*.245,w*.245]:
    B('aquarium_cabinet_door',(w*.475,.023,base*.79),(x,-d*.504,base*.52),m['wood_dark']);B('recessed_door_pull',(.064,.012,.012),(x,-d*.526,base*.85),metal)
  B('tank_base_frame',(w,d,.032),(0,0,base),metal);B('sand_substrate',(w*.94,d*.92,.029),(0,0,base+.032),sand)
  for x in [-w*.49,w*.49]:B('polished_glass_side',(.006,d*.97,tank-.028),(x,0,base+tank*.50),glass,.001)
  for y in [-d*.49,d*.49]:B('polished_glass_panel',(w*.98,.006,tank-.028),(0,y,base+tank*.50),glass,.001)
  B('waterline_surface',(w*.94,d*.93,.002),(0,0,h-.045),water,.0003)
  for y in [-d*.49,d*.49]:B('silicone_top_binding',(w,.012,.016),(0,y,h-.012),metal)
  for x in [-w*.49,w*.49]:B('silicone_top_binding',(.012,d,.016),(x,0,h-.012),metal)
  B('slim_led_hood',(w*.82,d*.19,.017),(0,d*.18,h-.007),metal);B('illuminated_led_lens',(w*.78,d*.15,.004),(0,d*.18,h-.018),light)
  B('internal_filter',(w*.075,d*.15,tank*.62),(w*.40,d*.33,base+tank*.50),metal)
  for j in range(11):B('filter_intake_slots',(w*.055,.003,.004),(w*.40,d*.25,base+tank*.23+j*tank*.018),rock,.0005)
  tube('airline_hose',[(w*.36,d*.34,h-.02),(w*.36,d*.30,base+.045),(w*.25,d*.14,base+.045)],.003,metal)
  cyl('porous_air_stone',.022,.025,(w*.25,d*.14,base+.047),rock,16)
  for i in range(65):
   x=rng.uniform(-w*.44,w*.44);y=rng.uniform(-d*.40,d*.40);r=rng.uniform(.004,.010);cyl('individual_gravel_pebble',r,r*.7,(x,y,base+.05),sand if i%3 else rock,7)
  # Branching driftwood, carved refuge and densely planted margins leave a swimming lane.
  if not reef:
   tube('branching_mopani_wood',[(-w*.30,d*.10,base+.065),(-w*.18,d*.14,base+tank*.30),(w*.20,d*.20,base+tank*.58)],.024,m['wood_dark'])
   for i in range(5):tube('driftwood_twigs',[(-w*.05,d*.16,base+tank*.40),(w*(.12+i*.035),d*.21,base+tank*(.48+i*.045))],.010,m['wood_dark'])
  # A genuine arched stone hide, open at both ends.
  r=w*.12;v=[]
  for y in [-d*.10,d*.13]:
   for rr in [r,r*.72]:
    for j in range(17):a=j*math.pi/16;v.append((-w*.25+rr*math.cos(a),y,base+.06+rr*math.sin(a)))
  g.add('open_stone_fish_refuge',v,[(j,j+1,35+j,34+j) for j in range(16)]+[(17+j,51+j,52+j,18+j) for j in range(16)]+[(j,17+j,18+j,j+1) for j in range(16)],rock)
  for plant in range(14):
   x=rng.uniform(-w*.40,w*.31);y=d*(.30 if plant%3 else -.27);p=Vector((x,y,base+.05))
   if reef:
    for branch in range(7):
     a=branch*2.4;end=p+Vector((w*.065*math.cos(a),d*.11*math.sin(a),tank*rng.uniform(.12,.33)));tube('branching_staghorn_coral',[p,p.lerp(end,.45),end],.009,pink if plant%2 else tip)
     for j in range(3):q=p.lerp(end,.45+j*.16);tube('coral_polyp_branch',[q,q+Vector((.015*math.cos(a+j),.015*math.sin(a+j),.022))],.004,pink)
   else:
    for leaf in range(9):
     a=leaf*2.4;end=p+Vector((w*.05*math.cos(a),d*.10*math.sin(a),tank*rng.uniform(.12,.55)));tube('aquatic_plant_petiole',[p,end],.0015,green);g.leaf('aquatic_lance_leaf',end,(math.cos(a)*.4,math.sin(a)*.4,1),tank*.22,tank*.06,green if leaf%2 else tip)
  g.finish()
  def join_role(before,name,role,index):
   objects=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
   for o in objects:o.select_set(True)
   bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;o['motion_role']=role;o['motion_index']=index
  for index in range(4 if desktop else 6):
   before=set(bpy.context.scene.objects);f=Geometry();length=w*(.15 if desktop else .12);center=Vector(((index%3-1)*w*.24,(-.15 if index%2 else .07)*d,base+tank*(.43+(index//3)*.21)))
   orange=material('fish-copper-scales',(.88,.28,.055),None,.58);blue=material('fish-turquoise-scales',(.08,.43,.57),None,.54);ivory=material('fish-pearl-stripe',(.92,.86,.68),None,.55);black=material('fish-obsidian-eye',(.008,.014,.015),None,.25)
   bodymat=orange if reef or index%2 else blue
   # Authored spindle cross sections: mouth, cheek, belly, peduncle, with raised scale tiles.
   sections=[(-.48,.035),(-.31,.13),(-.08,.23),(.17,.24),(.35,.17),(.48,.065),(.51,.022)];verts=[]
   for x,r in sections:
    for j in range(16):a=j*math.tau/16;verts.append(center+Vector((x*length,math.cos(a)*r*length*.56,math.sin(a)*r*length)))
   f.add('fish_sculpted_body',verts,[(i*16+j,i*16+(j+1)%16,(i+1)*16+(j+1)%16,(i+1)*16+j) for i in range(6) for j in range(16)],bodymat)
   for i in range(7):
    for j in range(9):
     a=j*math.tau/9;x=(-.25+i*.09)*length;r=length*.22*math.sqrt(max(.1,1-(x/(length*.6))**2));p=center+Vector((x,math.cos(a)*r*.57,math.sin(a)*r))
     f.leaf('overlapping_fish_scales',p,(-1,0,0),length*.065,length*.050,ivory if reef and i in [1,4] else bodymat)
   for side in [-1,1]:
    p=center+Vector((length*.35,side*length*.089,length*.045));cyl('fish_golden_iris',length*.037,length*.015,p,ivory,16,rot=(math.pi/2,0,0));cyl('fish_black_pupil',length*.021,length*.020,p+Vector((0,side*length*.007,0)),black,16,rot=(math.pi/2,0,0))
    f.leaf('pectoral_fin',center+Vector((length*.12,side*length*.13,0)),(-.8,side*.6,-.4),length*.29,length*.18,bodymat)
   f.add('dorsal_sail_fin',[center+Vector((x*length,0,z*length)) for x,z in [(-.30,.13),(-.12,.42),(.18,.35),(.28,.14)]],[(0,1,2,3)],bodymat)
   for j in range(8):f.tube('dorsal_fin_rays',[center+Vector(((-.25+j*.065)*length,0,.15*length)),center+Vector(((-.12+j*.044)*length,0,(.41-j*.009)*length))],length*.006,ivory,4)
   f.finish();join_role(before,'aquarium_fish_'+str(index),'fish',index)
   before=set(bpy.context.scene.objects);tail=Geometry();p=center+Vector((-length*.45,0,0));tail.add('forked_fan_tail',[p,p+Vector((-length*.32,0,length*.28)),p+Vector((-length*.23,0,0)),p+Vector((-length*.32,0,-length*.28))],[(0,1,2),(0,2,3)],bodymat)
   for j in range(9):tail.tube('tail_fin_rays',[p,p+Vector((-length*.28,0,(j-4)*length*.060))],length*.005,ivory,4)
   tail.finish();join_role(before,'aquarium_tail_'+str(index),'tail',index)
  bubble=material('aquarium-air-bubble',(.63,.84,.89),None,.18);bubble.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.4
  for i in range(18):
   bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.0035+(i%3)*.001,location=(w*.25+.012*math.sin(i),d*.14,base+.08+(tank-.15)*i/18));o=bpy.context.object;o.name='aquarium_bubble_'+str(i);o.data.materials.append(bubble);o['motion_role']='bubble';o['motion_index']=i
  return w,d,h
 return {id:lambda m,id=id:build(id,m) for id in SIZES}
