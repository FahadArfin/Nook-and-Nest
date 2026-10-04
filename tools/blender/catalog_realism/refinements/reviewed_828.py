"""Four final exact-source construction corrections; no global pipeline changes."""
import math
from pathlib import Path
import runpy

_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_textile=runpy.run_path(str(_dir/'textile_turning.py'))
_shell=runpy.run_path(str(_dir/'silhouette_geometry.py'))
bounds=_curves['bounds']


def drilled_vessel(points,polygons,radius=.022):
    caps=[f for f in polygons if len(f)==48 and max(points[i][2] for i in f)-min(points[i][2] for i in f)<1e-7]
    if len(caps)!=2:raise ValueError('Exact source vessel must have two planar48-vertex caps')
    top=max(caps,key=lambda f:points[f[0]][2]);bottom=min(caps,key=lambda f:points[f[0]][2])
    if abs(points[top[0]][2]-.01)>1e-7 or abs(points[bottom[0]][2])>1e-7:raise ValueError('Original basin floor changed')
    # Original outer/inner wall vertices and all their connecting polygons stay
    # exactly in place. Only the two center caps become drain annuli.
    vertices=[list(p) for p in points];faces=[tuple(f) for f in polygons if f not in caps]
    top_order=list(top);bottom_order=list(reversed(bottom))
    top_start=len(vertices)
    for z in (.01,0.):
        for i in top_order:
            angle=math.atan2(points[i][1],points[i][0]);vertices.append((radius*math.cos(angle),radius*math.sin(angle),z))
    bottom_start=top_start+48
    for i in range(48):
        j=(i+1)%48
        faces.extend([(top_order[i],top_order[j],top_start+j,top_start+i),
                      (bottom_order[j],bottom_order[i],bottom_start+i,bottom_start+j),
                      (top_start+i,top_start+j,bottom_start+j,bottom_start+i)])
    return vertices,faces


def _unit(v):
    length=math.sqrt(sum(x*x for x in v))
    if length<1e-12:raise ValueError('Collapsed measured path')
    return tuple(x/length for x in v)
def _sub(a,b):return tuple(x-y for x,y in zip(a,b))
def _dot(a,b):return sum(x*y for x,y in zip(a,b))
def _cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def tube(path,radius=.008,sides=16):
    vertices=[];faces=[];side=(1.,0.,0.)
    for i,point in enumerate(path):
        tangent=_unit(_sub(path[min(i+1,len(path)-1)],path[max(0,i-1)]))
        side=tuple(side[a]-_dot(side,tangent)*tangent[a] for a in range(3))
        if sum(x*x for x in side)<1e-10:side=_cross(tangent,(0.,0.,1.))
        side=_unit(side);up=_unit(_cross(tangent,side))
        for j in range(sides):
            angle=j*math.tau/sides
            vertices.append(tuple(point[a]+radius*(math.cos(angle)*side[a]+math.sin(angle)*up[a]) for a in range(3)))
    for i in range(len(path)-1):
        for j in range(sides):
            k=(j+1)%sides;faces.append((i*sides+j,i*sides+k,(i+1)*sides+k,(i+1)*sides+j))
    faces.extend([tuple(reversed(range(sides))),tuple(range((len(path)-1)*sides,len(path)*sides))])
    return _curves['outward'](vertices,faces)


def waffle_handle(front):
    control=[(-.07,-.12,.055),(-.07,-.12,.114),(-.07,-.167,.114),(.07,-.167,.114),(.07,-.12,.114),(.07,-.12,.055)]
    path=[control[0]]
    for a,b,c in zip(control,control[1:],control[2:]):
        u=_unit(_sub(a,b));w=_unit(_sub(c,b));start=tuple(b[k]+u[k]*.009 for k in range(3));end=tuple(b[k]+w[k]*.009 for k in range(3))
        path.append(start)
        for j in range(1,9):
            t=j/8;path.append(tuple((1-t)**2*start[k]+2*t*(1-t)*b[k]+t*t*end[k] for k in range(3)))
    path.append(control[-1]);vertices,faces=tube(path)
    shift=front-min(p[1] for p in vertices);vertices=[(x,y+shift,z) for x,y,z in vertices]
    return vertices,faces


def stool_supports(pan,back):
    y=pan['max'][1]-.010;z0=pan['max'][2]-.020;z1=back['min'][2]+.23
    if not .07<back['min'][2]-pan['max'][2]<.10:raise ValueError('Reviewed stool back gap changed')
    return [tube([(x,y,z0),(x,y,z1)],.009,24) for x in (-.174,.174)]


def _seat_welt(obj,pad,spec):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    centers=_curves['resample_closed'](spec['sourceCenters'],.008);radius=spec['sectionRadiusM']
    world=[pad.matrix_world@v.co for v in pad.data.vertices];box=bounds(world);pad.data.calc_loop_triangles()
    tree=BVHTree.FromPolygons(world,[tuple(p.vertices) for p in pad.data.loop_triangles],all_triangles=True)
    surface=[];normals=[]
    for point in centers:
        hit=tree.ray_cast(Vector((point[0],point[1],box['max'][2]+.05)),Vector((0,0,-1)),.3)
        if hit[0] is None or hit[1].z<.12 or abs(hit[0].z-point[2])>.06:raise ValueError('Reviewed seat welt cannot reach its cover')
        normal=hit[1].normalized();surface.append(hit[0]+normal*radius*.25);normals.append(normal)
    vertices=[];faces=[];count=len(surface)
    for i,point in enumerate(surface):
        tangent=(surface[(i+1)%count]-surface[i-1]).normalized();side=tangent.cross(normals[i]).normalized();up=side.cross(tangent).normalized()
        for j in range(8):
            angle=j*math.tau/8;p=point+radius*(math.cos(angle)*side+math.sin(angle)*up)
            if any(p[a]<box['min'][a]-.003 or p[a]>box['max'][a]+.003 for a in range(3)):raise ValueError('Seat piping escaped its pad envelope')
            vertices.append(tuple(p))
    for i in range(count):
        for j in range(8):faces.append((i*8+j,((i+1)%count)*8+j,((i+1)%count)*8+(j+1)%8,i*8+(j+1)%8))
    return _curves['outward'](vertices,faces),{'seatedSections':count,'sectionRadiusM':radius,'maximumSampleSpacingM':.008,'surfaceOffsetM':radius*.25}


