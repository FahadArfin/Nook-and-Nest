"""Measured, isolated repairs for nine explicitly reviewed collection models.

No material factors, image bytes, protected panels, bowl interiors, or unrelated
objects are replaced. Every native role is guarded by the frozen source metrics.
"""
import math
from pathlib import Path
import runpy

_directory=Path(__file__).parent
_curves=runpy.run_path(str(_directory/'curved_construction.py'))
_fixtures=runpy.run_path(str(_directory/'fixture_contacts.py'))
_vessels=runpy.run_path(str(_directory/'vessel_geometry.py'))
bounds=_curves['bounds']
outward=_curves['outward']
cross=_fixtures['_cross']
unit=_fixtures['_unit']


def add(a,b):return tuple(x+y for x,y in zip(a,b))
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def scale(a,s):return tuple(x*s for x in a)
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def lerp(a,b,t):return add(scale(a,1-t),scale(b,t))


def rounded_path(points,cut=.035,spacing=.025):
    """Quadratic fillets inside the authored polyline's convex hull."""
    coarse=[tuple(points[0])]
    for i,b in enumerate(points[1:-1],1):
        a,c=points[i-1],points[i+1]
        distance=min(cut,math.dist(a,b)*.22,math.dist(b,c)*.22)
        before=add(b,scale(unit(sub(a,b)),distance));after=add(b,scale(unit(sub(c,b)),distance))
        count=max(1,math.ceil(math.dist(coarse[-1],before)/spacing))
        start=coarse[-1]
        coarse.extend(lerp(start,before,j/count) for j in range(1,count+1))
        coarse.extend(add(add(scale(before,(1-t)**2),scale(b,2*t*(1-t))),scale(after,t*t)) for t in [j/12 for j in range(1,13)])
    last=tuple(points[-1]);count=max(1,math.ceil(math.dist(coarse[-1],last)/spacing));start=coarse[-1]
    coarse.extend(lerp(start,last,j/count) for j in range(1,count+1))
    return [p for i,p in enumerate(coarse) if i==0 or math.dist(p,coarse[i-1])>1e-9]


def sweep(path,radius,normal,*,sides=16,closed=False,miter=False):
    """Fixed plane normal prevents the source tube's vertical-axis sign flip."""
    if len(path)<3 or radius<=0:raise ValueError('Nondegenerate measured tube required')
    normal=unit(normal);vertices=[];faces=[]
    if max(abs(dot(sub(p,path[0]),normal)) for p in path)>2e-5:
        raise ValueError('Reviewed sweep must remain in its authored plane')
    for i,p in enumerate(path):
        before=path[(i-1)%len(path)] if closed or i else path[0]
        after=path[(i+1)%len(path)] if closed or i<len(path)-1 else path[-1]
        entering=unit(sub(p,before)) if i or closed else unit(sub(after,p))
        leaving=unit(sub(after,p)) if i<len(path)-1 or closed else entering
        tangent=unit(add(entering,leaving));perpendicular=unit(cross(normal,tangent))
        stretch=1/max(.5,dot(tangent,entering)) if miter else 1
        for j in range(sides):
            angle=math.tau*j/sides
            vertices.append(add(p,add(scale(perpendicular,radius*stretch*math.cos(angle)),scale(normal,radius*math.sin(angle)))))
    for i in range(len(path) if closed else len(path)-1):
        nxt=(i+1)%len(path)
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,nxt*sides+(j+1)%sides,nxt*sides+j))
    if not closed:faces += [tuple(reversed(range(sides))),tuple(range((len(path)-1)*sides,len(path)*sides))]
    return outward(vertices,faces)


