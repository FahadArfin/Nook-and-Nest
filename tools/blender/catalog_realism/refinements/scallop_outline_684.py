"""Scallop-only repair of discontinuous lobe joins in the first rug pilot."""
import math
from pathlib import Path
import runpy

_rug=runpy.run_path(str(Path(__file__).with_name('reviewed_rugs_684.py')))
_curves=runpy.run_path(str(Path(__file__).with_name('curved_construction.py')))


def outline(specs,segments=512):
    base=specs[0]['bounds'];petals=[s for s in specs if 'petal' in s['name']];radii=[]
    for i in range(segments):
        a=math.tau*i/segments;dx,dy=math.cos(a),math.sin(a)
        t=min(abs(base['max'][0]/dx) if abs(dx)>1e-12 else 100.,abs(base['max'][1]/dy) if abs(dy)>1e-12 else 100.)
        for spec in petals:
            cx,cy,rx,ry=_rug['_ellipse'](spec);qa=(dx/rx)**2+(dy/ry)**2
            qb=-2*(dx*cx/rx**2+dy*cy/ry**2);qc=(cx/rx)**2+(cy/ry)**2-1;disc=qb*qb-4*qa*qc
            if disc>=0:t=max(t,(-qb+math.sqrt(disc))/(2*qa))
        radii.append(t)
    # Join the outermost authored lobes into one bound textile perimeter. Small
    # radial gaps between overlapping source discs must not become sharp darts.
    for _ in range(3):radii=[sum(radii[(i+j-2)%segments]*w for j,w in enumerate((1,4,6,4,1)))/16 for i in range(segments)]
    points=[(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments)) for i,r in enumerate(radii)]
    lo=[min(p[a] for p in points) for a in (0,1)];hi=[max(p[a] for p in points) for a in (0,1)]
    target={s:[fn(o['bounds'][s][a] for o in specs) for a in (0,1)] for s,fn in [('min',min),('max',max)]}
    return [tuple(target['min'][a]+(p[a]-lo[a])/(hi[a]-lo[a])*(target['max'][a]-target['min'][a]) for a in (0,1)) for p in points]


def geometry(specs):
    border=outline(specs);n=len(border);rings=8;points=[(0.,0.)];top=[]
    for r in range(1,rings+1):points.extend((x*r/rings,y*r/rings) for x,y in border)
    for i in range(n):top.append((0,1+i,1+(i+1)%n))
    for r in range(rings-1):
        a=1+r*n;b=a+n
        for i in range(n):
            j=(i+1)%n;top.append((a+i,b+i,b+j,a+j))
    box={s:[fn(o['bounds'][s][a] for o in specs) for a in range(3)] for s,fn in [('min',min),('max',max)]}
    rx=max(abs(box['min'][0]),abs(box['max'][0]));ry=max(abs(box['min'][1]),abs(box['max'][1]))
    vertices=[(x,y,box['max'][2]-.0015*min(1.,(x/rx)**2+(y/ry)**2)) for x,y in points];faces=list(top);keys=[]
    petals=[s for s in specs if 'petal' in s['name']]
    for face_index,face in enumerate(top):
        p=tuple(sum(points[i][a] for i in face)/len(face) for a in (0,1));key=specs[0]['materials'][0]
        # Use the existing alternating petal colors as one flush border. Its
        # inner edge follows a shared contour, instead of classifying coarse
        # quads against overlapping circles and creating jagged inward stars.
        strip=-1 if face_index<n else (face_index-n)//n
        if strip>=5:key=min(petals,key=lambda s:math.dist(p,_rug['_ellipse'](s)[:2]))['materials'][0]
        keys.append(key)
    bottom=len(vertices);vertices.extend((x,y,box['min'][2]) for x,y in border);center=len(vertices);vertices.append((0.,0.,box['min'][2]));outer=1+(rings-1)*n
    for i in range(n):
        j=(i+1)%n;faces.extend([(outer+i,bottom+i,bottom+j,outer+j),(bottom+j,bottom+i,center)]);keys.extend([specs[0]['materials'][0]]*2)
    return vertices,faces,keys


def apply(scene,keys,names,specs):
    from mathutils import Vector
    objects=_curves['_objects'](scene,names);obj=objects.get(specs[0]['name'])
    if obj is None or obj.get('motion_role') or obj.get('shared_geometry'):raise ValueError('Missing reviewed scallop body')
    expected=_rug['rug_body']('scallop-rug',specs)
    if len(obj.data.vertices)!=len(expected[0]):raise ValueError('Scallop first-stage topology changed')
    palette={keys[m.name]:m for m in obj.data.materials};v,f,face_keys=geometry(specs)
    evidence=_curves['_replace'](obj,(v,f),smooth_sides=False);order=sorted(palette)
    obj.data.materials.clear()
    for key in order:obj.data.materials.append(palette[key])
    box=_curves['bounds'](v);rx=max(abs(box['min'][0]),abs(box['max'][0]));ry=max(abs(box['min'][1]),abs(box['max'][1]));normal_matrix=obj.matrix_world.to_3x3().transposed();normals=[]
    for polygon,key in zip(obj.data.polygons,face_keys):
        polygon.material_index=order.index(key);top=all(v[i][2]>box['min'][2]+.003 for i in polygon.vertices);polygon.use_smooth=top
        for loop in polygon.loop_indices:
            x,y,z=v[obj.data.loops[loop].vertex_index]
            n=Vector((.003*x/rx**2,.003*y/ry**2,1)) if (x/rx)**2+(y/ry)**2<1 else Vector((0,0,1))
            normals.append(tuple((normal_matrix@n).normalized()) if top else tuple(polygon.normal))
    obj.data.normals_split_custom_set(normals);obj.data.update()
    return [{'kind':'source-evidenced-construction','component':specs[0]['name'],
             'construction':'continuous softened joins between the measured outer petal envelopes with a flush alternating-color border',
             'outlineSamples':512,'preserved':['all original global bounds','original color keys','continuous closed textile face'],**evidence}]
