"""Exact support/contact corrections for saddle stool, curved sofa and daybed."""
import math
from pathlib import Path
import runpy

_directory=Path(__file__).parent
_curves=runpy.run_path(str(_directory/'curved_construction.py'))
_fixtures=runpy.run_path(str(_directory/'fixture_contacts.py'))
_textile=runpy.run_path(str(_directory/'textile_turning.py'))
bounds=_curves['bounds']


def counter_braces(ring,legs,dimensions):
    center=[(ring['min'][a]+ring['max'][a])/2 for a in range(3)]
    # Exact modern_models.py:ring: 0.33 times nominal width/depth and a
    # 15 mm source tube, before measured independent-axis normalization.
    radii=[(ring['max'][a]-ring['min'][a])/2*(dimensions[a]/1000*.33)/(dimensions[a]/1000*.33+.015) for a in (0,1)]
    result=[]
    for leg in legs:
        x,y=[(leg['min'][a]+leg['max'][a])/2 for a in (0,1)]
        angle=math.atan2((y-center[1])/radii[1],(x-center[0])/radii[0])
        result.append([(center[0]+radii[0]*math.cos(angle),center[1]+radii[1]*math.sin(angle),center[2]),(x,y,center[2])])
    return result


def sofa_back():
    vertices=[];faces=[];sections=72;sides=24
    # A single rear bolster follows all three source modules. Its ends seat
    # inside the track arms and its lower edge enters the platform modules.
    for i in range(sections+1):
        x=-1.18+2.36*i/sections
        center=.49-.28*(x/1.18)**2;bottom=.295;top=.72-.20*(abs(x)/1.18)**4
        y0,y1=center-.055,center+.055;r=.024
        for cy,cz,start in [(y1-r,top-r,0),(y0+r,top-r,90),(y0+r,bottom+r,180),(y1-r,bottom+r,270)]:
            for j in range(6):
                angle=math.radians(start+j*90/5)
                vertices.append((x,cy+r*math.cos(angle),cz+r*math.sin(angle)))
    for i in range(sections):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces += [tuple(reversed(range(sides))),tuple(range(sections*sides,(sections+1)*sides))]
    return _curves['outward'](vertices,faces)


def daybed_plan(rows):
    def box(name):return rows[name]['bounds']
    left,right=box('daybed_end_frame'),box('daybed_end_frame.001')
    drawer_left,drawer_right=box('daybed_drawer'),box('daybed_drawer.001')
    if abs(left['min'][0]+right['max'][0])>1e-6 or abs(drawer_left['min'][0]+drawer_right['max'][0])>1e-6:
        raise ValueError('Reviewed symmetric daybed envelope changed')
    factor=drawer_right['max'][0]/right['max'][0]
    if not 1.35<factor<1.40:raise ValueError('Unexpected daybed frame width correction')
    limit=right['min'][0]*factor-.004
    target=[(-limit,-.006),(.006,limit)];drawers={}
    for name,new in zip(('daybed_drawer','daybed_drawer.001'),target):
        old=box(name);scale=(new[1]-new[0])/(old['max'][0]-old['min'][0])
        drawers[name]=(scale,new[0]-old['min'][0]*scale)
    return {'frameScaleX':factor,'drawers':drawers,'centerRevealM':.012,'endFrameClearanceM':.004,
            'preservedOuterWidthM':drawer_right['max'][0]-drawer_left['min'][0]}


def _tree(obj):
    from mathutils.bvhtree import BVHTree
    obj.data.calc_loop_triangles()
    return BVHTree.FromPolygons([obj.matrix_world@v.co for v in obj.data.vertices],[tuple(p.vertices) for p in obj.data.loop_triangles],all_triangles=True)