def ring_centers(points,sides):
    if len(points)%sides:raise ValueError('Original authored ring count changed')
    centers=[tuple(sum(p[a] for p in points[i:i+sides])/sides for a in range(3)) for i in range(0,len(points),sides)]
    radii=[math.dist(p,centers[i//sides]) for i,p in enumerate(points)]
    radius=sum(radii)/len(radii)
    if min(radii)<radius*.65 or max(radii)>radius*1.35:
        raise ValueError('Source is no longer a normalized constant-radius tube')
    return centers,radius


def mirror_path(centers,arched):
    path=[]
    for p in centers:
        if not path or math.dist(p,path[-1])>1e-6:path.append(p)
    if math.dist(path[-1],path[0])>1e-6:raise ValueError('Authored mirror perimeter is not closed')
    path.pop()
    if arched:
        if len(path)!=35:raise ValueError('Expected authored 32-section arched mirror')
        floor_left,floor_right,spring=path[:3];cx=(floor_left[0]+floor_right[0])/2
        rx=spring[0]-cx;rz=max(p[2] for p in path)-spring[2]
        path=[floor_left,floor_right]+[(cx+rx*math.cos(i*math.pi/96),spring[1],spring[2]+rz*math.sin(i*math.pi/96)) for i in range(97)]
    elif len(path)!=8:raise ValueError('Expected authored eight-sided mirror')
    return path


def coffee_path(centers):
    if len(centers)!=21:raise ValueError('Expected authored twenty-section glass-table arch')
    first,last=centers[0],centers[-1]
    if abs(first[2]-last[2])>2e-6:raise ValueError('Arch feet no longer share a floor')
    height=centers[10][2]-first[2]
    for i,p in enumerate(centers):
        expected=lerp(first,last,i/20)
        expected=(expected[0],expected[1],first[2]+height*math.sin(math.pi*i/20))
        if math.dist(p,expected)>2e-6:raise ValueError('Authored sine arch centerline changed')
    result=[(first[0]+(last[0]-first[0])*i/96,first[1]+(last[1]-first[1])*i/96,first[2]+height*math.sin(math.pi*i/96)) for i in range(97)]
    result[0]=first;result[-1]=last
    return result


def bowl_shell(box):
    # Original shell radius and 88% interior; the source inner floor was at20%.
    profile=[(0,0),(.97,0),(.992,.007),(1,.018),(1,.965)]
    profile += [(.94+.06*math.cos(i*math.pi/12),.965+.035*math.sin(i*math.pi/12)) for i in range(1,13)]
    profile += [(.88,.225),(.872,.207),(.85,.2),(0,.2)]
    return outward(*_vessels['lathe'](profile,box['min'],box['max'],segments=128))


def bowl_flute(angle,radius,outer,height):
    # A closed, round-ended raised rib is embedded in the exterior wall.
    # It cannot make the old sharp ends protrude into the 88% radius cavity.
    radial=outer-radius;profile=[(0,0)]
    profile += [(math.sin(i*math.pi/8),.08*(1-math.cos(i*math.pi/8))) for i in range(1,5)]
    profile += [(1,.92)]
    profile += [(math.cos(i*math.pi/8),.92+.08*math.sin(i*math.pi/8)) for i in range(1,4)]+[(0,1)]
    vertices,faces=_vessels['lathe'](profile,[-radial,-.0068,.026],[radial,.0068,height],segments=16)
    vertices=[((radius+x)*math.cos(angle)-y*math.sin(angle),(radius+x)*math.sin(angle)+y*math.cos(angle),z) for x,y,z in vertices]
    return outward(vertices,faces)


def economical_flute(box):
    height=box['max'][2]-box['min'][2];bevel=min(.000257/height,.025)
    return _capped_flute(box,bevel)


def _capped_flute(box,bevel):
    vertices,faces=_vessels['lathe']([(.95,0),(1,bevel),(1,1-bevel),(.95,1)],box['min'],box['max'],segments=12)
    faces += [tuple(reversed(range(12))),tuple(range(36,48))]
    return outward(vertices,faces)


def box_mesh(box):
    lo,hi=box['min'],box['max'];vertices=[(x,y,z) for z in (lo[2],hi[2]) for y in (lo[1],hi[1]) for x in (lo[0],hi[0])]
    return outward(vertices,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)])


def deck_collar(rect,bowl,z0,z1):
    """Closed rectangle with an exact48-edge opening around the original rim."""
    cx,cy=[(bowl['min'][a]+bowl['max'][a])/2 for a in (0,1)]
    rx,ry=[(bowl['max'][a]-bowl['min'][a])/2*.985 for a in (0,1)]
    polygon=[]
    for i in range(48):
        t=i*math.tau/48;c,s=math.cos(t),math.sin(t)
        polygon.append((rx*math.copysign(abs(c)**.4,c),ry*math.copysign(abs(s)**.4,s)))
    angles=[math.atan2(y,x)%math.tau for x,y in polygon]
    angles += [math.atan2(y-cy,x-cx)%math.tau for x in (rect[0],rect[1]) for y in (rect[2],rect[3])]
    angles=sorted(set(round(a,12) for a in angles));outer=[];inner=[]
    for t in angles:
        dx,dy=math.cos(t),math.sin(t)
        distances=[(bound-center)/direction for bound,center,direction in [(rect[0],cx,dx),(rect[1],cx,dx),(rect[2],cy,dy),(rect[3],cy,dy)] if abs(direction)>1e-10 and (bound-center)/direction>0]
        length=min(distances);outer.append((cx+length*dx,cy+length*dy))
        hits=[]
        for a,b in zip(polygon,polygon[1:]+polygon[:1]):
            ex,ey=b[0]-a[0],b[1]-a[1];den=dx*ey-dy*ex
            if abs(den)<1e-12:continue
            distance=(a[0]*ey-a[1]*ex)/den;u=(a[0]*dy-a[1]*dx)/den
            if distance>0 and -1e-8<=u<=1+1e-8:hits.append(distance)
        if not hits:raise ValueError('Cannot intersect original bowl rim')
        length=min(hits)
        if length>=min(distances):raise ValueError('Bowl opening escapes fitted counter deck')
        inner.append((cx+length*dx,cy+length*dy))
    n=len(angles);vertices=[(x,y,z) for z,ring in [(z0,outer),(z1,outer),(z0,inner),(z1,inner)] for x,y in ring];faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,n+j,n+i),(2*n+j,2*n+i,3*n+i,3*n+j),(j,i,2*n+i,2*n+j),(n+i,n+j,3*n+j,3*n+i)]
    return outward(vertices,faces),(cx,cy)


