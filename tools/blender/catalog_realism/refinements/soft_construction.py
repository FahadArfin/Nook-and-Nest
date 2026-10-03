"""Bounded, source-evidenced cloth, blade and connected furniture corrections."""
import math
from pathlib import Path
import runpy


def bounds(points):
    return {side: [fn(p[a] for p in points) for a in range(3)]
            for side, fn in [('min', min), ('max', max)]}


def fit(points, box):
    old = bounds(points)
    return [tuple(box['min'][a] + (p[a]-old['min'][a]) /
                  max(1e-12, old['max'][a]-old['min'][a]) *
                  (box['max'][a]-box['min'][a]) for a in range(3)) for p in points]


def grass(points, box, steps=14):
    if len(points) not in (210, 415) or len(points) % 5:
        raise ValueError('Expected the two inspected five-vertex blade groups')
    vertices, faces = [], []
    for start in range(0, len(points), 5):
        old = points[start:start+5]
        base = [(old[0][a]+old[1][a])/2 for a in range(3)]
        shoulder = [(old[2][a]+old[3][a])/2 for a in range(3)]
        side = [(old[1][a]-old[0][a])/2 for a in range(3)]
        tip = old[4]
        offset = len(vertices)
        for i in range(steps):
            t = i/steps
            center = [(1-t)**2*base[a]+2*t*(1-t)*shoulder[a]+t*t*tip[a] for a in range(3)]
            width = (1-t)**.75
            for across in (-1, 0, 1):
                vertices.append(tuple(center[a]+side[a]*width*across +
                                      (.00035*width if a == 2 and across == 0 else 0) for a in range(3)))
        tip_index = len(vertices); vertices.append(tuple(tip))
        for i in range(steps-1):
            for j in range(2):
                n = offset+i*3+j
                faces.append((n, n+1, n+4, n+3))
        n = offset+(steps-1)*3
        faces += [(n, n+1, tip_index), (n+1, n+2, tip_index)]
    return fit(vertices, box), faces


def roman(box, columns=16, rows=140):
    """A closed thin cloth with seven rounded folds and gentle central sag."""
    lo, hi = box['min'], box['max']; vertices = []; faces = []
    for back in (0, 1):
        for row in range(rows+1):
            t = row/rows
            for col in range(columns+1):
                u = col/columns
                sag = .028*math.sin(math.pi*u)**2*math.sin(math.pi*t)
                wave = (1-math.cos(math.tau*7*t))/2
                vertices.append((lo[0]+u*(hi[0]-lo[0]),
                                 hi[1]-(hi[1]-lo[1])*.975*wave+back*.001,
                                 lo[2]+t*(hi[2]-lo[2])-sag))
    count = (rows+1)*(columns+1)
    for row in range(rows):
        for col in range(columns):
            n = row*(columns+1)+col
            face = (n, n+1, n+columns+2, n+columns+1)
            faces.append(face); faces.append(tuple(i+count for i in reversed(face)))
    border = list(range(columns+1))
    border += [r*(columns+1)+columns for r in range(1, rows+1)]
    border += [rows*(columns+1)+c for c in range(columns-1, -1, -1)]
    border += [r*(columns+1) for r in range(rows-1, 0, -1)]
    faces += [(a, a+count, b+count, b) for a,b in zip(border,border[1:]+border[:1])]
    return fit(vertices, box), faces


def braided_rows():
    """Three interlaced continuous strands per concentric oval row."""
    groups = [([], []) for _ in range(4)]
    for row in range(10):
        scale = .075 + row*.093
        group = 3 if row < 2 else 2 if row < 4 else 1 if row < 7 else 0
        vertices, faces = groups[group]
        for strand in range(3):
            offset = len(vertices)
            for i in range(64):
                a = i*math.tau/64; phase = a*8+strand*math.tau/3
                radial = .021*math.cos(phase)
                cx = (.8*scale+radial)*math.cos(a)
                cy = (.5*scale+radial)*math.sin(a)
                cz = .045+.006*math.sin(phase)
                for side in range(4):
                    p = side*math.tau/4
                    # Flattened cloth strands pack adjacent rows together;
                    # narrow circular ropes left conspicuous basket-like gaps.
                    width = .015 if row == 0 else .020
                    vertices.append((cx+width*math.cos(p)*math.cos(a),
                                     cy+width*math.cos(p)*math.sin(a), cz+.007*math.sin(p)))
            for i in range(64):
                for j in range(4):
                    faces.append((offset+i*4+j, offset+((i+1)%64)*4+j,
                                  offset+((i+1)%64)*4+(j+1)%4, offset+i*4+(j+1)%4))
    all_vertices = [v for vertices,_ in groups for v in vertices]
    old = bounds(all_vertices)
    for vertices,_ in groups:
        for i,(x,y,z) in enumerate(vertices):
            vertices[i] = (x,y,.025 + (z-old['min'][2])/(old['max'][2]-old['min'][2])*.04349999725818634)
    return groups


