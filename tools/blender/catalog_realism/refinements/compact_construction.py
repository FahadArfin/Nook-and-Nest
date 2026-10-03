"""Source-measured desk supports, exposed trap and sewn hanging fabric."""
import math
from pathlib import Path
import runpy


def bounds(points):
    return {key:[fn(p[a] for p in points) for a in range(3)] for key,fn in [('min',min),('max',max)]}


def fit(points,box):
    old=bounds(points)
    return [tuple(box['min'][a]+(p[a]-old['min'][a])/max(1e-12,old['max'][a]-old['min'][a])*(box['max'][a]-box['min'][a]) for a in range(3)) for p in points]


def tube(path,radius=.015,sides=20,closed=False):
    vertices=[];faces=[]
    def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    def unit(v):
        length=math.sqrt(sum(x*x for x in v))
        if length<1e-10:raise ValueError('Collapsed tube frame')
        return tuple(x/length for x in v)
    for i,p in enumerate(path):
        a=path[(i-1)%len(path)] if closed else path[max(0,i-1)]
        b=path[(i+1)%len(path)] if closed else path[min(len(path)-1,i+1)]
        direction=unit(tuple(b[k]-a[k] for k in range(3)))
        axis=(1,0,0) if abs(direction[0])<.85 else (0,1,0)
        first=unit(cross(direction,axis));second=cross(direction,first)
        for j in range(sides):
            phase=j*math.tau/sides
            vertices.append(tuple(p[k]+radius*(math.cos(phase)*first[k]+math.sin(phase)*second[k]) for k in range(3)))
    for i in range(len(path) if closed else len(path)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%len(path))*sides+(j+1)%sides,((i+1)%len(path))*sides+j))
    if not closed:faces.extend([tuple(reversed(range(sides))),tuple((len(path)-1)*sides+j for j in range(sides))])
    return vertices,faces


def join(geometries):
    vertices=[];faces=[]
    for points,polygons in geometries:
        offset=len(vertices);vertices.extend(points);faces.extend(tuple(i+offset for i in face) for face in polygons)
    return vertices,faces


def trap_path():
    points=[(0,-.02,.701),(0,-.02,.572)]
    points += [(0,.03-.05*math.cos(i*math.pi/24),.572-.05*math.sin(i*math.pi/24)) for i in range(1,25)]
    points += [(0,.12-.04*math.cos(i*math.pi/32),.58+.04*math.sin(i*math.pi/32)) for i in range(17)]
    return points+[(0,.255,.62)]


def interpolated_profile(points,count=64):
    """Smooth monotone cubic interpolation through the inspected canopy stations."""
    slopes=[]
    for i in range(len(points)):
        slopes.append(tuple((points[min(len(points)-1,i+1)][a]-points[max(0,i-1)][a])/(1 if i in (0,len(points)-1) else 2) for a in range(3)))
    result=[]
    for j in range(count+1):
        u=j/count*(len(points)-1);i=min(int(u),len(points)-2);t=u-i
        result.append(tuple((2*t**3-3*t*t+1)*points[i][a]+(t**3-2*t*t+t)*slopes[i][a]+(-2*t**3+3*t*t)*points[i+1][a]+(t**3-t*t)*slopes[i+1][a] for a in range(3)))
    return result


def canopy(points,columns=16,rows=64):
    if len(points)!=22:raise ValueError('Expected two eleven-station canopy edges')
    left=interpolated_profile(points[:11],rows);right=interpolated_profile(points[11:],rows)
    vertices=[];faces=[]
    for back in (0,1):
        for r in range(rows+1):
            for c in range(columns+1):
                u=c/columns;t=r/rows
                point=[left[r][a]*(1-u)+right[r][a]*u for a in range(3)]
                point[2]-=.006*math.sin(math.pi*u)**2*math.sin(math.tau*t)**2+back*.0008
                vertices.append(tuple(point))
    n=(rows+1)*(columns+1)
    for r in range(rows):
        for c in range(columns):
            a=r*(columns+1)+c;face=(a,a+1,a+columns+2,a+columns+1)
            faces.extend([face,tuple(i+n for i in reversed(face))])
    edge=list(range(columns+1))+[r*(columns+1)+columns for r in range(1,rows+1)]+[rows*(columns+1)+c for c in range(columns-1,-1,-1)]+[r*(columns+1) for r in range(rows-1,0,-1)]
    faces += [(a,a+n,b+n,b) for a,b in zip(edge,edge[1:]+edge[:1])]
    return vertices,faces


