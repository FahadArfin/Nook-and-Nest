"""Original HOME-107..114 fixture and indoor botanical construction in mm.

Only create() authors geometry in the caller's owned scene. No scene reset, file
save, export, animation or background process is performed by this module.
"""
import math
import bpy
from mathutils import Vector
from build_kitchen_essentials import B,C,mesh,tube,ring,lathe,material
from household_lighting_office import pot,plant_palette,poly_solid

IDS=['art-picture-light','garden-path-bollard-light','interior-louvered-shutters',
     'low-level-wall-night-light','potted-zz-plant','potted-fiddle-leaf-fig',
     'potted-moth-orchid','potted-peace-lily']


def fixtures(cid,M):
    warm=material('household-warm-opal-diffuser',(.91,.68,.36),.45,0,1,.5)
    if cid=='art-picture-light':
        B('Oblong wall fixing plate',(0,77,92),(250,15,88),M['brass'],14)
        for x in [-85,85]:
            C('Support arm pivot',(x,66,101),12,12,M['dark'],axis='Y',s=20)
            tube('Swept picture light arm',[(x,61,101),(x,40,128),(x,-35,141),(x,-71,116)],6,M['brass'],10)
            C('Hood tilt pivot',(x,-71,113),10,20,M['dark'],axis='X',s=20)
        # Open half-cylinder shade with a visible interior and rolled front lip.
        verts=[];steps=24
        for x in [-300,300]:
            for radius in [37,33]:
                for i in range(steps+1):
                    a=math.pi*i/steps;verts.append((x,-80+radius*math.cos(a),110+radius*math.sin(a)))
        n=steps+1;faces=[]
        for i in range(steps):
            faces.extend([(i,i+1,2*n+i+1,2*n+i),(n+i,3*n+i,3*n+i+1,n+i+1),
                          (i,n+i,n+i+1,i+1),(2*n+i,2*n+i+1,3*n+i+1,3*n+i)])
        faces += [(0,2*n,3*n,n),(steps,n+steps,3*n+steps,2*n+steps)]
        mesh('Open brass art-light hood',verts,faces,M['brass'])
        for x in [-300,300]:
            section=[(-80+37*math.cos(i*math.pi/24),110+37*math.sin(i*math.pi/24)) for i in range(25)]
            count=len(section);v=[(x+dx,y,z) for dx in [-2.5,2.5] for y,z in section]
            f=[tuple(reversed(range(count))),tuple(range(count,2*count))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
            mesh('Half-round hood end cap',v,f,M['brass'])
        B('Warm recessed art optic',(0,-83,114),(553,32,5),warm,2)
        for y in [-117,-43]:tube('Rolled hood edge',[(-299,y,111),(299,y,111)],2,M['brass'],8)
        for x in [-108,108]:C('Wall plate fixing screw',(x,67,92),3.5,3,M['steel'],axis='Y',s=12)
    elif cid=='garden-path-bollard-light':
        C('Low post mounting plinth',(0,0,7),56,14,M['dark'],s=40)
        lathe('Stepped aluminium bollard',[(0,14),(49,14),(49,181),(46,190),(0,190)],M['dark'],48)
        C('Inward reflector core',(0,0,207),27,39,M['steel'],s=32)
        lathe('Opal cylindrical diffuser',[(43,188),(48,188),(49,193),(49,244),(45,250),(43,248)],warm,48)
        C('Rain cap',(0,0,252),52,10,M['dark'],s=48)
        ring('Raised top weather seam',(0,0,251),52,1.5,M['dark'])
        for a in [0,math.tau/3,math.tau*2/3]:C('Base anchor screw',(42*math.cos(a),42*math.sin(a),15),3,2,M['steel'],s=12)
        B('Low power inlet',(0,49,35),(14,4,11),M['rubber'],2)
    elif cid=='low-level-wall-night-light':
        B('Soft corner wall plate',(0,0,58),(75,12,116),M['cream'],7)
        B('Recessed inner bezel',(0,-7,58),(48,4,75),M['dark'],3)
        B('Warm inset light panel',(0,-10,54),(41,3,61),warm,2)
        for z in [16,99]:
            C('Plate captive screw',(0,-8,z),3,2,M['steel'],axis='Y',s=12)
            B('Screwdriver slot',(0,-9.2,z),(4,.5,.7),M['dark'],.1)
        C('Small ambient sensor window',(0,-10,93),3,2,M['dark'],axis='Y',s=12)
    else:raise KeyError(cid)


def shutters(M):
    for x in [-575,575]:B('Deep outer window stile',(x,18,700),(50,72,1400),M['wood2'],3)
    for z in [25,1375]:B('Deep outer header sill',(0,18,z),(1100,72,50),M['wood2'],3)
    for panel,cx in enumerate([-278,278]):
        for x in [cx-255,cx+255]:B('Shutter panel stile',(x,-9,700),(40,40,1318),M['cream'],3)
        for z in [63,700,1337]:B('Shutter panel cross rail',(cx,-9,z),(475,40,45),M['cream'],3)
        for j in range(16):
            z=110+j*78
            if abs(z-700)<50:continue
            # Shaped elliptical cross section avoids a flat Venetian-card look.
            points=[]
            for k in range(16):
                a=k*math.tau/16;points.append((41*math.cos(a),5.5*math.sin(a)))
            verts=[(x,-9+y,z+zz) for x in [cx-233,cx+233] for y,zz in points]
            faces=[tuple(reversed(range(16))),tuple(range(16,32))]+[(k,(k+1)%16,(k+1)%16+16,k+16) for k in range(16)]
            o=mesh('Shaped timber louver %d %d'%(panel,j),verts,faces,M['cream'])
            # Rotate about local horizontal line, not the scene origin.
            for v in o.data.vertices:
                y=v.co.y+9;zz=v.co.z-z;a=math.radians(-23)
                v.co.y=-9+y*math.cos(a)-zz*math.sin(a);v.co.z=z+y*math.sin(a)+zz*math.cos(a)
        for z in [388,1030]:B('Front tilt operating rod',(cx,-51,z),(11,9,526),M['wood2'],3)
        for z in [182,1218]:
            x=cx+(-275 if panel==0 else 275)
            C('Panel hinge barrel',(x,-7,z),5,64,M['brass'],s=16)
            B('Recessed hinge leaf',(x+(-8 if panel==0 else 8),-9,z),(22,5,55),M['brass'],1)
        C('Small shutter pull',(cx+(-220 if panel else 220),-37,705),8,17,M['brass'],axis='Y',s=20)


def leaf(name,base,direction,width,length,P,shape='oval',mat=None,veins=True):
    base=Vector(base);axis=Vector(direction).normalized();side=axis.cross(Vector((0,0,1)))
    if side.length<.05:side=Vector((1,0,0))
    side.normalize();normal=side.cross(axis).normalized();n=14 if shape=='fig' else 10;m=6;verts=[]
    def point(t,s,lift=0):
        profile=math.sin(math.pi*t)**.64
        if shape=='fig':profile*=1-.34*math.exp(-((t-.43)/.13)**2)
        if shape=='lance':profile=math.sin(math.pi*t)**1.05
        if shape=='tongue':profile=(math.sin(math.pi*t)**.4)
        if shape=='spathe':profile=math.sin(math.pi*t)**.68
        span=width*.5*profile
        ripple=(width*.027*math.sin(5*math.pi*t)*abs(s)**3 if shape=='fig' else 0)
        lift0=width*.10*(1-s*s)*math.sin(math.pi*t)-length*.16*t*t+ripple
        if shape=='spathe':lift0=width*.27*s*s*math.sin(math.pi*t)-length*.05*t*t
        return base+axis*(length*t)+side*(span*s)+normal*(lift0+lift)
    for j in range(n):
        for k in range(m+1):verts.append(point(j/(n-1),-1+2*k/m))
    faces=[(j*(m+1)+k,j*(m+1)+k+1,(j+1)*(m+1)+k+1,(j+1)*(m+1)+k) for j in range(n-1) for k in range(m)]
    o=mesh(name,verts,faces,mat or P['leaf']);bpy.context.view_layer.objects.active=o
    solid=o.modifiers.new('Curved leaf thickness','SOLIDIFY');solid.thickness=2 if shape=='tongue' else .9
    bpy.ops.object.modifier_apply(modifier=solid.name)
    for f in o.data.polygons:f.use_smooth=True
    if veins:
        tube(name+' central raised vein',[point(j/10,0,.9) for j in range(11)],max(.6,width*.004),P['vein'],5)
        if shape!='oval':
            for t in [.22,.39,.56,.73]:
                for s in [-1,1]:tube(name+' lateral vein',[point(t,0,1),point(t+.07,s*.55,1),point(t+.13,s*.88,1)],max(.35,width*.0015),P['vein'],5)
    return o


def zz(M,P):
    pot(120,210,M,P)
    for i in range(7):
        a=i*2.399;h=430+(i*67)%220;r=95+(i%3)*22
        pts=[(r*(t**1.6)*math.cos(a),r*(t**1.6)*math.sin(a),193+h*t) for t in [j/12 for j in range(13)]]
        tube('Succulent arching ZZ rachis %d'%i,pts,6.5-(i%2),P['light'],8)
        for j in range(3,12,2):
            p=Vector(pts[j]);t=j/12
            for sign in [-1,1]:
                b=a+sign*1.0;direction=(math.cos(b),math.sin(b),.5-t*.25)
                leaf('Paired ZZ leaflet %d %d %d'%(i,j,sign),p,direction,37+12*(1-t),78+23*(1-t),P,mat=P['light'] if i==5 else P['leaf'])
        leaf('Terminal ZZ leaflet %d'%i,pts[-1],(math.cos(a),math.sin(a),.9),37,68,P)


def fig(M,P):
    pot(190,340,M,P)
    trunk=[Vector(p) for p in [(-12,0,317),(-24,7,590),(-11,14,875),(17,-3,1150),(35,9,1425),(8,23,1710),(18,10,1880)]]

    def tapered_branch(name,points,radii,mat,sides=10):
        # A connected woody sweep with decreasing radius, rather than one thick
        # uniform pole under a stack of disconnected leaf rings.
        verts=[];normal=None
        for i,p in enumerate(points):
            tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
            if normal is None:
                helper=min([Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))],key=lambda v:abs(v.dot(tangent)))
                normal=tangent.cross(helper).normalized()
            else:normal=(normal-tangent*normal.dot(tangent)).normalized()
            side=tangent.cross(normal).normalized()
            verts += [p+radii[i]*(normal*math.cos(k*math.tau/sides)+side*math.sin(k*math.tau/sides)) for k in range(sides)]
        faces=[(i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k) for i in range(len(points)-1) for k in range(sides)]
        faces += [tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))]
        obj=mesh(name,verts,faces,mat)
        for face in obj.data.polygons:face.use_smooth=len(face.vertices)==4
        return obj

    tapered_branch('Tapered irregular fiddle-leaf trunk',trunk,[25,23,20,16,13,9,5],M['endgrain'],12)
    # Seven unequal rising shoots carry staggered, alternate foliage. The lower
    # broad blades fill the crown near the pot; small upright terminal blades
    # finish the top. The 26 leaves remain individually editable meshes.
    shoots=[(.15,640,980,95,4),(2.45,785,1190,125,4),(4.55,965,1370,155,4),
            (1.10,1140,1540,140,3),(3.30,1310,1690,105,4),(5.20,1500,1810,92,4),
            (2.25,1670,1880,55,3)]
    for i,(angle,z,tip_z,reach,count) in enumerate(shoots):
        start=next(a.lerp(b,(z-a.z)/(b.z-a.z)) for a,b in zip(trunk,trunk[1:]) if a.z<=z<=b.z)
        radial=Vector((math.cos(angle),math.sin(angle),0))
        points=[start,start+radial*(reach*.22)+Vector((0,0,(tip_z-z)*.35)),
                start+radial*(reach*.68)+Vector((0,0,(tip_z-z)*.73)),
                start+radial*reach+Vector((0,0,tip_z-z))]
        tapered_branch('Rising forked fig shoot %d'%i,points,[11-i*.65,8-i*.4,5.3,3.1],M['endgrain'],8)
        for j in range(count):
            t=.26+.74*j/(count-1);scaled=t*3;segment=min(2,int(scaled));node=points[segment].lerp(points[segment+1],scaled-segment)
            spread=(-.88 if j%2==0 else .68)+(i%3-.8)*.14
            a=angle+spread
            rise=.22+(j%3)*.20+(.32 if i==6 else 0)
            direction=Vector((math.cos(a),math.sin(a),rise)).normalized()
            base=node+direction*(28+(i+j)%3*7)
            tube('Individual fig leaf petiole %d %d'%(i,j),[node,node.lerp(base,.52)+Vector((0,0,5)),base],3.2 if i<5 else 2.7,P['leaf'],6)
            width=248+(i+j)%3*19-(38 if i==6 else 0)
            length=348+(i*2+j)%4*17-(44 if i==6 else 0)
            leaf('Broad folded violin fig leaf %d %d'%(i,j),base,direction,width,length,P,'fig',P['light'] if i==6 or (i+j)%9==0 else P['leaf'])
        tip=points[-1]
        tube('Fig terminal bud %d'%i,[tip,tip+radial*8+Vector((0,0,22))],4,P['light'],7)
    for i,z in enumerate([386,465,557,674]):
        p=next(a.lerp(b,(z-a.z)/(b.z-a.z)) for a,b in zip(trunk,trunk[1:]) if a.z<=z<=b.z)
        radius=25-(z-317)*.009
        tube('Small old fig leaf scar %d'%i,[p+Vector((radius*math.cos(a),radius*math.sin(a),0)) for a in [j*math.pi/12+.6*i for j in range(7)]],1.25,M['wood'],5)


