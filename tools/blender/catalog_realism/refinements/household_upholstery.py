"""One house-bed pillow loop and one child's upholstered shell chair."""
from pathlib import Path
import math,runpy
_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_textile=runpy.run_path(str(_dir/'textile_turning.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']

def shell(points):
    if len(points)!=41*12:raise ValueError('Expected the exact forty-section twelve-sided shell')
    rings=[points[i*12:(i+1)*12] for i in range(41)]
    centers=[tuple(sum(p[a] for p in row)/12 for a in range(3)) for row in rings]
    cx=(centers[0][0]+centers[-1][0])/2;rx=(centers[0][0]-centers[-1][0])/2
    cy=centers[0][1];ry=centers[20][1]-cy
    rise=(centers[20][2]-centers[0][2])/.42;base=centers[0][2]-.58*rise
    sx=max(p[0] for p in rings[0])-centers[0][0];sy=max(p[1] for p in rings[20])-centers[20][1]
    sz=(max(p[2] for p in rings[0])-centers[0][2])/.58
    def point(a,t):
        r=.58+.42*math.sin(a)
        return (cx+(rx+sx*math.cos(t))*math.cos(a),cy+(ry+sy*math.cos(t))*math.sin(a),base+rise*r+sz*r*math.sin(t))
    if max(math.dist(p,point(i*math.pi/40,j*math.tau/12)) for i,row in enumerate(rings) for j,p in enumerate(row))>2e-6:raise ValueError('Authored wrapped shell profile changed')
    sections=96;sides=32
    vertices=[point(i*math.pi/sections,j*math.tau/sides) for i in range(sections+1) for j in range(sides)]
    faces=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(sections) for j in range(sides)]
    faces += [tuple(reversed(range(sides))),tuple(range(sections*sides,(sections+1)*sides))]
    return outward(fit(vertices,bounds(points)),faces)

def pillow_loop(points,groups,box):
    matches=[]
    for i,group in enumerate(groups):
        b=bounds([points[j] for j in group]);center=[(b['min'][a]+b['max'][a])/2 for a in range(3)]
        if all(box['min'][a]<=center[a]<=box['max'][a] for a in (0,1)) and b['max'][0]-b['min'][0]<.75:matches.append(i)
    if len(matches)!=1:raise ValueError('The one pillow seam must match unambiguously')
    return matches[0]

def seated_pillow(trim,pillow):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    points=[tuple(trim.matrix_world@v.co) for v in trim.data.vertices]
    groups=_curves['components'](len(points),[tuple(e.vertices) for e in trim.data.edges])
    if len(groups)!=3 or any(len(g)!=150 for g in groups):raise ValueError('Expected three original six-sided tailored loops')
    pillow.data.calc_loop_triangles();cover=[pillow.matrix_world@v.co for v in pillow.data.vertices];box=bounds(cover)
    selected=pillow_loop(points,groups,box)
    tree=BVHTree.FromPolygons(cover,[tuple(f.vertices) for f in pillow.data.loop_triangles],all_triangles=True)
    vertices=[];faces=[];maximum=0;sections=0
    for index,group in enumerate(groups):
        offset=len(vertices)
        if index!=selected:
            lookup={original:offset+i for i,original in enumerate(group)};vertices.extend(points[i] for i in group)
            faces += [tuple(lookup[i] for i in p.vertices) for p in trim.data.polygons if all(i in lookup for i in p.vertices)]
            continue
        path,radius=_curves['authored_trim_loop']([points[i] for i in group]);sampled=_curves['resample_closed'](path,.006)
        surface=[];normals=[]
        for point in sampled:
            hit=tree.ray_cast(Vector((point[0],point[1],box['max'][2]+.05)),Vector((0,0,-1)),.3)
            if hit[0] is None:hit=tree.find_nearest(Vector(point))
            if hit[0] is None or hit[1].z<.1 or (hit[0]-Vector(point)).length>.065:raise ValueError('Pillow seam cannot be seated on its original cover')
            normal=hit[1].normalized();surface.append(hit[0]+normal*radius*.3);normals.append(normal)
            maximum=max(maximum,(surface[-1]-Vector(point)).length)
        sections=len(surface)
        for i,p in enumerate(surface):
            tangent=(surface[(i+1)%sections]-surface[i-1]).normalized();side=tangent.cross(normals[i]).normalized();up=side.cross(tangent).normalized()
            for j in range(8):
                a=j*math.tau/8;v=p+radius*(math.cos(a)*side+math.sin(a)*up)
                if any(v[k]<box['min'][k]-.004 or v[k]>box['max'][k]+.004 for k in range(3)):raise ValueError('Pillow seam escaped original cover bounds')
                vertices.append(tuple(v))
        local=[(i*8+j,((i+1)%sections)*8+j,((i+1)%sections)*8+(j+1)%8,i*8+(j+1)%8) for i in range(sections) for j in range(8)]
        _,local=outward(vertices[offset:],local);faces += [tuple(offset+i for i in f) for f in local]
    return (vertices,faces),{'seatedPillowLoops':1,'unchangedBeddingLoops':2,'maximumCenterDisplacementM':maximum,'seatedSections':sections,'surfaceOffsetRatio':.3}

def apply(root,scene,item,keys,names,evidence):
    ident=item['id']
    if ident not in ('kids-house-bed','kids-shell-chair') or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed child upholstery source changed')
    objects=_curves['_objects'](scene,names);checked={};points={};changes=[]
    for spec in evidence['objects']:
        soft=spec['name'] in ('pillow','tailored_seat_cushion');trim=spec['name'] in ('tailored_double_welt','seat_double_welt')
        checked[spec['name']],points[spec['name']]=_curves['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)
    if ident=='kids-house-bed':
        name='tailored_double_welt';mesh,detail=seated_pillow(checked[name],checked['pillow'])
        changes.append({'kind':'source-evidenced-contact','component':name,'construction':'only the pillow welt follows its actual lofted cover; mattress and quilt loops stay exact',**_curves['_replace'](checked[name],mesh),**detail})
        for p in checked[name].data.polygons:p.use_smooth=True
    else:
        name='continuous_tailored_wraparound_shell';mesh=shell(points[name])
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':'dense smooth sampling of the exact original wrapped upholstered shell profile',**_curves['_replace'](checked[name],mesh),'sections':96,'radialSides':32})
        for p in checked[name].data.polygons:p.use_smooth=len(p.vertices)==4
        name='seat_double_welt';mesh,detail=_textile['_chair_welt'](checked[name],checked['tailored_seat_cushion'])
        changes.append({'kind':'source-evidenced-contact','component':name,'construction':'seat piping continuously seated on the existing lofted child-size cushion',**_curves['_replace'](checked[name],mesh),**detail})
        for p in checked[name].data.polygons:p.use_smooth=True
    return changes
