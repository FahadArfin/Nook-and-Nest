"""Render named catalog assets from their original editable Blender sources."""
import os,time,subprocess
import bpy
import sys
from pathlib import Path
from mathutils import Vector, Matrix

root=Path(__file__).resolve().parents[2]
out=root/'assets-source'/'previews'
out.mkdir(parents=True,exist_ok=True)
for name in sys.argv[sys.argv.index('--')+1:]:
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source'/'blender'/(name+'.blend')))
    scene=bpy.context.scene
    w,d,h=scene['nominal_dimensions_m']
    if name in ['sonos-architectural-ceiling','sonos-ceiling-8']:
        # Show the installed grille face in the thumbnail; preserve source placement.
        flip=Matrix.Rotation(3.141592653589793,4,'X')
        for obj in scene.objects:
            if obj.type=='MESH':obj.matrix_world=flip @ obj.matrix_world
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=480;scene.render.resolution_y=440;scene.render.resolution_percentage=100
    scene.world.color=(.45,.45,.45);scene.view_settings.view_transform='AgX'
    bpy.ops.object.camera_add(location=(50,-70,50) if name.startswith('backdrop-') else (3,-5,3.4))
    camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,h*.48))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';scene.camera=camera
    bpy.context.view_layer.update()
    camera_inverse=camera.matrix_world.inverted()
    projected=[camera_inverse @ obj.matrix_world @ vertex.co for obj in scene.objects if obj.type=='MESH' for vertex in obj.data.vertices]
    low=[min(p[i] for p in projected) for i in range(2)];high=[max(p[i] for p in projected) for i in range(2)]
    camera.location += camera.rotation_euler.to_matrix() @ Vector(((low[0]+high[0])/2,(low[1]+high[1])/2,0))
    camera.data.ortho_scale=max(high[1]-low[1],(high[0]-low[0])*440/480)*1.22
    bpy.ops.object.light_add(type='AREA',location=(-3,-4,5));bpy.context.object.data.energy=450;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
    bpy.ops.object.light_add(type='AREA',location=(3,1,3));bpy.context.object.data.energy=300;bpy.context.object.data.size=3
    if name.startswith('backdrop-'):
        bpy.ops.object.light_add(type='SUN',rotation=(.4,-.5,-.5));bpy.context.object.data.energy=2
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG'
    target=out/(name+'.png');temporary=out/('.'+name+'-render.png')
    scene.render.filepath=str(temporary);bpy.ops.render.render(write_still=True)
    for attempt in range(10):
        try:os.replace(temporary,target);break
        except PermissionError:
            if attempt==9:raise
            time.sleep(.3)
    subprocess.run(['python',str(root/'scripts/compress-previews.py'),name],check=True)
    print('PREVIEW '+name)