def tulip_profile():
    stations = [(0,0), (.96,0), (1,.014), (.99,.040), (.87,.071),
                (.63,.103), (.40,.162), (.245,.29), (.20,.48),
                (.205,.69), (.26,.86), (.40,.96), (.56,1), (0,1)]
    contour=stations[1:-1]
    intervals=[b[1]-a[1] for a,b in zip(contour,contour[1:])]
    slopes=[(b[0]-a[0])/h for a,b,h in zip(contour,contour[1:],intervals)]
    tangents=[slopes[0]]
    for i in range(1,len(contour)-1):
        before,after=slopes[i-1],slopes[i]
        if before*after<=0:tangents.append(0)
        else:
            first=2*intervals[i]+intervals[i-1];second=intervals[i]+2*intervals[i-1]
            tangents.append((first+second)/(first/before+second/after))
    tangents.append(slopes[-1])
    profile=[stations[0]]
    for i,(a,b) in enumerate(zip(contour,contour[1:])):
        for j in range(6):
            t=j/6;h=b[1]-a[1]
            radius=(2*t**3-3*t*t+1)*a[0]+(t**3-2*t*t+t)*h*tangents[i]
            radius+=(-2*t**3+3*t*t)*b[0]+(t**3-t*t)*h*tangents[i+1]
            profile.append((radius,a[1]+h*t))
    profile.extend([contour[-1],stations[-1]])
    return profile


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    if item['sourceBlend'] != evidence['sourceBlend']:
        raise ValueError('Original source differs from the inspected construction')
    objects = {names.get(o.name):o for o in scene.objects if o.type == 'MESH'}
    for spec in evidence['objects']:
        o = objects.get(spec['name'])
        if o is None or len(o.data.vertices) != spec['vertices'] or o.data.shape_keys or o.get('motion_role') or o.get('shared_geometry'):
            raise ValueError('Exact source construction changed: '+spec['name'])
        if [keys[m.name] if m else None for m in o.data.materials] != spec['materials']:
            raise ValueError('Source materials changed: '+spec['name'])
        box = bounds([tuple(o.matrix_world@v.co) for v in o.data.vertices])
        if any(abs(box[s][a]-spec['bounds'][s][a]) > 2e-6 for s in ('min','max') for a in range(3)):
            raise ValueError('Source bounds changed: '+spec['name'])
    helper = runpy.run_path(str(Path(__file__).with_name('silhouette_geometry.py')))
    def box_for(name):return bounds([tuple(objects[name].matrix_world@v.co) for v in objects[name].data.vertices])
    changes=[]
    def replace(name, geometry, description, smooth=True):
        o=objects[name]; vertices,faces=geometry; old=len(o.data.vertices); inv=o.matrix_world.inverted()
        if sum(len(f)-2 for f in faces)>18000:raise ValueError('Construction exceeds per-part triangle budget')
        mesh=bpy.data.meshes.new(name+' refined construction')
        mesh.from_pydata([inv@Vector(v) for v in vertices],[],helper['outward'](vertices,faces))
        for material in o.data.materials:mesh.materials.append(material)
        mesh.update()
        for face in mesh.polygons:
            face.use_smooth=smooth and (item['id'] in ('blue-fescue','blind-roman','braided-rug') or
                                       max(vertices[i][2] for i in face.vertices)-min(vertices[i][2] for i in face.vertices)>1e-8)
        o.data=mesh
        for modifier in list(o.modifiers):o.modifiers.remove(modifier)
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,
                        'sourceVertices':old,'candidateVertices':len(vertices),'candidateTriangles':sum(len(f)-2 for f in faces),
                        'preserved':['catalog envelope and material keys','unrelated original parts']})
    if item['id']=='blue-fescue':
        for name in ('arching_strap_blade','arching_strap_blade.001'):
            points=[tuple(objects[name].matrix_world@v.co) for v in objects[name].data.vertices]
            replace(name,grass(points,box_for(name)),'125 source-positioned curved tapered blades with folded midribs')
    elif item['id']=='blind-roman':
        replace('roman_shade_soft_fold',roman(box_for('roman_shade_soft_fold')),'continuous thin cloth, seven smooth folds and restrained central sag')
    elif item['id']=='braided-rug':
        for i,geometry in enumerate(braided_rows()):
            replace('braided_rug_layer_'+str(i),geometry,'continuous interlaced three-strand oval braids on the original connected backing')
    elif item['id']=='breakfast-tulip-table':
        top=box_for('shaped_slab_top');base=box_for('weighted_elliptic_foot')
        base['max'][2]=top['min'][2]+.006
        replace('weighted_elliptic_foot',helper['lathe'](tulip_profile(),base,64),'continuous flared tulip foot and stem seated inside top')
        obsolete=objects['sculpted_center_pedestal'];names.pop(obsolete.name,None);bpy.data.objects.remove(obsolete,do_unlink=True)
        profile=[(0,0),(.99,0),(1,.045),(1,.955),(.99,1),(0,1)]
        replace('shaped_slab_top',helper['lathe'](profile,top,96),'smooth circular slab with rounded rim and flat support face')
    elif item['id']=='bunk-bed':
        template=objects['bunk_guard_rail'];points=[tuple(template.matrix_world@v.co) for v in template.data.vertices]
        faces=[tuple(p.vertices) for p in template.data.polygons]
        boxes=[]
        for x in (-.462,.462):
            for z in (1.59,1.69):boxes.append({'min':[x-.025,-.894,z-.033],'max':[x+.025,.975,z+.033]})
        for z in (1.59,1.69):boxes.append({'min':[-.478,.939,z-.033],'max':[.478,.989,z+.033]})
        for index,box in enumerate(boxes):
            o=template.copy();o.data=template.data.copy();scene.collection.objects.link(o)
            name='upper bunk fitted guard '+str(index);o.name=name;names[o.name]=name;objects[name]=o
            replace(name,(fit(points,box),faces),'connected upper side/head guard rails with ladder-end opening',smooth=False)
    else:raise ValueError('Unsupported exact construction recipe')
    bpy.context.view_layer.update()
    return changes
