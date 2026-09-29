"""Original household collection HOME-058..071, millimetre editable construction.

create(id, palette) only authors parts in the caller's owned active scene. It does
not clear scenes, export, render, or save. The collection harness owns those steps.
"""
import math
import bpy, bmesh
from mathutils import Vector, Matrix
from build_kitchen_essentials import B, C, mesh, tube, ring, lathe, material
from studio_geometry import text

IDS = ['adjustable-ceiling-track-light','ceiling-fan-with-light','porch-wall-lantern',
       'under-cabinet-light-bar','vertical-patio-door-blinds','potted-monstera-deliciosa',
       'potted-snake-plant','trailing-pothos-in-shelf-pot','acoustic-guitar-on-stand',
       'desk-monitor-arm','compact-paper-printer','compact-digital-piano',
       'desktop-sewing-machine','office-filing-cabinet','compact-piano-bench']


def poly_solid(name, outline, depth, mat, plane='XY', center=(0,0,0), bevel=0):
    """Extruded shaped construction, with actual front/back/edge surfaces."""
    n=len(outline);v=[]
    for d in [-depth/2,depth/2]:
        for a,b in outline:
            co=(a,b,d) if plane=='XY' else (a,d,b)
            v.append(tuple(co[i]+center[i] for i in range(3)))
    fs=[tuple(reversed(range(n))),tuple(range(n,n*2))]
    fs += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh(name,v,fs,mat)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    if bevel:
        bpy.context.view_layer.objects.active=o
        m=o.modifiers.new('Soft shaped edge','BEVEL');m.width=bevel;m.segments=2
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def place_group(before, position, direction):
    q=Vector((0,0,1)).rotation_difference(Vector(direction).normalized())
    t=Matrix.Translation(Vector(position))@q.to_matrix().to_4x4()
    for o in bpy.context.scene.objects:
        if o not in before:o.matrix_world=t@o.matrix_world


