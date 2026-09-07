"""Original editable bath mat and coordinated breakfast furniture, millimetres."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from studio_geometry import *

models={'bath-ribbed-rug':(800,500,18),'breakfast-nook-table':(1100,750,750),'breakfast-nook-chair':(460,500,820)}
manifest=json.loads((ROOT/'src/modelMaterials.json').read_text())
for id,dims in models.items():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 white=material('variant-surface',(.93,.92,.88),.92)
 oak=material('natural-oak',(.58,.39,.22),.82)
 dark=material('backing-and-foot-pads',(.18,.19,.16),.95)
 if id=='bath-ribbed-rug':
  B('Non slip backing',(0,0,2),(800,500,4),dark,2)
  B('Cotton bound edge',(0,0,7),(800,500,10),white,5)
  for y in range(-215,216,18):B('Raised plush rib',(0,y,13),(750,12,10),white,3)
  for x in [-386,386]:B('Woven side binding',(x,0,11),(17,478,7),white,3)
 else:
  chair=id.endswith('chair');w,d,h=dims
  seat=450 if chair else 730
  for x in [-1,1]:
   for y in [-1,1]:
    tube('Tapered splayed leg',[(x*w*.42,y*d*.39,15),(x*w*.35,y*d*.31,seat-30)],22,oak,8)
    C('Floor pad',(x*w*.42,y*d*.39,4),19,8,dark,s=16)
  B('Front apron',(0,-d*.31,seat-55),(w*.72,28,72),oak,5)
  B('Back apron',(0,d*.31,seat-55),(w*.72,28,72),oak,5)
  for x in [-1,1]:B('Side apron',(x*w*.35,0,seat-55),(28,d*.65,72),oak,5)
  B('Seat frame' if chair else 'Rounded tabletop',(0,0,seat),(w,d,40),oak if chair else white,10)
  if chair:
   B('Tailored cushion',(0,-10,seat+28),(w-28,d-32,42),white,10)
   for x in [-1,1]:tube('Back upright',[(x*185,170,400),(x*196,220,790)],19,oak)
   for x in [-125,-62,0,62,125]:tube('Back spindle',[(x,188,490),(x,225-abs(x)*.06,762)],9,oak)
   tube('Curved back rail',[(-205,204,792),(-140,218,802),(0,237,806),(140,218,802),(205,204,792)],22,oak,12)
  else:
   for y in [-1,1]:B('Apron shadow bead',(0,y*d*.33,seat-28),(w*.74,12,10),oak,3)
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update()
 pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices];lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)));center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for o in objects:
  mat=o.matrix_world.copy()
  for v in o.data.vertices:
   p=mat@v.co-center;v.co=Vector(tuple(p[i]*dims[i]/(hi[i]-lo[i])/1000 for i in range(3)))
  o.matrix_world.identity();o['catalog_id']=id
 scene=bpy.context.scene;scene['nominal_dimensions_m']=[v/1000 for v in dims];scene['catalog_id']=id
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender'/f'{id}.blend'),compress=True)
 bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/furniture'/f'{id}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
 manifest[id]=[{'id':m.name,'label':m.name.replace('-',' '),'color':'#f5f4ef' if m==white else '#ac855e' if m==oak else '#4b5045'} for m in [white,oak,dark] if any(m in list(o.data.materials) for o in [bpy.context.object])]
(ROOT/'src/modelMaterials.json').write_text(json.dumps(manifest,indent=2)+'\n')
