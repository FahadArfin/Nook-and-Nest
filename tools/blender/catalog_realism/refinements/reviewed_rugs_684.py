"""Three measured rug corrections: continuous textile faces and strand fringe."""
import math
from pathlib import Path
import runpy

_curves=runpy.run_path(str(Path(__file__).with_name('curved_construction.py')))
bounds=_curves['bounds'];fit=_curves['fit']


def _ellipse(spec):
    b=spec['bounds']
    return ((b['min'][0]+b['max'][0])/2,(b['min'][1]+b['max'][1])/2,
            (b['max'][0]-b['min'][0])/2,(b['max'][1]-b['min'][1])/2)


def _inside(p,spec,round_shape=False):
    x,y=p;b=spec['bounds']
    if round_shape:
        cx,cy,rx,ry=_ellipse(spec)
        return ((x-cx)/rx)**2+((y-cy)/ry)**2<=1.00000001
    return b['min'][0]-1e-9<=x<=b['max'][0]+1e-9 and b['min'][1]-1e-9<=y<=b['max'][1]+1e-9


def _delaunay(points):
    """Small deterministic Bowyer-Watson mesh; circle boundary vertices stay shared."""
    count=len(points);p=list(points)+[(-10.,-10.),(10.,-10.),(0.,10.)]
    def circle(t):
        a,b,c=[p[i] for i in t]
        d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]))
        if abs(d)<1e-16:return None
        aa=sum(v*v for v in a);bb=sum(v*v for v in b);cc=sum(v*v for v in c)
        x=(aa*(b[1]-c[1])+bb*(c[1]-a[1])+cc*(a[1]-b[1]))/d
        y=(aa*(c[0]-b[0])+bb*(a[0]-c[0])+cc*(b[0]-a[0]))/d
        return x,y,(x-a[0])**2+(y-a[1])**2
    triangles={(count,count+1,count+2):circle((count,count+1,count+2))}
    for i,(x,y) in enumerate(points):
        bad=[t for t,c in triangles.items() if (x-c[0])**2+(y-c[1])**2<c[2]+1e-13]
        boundary={}
        for t in bad:
            del triangles[t]
            for a,b in zip(t,t[1:]+t[:1]):
                edge=tuple(sorted((a,b)))
                if edge in boundary:del boundary[edge]
                else:boundary[edge]=(a,b)
        for a,b in boundary.values():
            cross=(p[b][0]-p[a][0])*(y-p[a][1])-(p[b][1]-p[a][1])*(x-p[a][0])
            t=(a,b,i) if cross>0 else (b,a,i);c=circle(t)
            if c:triangles[t]=c
    return [t for t in triangles if max(t)<count]


def _round_top(specs):
    points=[];seen=set()
    def add(p):
        key=tuple(round(v,9) for v in p)
        if key not in seen:seen.add(key);points.append(p)
    # The outer colored annulus is constructed explicitly. Its inner boundary
    # must be one shared circular contour, not a centroid-classified triangulation.
    for spec in specs[1:]:
        cx,cy,rx,ry=_ellipse(spec);n=128 if 'field' in spec['name'] else 48
        for i in range(n):
            a=math.tau*i/n;add((cx+rx*math.cos(a),cy+ry*math.sin(a)))
    add((0.,0.))
    for j in range(-22,23):
        for i in range(-22,23):
            p=(i*.04,j*.04)
            if not _inside(p,specs[1],True):continue
            near=False
            for spec in specs:
                cx,cy,rx,ry=_ellipse(spec)
                if abs(math.sqrt(((p[0]-cx)/rx)**2+((p[1]-cy)/ry)**2)-1)*min(rx,ry)<.012:near=True;break
            if not near:add(p)
    faces=_delaunay(points);start=len(points);cx,cy,rx,ry=_ellipse(specs[0])
    for i in range(128):
        a=math.tau*i/128;points.append((cx+rx*math.cos(a),cy+ry*math.sin(a)))
    for i in range(128):
        j=(i+1)%128;faces.extend([(i,start+i,start+j),(i,start+j,j)])
    return points,faces


