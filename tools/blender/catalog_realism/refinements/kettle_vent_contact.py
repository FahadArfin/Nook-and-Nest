"""Conform the exact kettle's original damper and vent marks to its spun lid."""
from pathlib import Path
import math,runpy
_h=runpy.run_path(str(Path(__file__).with_name('household_turning.py')))
_curves=_h['_curves'];bounds=_h['bounds'];outward=_h['outward']

def seat_vertices(points,height,bottom_offset,thickness):
    box=bounds(points);depth=box['max'][2]-box['min'][2]
    if depth<=0 or not 0<thickness<.01:raise ValueError('Original thin vent geometry required')
    result=[]
    for x,y,z in points:
        new=height(x,y)+bottom_offset+(z-box['min'][2])/depth*thickness
        if not math.isfinite(new) or abs(new-z)>.05:raise ValueError('Vent is no longer beside its authored lid surface')
        result.append((x,y,new))
    return result

def conformed_disc(box,height,bottom_offset,thickness):
    cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    rx,ry=[(box['max'][a]-box['min'][a])/2 for a in (0,1)]
    points=[];faces=[];sides=48;radial=4
    for z in (box['min'][2],box['max'][2]):
        points.append((cx,cy,z))
        for ring in range(1,radial+1):
            for i in range(sides):
                angle=i*math.tau/sides
                points.append((cx+rx*ring/radial*math.cos(angle),cy+ry*ring/radial*math.sin(angle),z))
    layer=1+sides*radial
    for offset,reverse in ((0,True),(layer,False)):
        for j in range(sides):
            f=(offset,offset+1+j,offset+1+(j+1)%sides);faces.append(tuple(reversed(f)) if reverse else f)
        for ring in range(radial-1):
            a=offset+1+ring*sides;b=a+sides
            for j in range(sides):
                f=(a+j,b+j,b+(j+1)%sides,a+(j+1)%sides);faces.append(tuple(reversed(f)) if reverse else f)
    a=1+(radial-1)*sides;b=layer+a
    for j in range(sides):faces.append((a+j,a+(j+1)%sides,b+(j+1)%sides,b+j))
    return outward(seat_vertices(points,height,bottom_offset,thickness),faces)

def apply(root,scene,item,keys,names,evidence,vents):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    if item['id']!='kettle-bbq':raise ValueError('Wrong reviewed kettle vent')
    objects=_curves['_objects'](scene,names);checked={}
    for spec in vents:checked[spec['name']]=_curves['_checked'](objects,spec,keys)[0]
    changes=_h['apply'](root,scene,item,keys,names,evidence)
    lid=objects['domed_enamel_kettle_lid'];lid.data.calc_loop_triangles()
    points=[lid.matrix_world@v.co for v in lid.data.vertices]
    tree=BVHTree.FromPolygons(points,[tuple(f.vertices) for f in lid.data.loop_triangles],all_triangles=True)
    def surface(x,y):
        hit=tree.ray_cast(Vector((x,y,evidence['bounds']['max'][2])),Vector((0,0,-1)),.4)
        if hit[0] is None or hit[1].z<.5:raise ValueError('No outer kettle dome below the original vent chart')
        return hit[0].z
    for spec in vents:
        name=spec['name'];plate=name=='lid_vent_damper'
        mesh=conformed_disc(spec['bounds'],surface,-.0005 if plate else .0024,.003 if plate else .001)
        box=bounds(mesh[0])
        if any(box[s][a]<evidence['bounds']['min'][a]-1e-7 or box[s][a]>evidence['bounds']['max'][a]+1e-7 for s in ('min','max') for a in range(3)):raise ValueError('Kettle vent escaped its original model dimensions')
        stats=_curves['_replace'](checked[name],mesh)
        for face in checked[name].data.polygons:face.use_smooth=True
        changes.append({'kind':'source-evidenced-contact','component':name,'construction':'original vent footprint conformed to the actual spun dome with restrained raised dark vent marks','sourceBoundsM':spec['bounds'],'surfaceThicknessM':.003 if plate else .001,**stats})
    return changes
