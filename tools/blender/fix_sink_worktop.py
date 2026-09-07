"""Correct the apron sink worktop from the immutable pre-fix editable source."""
import bpy, subprocess, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=subprocess.check_output(['git','show','b1897060b0dc8934d852d3fa81030632d6ff6731:assets-source/blender/sink-cabinet.blend'],cwd=root)
base=root/'.generated/sink-original.blend';base.parent.mkdir(exist_ok=True);base.write_bytes(source)
bpy.ops.wm.open_mainfile(filepath=str(base));bpy.context.preferences.filepaths.save_version=0
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
oldtop=max((o.matrix_world@v.co).z for o in meshes if 'counter' in o.name for v in o.data.vertices)
for o in meshes:
 matrix=o.matrix_world.copy()
 for v in o.data.vertices:
  p=matrix@v.co;p.z=p.z*.910/oldtop if p.z<=oldtop else .910+(p.z-oldtop)*.180/(.930-oldtop);v.co=p
 o.matrix_world.identity();o['nominal_height_m']=1.090
bpy.context.scene['nominal_dimensions_m']=(1,.640,1.090)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source/blender/sink-cabinet.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/furniture/sink-cabinet.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