def sink_parts(rows):
    bowls=sorted([r for n,r in rows.items() if n.startswith('deep ')],key=lambda r:r['bounds']['min'][0])
    counter=[rows[n]['bounds'] for n in ('countertop-surface','countertop-surface.001','countertop-surface.002')]
    apron=rows['ceramic apron']['bounds'];rail=rows['apron support crossrail']['bounds']
    x0,x1=min(b['min'][0] for b in counter),max(b['max'][0] for b in counter)
    y0,y1=apron['min'][1],max(b['max'][1] for b in counter)
    z0,z1=counter[0]['min'][2],counter[0]['max'][2]-.0005
    plans=[]
    for i,row in enumerate(bowls):
        lo=x0 if i==0 else (bowls[i-1]['bounds']['max'][0]+row['bounds']['min'][0])/2
        hi=x1 if i==len(bowls)-1 else (row['bounds']['max'][0]+bowls[i+1]['bounds']['min'][0])/2
        geometry,center=deck_collar((lo,hi,y0,y1),row['bounds'],z0,z1)
        plans.append({'kind':'deck','name':'detail_fitted_sink_deck_'+str(i+1),'geometry':geometry,'materialRole':'countertop-surface','holeCenter':center})
    for i,side in enumerate([rows['full-height sink cabinet side']['bounds'],rows['full-height sink cabinet side.001']['bounds']]):
        left=i==0
        lo=side['min'][0]+.004 if left else apron['max'][0]-.002
        hi=apron['min'][0]+.002 if left else side['max'][0]-.004
        box={'min':[lo,rail['min'][1]+.002,rail['max'][2]-.005],
             'max':[hi,side['min'][1]+.009,z0+.002]}
        plans.append({'kind':'stile','name':'detail_fitted_sink_apron_stile_'+str(i+1),'geometry':box_mesh(box),'materialRole':'full-height sink cabinet side'})
    return plans


def _surface(obj,geometry,smooth=True):
    evidence=_curves['_replace'](obj,geometry,smooth_sides=False)
    for face in obj.data.polygons:face.use_smooth=smooth and len(face.vertices)==4
    return evidence


def validate_flute_state(vertex_count,spec,modifiers):
    # geometry.py measures evaluated80 vertices but deliberately retains the
    # original20 vertices plus a live modifier until export. Check both states.
    width=min(spec['bounds']['max'][a]-spec['bounds']['min'][a] for a in range(3))*.025
    if vertex_count!=spec['vertices'] or vertex_count!=20 or len(modifiers)!=1:
        raise ValueError('Expected original20-vertex flute with one frozen live bevel')
    modifier=modifiers[0]
    if modifier['name']!='Realism softened manufactured edge' or modifier['type']!='BEVEL' or modifier['segments']!=3 or abs(modifier['width']-width)>1e-7:
        raise ValueError('Frozen flute bevel settings changed')


