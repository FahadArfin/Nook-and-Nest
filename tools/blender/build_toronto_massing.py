"""Replace building geometry with City's 2025 surfaces; retain OSM land/water.
Run with Blender after scripts/prepare-toronto-massing.py.
"""
import bpy,json,bmesh,numpy as np
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/backdrop-city.blend'))
keep={'road','park','land','water'}
for obj in list(bpy.data.objects):
 if obj.type=='MESH' and obj.name not in keep:bpy.data.objects.remove(obj,do_unlink=True)
data=json.loads((root/'assets-source/geodata/massing-chunks.json').read_text())
colors={'glass':(.31,.43,.48),'stone0':(.58,.57,.54),'stone1':(.43,.47,.48),'stone2':(.70,.68,.63),'city-window-lights':(.40,.48,.50)}
for name in data:
 archive=np.load(root/'assets-source/geodata'/(name+'.npz'));vertices=archive['vertices'];faces=archive['faces']
 print('Building',name,len(vertices),len(faces),flush=True)
 material=bpy.data.materials.get(name) or bpy.data.materials.new(name);material.use_nodes=True
 c=colors.get(name.replace('-roof',''),(.5,.5,.5));material.diffuse_color=(*c,1)
 node=material.node_tree.nodes['Principled BSDF'];node.inputs['Base Color'].default_value=(*c,1);node.inputs['Roughness'].default_value=.45 if name=='glass' else .85
 mesh=bpy.data.meshes.new(name);mesh.vertices.add(len(vertices));mesh.vertices.foreach_set('co',vertices.ravel());mesh.loops.add(faces.size);mesh.loops.foreach_set('vertex_index',faces.ravel());mesh.polygons.add(len(faces));mesh.polygons.foreach_set('loop_start',np.arange(len(faces),dtype=np.int32)*3);mesh.polygons.foreach_set('loop_total',np.full(len(faces),3,dtype=np.int32));mesh.validate(clean_customdata=False);mesh.update();mesh.materials.append(material);del vertices,faces;archive.close()
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);material.use_backface_culling=False
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bmesh.ops.dissolve_limit(bm,angle_limit=.01,verts=list(bm.verts),edges=list(bm.edges),delimit={'NORMAL'});bm.to_mesh(mesh);bm.free()
 # Facade lighting UVs use real metre spacing on each wall plane.
 if not name.endswith('-roof') and name!='city-window-lights':
  uv=mesh.uv_layers.new(name='Window spacing')
  for poly in mesh.polygons:
   n=poly.normal;length=(n.x*n.x+n.y*n.y)**.5
   if length<.01:continue
   for index in poly.loop_indices:
    p=mesh.vertices[mesh.loops[index].vertex_index].co
    uv.data[index].uv=((-n.y*p.x+n.x*p.y)/length/16,(p.z+80)/13.2)
 # Editable geographic UVs; runtime applies the shared aerial photo separately.
 if name.endswith('-roof'):
  uv=mesh.uv_layers.new(name='Geographic roof UV');e=json.loads((root/'public/textures/toronto/aerial-2022.json').read_text(encoding='utf-8-sig'))['extent']
  import math
  for loop in mesh.loops:
   p=mesh.vertices[loop.vertex_index].co;lon=-79.3825+p.x/(111320*math.cos(math.radians(43.64)));lat=43.64+p.y/111320
   uv.data[loop.index].uv=((lon-e['xmin'])/(e['xmax']-e['xmin']),(lat-e['ymin'])/(e['ymax']-e['ymin']))
# Bound the displayed geometry while retaining non-destructive source meshes/modifiers.
triangles=sum(max(1,len(p.vertices)-2) for o in bpy.data.objects if o.type=='MESH' for p in o.data.polygons)
if triangles>1800000:
 for obj in bpy.data.objects:
  if obj.type=='MESH' and obj.name not in keep and obj.name!='city-window-lights':
   modifier=obj.modifiers.new('Browser detail budget','DECIMATE');modifier.ratio=1800000/triangles
print('Source triangles after planar cleanup',triangles,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source/geodata/backdrop-city-full.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'assets-source/geodata/backdrop-city-export.glb'),export_format='GLB',export_yup=True,export_extras=True,export_apply=True)