def orchid_petal(name,center,angle,length,width,mat,forward=0):
    """Cupped petal surface in the front-facing XZ plane, with real thickness."""
    c=Vector(center);u=Vector((math.cos(angle),0,math.sin(angle)));v=Vector((-math.sin(angle),0,math.cos(angle)));vs=[];nr=8;nc=6
    for j in range(nr):
        t=j/(nr-1);span=width*.5*math.sin(math.pi*t)**.55
        for k in range(nc+1):
            s=-1+2*k/nc;vs.append(c+u*(length*t)+v*(span*s)+Vector((0,-forward-5*math.sin(math.pi*t)*(1-s*s)+8*t*t,0)))
    fs=[(j*(nc+1)+k,j*(nc+1)+k+1,(j+1)*(nc+1)+k+1,(j+1)*(nc+1)+k) for j in range(nr-1) for k in range(nc)]
    o=mesh(name,vs,fs,mat);bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Petal thickness','SOLIDIFY');mod.thickness=.65;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True


def orchid(M,P):
    pink=material('household-orchid-blush-petals',(.73,.43,.53),.75)
    pale=material('household-orchid-ivory-petals',(.85,.76,.69),.78)
    lip=material('household-orchid-raspberry-lip',(.44,.035,.12),.7)
    pot(71,153,M,P)
    for i in range(6):
        a=i*2.4;leaf('Thick basal orchid strap leaf %d'%i,(0,0,141),(math.cos(a),math.sin(a),.18+(i%2)*.2),55,130+(i%3)*22,P,'tongue',veins=False)
    for i in range(2):
        s=1 if i==0 else -1;pts=[(s*12,5,151),(s*15,10,330),(s*26,6,470),(s*78,0,550),(s*140,-4,571),(s*190,-5,538)]
        tube('Arching orchid flower spike %d'%i,pts,3.7,P['leaf'],8)
        tube('Fine bamboo support stake %d'%i,[(s*12,20,140),(s*12,20,470)],2.6,M['wood'],7)
        for z in [260,390,455]:ring('Stem support clip',(s*12,12,z),7,1.2,M['dark'],steps=16)
        for j in range(4):
            x=s*(56+j*37);z=515+40*math.sin((j+.4)*.8)
            c=(x,-15,z);tube('Individual orchid pedicel',[(x,0,z-10),c],2,P['light'],6)
            for k,a in enumerate([math.pi/2,math.pi*7/6,math.pi*11/6]):orchid_petal('Shaped orchid sepal %d %d %d'%(i,j,k),c,a,43,26,pale)
            for k,a in enumerate([math.pi*.12,math.pi*.88]):orchid_petal('Broad moth orchid petal %d %d %d'%(i,j,k),c,a,42,48,pink,3)
            for k,a in enumerate([math.pi*1.3,math.pi*1.7]):orchid_petal('Curled orchid lip lobe %d %d %d'%(i,j,k),c,a,18,15,lip,9)
            orchid_petal('Forward orchid lip',(x,-22,z-3),-math.pi/2,23,21,pale,5)
            C('Orchid yellow callus',(x,-29,z),4,6,M['brass'],axis='Y',s=12)
        for j in range(2):
            lathe('Closed orchid bud',[(0,0),(6,3),(9,12),(6,20),(0,23)],P['light'],20,center=(s*(182+j*12),-4,522-j*13))