def _runner_top(specs):
    b=specs[0]['bounds'];xs={b['min'][0],b['max'][0],0.};ys={b['min'][1],b['max'][1],0.}
    for s in specs:
        xs.update(s['bounds'][side][0] for side in ('min','max'));ys.update(s['bounds'][side][1] for side in ('min','max'))
    xs.update(i*.04 for i in range(-9,10));ys.update(i*.04 for i in range(-27,28))
    xs=sorted(xs);ys=sorted(ys);points=[(x,y) for y in ys for x in xs];n=len(xs);faces=[]
    for j in range(len(ys)-1):
        for i in range(n-1):
            a=j*n+i;faces.extend([(a,a+1,a+n+1),(a,a+n+1,a+n)])
    return points,faces


def _scallop_top(specs):
    base=specs[0]['bounds'];petals=[s for s in specs if 'petal' in s['name']]
    angles={i*math.tau/384 for i in range(384)}
    # Include every authored lobe cardinal extremum so global dimensions are exact.
    for s in petals:
        cx,cy,rx,ry=_ellipse(s)
        for x,y in [(cx-rx,cy),(cx+rx,cy),(cx,cy-ry),(cx,cy+ry)]:angles.add(math.atan2(y,x)%math.tau)
    outline=[]
    for a in sorted(angles):
        dx,dy=math.cos(a),math.sin(a)
        t=min(abs(base['max'][0]/dx) if abs(dx)>1e-12 else 100.,abs(base['max'][1]/dy) if abs(dy)>1e-12 else 100.)
        for s in petals:
            cx,cy,rx,ry=_ellipse(s);qa=(dx/rx)**2+(dy/ry)**2;qb=-2*(dx*cx/rx**2+dy*cy/ry**2);qc=(cx/rx)**2+(cy/ry)**2-1
            disc=qb*qb-4*qa*qc
            if disc<0:continue
            near=(-qb-math.sqrt(disc))/(2*qa);far=(-qb+math.sqrt(disc))/(2*qa)
            if near<=t+1e-8:t=max(t,far)
        outline.append((t*dx,t*dy))
    n=len(outline);points=[(0.,0.)];faces=[];rings=10
    for r in range(1,rings+1):points.extend((x*r/rings,y*r/rings) for x,y in outline)
    for i in range(n):faces.append((0,1+i,1+(i+1)%n))
    for r in range(rings-1):
        a=1+r*n;b=a+n
        for i in range(n):
            j=(i+1)%n;faces.extend([(a+i,b+i,b+j),(a+i,b+j,a+j)])
    return points,faces


def rug_body(catalog_id,specs):
    if catalog_id not in ('round-rug','runner-rug','scallop-rug'):raise ValueError('Unsupported exact rug')
    box={side:[fn(s['bounds'][side][a] for s in specs) for a in range(3)] for side,fn in [('min',min),('max',max)]}
    points,top={'round-rug':_round_top,'runner-rug':_runner_top,'scallop-rug':_scallop_top}[catalog_id](specs)
    # The measured total height is retained as restrained loft shared by every
    # colored region; no colored tile or medallion introduces a separate step.
    rx=max(abs(box['min'][0]),abs(box['max'][0]));ry=max(abs(box['min'][1]),abs(box['max'][1]))
    height=lambda x,y:box['max'][2]-.0015*min(1.,(x/rx)**2+(y/ry)**2)
    vertices=[(x,y,height(x,y)) for x,y in points];faces=list(top);materials=[]
    for face in top:
        p=tuple(sum(points[i][a] for i in face)/3 for a in (0,1));chosen=specs[0]['materials'][0]
        if catalog_id=='scallop-rug':
            matches=[s for s in specs if 'petal' in s['name'] and _inside(p,s,True)]
            if matches and not _inside(p,specs[-1]):
                # A lobe is one flush textile region, with a shared outline and
                # no overlapping disc walls beneath the inner field.
                chosen=min(matches,key=lambda s:math.dist(p,_ellipse(s)[:2]))['materials'][0]
        else:
            for s in specs[1:]:
                if _inside(p,s,catalog_id=='round-rug'):chosen=s['materials'][0]
        materials.append(chosen)
    edges={}
    for f in top:
        for a,b in zip(f,f[1:]+f[:1]):
            key=tuple(sorted((a,b)))
            if key in edges:del edges[key]
            else:edges[key]=(a,b)
    border={a for e in edges.values() for a in e};bottom={}
    for i in sorted(border):bottom[i]=len(vertices);vertices.append((*points[i],box['min'][2]))
    center=len(vertices);vertices.append((0.,0.,box['min'][2]));back=specs[0]['materials'][0]
    for a,b in edges.values():
        faces.extend([(a,bottom[a],bottom[b],b),(bottom[b],bottom[a],center)]);materials.extend([back,back])
    return vertices,faces,materials