def lighting(cid,M):
    glow=material('household-warm-opal-diffuser',(.91,.68,.36),.45,0,1,.5)
    brass=M['brass'];dark=M['dark']
    if cid=='adjustable-ceiling-track-light':
        B('Extruded two-channel ceiling track',(0,0,247),(1100,36,26),dark,4)
        B('Recessed electrical track seam',(0,-19,247),(1050,2,7),M['rubber'],.5)
        for x in [-525,525]:B('Removable track end cap',(x,0,247),(50,40,28),M['steel'],3)
        for x in [-400,400]:
            B('Ceiling mounting saddle',(x,0,262),(66,44,7),dark,2)
            for dx in [-22,22]:C('Mounting screw',(x+dx,0,266),3,2,M['steel'],s=12)
        for i,x in enumerate([-400,0,400]):
            B('Sliding power adapter %d'%i,(x,0,223),(75,42,22),dark,3)
            C('Head pivot vertical stem',(x,0,200),9,28,brass,s=20)
            C('Head tilt collar',(x,0,182),16,50,dark,axis='Y',s=24)
            before=set(bpy.context.scene.objects)
            lathe('Hollow reflector housing %d'%i,[(28,0),(38,6),(39,115),(36,122),(32,122),(30,113),(27,15)],dark,40)
            C('Recessed warm LED optic',(0,0,117),29,3,glow,s=40)
            ring('Lens retaining ring',(0,0,121),33,2.5,brass,steps=40)
            for z in [8,15,22]:ring('Cooling ridge',(0,0,z),38,1.2,dark,steps=32)
            place_group(before,(x,0,176),((-.38,.34,.25)[i],(-.28,-.1,.33)[i],-1))
    elif cid=='ceiling-fan-with-light':
        C('Flush ceiling canopy',(0,0,278),98,42,dark,s=48)
        lathe('Layered motor casing',[(0,242),(108,242),(134,211),(138,176),(123,160),(0,160)],dark,64)
        ring('Brass motor seam',(0,0,175),135,3,brass)
        lathe('Opal bowl diffuser',[(0,90),(48,93),(84,108),(101,134),(103,154),(98,160),(0,160)],glow,64)
        for i in range(4):
            a=i*math.tau/4+.18
            points=[(95,-30),(230,-53),(472,-70),(551,-45),(558,34),(503,60),(230,48),(95,26)]
            o=poly_solid('Shaped pitched timber blade %d'%i,points,9,M['wood'],center=(0,0,192),bevel=3)
            o.rotation_euler.z=a;o.rotation_euler.x=math.radians(4)
            arm=poly_solid('Cast blade iron %d'%i,[(74,-20),(200,-23),(227,-9),(227,9),(200,23),(74,20)],8,brass,center=(0,0,183),bevel=3);arm.rotation_euler.z=a
            for r in [182,210]:C('Blade iron fixing',(r*math.cos(a),r*math.sin(a),191),4,4,M['steel'],s=12)
    elif cid=='porch-wall-lantern':
        B('Wall fixing backplate',(0,100,200),(115,20,240),dark,12)
        tube('Swept cantilever wall arm',[(0,90,255),(0,53,282),(0,-17,282),(0,-28,268)],10,brass,10)
        for z in [20,250]:B('Lantern frame perimeter plate',(0,-24,z),(176,146,12),dark,5)
        for x in [-80,80]:
            for y in [-89,41]:B('Glazing corner mullion',(x,y,136),(11,11,222),dark,2)
        # Four single panes, with separate frame and opaque socket/bulb inside.
        for x in [-79,79]:B('Side glass pane',(x,-24,136),(2,120,210),M['glass'],0)
        for y in [-88,40]:B('Front rear glass pane',(0,y,136),(150,2,210),M['glass'],0)
        mesh('Four pitched roof panels',[(-96,-108,256),(96,-108,256),(96,60,256),(-96,60,256),(0,-24,300)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],dark)
        C('Roof finial',(0,-24,308),9,20,brass,s=20)
        C('Lamp holder',(0,-24,45),20,36,brass,s=24)
        lathe('Original pear shaped bulb',[(0,61),(11,61),(15,81),(27,101),(30,126),(23,149),(0,158)],glow,40,center=(0,-24,0))
        for z in [58,62,66]:ring('Bulb base screw',(0,-24,z),14,1,M['steel'],steps=24)
        for z in [126,274]:C('Backplate fixing',(0,88,z),4,3,brass,axis='Y',s=12)
    else:
        B('Slim aluminium channel',(0,0,12),(600,32,20),M['steel'],3)
        B('Recessed underside diffuser',(0,-1,2),(560,25,3),glow,1)
        for x in [-292,292]:B('Polymer end cap',(x,0,11),(16,34,22),dark,2)
        for x in [-225,225]:
            B('Screw on mounting clip',(x,0,24),(32,40,6),dark,1)
            for y in [-15,15]:C('Clip screw',(x,y,27),2.5,2,M['steel'],s=12)
        B('Inline power socket',(279,0,12),(7,15,8),M['rubber'],1)
        C('Small switch',(255,-17,12),4,3,dark,axis='Y',s=16)


def blinds(M):
    B('Two metre valance',(0,0,2175),(2000,85,50),M['cream'],4)
    B('Open carrier track',(0,-12,2145),(1940,26,12),M['steel'],1)
    for i in range(20):
        x=-920+i*94
        C('Individual vane carrier',(x,-12,2136),5,20,M['dark'],s=12)
        o=B('Weighted linen vertical vane %02d'%i,(x,0,1080),(89,4,2085),M['fabric'],1)
        o.rotation_euler.z=math.radians(30)
        o=B('Sewn weighted hem %02d'%i,(x,0,48),(89,6,18),M['cream'],1);o.rotation_euler.z=math.radians(30)
    tube('Twist wand',[(-957,-38,2117),(-965,-42,2020),(-972,-51,1420)],4,M['cream'],8)
    C('Wand lower grip',(-972,-51,1400),6,42,M['cream'],s=16)
    for x in [-835,835]:B('Wall stand off bracket',(x,47,2150),(75,40,35),M['steel'],2)


def plant_palette():
    return dict(leaf=material('household-botanical-deep-green',(.020,.10,.045),.87),
                light=material('household-botanical-young-green',(.045,.16,.055),.86),
                vein=material('household-botanical-veins',(.09,.19,.065),.89),
                gold=material('household-botanical-golden-bands',(.19,.25,.07),.9),
                stripe=material('household-snake-muted-mottling',(.050,.145,.071),.88),
                soil=material('household-potting-soil',(.066,.038,.018),1))


