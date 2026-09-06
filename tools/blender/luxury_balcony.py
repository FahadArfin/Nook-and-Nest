"""Original luxury railing collection. Run in Blender with --background --python.
Named editable parts remain in .blend; the established exporter joins web meshes.
Research and reproduction notes: docs/luxury-balcony-models.md.
"""
import sys, json, math
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).parent))
import build_quality_models as base

ROOT = Path(__file__).resolve().parents[2]
ROWS = json.loads((ROOT/'src/luxuryBalconyExpansion.json').read_text())

def build(row, mats):
    ident = row[0].removeprefix('balcony-rail-')
    w,d,h = [v/1000 for v in row[3:6]]
    bronze = base.material('aged-bronze-frame', (.32,.19,.085), None,.44,.65)
    iron = base.material('graphite-iron-frame', (.045,.055,.057), None,.7,.4)
    steel = base.material('satin-stainless-fixings', (.48,.53,.54), None,.38,.8)
    wood = base.material('warm-teak-infill', (.52,.30,.13),'handpainted-honey-oak.png',.83)
    stone = base.material('warm-limestone', (.72,.66,.53),None,.94)
    gasket = base.material('recessed-rubber-gaskets', (.018,.022,.024),None,.97)
    glass = base.material('clear-laminated-glass', (.65,.84,.82),None,.16)
    glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .23
    def box(name,size,p,mat=iron,b=.004):
        return base.rounded_box(name,size,p,mat,min(b,min(size)*.2))
    def tube(name,points,r,mat=iron):
        # Constant cross-section: botanical tapered tubes are unsuitable for metalwork.
        curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=1
        curve.bevel_depth=r;curve.bevel_resolution=1;curve.resolution_u=1;curve.use_fill_caps=True
        spl=curve.splines.new('POLY');spl.points.add(len(points)-1)
        for p,co in zip(spl.points,points):p.co=(*co,1)
        ob=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat)
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');ob.select_set(False)
    def bolt(x,y,z):
        base.cylinder('anchor_washer',.009,.002,(x,y,z),steel,12)
        base.cylinder('hex_anchor_head',.006,.006,(x,y,z+.004),steel,6)
    def posts(mat=iron):
        for x in [-w/2+.07,w/2-.07]:
            box('bolted_base_plate',(.14,d,.014),(x,0,.007),mat)
            box('post_shoe',(.072,.072,.036),(x,0,.034),mat)
            box('upright_post',(.048,.048,h-.065),(x,0,(h-.065)/2+.035),mat)
            for z in [.07,h-.065]:box('post_collar',(.062,.062,.022),(x,0,z),bronze)
            box('layered_post_cap',(.068,.068,.018),(x,0,h-.024),mat)
            for xx in [-.047,.047]:
                for yy in [-d*.31,d*.31]:bolt(x+xx,yy,.015)
    def rails(mat=iron,topwood=False):
        box('lower_infill_rail',(w-.14,.034,.035),(0,0,.125),mat)
        box('structural_top_rail',(w,.06,.033),(0,0,h-.033),mat)
        box('rounded_hand_cap',(w,.078,.022),(0,0,h-.011),wood if topwood else mat,.006)
    if ident=='crystal':
        box('shoe_lower_channel',(w,d,.028),(0,0,.014),steel)
        for y in [-d/2+.013,d/2-.013]:
            box('extruded_shoe_side',(w,.026,.115),(0,y,.07),steel)
            box('recessed_shadow_joint',(w,.002,.007),(0,y+(-.014 if y<0 else .014),.047),gasket,.001)
        for y in [-.012,.012]:box('continuous_glazing_gasket',(w-.02,.007,.032),(0,y,.127),gasket)
        for x in [-.299,.299]:
            box('laminated_glass_panel',(.59,.018,h-.142),(x,0,.142+(h-.142)/2),glass,.001)
            box('satin_glass_edge_cap',(.59,.03,.012),(x,0,h-.006),steel,.002)
        for x in [-w/2+.006,w/2-.006]:box('shoe_end_cover',(.012,d,.13),(x,0,.065),steel)
        for x in [-.45,0,.45]:bolt(x,.037,.03)
    elif ident=='limestone':
        for z,hh,dd in [(.032,.064,d),(.085,.042,d-.016),(.14,.068,d-.03),(h-.08,.07,d-.018),(h-.027,.054,d)]:
            box('molded_stone_course',(w,dd,hh),(0,0,z),stone,.01)
        for x in [-.52,.52]:
            box('stone_end_pier',(.16,d-.04,.84),(x,0,.56),stone,.008)
            for y in [-d/2+.018,d/2-.018]:
                box('recessed_pier_panel',(.10,.009,.59),(x,y,.55),stone,.002)
        profile=[(.042,.18),(.054,.195),(.054,.23),(.035,.255),(.043,.30),(.057,.37),(.058,.43),(.046,.49),(.026,.59),(.024,.70),(.035,.79),(.052,.825),(.052,.85),(.038,.88),(.05,.91),(.05,.935)]
        for x in [-.34,-.17,0,.17,.34]:
            verts=[(x+r*math.cos(i*math.tau/24),r*math.sin(i*math.tau/24),z) for r,z in profile for i in range(24)]
            faces=[(j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i) for j in range(len(profile)-1) for i in range(24)]
            faces += [tuple(reversed(range(24))),tuple(range((len(profile)-1)*24,len(profile)*24))]
            mesh=bpy.data.meshes.new('turned_limestone');mesh.from_pydata(verts,[],faces);mesh.materials.append(stone)
            ob=bpy.data.objects.new('turned_baluster',mesh);bpy.context.collection.objects.link(ob)
            for poly in mesh.polygons:poly.use_smooth=True
    else:
        posts(bronze if ident=='bronze' else iron);rails(bronze if ident=='bronze' else iron,ident in ['teak','cable'])
        if ident in ['bronze','teak']:
            for i in range(11):
                x=(i-5)*.086
                box('teak_infill_slat' if ident=='teak' else 'bronze_vertical_picket',(.048 if ident=='teak' else .014,.027 if ident=='teak' else .014,.88),(x,0,.585),wood if ident=='teak' else bronze,.003)
                for z in [.17,1.0]:
                    if ident=='teak':
                        base.cylinder('countersunk_slat_fixing',.0038,.003,(x,-.015,z),steel,10,rot=(math.pi/2,0,0))
                    else:box('picket_ferrule',(.024,.024,.025),(x,0,z),bronze,.002)
        elif ident=='cable':
            for i in range(10):
                z=.195+i*.083
                tube('stainless_cable',[(-.5,0,z),(.5,0,z)],.0025,steel)
                for side in [-1,1]:
                    tube('swaged_tensioner',[(side*.42,0,z),(side*.50,0,z)],.006,steel)
                    tube('tensioner_locknut',[(side*.475,0,z),(side*.485,0,z)],.009,bronze)
            box('midspan_cable_spreader',(.015,.02,.92),(0,0,.59),iron,.002)
        elif ident=='deco':
            for i in range(11):box('vertical_infill',(.012,.016,.92),((i-5)*.086,0,.59),iron,.002)
            for cx in [-.258,.258]:
                for level in range(3):
                    r=.062+level*.043
                    tube('stepped_fan_arch',[(cx+r*math.cos(a),-.018,.66+r*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]],.006,bronze)
                    for side in [-1,1]:tube('fan_stem',[(cx+side*r,-.018,.66),(cx+side*r,-.018,.24+level*.05)],.006,bronze)
                box('fan_center_spine',(.017,.023,.58),(cx,-.018,.52),bronze)
        elif ident=='scroll':
            for i in range(9):box('forged_vertical_bar',(.014,.019,.92),((i-4)*.105,0,.59),iron,.002)
            for cx in [-.315,0,.315]:
                for side in [-1,1]:
                    for flip in [-1,1]:
                        pts=[]
                        for i in range(49):
                            t=i/48;a=-math.pi/2+t*math.pi*2.0;r=.095*(1-t)+.015*t
                            pts.append((cx+side*(.018+r*math.cos(a)),-.016,.57+flip*(.17+r*math.sin(a))))
                        tube('forged_C_scroll',pts,.008,iron)
                for z in [.32,.57,.82]:
                    box('forged_binding_collar',(.03,.04,.022),(cx,0,z),bronze,.002)
                for a in range(8):
                    angle=a*math.tau/8
                    tube('rosette_petal',[(cx,-.038,.57),(cx+.027*math.cos(angle),-.045,.57+.027*math.sin(angle)),(cx+.02*math.cos(angle+.6),-.045,.57+.02*math.sin(angle+.6)),(cx,-.038,.57)],.004,bronze)
    return w,d,h

if __name__=='__main__':
    selected=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for row in ROWS:
        if selected and row[0] not in selected:continue
        builder=lambda m,row=row:build(row,m)
        base.COZY_BUILDERS[row[0]]=builder
        base.export_model(row[0],builder)