def peace_lily(M,P):
    ivory=material('household-peace-lily-spathe',(.88,.86,.69),.82)
    center=material('household-peace-lily-spadix',(.54,.52,.20),.84)
    pot(125,215,M,P)
    for i in range(13):
        a=i*2.399;z=290+(i*71)%270;r=65+(i%3)*19;base=(r*math.cos(a),r*math.sin(a),z)
        tube('Peace lily petiole %d'%i,[(0,0,198),(base[0]*.45,base[1]*.45,z*.76),base],4,P['leaf'],7)
        leaf('Ribbed lance-shaped peace lily leaf %d'%i,base,(math.cos(a),math.sin(a),.2-(i%3)*.22),85+(i%3)*13,218+(i%4)*23,P,'lance')
    for i,(x,y,z) in enumerate([(-70,-20,620),(56,20,714),(11,70,560)]):
        tube('Flower scape %d'%i,[(0,0,200),(x*.7,y*.8,z*.72),(x,y,z)],4,P['light'],7)
        leaf('Cupped ivory peace lily spathe %d'%i,(x,y,z),(i*.15-.2,.12,.97),80,146,P,'spathe',ivory,veins=False)
        tube('Raised spadix center %d'%i,[(x,y-8,z+14),(x+5,y-14,z+78)],6,center,10)
        for j in range(9):
            a=j*2.4
            C('Textured spadix floret',(x+5*math.cos(a),y-12+5*math.sin(a),z+18+j*6),2.5,3,ivory,s=6)


def create(catalog_id,M):
    if catalog_id not in IDS:raise KeyError(catalog_id)
    if catalog_id in ['art-picture-light','garden-path-bollard-light','low-level-wall-night-light']:fixtures(catalog_id,M)
    elif catalog_id=='interior-louvered-shutters':shutters(M)
    else:
        P=plant_palette()
        {'potted-zz-plant':zz,'potted-fiddle-leaf-fig':fig,'potted-moth-orchid':orchid,'potted-peace-lily':peace_lily}[catalog_id](M,P)