def _add(scene,name,geometry,material):
    import bpy
    mesh=bpy.data.meshes.new(name);obj=bpy.data.objects.new('detail_casework_'+name,mesh);mesh.materials.append(material);scene.collection.objects.link(obj)
    evidence=_curves['_replace'](obj,geometry,smooth_sides=False)
    for face in obj.data.polygons:face.use_smooth=len(face.vertices)==4 and abs(face.normal.z)<.999
    return evidence


def apply(root,scene,item,keys,names,specs,source_sha):
    if item['sourceBlend']['sha256']!=source_sha:raise ValueError('Exact reviewed828 source changed')
    objects=_curves['_objects'](scene,names);checked={};palette={};changes=[]
    for spec in specs:
        soft=spec.get('role')=='cover';trim=spec.get('role')=='welt'
        obj=_curves['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0];checked[spec['name']]=obj
        for material in obj.data.materials:
            if material:palette[keys[material.name]]=material
    def replace(spec,geometry,construction,smooth=True,extra=None):
        obj=checked[spec['name']];evidence=_curves['_replace'](obj,geometry,smooth_sides=False)
        for face in obj.data.polygons:face.use_smooth=smooth and len(face.vertices)==4 and abs(face.normal.z)<.999
        changes.append({'kind':'source-evidenced-construction','component':spec['name'],'construction':construction,**evidence,**(extra or {}),
                        'preserved':['original material keys and factors','overall source dimensions','unrelated original geometry']})
    if item['id'] in ('upholstered-bar-stool','upholstered-dining-chair'):
        spec=next(s for s in specs if s.get('role')=='welt');obj=checked[spec['name']]
        geometry,evidence=_seat_welt(obj,checked['tailored_seat_cushion'],spec)
        replace(spec,geometry,'continuous round welt seated on the complete shaped seat cover',extra=evidence)
        for face in obj.data.polygons:face.use_smooth=True
        if item['id']=='upholstered-bar-stool':
            pan=next(s['bounds'] for s in specs if s['name']=='structural_seat_pan');back=next(s['bounds'] for s in specs if s['name']=='tailored_back_cushion')
            details=[]
            for i,geometry in enumerate(stool_supports(pan,back)):
                details.append({'component':'stool back upright '+str(i),**_add(scene,'stool back upright '+str(i),geometry,palette['modern-brushed-aluminum'])})
            changes.append({'kind':'source-evidenced-construction','construction':'two metal back uprights link the seat pan to the previously unsupported back cushion','components':details,'panContactOverlapM':.02})
    elif item['id']=='vessel-sink':
        spec=next(s for s in specs if s['name']=='Fine rim vessel');obj=checked[spec['name']]
        points=[list(obj.matrix_world@v.co) for v in obj.data.vertices];polygons=[list(p.vertices) for p in obj.data.polygons]
        replace(spec,drilled_vessel(points,polygons),'44mm drain passage through the original basin floor; all original vessel wall vertices retained')
        parts=[('drain rim',[(1,0),(1,1),(.74,1),(.74,0)],.026,.009,.013,'brushed-steel'),
               ('drain recess',[(1,0),(1,1),(.8,1),(.8,0)],.0205,.0005,.011,'recess-shadow-detail'),
               ('drain pop-up cap',[(0,0),(.94,0),(1,.35),(.98,1),(0,1)],.016,.0105,.0135,'brushed-steel')]
        details=[]
        for name,profile,r,z0,z1,key in parts:
            geometry=_shell['lathe'](profile,{'min':[-r,-r,z0],'max':[r,r,z1]},64)
            details.append({'component':name,'materialKey':key,**_add(scene,name,geometry,palette[key])})
        changes.append({'kind':'source-evidenced-construction','construction':'inset metal pop-up drain and recessed dark annulus within the original vessel envelope','components':details})
    elif item['id']=='waffle-iron':
        base=next(s for s in specs if s['name']=='rounded_waffle_base');profile=[(0,0),(.89,0),(.95,.04),(.98,.15),(1,.48),(1,.7778),(.98,.86),(.9375,1),(0,1)]
        replace(base,_shell['lathe'](profile,base['bounds'],128),'smooth cast lower shell with a flat landing and the original maximum body envelope')
        handle=next(s for s in specs if s['name']=='cool_touch_handle')
        replace(handle,waffle_handle(handle['bounds']['min'][1]),'constant-section rounded wood handle with two returned supports seated in the lower shell',extra={'sectionRadiusM':.008,'supportEndHeightM':.055,'frontEnvelopePreserved':True})
        for face in checked[handle['name']].data.polygons:face.use_smooth=len(face.vertices)==4
    else:raise ValueError('Unsupported exact828 recipe')
    return changes
