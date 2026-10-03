"""Exact cyclic topology recovers the child chair seam after generic transport."""
from pathlib import Path
from collections import Counter
import math,runpy
_u=runpy.run_path(str(Path(__file__).with_name('household_upholstery.py')))
_curves=_u['_curves'];bounds=_u['bounds'];outward=_u['outward']

def child_cover(box):
    """Rounded rectangular source envelope with a quiet, uniformly crowned top."""
    lo,hi=box['min'],box['max'];cx,cy=[(lo[a]+hi[a])/2 for a in (0,1)]
    hx,hy=[(hi[a]-lo[a])/2 for a in (0,1)];radius=min(.025,hx*.3,hy*.3)
    outline=[]
    for sx,sy,start in ((1,1,0),(-1,1,math.pi/2),(-1,-1,math.pi),(1,-1,3*math.pi/2)):
        for j in range(16):
            angle=start+j*math.pi/32
            outline.append((sx*(hx-radius)+radius*math.cos(angle),sy*(hy-radius)+radius*math.sin(angle)))
    profile=[(.94,0),(.99,.025),(1,.07),(1,.82),(.99,.91),(.975,.96),(.92,.99),(.65,1),(.30,1)]
    points=[(cx+x*scale,cy+y*scale,lo[2]+height*(hi[2]-lo[2])) for scale,height in profile for x,y in outline]
    faces=[]
    for i in range(len(profile)-1):
        for j in range(64):faces.append((i*64+j,i*64+(j+1)%64,(i+1)*64+(j+1)%64,(i+1)*64+j))
    for ring,z in ((0,lo[2]),(len(profile)-1,hi[2])):
        center=len(points);points.append((cx,cy,z))
        for j in range(64):faces.append((center,ring*64+j,ring*64+(j+1)%64) if ring else (center,(j+1)%64,j))
    points=_curves['fit'](points,box)
    points=[tuple(lo[a] if abs(v[a]-lo[a])<1e-12 else hi[a] if abs(v[a]-hi[a])<1e-12 else v[a] for a in range(3)) for v in points]
    return outward(points,faces)

def seat_path(points,faces):
    if len(points)!=192 or len(faces)!=192 or any(len(f)!=4 for f in faces):raise ValueError('Expected the original 24 by 8 cyclic quad strip')
    edges=Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
    expected=set()
    for i in range(24):
        for j in range(8):
            expected.add(tuple(sorted((i*8+j,i*8+(j+1)%8))))
            expected.add(tuple(sorted((i*8+j,((i+1)%24)*8+j))))
    if set(edges)!=expected or set(edges.values())!={2}:raise ValueError('Original ring connectivity changed')
    centers=[tuple(sum(points[i*8+j][a] for j in range(8))/8 for a in range(3)) for i in range(24)]
    radius=sum(math.dist(points[i*8+j],centers[i]) for i in range(24) for j in range(8))/192
    if not .001<radius<.004:raise ValueError('Child chair seam thickness changed')
    return centers,radius

def seated_welt(obj,pad,original):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    points=[tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
    current,radius=seat_path(points,[tuple(f.vertices) for f in obj.data.polygons])
    path=original['centersM'];source_radius=original['radiusM']
    if len(path)!=24 or abs(radius-source_radius)>2e-5 or any(math.dist(a,b)>.04 for a,b in zip(current,path)):raise ValueError('Child seam differs from its bound source chart')
    radius=source_radius;path=_curves['resample_closed'](path,.006)
    pad.data.calc_loop_triangles();world=[pad.matrix_world@v.co for v in pad.data.vertices];box=bounds(world)
    tree=BVHTree.FromPolygons(world,[tuple(f.vertices) for f in pad.data.loop_triangles],all_triangles=True)
    seated=[];normals=[];largest=0
    for point in path:
        hit=tree.ray_cast(Vector((point[0],point[1],box['max'][2]+.05)),Vector((0,0,-1)),.3)
        if hit[0] is None or hit[1].z<.12 or (hit[0]-Vector(point)).length>.05:raise ValueError('Child seam cannot be seated on its original cover')
        normal=hit[1].normalized();seated.append(hit[0]+normal*radius*.25);normals.append(normal)
        largest=max(largest,(seated[-1]-Vector(point)).length)
    vertices=[];faces=[];count=len(seated)
    for i,p in enumerate(seated):
        tangent=(seated[(i+1)%count]-seated[i-1]).normalized();side=tangent.cross(normals[i]).normalized();up=side.cross(tangent).normalized()
        for j in range(8):
            angle=j*math.tau/8;v=p+radius*(math.cos(angle)*side+math.sin(angle)*up)
            if any(v[a]<box['min'][a]-.003 or v[a]>box['max'][a]+.003 for a in range(3)):raise ValueError('Child piping escaped the original cover envelope')
            vertices.append(tuple(v))
    for i in range(count):
        for j in range(8):faces.append((i*8+j,((i+1)%count)*8+j,((i+1)%count)*8+(j+1)%8,i*8+(j+1)%8))
    return outward(vertices,faces),{'originalSectionCount':24,'sectionTopology':'exact cyclic 24 by 8 quad strip','seatedSections':count,'sectionRadiusM':radius,'maximumCenterDisplacementM':largest,'surfaceOffsetRatio':.25}

def apply(root,scene,item,keys,names,evidence):
    if item['id']!='kids-shell-chair' or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Wrong reviewed child shell chair source')
    objects=_curves['_objects'](scene,names);checked={};points={}
    for spec in evidence['objects']:
        soft=spec['name']=='tailored_seat_cushion';trim=spec['name']=='seat_double_welt'
        checked[spec['name']],points[spec['name']]=_curves['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)
    shell='continuous_tailored_wraparound_shell';mesh=_u['shell'](points[shell])
    changes=[{'kind':'source-evidenced-construction','component':shell,'construction':'dense sampling of the exact original wrapped shell contour',**_curves['_replace'](checked[shell],mesh),'sections':96,'radialSides':32}]
    for p in checked[shell].data.polygons:p.use_smooth=len(p.vertices)==4
    name='tailored_seat_cushion';spec=next(s for s in evidence['objects'] if s['name']==name)
    changes.append({'kind':'source-evidenced-construction','component':name,'construction':'rounded rectangular tailored seat with a restrained crown and no corner puckers in its original envelope',**_curves['_replace'](checked[name],child_cover(spec['bounds']))})
    for p in checked[name].data.polygons:p.use_smooth=True
    name='seat_double_welt';mesh,detail=seated_welt(checked[name],checked['tailored_seat_cushion'],evidence['originalSeam'])
    changes.append({'kind':'source-evidenced-contact','component':name,'construction':'continuous child seat piping along its bound original source path, seated on the uniformly crowned cover',**_curves['_replace'](checked[name],mesh),**detail})
    for p in checked[name].data.polygons:p.use_smooth=True
    return changes
