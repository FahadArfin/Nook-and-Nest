"""Editable real-footprint Toronto backdrop. Run prepare-toronto-scenery.py first."""
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
data=json.loads((root/'assets-source/geodata/toronto-mesh.json').read_text(encoding='utf-8'))
colors={'glass':(.31,.43,.48),'brick':(.45,.27,.21),'stone0':(.58,.57,.54),'stone1':(.43,.47,.48),'stone2':(.70,.68,.63),'road':(.26,.28,.29),'park':(.30,.43,.25),'land':(.52,.54,.45),'water':(.16,.37,.48),'city-window-lights':(.40,.48,.50)}
for name,(vertices,faces) in data.items():
 material=bpy.data.materials.new(name);material.use_nodes=True;c=colors.get(name.replace('-roof',''),(.5,.5,.5));c=tuple(v*.8 for v in c) if name.endswith('-roof') else c
 material.diffuse_color=(*c,1);node=material.node_tree.nodes['Principled BSDF'];node.inputs['Base Color'].default_value=(*c,1);node.inputs['Roughness'].default_value=.45 if name in ['glass','water'] else .85
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.materials.append(material);obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
 # Both sides: OSM winding and mixed facade ring orientations should not hide geometry.
 material.use_backface_culling=False
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source/blender/backdrop-city.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/furniture/backdrop-city.glb'),export_format='GLB',export_yup=True,export_extras=True)
