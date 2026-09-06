import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]/'assets-source/skyline-brick-study'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(R/'skyline-gtr-brick.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
low=[min(p[i] for p in pts) for i in range(3)];high=[max(p[i] for p in pts) for i in range(3)]
tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'mesh_parts':len(meshes),'triangles':tri,'dimensions_metres':[round(high[i]-low[i],5) for i in range(3)],'glb_bytes':(R/'skyline-gtr-brick.glb').stat().st_size,'materials':len(bpy.data.materials),'import_check':'passed'}
assert len(meshes)>100 and 0<tri<200000
(R/'asset-audit.json').write_text(json.dumps(report,indent=2));print(report)
