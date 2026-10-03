"""Source-attached rounded hydrangea organs and bounded concentric jute braid."""
from pathlib import Path
import math,runpy
_curves=runpy.run_path(str(Path(__file__).with_name('curved_construction.py')))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']

def rounded_organs(points,leaf):
    count=13 if leaf else 9;segments=24 if leaf else 16
    if not points or len(points)%count:raise ValueError('Original independent leaf/petal fan count changed')
    result=[];faces=[]
    for start in range(0,len(points),count):
        old=points[start:start+count];root=old[1];tip=old[7 if leaf else 5]
        axis=[tip[a]-root[a] for a in range(3)]
        side=[(old[4 if leaf else 3][a]-old[10 if leaf else 7][a])/2 for a in range(3)]
        normal=[(old[0][a]-root[a]-.52*axis[a])/.17 for a in range(3)]
        if min(math.dist(axis,(0,0,0)),math.dist(side,(0,0,0)))<.001:raise ValueError('Degenerate botanical organ')
        vertices=[tuple(old[0])]
        for i in range(segments):
            angle=i*math.tau/segments;x=(1-math.cos(angle))/2;y=math.sin(angle)
            if leaf:
                # Fine alternating marginal teeth replace four deep lobes.
                y*=.97 if i%2 else 1
            vertices.append(tuple(root[a]+axis[a]*x+side[a]*y+normal[a]*math.sin(x*math.pi)*.04 for a in range(3)))
        vertices=fit(vertices,bounds(old))
        # Keep the authored attachment, distal tip and raised midrib apex exact.
        vertices[0]=tuple(old[0]);vertices[1]=tuple(root);vertices[segments//2+1]=tuple(tip)
        offset=len(result);result+=vertices
        faces += [(offset,offset+i+1,offset+(i+1)%segments+1) for i in range(segments)]
    return result,faces

def jute_row(box,row):
    if row not in range(1,30):raise ValueError('Expected one of the original twenty-nine concentric rows')
    radius=(box['max'][0]-box['min'][0])/2-.004
    if abs(radius-row*.034)>2e-5:raise ValueError('Source jute row spacing changed')
    steps=max(24,3*round((24+96*radius/.986)/3));cycles=steps//3
    width=min(.0168,1-radius-.0003);points=[];faces=[]
    z0,z1=box['min'][2],box['max'][2];zc=(z0+z1)/2
    for strand in range(2):
        offset=len(points)
        for i in range(steps):
            angle=i*math.tau/steps;phase=angle*cycles+strand*math.pi
            center_radius=radius+width*.43*math.sin(phase)
            center_z=zc+(z1-z0)*.22*math.cos(phase)
            for side in range(3):
                p=side*math.tau/3
                r=center_radius+width*.57*math.cos(p)
                points.append((r*math.cos(angle),r*math.sin(angle),center_z+(z1-z0)*.23*math.sin(p)))
        for i in range(steps):
            for j in range(3):faces.append((offset+i*3+j,offset+((i+1)%steps)*3+j,offset+((i+1)%steps)*3+(j+1)%3,offset+i*3+(j+1)%3))
    # Preserve the top/bottom of the original authored woven row exactly.
    old=bounds(points)
    points=[(x,y,z0+(z-old['min'][2])/(old['max'][2]-old['min'][2])*(z1-z0)) for x,y,z in points]
    return outward(points,faces)

def apply(root,scene,item,keys,names,evidence):
    if item['id'] not in ('hydrangea-border','jute-rug') or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed botanical/textile source changed')
    objects=_curves['_objects'](scene,names);changes=[]
    for spec in evidence['objects']:
        obj,points=_curves['_checked'](objects,spec,keys)
        if item['id']=='hydrangea-border':
            leaf=spec['name'].startswith('veined_stem_leaves')
            mesh=rounded_organs(points,leaf)
            description='rounded ovate leaf with fine marginal teeth retaining raised midribs' if leaf else 'rounded cupped hydrangea sepal fan retaining all original flower cluster centers'
            extra={'independentOrgans':len(points)//(13 if leaf else 9),'outlineSegments':24 if leaf else 16,'preservedAttachments':True}
        else:
            row=spec['row'];mesh=jute_row(spec['bounds'],row)
            description='two continuous interlaced flattened jute strands in the original concentric row pattern'
            extra={'row':row,'preservedOriginalRowColor':True,'packedRowHalfWidthM':min(.0168,1-row*.034-.0003)}
        box=bounds(mesh[0]);envelope=evidence['bounds']
        if any(box[s][a]<envelope['min'][a]-1e-7 or box[s][a]>envelope['max'][a]+1e-7 for s in ('min','max') for a in range(3)):raise ValueError('Botanical/weave correction escaped source envelope')
        stats=_curves['_replace'](obj,mesh,smooth_sides=False)
        for face in obj.data.polygons:face.use_smooth=True
        changes.append({'kind':'source-evidenced-construction','component':spec['name'],'construction':description,**stats,**extra})
    return changes