def pot(r,h,M,P):
    lathe('Hollow hand thrown ceramic pot',[(0,4),(r*.7,4),(r*.73,0),(r*.82,4),(r,h-10),(r-2,h),(r-10,h),(r-12,h-12),(r*.72,15),(0,15)],M['clay'],48)
    C('Visible inset potting soil',(0,0,h-19),r-15,8,P['soil'],s=48)
    ring('Raised pot rim',(0,0,h-7),r-2,4,M['clay'],steps=48)
    for i in range(15):
        a=i*2.399;r0=r*(.2+.5*((i*17)%13)/13)
        C('Small irregular soil aggregate',(r0*math.cos(a),r0*math.sin(a),h-13),3+(i%3),3,P['soil'],s=5)


def broad_leaf(name,base,direction,width,length,P,split=False,young=False):
    """Cordate blade, natural marginal lobes and rounded genuine fenestration.

    Tessellate a curved heart silhouette then subdivide each triangle once before
    folding it in 3D. Closed elliptical cutters create smooth bounded openings;
    no missing rectangular grid cells or opaque leaf cards are used.
    """
    from mathutils.geometry import tessellate_polygon
    base=Vector(base);axis=Vector(direction).normalized();side=axis.cross(Vector((0,0,1)))
    if side.length<.05:side=Vector((1,0,0))
    side.normalize();normal=side.cross(axis).normalized()
    count=84 if split else 32
    outline=[]
    for i in range(count):
        a=i*math.tau/count
        x=width*.5*math.sin(a)**3
        t=(5-(13*math.cos(a)-5*math.cos(2*a)-2*math.cos(3*a)-math.cos(4*a)))/22
        if split and .08<t<.93:
            # Narrow rounded incisions leave tapered natural lobes and a broad
            # connected inner blade. Left/right cuts intentionally differ.
            depth=sum(.69*math.exp(-((t-(c+(.012 if x>0 else -.012)))/.022)**2) for c in [.25,.42,.59,.76])
            x*=max(.22,1-depth)
        x*=1+.032*math.sin(a*3+.4)
        outline.append(Vector((x,t,0)))
    def point(x,t,lift=0):
        s=2*x/width
        fold=width*.075*(1-s*s)*math.sin(math.pi*max(0,t))-length*.20*t*t
        fold+=width*.018*s*math.sin(t*7+.3)
        return base+axis*(length*t)+side*x+normal*(fold+lift)
    verts=[];faces=[];cache={}
    def vertex(p):
        k=(round(p.x,7),round(p.y,7))
        if k not in cache:cache[k]=len(verts);verts.append(point(p.x,p.y))
        return cache[k]
    for triangle in tessellate_polygon([outline]):
        # Current Blender returns flattened vertex indices; earlier mathutils
        # builds returned the input Vectors. Normalize before interpolation.
        a,b,c=(p if hasattr(p,'x') else outline[int(p)] for p in triangle)
        ab=(a+b)/2;bc=(b+c)/2;ca=(c+a)/2
        for tri in [(a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)]:faces.append(tuple(vertex(p) for p in tri))
    o=mesh(name,verts,faces,P['light'] if young else P['leaf'])
    # Consistent normals matter for the boolean on this thin curved solid.
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    bpy.context.view_layer.objects.active=o
    solid=o.modifiers.new('Actual folded leaf thickness','SOLIDIFY');solid.thickness=max(.65,width*.004)
    bpy.ops.object.modifier_apply(modifier=solid.name)
    if split:
        cutverts=[];cutfaces=[];steps=16
        for sign in [-1,1]:
            for j,t in enumerate([.17,.335,.51]):
                cx=sign*width*(.17+.022*j);center=point(cx,t)
                rx=width*(.039 if j!=1 else .048);ry=length*(.041+.007*j)
                start=len(cutverts)
                for end in [-1,1]:
                    for k in range(steps):
                        a=k*math.tau/steps
                        cutverts.append(center+side*(rx*math.cos(a))+axis*(ry*math.sin(a))+normal*(end*width*.35))
                cutfaces.extend([(start+k,start+(k+1)%steps,start+steps+(k+1)%steps,start+steps+k) for k in range(steps)])
                cutfaces.extend([tuple(reversed(range(start,start+steps))),tuple(range(start+steps,start+2*steps))])
        cutter=mesh(name+' smooth window cutters',cutverts,cutfaces,P['leaf'])
        bm=bmesh.new();bm.from_mesh(cutter.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(cutter.data);bm.free()
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Rounded inner fenestration','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    for f in o.data.polygons:f.use_smooth=True
    mid=11 if split else 7
    tube(name+' curved midrib',[point(0,i/mid,.65) for i in range(mid+1)],max(.45,width*.003),P['vein'],5)
    for t in ([.12,.29,.46,.63,.80] if split else [.23,.52]):
        for sign in [-1,1]:
            tube(name+' fine lateral vein',[point(0,t,.7),point(sign*width*.15,t+.04,.8),point(sign*width*.32,t+.08,.6)],max(.25,width*.0013),P['vein'],4)
    return o


def plants(cid,M):
    P=plant_palette()
    if cid=='potted-monstera-deliciosa':
        pot(175,300,M,P)
        specs=[(i*2.399,485+(i*127)%480,280+(i%3)*26,325+(i%4)*18) for i in range(11)]
        specs += [(i*2.13+.7,365+i*155,145+i*18,200+i*19) for i in range(4)]
        for i,(a,z,w,l) in enumerate(specs):
            r=72+(i%4)*21;base=(math.cos(a)*r,math.sin(a)*r,z)
            tube('Curving Monstera petiole %d'%i,[(math.cos(a)*31,math.sin(a)*31,276),(math.cos(a)*r*.28,math.sin(a)*r*.28,295+(z-295)*.56),base],6.3-(i%3)*.65,P['leaf'],8)
            broad_leaf('Lobed fenestrated Monstera leaf %d'%i,base,(math.cos(a)*.9,math.sin(a)*.9,.25-(i%4)*.16),w,l,P,split=i<11,young=i>=11)
        for a,z in [(1.3,675),(3.8,825),(5.1,553)]:tube('Curved aerial supporting root',[(24*math.cos(a),24*math.sin(a),z),(52*math.cos(a+.2),52*math.sin(a+.2),z*.64),(64*math.cos(a),64*math.sin(a),307)],4,M['endgrain'],7)
    elif cid=='potted-snake-plant':
        pot(130,240,M,P)
        for i in range(17):
            a=i*2.399;r=21+(i%4)*18;h=340+(i*79)%480;w=33+(i%4)*7;n=32;m=4
            origin=Vector((r*math.cos(a),r*math.sin(a),220));side=Vector((math.cos(a+.4),math.sin(a+.4),0));normal=Vector((-math.sin(a+.4),math.cos(a+.4),0));vs=[]
            for j in range(n+1):
                t=j/n;ww=w*math.sin(math.pi*(.11+.89*t))**.46/2
                for k in range(m+1):
                    s=-1+2*k/m
                    # Slightly uneven cross-blade levels give mottled wavy bands
                    # without the old giant checkerboard rectangles.
                    zz=h*t+3*math.sin(s*2.6+i*.71+j*.6)*math.sin(math.pi*t)
                    vs.append(origin+side*(s*ww+(18+(i%3)*7)*t*t)+normal*(19*math.sin(t*1.4+i*.35)*t+6*(1-s*s)*math.sin(math.pi*t))+Vector((0,0,zz)))
            fs=[(j*(m+1)+k,j*(m+1)+k+1,(j+1)*(m+1)+k+1,(j+1)*(m+1)+k) for j in range(n) for k in range(m)]
            o=mesh('Curved thick snake blade %02d'%i,vs,fs,P['leaf']);o.data.materials.append(P['stripe'])
            for f in o.data.polygons:
                row=f.index//m;col=f.index%m
                f.material_index=1 if (row+i*2)%7 in [1,2] and not (col==i%4 and row%3==0) else 0
                f.use_smooth=True
            bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Succulent blade thickness','SOLIDIFY');mod.thickness=3.4;bpy.ops.object.modifier_apply(modifier=mod.name)
            for k in [0,m]:tube('Restrained golden snake margin',[vs[j*(m+1)+k] for j in range(n+1)],1.05,P['gold'],4)
    else:
        pot(90,155,M,P)
        pot_parts=set(bpy.context.scene.objects)
        for i in range(6):
            a=i*2.399;pts=[];hang=270+(i%3)*38
            for j in range(9):
                t=j/8;r=20+(120+(i%2)*20)*t
                aa=a+.14*math.sin(t*4+i)
                pts.append((math.cos(aa)*r,math.sin(aa)*r,141+70*math.sin(t*math.pi)-hang*t*t))
            tube('Curving trailing pothos vine %d'%i,pts,2.5,P['light'],6)
            for j in range(2,9):
                p=Vector(pts[j]);ang=a+(-.85 if j%2 else .82)
                direction=(math.cos(ang),math.sin(ang),-.3-(j/8)*.35)
                stem=p+Vector(direction)*12
                tube('Alternate pothos petiole',[p,stem],1.35,P['light'],5)
                broad_leaf('Cordate pothos leaf %d %d'%(i,j),stem,direction,48+(8-j)*2.3,65+(8-j)*3.1,P,young=j>=7 or (i+j)%5==0)
        for i in range(12):
            a=i*2.399;r=12+(i%3)*17;z=145+(i%4)*12;base=(r*math.cos(a),r*math.sin(a),z)
            tube('Crown pothos petiole',[(0,0,141),base],1.7,P['light'],5)
            broad_leaf('Full crown heart pothos leaf %d'%i,base,(math.cos(a),math.sin(a),.45+(i%3)*.16),61+(i%3)*9,79+(i%3)*10,P,young=i%4==0)
        # Trailing foliage arches around a small pedestal, rather than passing
        # through its board. Preserve the upper crown and pot exactly. A
        # monotonic radial map retains nonzero lamina/tube thickness, unlike a
        # hard radius clamp. The export driver measures the final clear zone.
        for obj in set(bpy.context.scene.objects)-pot_parts:
            if obj.type!='MESH':continue
            for vertex in obj.data.vertices:
                p=vertex.co;r=math.hypot(p.x,p.y)
                if p.z>=145 or r<.001 or r>=180:continue
                t=max(0,min(1,(145-p.z)/100));blend=t*t*(3-2*t)
                target_radius=150+r/6
                scale=1+blend*(target_radius/r-1)
                p.x*=scale;p.y*=scale
            obj.data.update()
        bpy.context.scene['household_support_plane_mm']=0.0
        bpy.context.scene['household_support_kind']='pot bottom; foliage hangs below support'
        bpy.context.scene['household_support_center_mm']=[0.0,0.0,0.0]
        bpy.context.scene['household_support_footprint_mm']=[131.4,131.4]
        bpy.context.scene['household_support_footprint_shape']='circle'
        bpy.context.scene['household_hanging_clear_radius_mm']=145.0


def guitar(M):
    # Tripod stand remains separate named source geometry from the instrument.
    for x,y in [(-292,-250),(292,-250),(0,265)]:
        tube('Stand splayed tubular foot',[(0,90,280),(x*.35,90+(y-90)*.35,140),(x,y,16)],15,M['dark'],10)
        B('Non slip tripod boot',(x,y,15),(65,45,30),M['rubber'],8)
    tube('Telescopic instrument support',[(0,90,135),(0,90,880)],16,M['dark'],12)
    C('Telescopic height collar',(0,90,685),24,32,M['dark'],s=24)
    B('Height lock lever',(29,90,685),(27,18,13),M['brass'],3)
    tube('Padded neck yoke',[(-38,-14,900),(-40,44,900),(0,65,900),(40,44,900),(38,-14,900)],10,M['rubber'],10)
    # Outline is a dreadnought-shaped waist, broad lower bout and narrow shoulder.
    side=[(0,105),(82,110),(156,146),(200,208),(206,280),(172,345),(125,378),(136,430),(178,482),(175,542),(138,580),(66,596),(0,594)]
    outline=side+[(-x,z) for x,z in reversed(side[1:-1])]
    back=poly_solid('Guitar solid mahogany back',outline,6,M['endgrain'],'XZ',(0,56,0),2)
    n=len(outline);vs=[(x,y,z) for y in [-54,53] for x,z in outline]
    mesh('Guitar curved hollow body sides',vs,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],M['wood'])
    top=poly_solid('Spruce soundboard with real sound hole',outline,5,M['wood2'],'XZ',(0,-57,0),1)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=48,depth=18,location=(0,-57,453),rotation=(math.pi/2,0,0))
    cutter=bpy.context.object;bpy.context.view_layer.objects.active=top
    mod=top.modifiers.new('Open acoustic sound hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    for y in [-59,58]:tube('Ivory body edge binding',[(x,y,z) for x,z in outline]+[(outline[0][0],y,outline[0][1])],2,M['cream'],6)
    for r in [49,54,58]:ring('Layered rosette',(0,-60,453),r,1.2,M['dark'],axis='Y',steps=64)
    B('Mahogany neck',(0,0,792),(46,40,395),M['endgrain'],7)
    B('Ebony fingerboard',(0,-24,785),(49,7,387),M['dark'],2)
    poly_solid('Angled peg head',[(-27,980),(27,980),(36,1106),(25,1130),(-25,1130),(-36,1106)],23,M['endgrain'],'XZ',(0,0,0),4)
    B('Rosewood bridge',(0,-65,300),(146,11,32),M['endgrain'],5)
    B('Ivory saddle',(0,-72,308),(78,4,5),M['cream'],1)
    B('Ivory nut',(0,-30,980),(48,7,4),M['cream'],1)
    for i in range(6):
        x=-19+i*7.6;tube('Steel acoustic string %d'%i,[(x,-73,308),(x,-62,590),(x,-30,980),(x,-18,1030+i%3*32)],.35+i*.05,M['steel'],5)
        C('Bridge pin',(x,-73,292),2.2,4,M['cream'],axis='Y',s=10)
    for i in range(19):
        z=980-650*(1-2**(-(i+1)/12))
        tube('Fret wire %02d'%i,[(-24,-29,z),(24,-29,z)],.8,M['steel'],6)
        if i in [2,4,6,8,11,14,16]:C('Fingerboard position inlay',(0,-29.5,z+8),2,1,M['cream'],axis='Y',s=12)
    for side in [-1,1]:
        for i in range(3):
            z=1016+i*37;C('Tuning machine barrel',(side*27,0,z),6,22,M['steel'],axis='Y',s=16)
            tube('Tuner axle',[(side*29,0,z),(side*46,0,z)],3,M['steel'],6)
            B('Tuning key',(side*50,0,z),(14,8,20),M['steel'],4)


def monitor_arm(M):
    B('Clamp upper rubber pad',(-180,65,3),(82,95,6),M['rubber'],3)
    B('Clamp upper steel saddle',(-180,65,14),(90,100,17),M['dark'],4)
    B('Desk edge clamp spine',(-180,116,-25),(86,12,88),M['dark'],3)
    B('Clamp lower lip',(-180,83,-66),(86,78,10),M['dark'],3)
    C('Clamp tightening screw',(-180,63,-49),6,52,M['steel'],s=16)
    C('Clamp pressure disc',(-180,63,-25),23,6,M['rubber'],s=24)
    tube('Clamp T handle',[(-213,63,-76),(-147,63,-76)],5,M['dark'],8)
    C('Vertical mounting post',(-180,65,133),16,230,M['steel'],s=24)
    C('Post collar',(-180,65,225),29,42,M['dark'],s=32)
    links=[((-180,65,230),(5,13,340)),((5,13,340),(190,-46,407))]
    for i,(p,q) in enumerate(links):
        tube('Articulated cast arm %d'%i,[p,q],22,M['dark'],8)
        tube('Inset cable channel %d'%i,[(p[0],p[1]+20,p[2]),(q[0],q[1]+20,q[2])],6,M['rubber'],6)
        C('Pivot collar %d'%i,p,30,46,M['steel'],axis='Y',s=24)
    C('Screen tilt pivot',(190,-46,407),27,55,M['steel'],axis='X',s=24)
    B('VESA mounting plate',(190,-74,407),(115,8,115),M['dark'],7)
    for x in [140,240]:
        for z in [357,457]:C('VESA fixing recess',(x,-79,z),4,1,M['steel'],axis='Y',s=12)
    tube('Looped display cable',[(-180,88,150),(-175,94,233),(-14,55,319),(14,45,356),(155,-20,416),(178,-52,404)],3,M['rubber'],6)
    bpy.context.scene['household_support_plane_mm']=0.0
    bpy.context.scene['household_support_kind']='clamp upper pad underside; align at desk edge'
    bpy.context.scene['household_support_center_mm']=[-180.0,65.0,0.0]
    bpy.context.scene['household_support_footprint_mm']=[82.0,95.0]
    bpy.context.scene['household_support_footprint_shape']='rectangle'


def printer(M):
    for x in [-170,170]:
        for y in [-145,145]:B('Printer isolation foot',(x,y,8),(34,34,16),M['rubber'],5)
    B('Scanner and paper chassis',(0,5,96),(420,335,170),M['dark'],18)
    B('Scanner lid seam',(0,4,189),(411,333,8),M['rubber'],5)
    B('Flat hinged scanner lid',(0,4,203),(414,337,24),M['sage'],10)
    for x in [-142,142]:B('Scanner lid hinge',(x,169,191),(47,19,38),M['dark'],5)
    B('Recessed sheet exit shadow',(-37,-164,96),(274,4,43),M['rubber'],2)
    B('Separate output tray',(-37,-178,76),(277,71,8),M['dark'],4)
    B('Paper drawer front',(-39,-170,42),(298,14,44),M['sage'],5)
    B('Drawer finger recess',(-39,-178,44),(93,2,13),M['dark'],4)
    B('Control panel surround',(-85,-177,148),(174,21,49),M['sage'],6)
    B('Small original status display',(-126,-189,152),(53,2,22),M['light'],2)
    text('Printer display text','READY',(-126,-191,152),7,M['dark'])
    for x in [-73,-52,-31]:C('Printer button',(x,-191,151),5,3,M['cream'],axis='Y',s=16)
    for i in range(4):
        x=139+i*14;B('Visible ink tank window',(x,-168,101),(9,3,70),M['glass'],2)
        B('Ink level',(x,-170,80),(6,1,24+i*7),[M['dark'],M['blue'],M['clay'],M['cream']][i],0)
    for i in range(9):B('Rear ventilation slot',(210,20+i*12,116),(1,5,40),M['rubber'],1)
    B('Rear USB socket',(108,174,68),(13,3,12),M['rubber'],1)
    B('Rear power inlet',(152,174,68),(25,3,14),M['rubber'],2)


def piano(M):
    for x in [-654,654]:
        B('Full height cabinet side',(x,17,385),(36,300,730),M['wood'],5)
        B('Stabilizing foot',(x,0,18),(54,350,36),M['dark'],6)
        for y in [-145,145]:C('Adjustable rubber foot',(x,y,5),15,10,M['rubber'],s=16)
    B('Keyboard support chassis',(0,-10,651),(1290,305,112),M['wood'],5)
    B('Instrument rear cabinet',(0,135,723),(1290,55,114),M['wood'],4)
    B('Retracted folding key cover',(0,82,767),(1288,52,20),M['wood2'],3)
    B('Music page retaining ledge',(0,52,778),(1140,14,12),M['wood2'],2)
    B('Key bed shadow',(0,-47,711),(1239,226,15),M['dark'],2)
    # Exactly 52 white and 36 black keys, A0 through C8.
    white_pitch=[p for p in range(21,109) if p%12 in [0,2,4,5,7,9,11]]
    white_x={p:-601.8+i*23.6 for i,p in enumerate(white_pitch)}
    for p,x in white_x.items():B('Ivory piano key MIDI %d'%p,(x,-52,729),(23.1,203,27),M['cream'],1.2)
    for p in range(21,109):
        if p%12 in [1,3,6,8,10]:
            x=(white_x[p-1]+white_x[p+1])/2
            B('Ebony piano key MIDI %d'%p,(x,-11,751),(13.5,125,25),M['dark'],1.5)
    B('Pedal rail',(0,65,88),(1260,70,110),M['wood'],5)
    for x in [-70,0,70]:
        tube('Pedal stem',[(x,45,80),(x,-45,47)],8,M['brass'],8)
        B('Separate piano pedal',(x,-67,41),(30,89,14),M['brass'],6)
    B('Left control panel',(-630,-44,735),(30,164,16),M['dark'],2)
    for y in [-94,-70,-46]:C('Piano function button',(-630,y,745),5,3,M['cream'],s=12)
    B('Power connector recess',(510,165,635),(35,3,18),M['rubber'],2)


def bench(M):
    B('Tailored padded piano bench',(0,0,469),(580,330,62),M['fabric'],20)
    B('Bench storage apron',(0,0,416),(550,303,65),M['wood'],4)
    for x in [-235,235]:
        for y in [-113,113]:B('Square tapered bench leg',(x,y,201),(38,38,402),M['wood'],4)
    for x in [-100,100]:
        for y in [-60,60]:C('Soft bench tuft',(x,y,501),6,2,M['dark'],s=12)


def sewing(M):
    B('Extended quilting table',(-48,0,51),(520,310,24),M['sage'],7)
    for x in [-275,180]:
        for y in [-129,129]:B('Short extension table foot',(x,y,21),(26,26,42),M['dark'],4)
    B('Machine lower bed',(38,22,86),(346,192,51),M['cream'],13)
    B('Right drive column',(151,30,173),(108,165,202),M['cream'],20)
    B('Overhanging needle arm',(30,30,266),(320,157,80),M['cream'],20)
    B('Needle head housing',(-112,15,225),(66,150,123),M['cream'],16)
    B('Steel needle plate',(-97,-5,114),(89,90,3),M['steel'],2)
    B('Translucent bobbin hatch',(-95,-39,116),(41,28,2),M['glass'],2)
    C('Needle bar',(-112,-34,174),3,113,M['steel'],s=12)
    C('Presser foot shaft',(-98,-20,149),3,62,M['steel'],s=12)
    for x in [-103,-92]:B('Separate slotted presser foot',(x,-32,122),(5,29,5),M['steel'],1)
    B('Needle plate feed dog',(-112,-24,116),(11,22,2),M['dark'],1)
    for i in range(4):B('Feed tooth',(-112,-32+i*5,118),(10,2,2),M['steel'],.3)
    C('Large side hand wheel',(217,30,234),34,22,M['dark'],axis='X',s=40)
    C('Wheel inset hub',(231,30,234),22,4,M['cream'],axis='X',s=32)
    B('LCD bezel',(151,-55,227),(61,4,39),M['dark'],3)
    B('Original stitch screen',(151,-58,227),(49,2,29),M['light'],1)
    text('Stitch length label','02  2.5',(151,-60,227),7,M['dark'])
    for x in [134,151,168]:C('Stitch selection key',(x,-58,194),5,3,M['dark'],axis='Y',s=12)
    C('Upper spool spindle',(80,38,311),3,43,M['steel'],s=12)
    C('Thread spool core',(80,38,316),14,33,M['wood'],s=24)
    for z in [300,303,306,309,312,315,318,321,324,327,330]:ring('Wound thread',(80,38,z),15,1.2,M['blue'],steps=24)
    tube('Thread guide path',[(80,22,327),(30,-24,309),(-94,-42,307),(-105,-55,194),(-112,-35,129)],.7,M['blue'],5)
    B('Rear power inlet',(180,114,143),(19,3,13),M['rubber'],2)


def filing(M):
    for x in [-205,205]:
        for y in [-174,174]:C('Leveling foot',(x,y,15),20,30,M['dark'],s=20)
    B('Cabinet plinth',(0,0,43),(502,442,36),M['dark'],5)
    for x in [-246,246]:B('Folded side wall',(x,0,627),(18,450,1146),M['sage'],3)
    B('Cabinet back panel',(0,219,626),(474,12,1144),M['sage'],2)
    B('Cabinet cap',(0,0,1191),(510,450,18),M['sage'],4)
    for i in range(3):
        z=245+i*374
        B('Deep file drawer front %d'%i,(0,-221,z),(474,14,365),M['sage'],4)
        B('Recessed horizontal handle %d'%i,(0,-230,z+127),(188,5,25),M['dark'],5)
        B('Folded lower handle lip %d'%i,(0,-235,z+119),(176,10,6),M['steel'],2)
        for x in [-230,230]:B('Interior file suspension rail',(x,0,z+123),(6,413,12),M['steel'],1)
        B('Editable drawer rear',(0,191,z),(455,9,311),M['sage'],2)
        B('Editable drawer bottom',(0,-4,z-170),(460,416,9),M['sage'],2)
    C('Upper drawer lock bezel',(182,-232,1139),10,4,M['steel'],axis='Y',s=24)
    B('Lock key slot',(182,-235,1139),(2,1,8),M['dark'],.5)


def create(catalog_id,M):
    if catalog_id not in IDS:raise KeyError(catalog_id)
    if catalog_id in IDS[:4]:lighting(catalog_id,M)
    elif catalog_id=='vertical-patio-door-blinds':blinds(M)
    elif catalog_id in IDS[5:8]:plants(catalog_id,M)
    elif catalog_id=='acoustic-guitar-on-stand':guitar(M)
    elif catalog_id=='desk-monitor-arm':monitor_arm(M)
    elif catalog_id=='compact-paper-printer':printer(M)
    elif catalog_id=='compact-digital-piano':piano(M)
    elif catalog_id=='compact-piano-bench':bench(M)
    elif catalog_id=='desktop-sewing-machine':sewing(M)
    elif catalog_id=='office-filing-cabinet':filing(M)
