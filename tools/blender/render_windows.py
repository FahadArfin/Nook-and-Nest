"""Render original window catalog previews from the editable Blender sources."""
import bpy
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
out = root / "public" / "models" / "previews"
out.mkdir(parents=True, exist_ok=True)
ids = ["casement", "sash", "picture", "arched", "bay", "awning"]
for style in ids:
    name = "window-" + style
    bpy.ops.wm.open_mainfile(filepath=str(root / "assets-source" / "blender" / (name + ".blend")))
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=480;scene.render.resolution_y=440;scene.render.resolution_percentage=100
    scene.world.color=(.45,.45,.45)
    scene.view_settings.view_transform='AgX'
    bpy.ops.object.camera_add(location=(2.1,-4.5,2.4))
    camera=bpy.context.object
    camera.rotation_euler=(Vector((0,-.1,.7))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=2.35 if style in ('bay','picture') else 1.95
    scene.camera=camera
    bpy.ops.object.light_add(type='AREA',location=(-3,-4,5));bpy.context.object.data.energy=450;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
    bpy.ops.object.light_add(type='AREA',location=(3,1,3));bpy.context.object.data.energy=300;bpy.context.object.data.size=3
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('PREVIEW '+name)
