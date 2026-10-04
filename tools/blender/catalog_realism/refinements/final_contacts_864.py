"""Measured window hardware and wingback support corrections for four IDs."""
from pathlib import Path
import math,runpy
_dir=Path(__file__).parent
_c=runpy.run_path(str(_dir/'curved_construction.py'))
_r=runpy.run_path(str(_dir/'round_appliances.py'))
_room=runpy.run_path(str(_dir/'room_construction.py'))
_f=runpy.run_path(str(_dir/'fixture_contacts.py'))
_d=runpy.run_path(str(_dir/'designed_construction.py'))
_living=runpy.run_path(str(_dir/'reviewed_living.py'))
bounds=_c['bounds'];combine=_room['combine']


def handle_parts(stile,front,z,height=.12,lever=False):
    x=(stile['min'][0]+stile['max'][0])/2
    face=stile['min'][1]
    if not .035<stile['max'][0]-stile['min'][0]<.05:raise ValueError('Measured narrow sash stile required')
    # Rose enters the actual sash. The grip remains within the original total
    # window depth, with round returned ends rather than a floating wedge.
    y=front+.006
    if y>=face-.008:raise ValueError('Insufficient measured grip clearance')
    plate=_room['box_mesh']((x-.011,face-.006,z-height/2-.009),(x+.011,face+.002,z+height/2+.009))
    if lever:
        controls=[(x,face-.003,z+height*.28),(x,y,z+height*.28),(x,y,z-height*.48)]
    else:
        controls=[(x,face-.003,z+height/2),(x,y,z+height/2),(x,y,z-height/2),(x,face-.003,z-height/2)]
    # This grip is planar in YZ. A constant X reference keeps corresponding
    # tube vertices continuous through the bend instead of flipping sections.
    grip=_d['sweep'](_d['rounded_path'](controls,.008,8),.0055,(1,0,0),sides=16)
    return combine([plate,grip])


def seated_welts(obj,pads):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    points=[tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
    groups=_c['components'](len(points),[tuple(e.vertices) for e in obj.data.edges])
    if len(groups)!=2 or any(len(g)!=150 for g in groups):raise ValueError('Expected seat and back loops')
    pieces=[]
    for group in groups:
        old=[points[i] for i in group];box=bounds(old);pad=pads[0 if box['max'][2]<.6 else 1]
        centers,radius=_c['authored_trim_loop'](old)
        centers=_c['resample_closed'](centers,.012)
        pad.data.calc_loop_triangles();world=[pad.matrix_world@v.co for v in pad.data.vertices]
        tree=BVHTree.FromPolygons(world,[tuple(t.vertices) for t in pad.data.loop_triangles],all_triangles=True)
        path=[];normals=[]
        for p in centers:
            hit=tree.find_nearest(Vector(p))
            if hit[0] is None or hit[3]>.075:raise ValueError('Sewn loop lost its matching cover')
            normal=hit[1].normalized();path.append(tuple(hit[0]+normal*radius*.25));normals.append(tuple(normal))
        pieces.append(_c['outward'](*_living['sewn_tube'](path,normals,radius,6)))
    return combine(pieces)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed final contacts source changed')
    objects=_c['_objects'](scene,names);checked={};specs={s['name']:s for s in evidence['objects']};changes=[]
    for spec in evidence['objects']:
        soft=spec['name'] in ('tailored_seat','padded_back');trim=spec['name']=='tailored_double_welt'
        checked[spec['name']]=_c['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    def replace(name,g,description):
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**_r['_replace'](checked[name],g)})
    if item['id'].startswith('window-'):
        old=specs['window_lever']['bounds'];z=(old['min'][2]+old['max'][2])/2
        parts=[handle_parts(specs[name]['bounds'],old['min'][1],z,.095 if item['id']=='window-glider' else .12,item['id']!='window-glider') for name in checked if name.startswith('compression_sash_stile')]
        replace('window_lever',combine(parts),'rounded brass handles with returned stems and mounting roses seated on the actual sash stiles')
    elif item['id']=='wingback-chair':
        replace('tailored_double_welt',seated_welts(checked['tailored_double_welt'],[checked['tailored_seat'],checked['padded_back']]),'two continuous sewn loops follow the shaped seat and back covers')
        # Full width upholstered rear frame connects the timber deck to both
        # arms and overlaps the original back cushion by 38 mm.
        mesh=bpy.data.meshes.new('connected upholstered back rail');obj=bpy.data.objects.new('detail_casework_connected upholstered back rail',mesh)
        mesh.materials.append(checked['padded_back'].data.materials[0]);scene.collection.objects.link(obj)
        g=_room['box_mesh']((-.32,.296,.322),(.32,.414,.574))
        detail=_r['_replace'](obj,g);mod=obj.modifiers.new('Editable upholstered rail corner easing','BEVEL');mod.width=.012;mod.segments=4
        changes.append({'kind':'source-evidenced-contact','component':obj.name,'construction':'continuous upholstered back rail joins the seat deck, arms and back cushion',**detail})
    else:raise ValueError('Wrong final contacts ID')
    bpy.context.view_layer.update();return changes