def drapery_point(p,box):
    x,y,z=p;lo,hi=box['min'],box['max'];t=max(0,min(1,(z-lo[2])/(hi[2]-lo[2])))
    if t==0 or t==1:return tuple(p)
    # Preserve the original hem exactly, with a gentle growing lateral drape.
    offset=.012*math.sin(math.pi*t)*math.sin(6*x+1.3)
    x+=offset
    midpoint=(lo[1]+hi[1])/2
    y=midpoint+(y-midpoint)*(1-.18*math.sin(math.pi*t)**2)+.005*math.sin(math.pi*t)*math.sin(11*x+4*t)
    return (x,y,z)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Source differs from inspected construction')
    objects={names.get(o.name):o for o in scene.objects if o.type=='MESH'}
    expected={o['name']:o for o in evidence['objects']}
    for name,spec in expected.items():
        o=objects.get(name)
        if o is None or len(o.data.vertices)!=spec['vertices'] or o.data.shape_keys or o.get('motion_role') or o.get('shared_geometry'):raise ValueError('Static source changed: '+name)
        if [keys[m.name] if m else None for m in o.data.materials]!=spec['materials']:raise ValueError('Source material changed: '+name)
        box=bounds([tuple(o.matrix_world@v.co) for v in o.data.vertices])
        if any(abs(box[k][a]-spec['bounds'][k][a])>2e-6 for k in ('min','max') for a in range(3)):raise ValueError('Source bounds changed: '+name)
    helper=runpy.run_path(str(Path(__file__).with_name('silhouette_geometry.py')))
    changes=[]
    def points(name):return [tuple(objects[name].matrix_world@v.co) for v in objects[name].data.vertices]
    def replace(name,geometry,description,smooth=True):
        o=objects[name];vertices,faces=geometry;old=len(o.data.vertices);inverse=o.matrix_world.inverted()
        if sum(len(f)-2 for f in faces)>30000:raise ValueError('Per-part mesh budget exceeded')
        mesh=bpy.data.meshes.new(name+' fitted construction');mesh.from_pydata([inverse@Vector(v) for v in vertices],[],faces)
        for material in o.data.materials:mesh.materials.append(material)
        mesh.update()
        for face in mesh.polygons:face.use_smooth=smooth and len(face.vertices)<=4
        o.data=mesh
        for modifier in list(o.modifiers):o.modifiers.remove(modifier)
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,'sourceVertices':old,'candidateVertices':len(vertices),'candidateTriangles':sum(len(f)-2 for f in faces),'preserved':['catalog envelope and material keys','unrelated source components']})
    def map_part(name,fn,description):
        o=objects[name]
        replace(name,([fn(p) for p in points(name)],[tuple(p.vertices) for p in o.data.polygons]),description,False)
    def fit_part(name,box,description):
        o=objects[name];replace(name,(fit(points(name),box),[tuple(p.vertices) for p in o.data.polygons]),description,False)
    if item['id']=='console-vanity':
        pieces=[tube(trap_path())]
        pieces += [tube([(0,-.02,z0),(0,-.02,z1)],r,32) for z0,z1,r in [(.682,.7,.022),(.572,.589,.020)]]
        pieces += [tube([(0,y0,.62),(0,y1,.62)],r,32) for y0,y1,r in [(.15,.165,.02),(.247,.26,.026)]]
        vertices,faces=join(pieces)
        replace('Exposed polished P trap',(vertices,helper['outward'](vertices,faces)),'continuous swept P-trap under the drain with collars and wall escutcheon')
    elif item['id']=='compact-stroller':
        source=points('segmented fabric canopy');vertices,faces=canopy(source)
        replace('segmented fabric canopy',(vertices,helper['outward'](vertices,faces)),'smooth sewn canopy with a thin closed shell and restrained sag between three ribs')
        for index,name in enumerate(('canopy bound edge','canopy bound edge.001')):
            geometry=tube(interpolated_profile(source[index*11:(index+1)*11]),.0035,10)
            replace(name,geometry,'continuous curved sewn binding along the canopy edge')
    elif item['id']=='corner-desk':
        for name in ('powdercoated_box_section_leg.001','height_control_display','memory_key','memory_key.001','memory_key.002'):
            if name.startswith('powder'):map_part(name,lambda p:(p[0],p[1]-.45,p[2]),'right support moved beneath the main L worktop')
            else:map_part(name,lambda p:(p[0],p[1],p[2]+.010),'control attached to underside of the worktop')
        for name in ('steel_sled_foot.001','under_top_mount_plate.001'):
            box=bounds(points(name));box['min'][1]=-.70;box['max'][1]=-.20
            if name.startswith('under'):box['max'][2]=.705;box['min'][2]=.675
            fit_part(name,box,'right foot and mounting plate fit within main worktop depth')
        name='under_top_mount_plate';box=bounds(points(name));box['max'][2]=.705;fit_part(name,box,'left mount seated into the connected L slab')
        map_part('steel_cross_brace',lambda p:(p[0],p[1]-.18094843-.45*(p[0]+.684)/1.368,p[2]),'cross brace connects the offset left and right columns')
        name='rear_cable_trough';box=bounds(points(name));box['min'][1]=-.62;box['max'][1]=-.52;fit_part(name,box,'cable trough beneath the rear of the main slab')
        map_part('cable_grommet.001',lambda p:(p[0],p[1]-1.04,p[2]),'right grommet seated on solid tabletop instead of the open knee bay')
    elif item['id']=='curved-executive-desk':
        for name in ('under_top_mount_plate','under_top_mount_plate.001'):
            box=bounds(points(name));box['min'][1]=-.195;box['max'][1]=.195;box['max'][2]=.705
            fit_part(name,box,'mounting plate inset within oval top contour and seated into its underside')
        for name in ('height_control_display','memory_key','memory_key.001','memory_key.002'):
            map_part(name,lambda p:(p[0],p[1]+.095,p[2]+.010),'control panel attached beneath the curved front edge')
        box=bounds(points('shaped_slab_top'));box['min'][1]=-.425;box['max'][1]=.425
        vertices,faces=helper['lathe']([(0,0),(.994,0),(1,.08),(1,.92),(.994,1),(0,1)],box,128)
        replace('shaped_slab_top',(vertices,faces),'smooth oval slab edge with flat support surface')
        for f in objects['shaped_slab_top'].data.polygons:
            zs=[vertices[i][2] for i in f.vertices];f.use_smooth=max(zs)-min(zs)>1e-8
    elif item['id'] in ('curtain-blackout-pair','curtain-linen-pair'):
        cloth=points('weighted_wave_fold_drapery');box=bounds(cloth)
        for name in ('weighted_wave_fold_drapery','separate_blackout_lining'):
            if name not in objects:continue
            o=objects[name];replace(name,([drapery_point(p,box) for p in points(name)],[tuple(f.vertices) for f in o.data.polygons]),'gently varied folds with unchanged opening, hem and separate lining')
        # Rebuild the rings around the X-axis rod and connect hooks to each
        # inspected top pleat crest. Original rings incorrectly lay in XZ.
        rod=bounds(points('curtain_rod'));ring_box=bounds(points('curtain_hanging_ring'))
        cy=(rod['min'][1]+rod['max'][1])/2;cz=2.174
        top=[p for p in cloth if abs(p[2]-box['max'][2])<1e-6]
        if len(top)!=130:raise ValueError('Expected two 65-station curtain headers')
        pieces=[]
        for group in (top[:65],top[65:]):
            for index in range(2,65,8):
                x,y,z=group[index]
                pieces.append(tube([(x,cy+.021*math.cos(j*math.tau/32),cz+.021*math.sin(j*math.tau/32)) for j in range(32)],.003,8,True))
                pieces.append(tube([(x,cy,cz-.019),(x,cy,2.092),(x,y,z-.003)],.002,8))
        replace('curtain_hanging_ring',join(pieces),'sixteen rod-wrapping rings and connected header hooks')
        rod['min'][0]=ring_box['min'][0];rod['max'][0]=ring_box['max'][0]
        fit_part('curtain_rod',rod,'retain the full original width with rod ends spanning the outer hangers')
    else:raise ValueError('Unsupported inspected construction recipe')
    bpy.context.view_layer.update()
    return changes
