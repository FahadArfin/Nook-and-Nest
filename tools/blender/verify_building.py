"""Read-only check of staircase tread heights in the editable Blender sources."""
from pathlib import Path
import bpy

root=Path(__file__).resolve().parents[2]
for style in ("traditional","switchback","l-turn","floating","cantilever","led"):
    name="stairs-"+style
    bpy.ops.wm.open_mainfile(filepath=str(root/"assets-source"/"blender"/(name+".blend")))
    treads=[o for o in bpy.context.scene.objects if o.type=="MESH" and "tread" in o.name and "riser" not in o.name]
    tops=sorted(max((o.matrix_world@v.co).z for v in o.data.vertices) for o in treads)
    assert len(tops)==16,(name,len(tops))
    for index,top in enumerate(tops):
        assert abs(top-(index+1)*2.8/16)<.0001,(name,index,top)
    print("VERIFIED",name,"16 even risers, top tread 2800 mm")
