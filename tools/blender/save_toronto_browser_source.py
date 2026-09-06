"""Build the bounded editable browser model; retain the full source in geodata."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'assets-source/geodata/backdrop-city-export.glb'))
for obj in list(bpy.data.objects):
 if obj.type!='MESH':continue
 material=obj.data.materials[0].name if obj.data.materials else ''
 ratio=.08 if material=='glass' else .23 if material=='glass-roof' else .75 if material.endswith('-roof') else .6 if material.startswith('stone') else 1
 if ratio<1:
  bpy.context.view_layer.objects.active=obj;obj.select_set(True)
  modifier=obj.modifiers.new('Distant city detail','DECIMATE');modifier.ratio=ratio
  bpy.ops.object.modifier_apply(modifier=modifier.name);obj.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source/blender/backdrop-city.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/furniture/backdrop-city.glb'),export_format='GLB',export_yup=True,export_extras=True)