def fringe(box):
    v=[];f=[];sides=6;stations=7
    for strand in range(4):
        offset=len(v)
        for j in range(stations):
            t=j/(stations-1);x=(strand-1.5)*.0046+.0005*math.sin(t*math.pi)*math.sin(strand)
            z=.004+.013*math.sin(t*math.pi+strand*.3)**2;radius=.0014*(1-.2*t)
            for k in range(sides):
                a=k*math.tau/sides;v.append((x+radius*math.cos(a),t,z+radius*math.sin(a)))
        for j in range(stations-1):
            for k in range(sides):
                a=offset+j*sides+k;b=offset+j*sides+(k+1)%sides;f.append((a,b,b+sides,a+sides))
        f.extend([tuple(reversed(range(offset,offset+sides))),tuple(range(offset+(stations-1)*sides,offset+stations*sides))])
    return _curves['outward'](fit(v,box),f)


def apply(root,scene,item,keys,names,specs,source_sha):
    import bpy
    if item['sourceBlend']['sha256']!=source_sha:raise ValueError('Exact reviewed rug source changed')
    objects=_curves['_objects'](scene,names);checked={}
    for spec in specs:checked[spec['name']]=_curves['_checked'](objects,spec,keys)[0]
    body_specs=[s for s in specs if 'fringe' not in s['name']];v,f,face_keys=rug_body(item['id'],body_specs)
    anchor=checked[body_specs[0]['name']];palette={}
    for obj in checked.values():
        for material in obj.data.materials:
            if material:palette[keys[material.name]]=material
    evidence=_curves['_replace'](anchor,(v,f),smooth_sides=False)
    anchor.data.materials.clear();order=sorted(set(face_keys))
    for key in order:anchor.data.materials.append(palette[key])
    for polygon,key in zip(anchor.data.polygons,face_keys):
        polygon.material_index=order.index(key);polygon.use_smooth=polygon.normal.z>.5
    # Analytic surface normals prevent a vertical binding wall from pulling the
    # shared smooth top normal toward a concave lobe corner.
    from mathutils import Vector
    box=bounds(v);rx=max(abs(box['min'][0]),abs(box['max'][0]));ry=max(abs(box['min'][1]),abs(box['max'][1]))
    normal_matrix=anchor.matrix_world.to_3x3().transposed();normals=[]
    for polygon in anchor.data.polygons:
        top=all(v[i][2]>box['min'][2]+.003 for i in polygon.vertices)
        for loop in polygon.loop_indices:
            x,y,z=v[anchor.data.loops[loop].vertex_index]
            if top:
                interior=(x/rx)**2+(y/ry)**2<1.
                normal=Vector((.003*x/rx**2,.003*y/ry**2,1)) if interior else Vector((0,0,1))
                normals.append(tuple((normal_matrix@normal).normalized()))
            else:normals.append(tuple(polygon.normal))
    anchor.data.normals_split_custom_set(normals);anchor.data.update()
    removed=[]
    for spec in body_specs[1:]:
        obj=checked[spec['name']];removed.append(spec['name']);bpy.data.objects.remove(obj,do_unlink=True)
    changes=[{'kind':'source-evidenced-construction','component':body_specs[0]['name'],
              'construction':'one continuous closed textile body with flush original colored regions',
              'consolidatedComponents':removed,'sharedSurfaceReliefM':.0015,**evidence,
              'preserved':['original material keys and colors','original overall rug dimensions','closed backing']}]
    fringe_evidence=[]
    for spec in specs:
        if 'fringe' not in spec['name']:continue
        obj=checked[spec['name']];fringe_evidence.append({'component':spec['name'],**_curves['_replace'](obj,fringe(spec['bounds']),smooth_sides=False)})
        for p in obj.data.polygons:p.use_smooth=len(p.vertices)==4
    if fringe_evidence:changes.append({'kind':'source-evidenced-construction','construction':'four curved yarn strands replace each thick rectangular fringe tab','strandsPerTab':4,'components':fringe_evidence})
    return changes
