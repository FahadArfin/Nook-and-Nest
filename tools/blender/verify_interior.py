"""Non-browser checks of editable source geometry and authored shelf planes."""
from pathlib import Path
import bpy
root=Path(__file__).resolve().parents[2]
for id,prefix,expected in [
    ('display-bookcase','usable_display_shelf',[.15,.74,1.33,1.90]),
    ('ladder-display-shelf','graduated_display_shelf',[.20,.66,1.12,1.58]),
    ('cube-display-shelf','cubby_horizontal',[.04,.466667,.893333,1.32]),
]:
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source'/'blender'/f'{id}.blend'))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    actual=sorted(max((o.matrix_world@v.co).z for v in o.data.vertices) for o in meshes if o.name.startswith(prefix))
    assert len(actual)==len(expected),(id,actual)
    assert all(abs(a-b)<.0006 for a,b in zip(actual,expected)),(id,actual,expected)
    print('SHELF_PLANES_OK',id,actual)
for id,required in [('model-sailboat',['cream_main_sail','warm_jib_sail']),('twin-full-bunk',['wide_lower_bunk_support']),('boneless-loveseat',['continuous_foam_foundation','folded_sloping_back'])]:
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source'/'blender'/f'{id}.blend'))
    for prefix in required:
        pieces=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(prefix)]
        assert pieces,(id,prefix)
        assert all(len(o.data.polygons)>0 for o in pieces),(id,prefix)
    print('EDITABLE_PARTS_OK',id)