def apply(root,scene,item,keys,names,specs):
    original=_curves['_objects'](scene,names);objects={};points={};changes=[]
    for spec in specs:
        reduced=spec['kind']=='flute-budget'
        obj,vertices=_curves['_checked'](original,spec,keys)
        if reduced:validate_flute_state(len(vertices),spec,[{'name':m.name,'type':m.type,'segments':getattr(m,'segments',None),'width':getattr(m,'width',None)} for m in obj.modifiers])
        objects[spec['name']]=obj;points[spec['name']]=vertices
    ident=item['id']
    if ident.startswith('designed-mirror-') or ident=='designed-coffee-glass' or ident.startswith('designed-sunroom-'):
        for spec in specs:
            if spec['kind']=='context':continue
            obj=objects[spec['name']];kind=spec['kind'];original_points=points[spec['name']]
            sides=spec['sides'];centers,radius=ring_centers(original_points,sides)
            if kind=='mirror':
                path=mirror_path(centers,ident.endswith('-arch'));normal=(0,1,0)
                geometry=sweep(path,radius,normal,closed=True,miter=True)
            elif kind=='coffee-arch':
                path=coffee_path(centers);delta=sub(path[-1],path[0]);normal=unit((-delta[1],delta[0],0))
                geometry=sweep(path,radius,normal,sides=20)
            else:
                normal=(1,0,0) if kind=='arm' else (0,1,0)
                path=rounded_path(centers);geometry=sweep(path,radius,normal,sides=16)
            geometry=(_curves['fit'](geometry[0],spec['bounds']),geometry[1])
            changes.append({'kind':'source-evidenced-construction','component':spec['name'],
                            'construction':'continuous measured planar sweep with stable cross-section orientation',
                            'sourceSectionCount':len(centers),'candidateSectionCount':len(path),'fixedPlaneNormal':normal,
                            **_surface(obj,geometry),'preserved':['original component envelope','original material keys and factors','all optical panels, source textures and unrelated construction']})
    elif ident=='decorative-bowl':
        body=next(s for s in specs if s['kind']=='bowl');radius=body['bounds']['max'][0]
        changes.append({'kind':'source-evidenced-construction','component':body['name'],'construction':'closed outer bottom and rounded continuous bowl wall with original88percent interior and20percent floor',**_surface(objects[body['name']],bowl_shell(body['bounds']))})
        for spec in specs:
            if spec['kind']!='bowl-flute':continue
            box=spec['bounds'];cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
            angle=math.atan2(cy,cx)
            geometry=bowl_flute(angle,radius,.17499999701976776,.11999999731779099)
            changes.append({'kind':'source-evidenced-construction','component':spec['name'],'construction':'round-ended exterior raised flute seated in bowl wall, without internal rod tips',**_surface(objects[spec['name']],geometry)})
    elif ident.startswith('designed-sink-'):
        rows={s['name']:s for s in specs}
        for plan in sink_parts(rows):
            obj=_fixtures['_add'](scene,names,plan['name'],plan['geometry'],objects[plan['materialRole']].data.materials[0],smooth=False)
            changes.append({'kind':'source-evidenced-construction','newComponent':names[obj.name],
                            'construction':'closed fitted counter collar around unchanged recessed bowl' if plan['kind']=='deck' else 'bounded cabinet stile closes the apron-to-side installation gap',
                            'boundsM':bounds(plan['geometry'][0]),'candidateTriangles':sum(len(f)-2 for f in plan['geometry'][1]),
                            'preserved':['all original basin geometry, drains and taps','countertop and cabinet independent material keys','original outer dimensions']})
    elif ident=='designed-dresser-fluted':
        for spec in specs:
            geometry=economical_flute(spec['bounds'])
            changes.append({'kind':'source-evidenced-construction','component':spec['name'],
                            'construction':'bounded twelve-sided rounded flute with two small end bevels and closed caps',
                            **_surface(objects[spec['name']],geometry),'preserved':['original flute extents and spacing','unchanged cabinet and drawer geometry','original lacquer color key']})
    else:raise ValueError('Unsupported designed collection refinement')
    return changes