def apply(root,scene,item,keys,names,specs):
    from mathutils import Matrix,Vector
    original=_curves['_objects'](scene,names);objects={}
    for spec in specs:
        soft=spec['kind']=='soft-contact';trim=spec['kind']=='welt'
        objects[spec['name']]=_curves['_checked'](original,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    changes=[]
    if item['id']=='counter-saddle-stool':
        legs=[s for s in specs if s['kind']=='leg'];ring=next(s for s in specs if s['kind']=='ring')
        paths=counter_braces(ring['bounds'],[s['bounds'] for s in legs],item['dimensionsMm'])
        material=objects[legs[0]['name']].data.materials[0]
        for i,(path,leg) in enumerate(zip(paths,legs)):
            targets=[ring['name'],leg['name']];distances=[]
            for point,target in zip(path,targets):
                hit=_tree(objects[target]).find_nearest(Vector(point))
                if hit[0] is None or hit[3]>.032 or (Vector(point)-hit[0]).dot(hit[1])>1e-5:
                    raise ValueError('Saddle stool brace endpoint must be inside the original ring/leg')
                distances.append(hit[3])
            geometry=_fixtures['closed_tube'](path,.009);name='detail_counter_saddle_ring_brace_'+str(i+1)
            _fixtures['_add'](scene,names,name,geometry,material)
            changes.append({'kind':'source-evidenced-contact','newComponent':name,'construction':'metal brace seats the foot ring into an existing leg',
                            'sourceComponents':targets,'attachmentCentersM':path,'endpointsInsideOriginals':True,
                            'endpointSurfaceDistancesM':distances,'boundsM':bounds(geometry[0]),'materialKey':'modern-brushed-aluminum'})
        welt=objects['seat_double_welt'];geometry,evidence=_textile['_chair_welt'](welt,objects['tailored_seat_cushion'])
        changes.append({'kind':'source-evidenced-construction','component':'seat_double_welt',
                        'construction':'continuous round seat piping seated on the unchanged refined cover',
                        **_textile['_replace'](welt,geometry),**evidence})
    elif item['id']=='curve-sofa':
        geometry=sofa_back();material=objects['angled_back_cushion.001'].data.materials[0]
        obj=_fixtures['_add'](scene,names,'detail_curve_sofa_connected_supporting_back',geometry,material)
        tree=_tree(obj);contacts={}
        for spec in specs:
            count=len(tree.overlap(_tree(objects[spec['name']])))
            if count==0:raise ValueError('Connected sofa back misses its original support: '+spec['name'])
            contacts[spec['name']]=count
        changes.append({'kind':'source-evidenced-construction','newComponent':names[obj.name],
                        'construction':'single curved upholstered supporting back joins all three pads, platforms and both arms',
                        'sourceIntersectionPairs':contacts,'boundsM':bounds(geometry[0]),'materialKey':'upholstery-textured',
                        'candidateVertices':len(geometry[0]),'candidateTriangles':sum(len(f)-2 for f in geometry[1]),
                        'preserved':['all original cushions, seams and arm meshes','terracotta color key and material factors','original outer envelope']})
    elif item['id']=='daybed':
        plan=daybed_plan({s['name']:s for s in specs})
        if set(objects)!=set(original):raise ValueError('Daybed correction must account for every original component')
        before=bounds([tuple(obj.matrix_world@v.co) for obj in objects.values() for v in obj.data.vertices])
        for name,obj in objects.items():
            scale,offset=plan['drawers'].get(name,(plan['frameScaleX'],0))
            transform=Matrix(((scale,0,0,offset),(0,1,0,0),(0,0,1,0),(0,0,0,1)))
            obj.matrix_world=transform@obj.matrix_world
            changes.append({'kind':'source-evidenced-fit','component':name,'construction':'drawer fits between end frames' if name in plan['drawers'] else 'shared frame/bedding/seam width correction',
                            'worldXScale':scale,'worldXOffsetM':offset,
                            'preserved':['mesh topology, UVs, original material slots','original Y/Z coordinates and overall catalog bounds']})
        after=bounds([tuple(obj.matrix_world@v.co) for obj in objects.values() for v in obj.data.vertices])
        if any(abs(before[s][a]-after[s][a])>2e-6 for s in ('min','max') for a in range(3)):
            raise ValueError('Daybed fit changed the original overall envelope')
        changes.append({'kind':'source-evidenced-fit','construction':'measured daybed frame and inset drawers share the original 2.05 metre envelope',
                        **plan,'beforeBoundsM':before,'afterBoundsM':after})
    else:raise ValueError('Unsupported support/fit model')
    return changes
