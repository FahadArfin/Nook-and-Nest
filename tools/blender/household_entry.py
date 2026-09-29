"""Original household entry and compact furniture, HOME-022 through HOME-043.

Geometry only: millimetres, Z up, negative Y front. The owning batch driver
creates its scene, assigns materials, then saves editable parts before export.
No scene clearing, file saving, joins or global materials mutation occurs here.
"""
import math
import bpy
from mathutils import Vector, Matrix
from build_kitchen_essentials import B,C,mesh,tube,ring,lathe,rounded_loop,material


def beam(name,a,b,w,d,mat):
    a,b=Vector(a),Vector(b)
    o=B(name,(a+b)/2,(w,d,(b-a).length),mat,min(w,d)*.12)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o


def group_transform(objects, angle=0, pivot=(0,0,0), translation=(0,0,0), axis='Z'):
    transform=Matrix.Translation(Vector(translation)) @ Matrix.Translation(Vector(pivot)) @ Matrix.Rotation(angle,4,axis) @ Matrix.Translation(-Vector(pivot))
    for o in objects:o.matrix_world=transform @ o.matrix_world


def caster(x,y,z,M,r=23):
    C('caster rubber wheel',(x,y,z+r),r,17,M['rubber'],axis='X',s=20)
    for s in [-1,1]:
        B('caster fork cheek',(x+s*11,y,z+r+12),(4,23,35),M['steel'],2)
        C('caster hub',(x+s*14,y,z+r),7,3,M['steel'],axis='X',s=12)
    C('caster swivel race',(x,y,z+2*r+14),15,7,M['steel'],s=20)


def slats(name,w,d,z,M,count=7,mat='wood'):
    for i in range(count):
        B(name+' %02d'%i,(-w/2+(i+.5)*w/count,0,z),(w/count-5,d,20),M[mat],3)


def open_box(name,w,d,h,z,M,mat='wood',th=12):
    B(name+' bottom',(0,0,z+th/2),(w,d,th),M[mat],2)
    for x in [-1,1]:B(name+' side',(x*(w-th)/2,0,z+h/2),(th,d,h),M[mat],3)
    for y in [-1,1]:B(name+' end',(0,y*(d-th)/2,z+h/2),(w-2*th,th,h),M[mat],3)


def pillow(name,w,d,h,M,key='fabric'):
    # Sewn square plan, tapered pinched corners and broad stuffed panels.
    # This is a rounded rectangular cloth mesh, never a scaled sphere.
    n=16;vs=[];fs=[]
    for side in [-1,1]:
        for j in range(n+1):
            v=2*j/n-1
            for i in range(n+1):
                u=2*i/n-1
                fullness=max(0,(1-u*u)*(1-v*v))**.45
                x=u*w/2*(1-.05*abs(v)**8)
                y=v*d/2*(1-.05*abs(u)**8)
                z=h/2+side*(h*.08+h*.42*fullness)
                vs.append((x,y,z))
    span=(n+1)**2
    for side in range(2):
        for j in range(n):
            for i in range(n):
                a=side*span+j*(n+1)+i;f=(a,a+1,a+n+2,a+n+1)
                fs.append(f if side else tuple(reversed(f)))
    perimeter=list(range(n+1))+[j*(n+1)+n for j in range(1,n+1)]+[n*(n+1)+i for i in range(n-1,-1,-1)]+[j*(n+1) for j in range(n-1,0,-1)]
    for a,b in zip(perimeter,perimeter[1:]+perimeter[:1]):fs.append((a,b,b+span,a+span))
    o=mesh(name,vs,fs,M[key])
    for p in o.data.polygons:p.use_smooth=True
    seam=[(vs[a][0],vs[a][1],h/2) for a in perimeter]
    tube(name+' tailored welt',seam+[seam[0]],1.8,M[key],6)
    tube(name+' concealed zipper',[(-w*.2,d*.48,h/2),(w*.2,d*.48,h/2)],1.3,M['dark'],6)
    return o


def hall_tree(M):
    # 800 x 370 x 1900, shoe support at 185, bench at 460.
    for x in [-372,372]:
        for y in [-152,152]:
            B('rubber leveling foot',(x,y,8),(34,34,16),M['rubber'],5)
            B('bench upright',(x,y,225),(28,28,420),M['dark'],4)
        B('coat upright',(x,152,965),(28,28,1860),M['dark'],4)
    for z in [170,432,1878]:B('horizontal structural rail',(0,152,z),(760,24,28),M['dark'],4)
    for x in [-372,372]:B('shoe support stretcher',(x,0,175),(25,310,26),M['dark'],3)
    for x in range(-350,351,50):B('open shoe shelf bar',(x,0,181),(10,316,8),M['dark'],2)
    for y in [-146,146]:B('shoe shelf edge',(0,y,181),(754,10,8),M['dark'],2)
    B('rounded oiled oak seat',(0,0,444),(800,370,32),M['wood'],10)
    for z in [1250,1690]:
        B('hook mounting rail',(0,147,z),(737,22,54),M['wood'],5)
        for x in [-276,-92,92,276]:
            C('hook mounting rose',(x,130,z),14,5,M['dark'],axis='Y',s=16)
            tube('rounded double coat hook',[(x,127,z+8),(x,94,z+28),(x,80,z+44),(x,77,z+62)],7,M['dark'],8)
            tube('lower bag hook',[(x,127,z),(x,102,z-28),(x,78,z-30),(x,69,z-15)],6,M['dark'],8)
    for x in [-372,372]:
        for z in [175,432,1250,1690]:C('visible frame fastener',(x,133,z),5,3,M['steel'],axis='Y',s=8)


def coat_stand(M):
    C('central wooden mast',(0,0,890),24,1510,M['wood'],s=20,r2=19)
    C('cast center joint',(0,0,300),42,75,M['dark'],s=16)
    for i in range(3):
        a=i*math.tau/3
        x,y=math.cos(a),math.sin(a)
        tube('swept tripod leg',[(x*305,y*305,18),(x*245,y*245,38),(x*70,y*70,268),(x*22,y*22,338)],17,M['dark'],10)
        B('non slip foot',(x*305,y*305,8),(40,40,16),M['rubber'],7)
    for j,z in enumerate([1050,1390,1600]):
        for i in range(3):
            a=i*math.tau/3+j*.6;x,y=math.cos(a),math.sin(a)
            tube('rising rounded wood peg',[(x*12,y*12,z),(x*95,y*95,z+20),(x*143,y*143,z+74)],12,M['wood'],10)
            C('peg end cap',(x*143,y*143,z+77),14,7,M['endgrain'],s=16)


def cubby_bin(M):
    open_box('reinforced canvas bin',290,270,290,0,M,'fabric',8)
    rounded_loop('bound open rim',286,266,7,287,M['sage'],3)
    for x in [-141,141]:
        for y in [-131,131]:tube('upright stitched seam',[(x,y,6),(x,y,286)],1.2,M['cream'],5)
    for y in [-134,134]:
        tube('fabric pull loop',[(-40,y,210),(-36,y*1.035,184),(36,y*1.035,184),(40,y,210)],5,M['sage'],6)
        for x in [-36,36]:B('handle stitched attachment',(x,y,213),(18,3,22),M['sage'],2)


def underbed_drawer(M):
    open_box('rolling drawer',820,630,165,54,M,'wood2',13)
    B('raised drawer front',(0,-321,144),(870,18,204),M['sage'],5)
    # Two rails forming a true open gripping recess; no painted-on handle.
    tube('recessed drawer pull',[(-95,-333,173),(-88,-342,162),(88,-342,162),(95,-333,173)],7,M['wood'],8)
    for x in [-330,330]:
        for y in [-240,240]:caster(x,y,0,M,18)
    for x in [-390,390]:
        for y in [-290,290]:C('corner joinery screw',(x,y,209),3,3,M['steel'],s=8)


def throw(M,draped=False):
    if not draped:
        for k in range(3):
            w=540-5*k;d=400-8*k;n=24;m=18;vs=[];fs=[]
            for j in range(m+1):
                y=-d/2+d*j/m
                for i in range(n+1):
                    x=-w/2+w*i/n;z=8+k*14+3*math.sin(x/43+y/73)+2*math.cos(y/24)
                    vs.append((x,y,z))
            for j in range(m):
                for i in range(n):a=j*(n+1)+i;fs.append((a,a+1,a+n+2,a+n+1))
            o=mesh('soft folded throw layer',vs,fs,M['blue']);sol=o.modifiers.new('Woven cloth thickness','SOLIDIFY');sol.thickness=5
            bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sol.name)
            for p in o.data.polygons:p.use_smooth=True
        for x in range(-250,251,18):
            tube('short folded fringe',[(x,-196,35),(x+3,-211,32),(x+1,-220,29)],1.7,M['cream'],5)
        for y in [-165,-153,154,166]:tube('woven border stripe',[(-260+i*520/24,y,41+3*math.sin((-260+i*520/24)/43+y/73)+2*math.cos(y/24)) for i in range(25)],1.5,M['cream'],5)
    else:
        # Fixed saddle drape over an approximately 180-mm-wide sofa arm.
        bpy.context.scene['household_support_plane_mm']=419.0
        bpy.context.scene['household_support_kind']='underside of throw crest over sofa arm; fringed ends hang below'
        bpy.context.scene['household_support_center_mm']=[0.0,0.0,419.0]
        bpy.context.scene['household_support_footprint_mm']=[420.0,110.0]
        bpy.context.scene['household_support_footprint_shape']='rectangle'
        profile=[(-245,35),(-220,70),(-185,115),(-160,185),(-130,275),(-102,385),(-86,420),(-55,427),(55,427),(86,420),(102,385),(130,275),(160,185),(185,115),(220,70),(245,35)]
        n=20;vs=[];fs=[]
        for j,(y,z) in enumerate(profile):
            for i in range(n+1):
                x=-230+i*460/n;wave=5*math.cos(x/31)*(.3+abs(y)/245)
                vs.append((x,y,z+wave))
        for j in range(len(profile)-1):
            for i in range(n):a=j*(n+1)+i;fs.append((a,a+1,a+n+2,a+n+1))
        o=mesh('continuous saddle draped throw',vs,fs,M['clay']);sol=o.modifiers.new('Woven cloth thickness','SOLIDIFY');sol.thickness=5
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sol.name)
        for p in o.data.polygons:p.use_smooth=True
        for y in [-245,245]:
            for x in range(-218,219,18):tube('drape hem fringe',[(x,y,35+5*math.cos(x/31)),(x+3,y*1.04,17),(x+1,y*1.055,7)],1.6,M['cream'],5)


def console(M):
    B('rounded solid walnut top',(0,0,765),(1100,300,30),M['wood'],10)
    B('lower display shelf',(0,0,200),(1040,245,24),M['wood2'],7)
    for x in [-504,504]:
        for y in [-102,102]:beam('tapered open console leg',(x*1.01,y*1.06,0),(x,y,750),32,32,M['wood'])
        B('end top apron',(x,0,704),(28,214,92),M['wood'],4)
    for y in [-111,111]:B('long inset apron',(0,y,712),(1030,22,75),M['wood'],4)
    for x in [-470,470]:
        for y in [-90,90]:B('corner joining block',(x,y,716),(46,46,60),M['endgrain'],4)


def basket(M):
    rattan=material('entry-natural-rattan',(.42,.27,.115),.87)
    darker=material('entry-rattan-shadow',(.30,.185,.078),.9)
    # Continuous thin inner wall closes gaps while preserving actual cavity.
    lathe('hollow woven basket liner',[(0,7),(125,7),(147,15),(185,110),(194,225),(178,300),(170,300),(186,224),(177,112),(139,23),(0,23)],darker,48)
    profile=[(147,15),(168,60),(185,110),(191,170),(194,225),(185,268),(178,300)]
    for k in range(24):
        z=18+k*12
        r=next((a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]) for a,b in zip(profile,profile[1:]) if a[1]<=z<=b[1]),178)
        pts=[((r+1.5*math.sin(i*math.pi/2))*math.cos(i*math.tau/48),(r+1.5*math.sin(i*math.pi/2))*math.sin(i*math.tau/48),z) for i in range(49)]
        tube('woven horizontal reed',pts,3.6,rattan,5)
    for i in range(24):
        a=i*math.tau/24
        tube('interlaced vertical reed',[(r*math.cos(a),r*math.sin(a),z) for r,z in profile],3.4,rattan,5)
    ring('bound basket rim',(0,0,300),175,6,rattan,steps=48)
    for x in [-170,170]:
        tube('bound oval carrying handle',[(x,-42,277),(x*1.035,-45,320),(x*1.02,-29,352),(x,0,360),(x*1.02,29,352),(x*1.035,45,320),(x,42,277)],8,rattan,8)
    for i in range(11):
        x=-110+i*22
        B('woven base reed',(x,0,8),(10,2*math.sqrt(122**2-x*x),8),rattan,2)


def clothes_rack(M):
    for x in [-510,510]:
        for y in [-205,205]:caster(x,y,0,M,24)
        tube('tubular caster base',[(x,-210,72),(x,210,72)],17,M['sage'],10)
        C('lower telescoping upright',(x,0,670),19,1180,M['sage'],s=20)
        C('upper sliding upright',(x,0,1340),14,430,M['steel'],s=20)
        C('height lock collar',(x,0,1150),23,35,M['dark'],s=20)
        C('height adjustment knob',(x,-33,1150),17,19,M['dark'],axis='Y',s=16)
        for z in [1230,1280,1330]:C('height pin position',(x,-15,z),3,2,M['dark'],axis='Y',s=10)
    tube('rounded garment rail',[(-510,0,1530),(-510,0,1580),(-487,0,1600),(487,0,1600),(510,0,1580),(510,0,1530)],15,M['steel'],12)
    for y in [-135,-45,45,135]:tube('shoe storage bar',[(-510,y,118),(510,y,118)],8,M['sage'],8)


def shoe_cabinet(M):
    # Closed tilt bins; hidden cradles and pivot pins remain editable geometry.
    for x in [-430,430]:B('front cabriole foot',(x,-97,100),(50,50,200),M['wood'],7)
    for x in [-457,457]:B('side cabinet panel',(x,0,690),(22,238,1130),M['sage'],4)
    B('rear cabinet panel',(0,111,690),(900,12,1130),M['sage'],3)
    B('projecting ledged top',(0,0,1268),(960,270,28),M['wood'],8)
    B('bottom support',(0,0,227),(900,220,25),M['sage'],3)
    for z in [490,1005]:
        for x in [-227,227]:
            B('tilt front frame',(x,-125,z),(440,18,495),M['wood'],4)
            B('inset sage door panel',(x,-137,z),(390,8,445),M['sage'],4)
            C('brass round knob',(x,-157,z+180),13,18,M['brass'],axis='Y',s=20)
            B('shoe cradle base',(x,-18,z-222),(399,180,12),M['wood2'],2)
            for xx in [-202,202]:B('shoe cradle side',(x+xx,-20,z-120),(12,178,215),M['wood2'],2)
            C('tilt pivot',(x,80,z-210),9,408,M['steel'],axis='X',s=12)
    B('center case upright',(0,0,745),(22,212,1000),M['sage'],3)


def shoe_rack(M):
    for x in [-275,275]:
        tube('folding U end frame',[(x,-144,0),(x,-144,170),(x,-135,185),(x,135,185),(x,144,170),(x,144,0)],7,M['blue'],8)
        for y in [-144,144]:C('stacking locator socket',(x,y,183),10,14,M['dark'],s=12)
        C('folding hinge pivot',(x,0,154),7,19,M['steel'],axis='X',s=12)
    for y in [-138,138]:tube('shelf perimeter rail',[(-279,y,155),(279,y,155)],6,M['blue'],8)
    for x in range(-270,271,22):tube('welded mesh cross wire',[(x,-135,159),(x,135,159)],2.5,M['blue'],6)
    for y in range(-110,111,37):tube('welded mesh long wire',[(-270,y,156),(270,y,156)],2.5,M['blue'],6)


def photo_frame(M):
    # Original geometric landscape artwork, physically in the frame's rebate.
    for x in [-83,83]:B('mitred walnut side',(x,0,114),(14,22,228),M['wood'],2)
    for z in [7,221]:B('mitred walnut rail',(0,0,z),(154,22,14),M['wood'],2)
    B('rear frame backing',(0,7,114),(152,5,214),M['endgrain'],1)
    B('cream inset mount',(0,-1,114),(151,2,211),M['paper'],1)
    B('original landscape sky',(0,-3,119),(125,2,150),M['blue'],0)
    for coords,key in [([(-62,45),(-62,98),(-27,123),(12,83),(62,112),(62,45)],'sage'),([(-62,45),(-62,75),(-12,93),(33,68),(62,84),(62,45)],'clay')]:
        mesh('original layered hill illustration',[(x,-5 if key=='sage' else -6,z) for x,z in coords],[tuple(range(len(coords)))],M[key])
    C('original sunset disc',(29,-4.4,170),17,1,M['cream'],axis='Y',s=32)
    B('clear front protective pane',(0,-7,114),(151,1,211),M['glass'],0)
    beam('rear easel prop',(0,80,1),(0,14,149),42,7,M['wood'])
    tube('easel restraint ribbon',[(0,10,40),(0,62,35)],3,M['dark'],6)
    C('easel hinge pin',(0,13,148),4,45,M['brass'],axis='X',s=12)


def dining_table(M,extended=False):
    w=2000 if extended else 1400;d=850;h=750
    half=(w-(600 if extended else 2))/2
    for sign in [-1,1]:B('split oak tabletop',(sign*((600 if extended else 2)/2+half/2),0,h-17),(half-1,d,34),M['wood'],8)
    if extended:B('inserted dining extension leaf',(0,0,h-17),(596,d,34),M['wood2'],6)
    else:B('leaf stored below tabletop',(0,0,633),(596,800,27),M['wood2'],4)
    for x in [-w/2+90,w/2-90]:
        for y in [-335,335]:beam('tapered square leg',(x,y,0),(x*.985,y*.99,716),54,54,M['wood'])
        B('end frame apron',(x,0,675),(30,710,85),M['wood'],5)
    for y in [-360,360]:
        for s in [-1,1]:B('divided sliding apron',(s*(w/4),y,679),(w/2-60,25,75),M['wood'],4)
    for y in [-230,230]:
        B('telescopic extension guide',(0,y,690),(w-180,22,27),M['steel'],2)
        B('inner slide channel',(0,y+15,684),(w-360,16,16),M['dark'],2)
        for x in [-270,270]:B('extension stop block',(x,y,671),(30,42,14),M['wood2'],2)


def dressing_table(M):
    for x in [-368,368]:
        for y in [-186,186]:beam('dressing table tapered leg',(x,y,0),(x*.98,y*.98,728),35,35,M['wood'])
    B('left desktop',( -160,0,740),(480,450,24),M['wood'],7)
    B('shallow drawer face',(-170,-219,677),(440,18,97),M['sage'],3)
    tube('drawer brass pull',[(-217,-231,677),(-217,-241,677),(-123,-241,677),(-123,-231,677)],4,M['brass'],8)
    for x in [-380,80,380]:B('shallow storage side',(x,0,690),(18,420,102),M['wood'],3)
    B('storage well bottom',(234,0,645),(287,420,13),M['wood2'],2)
    B('storage well rear',(235,204,690),(286,16,100),M['wood'],2)
    B('storage well front',(235,-212,690),(286,16,100),M['wood'],2)
    for y in [-60,85]:B('cosmetic compartment divider',(235,y,679),(279,9,57),M['wood2'],2)
    B('compartment cross divider',(235,-133,679),(9,145,57),M['wood2'],2)
    # Raised mirror lid, hinged along the rear edge. Exact fixed pose.
    before=set(bpy.context.scene.objects)
    B('raised lid walnut frame',(235,0,750),(296,450,20),M['wood'],4)
    B('mirror inset',(235,0,736),(260,410,3),M['steel'],2)
    group_transform(set(bpy.context.scene.objects)-before,math.radians(-98),(235,215,750),axis='X')
    for x in [120,350]:C('hinge barrel',(x,214,745),6,40,M['brass'],axis='X',s=12)


def folding_chair(M,folded=False):
    if folded:
        # The seat pivots up within a parallel folded pair of frames.
        for x in [-206,206]:
            beam('front folding leg',(x,-25,0),(x,18,830),32,32,M['wood'])
            beam('rear folding leg',(x,50,0),(x,-5,535),28,28,M['wood'])
            C('main folding pivot',(x,-1,440),11,38,M['steel'],axis='X',s=16)
        B('folded padded seat',(0,-21,614),(385,48,355),M['sage'],14)
        B('folded seat rear board',(0,6,614),(396,13,365),M['wood'],5)
        B('backrest frame',(0,12,792),(427,30,134),M['wood'],9)
        B('backrest fabric panel',(0,-8,792),(365,22,104),M['sage'],9)
    else:
        for x in [-206,206]:
            beam('front-to-back folding frame',(x,-218,0),(x,143,833),32,32,M['wood'])
            beam('crossed rear folding leg',(x,220,0),(x,-135,495),30,30,M['wood'])
            C('main folding pivot',(x,0,440),11,38,M['steel'],axis='X',s=16)
            beam('seat support',(x,-160,429),(x,144,429),25,25,M['wood'])
            beam('locking seat brace',(x,110,321),(x,-112,451),13,8,M['steel'])
        B('upholstered square seat',(0,-28,468),(410,388,46),M['sage'],18)
        B('underseat frame',(0,-28,438),(425,395,23),M['wood'],5)
        back=B('curved profile back rail',(0,123,770),(443,37,140),M['wood'],12);back.rotation_euler.x=math.radians(7)
        pad=B('matte back upholstery',(0,101,772),(378,22,109),M['sage'],12);pad.rotation_euler.x=math.radians(7)
        for y,z in [(-147,176),(155,204)]:B('leg cross stretcher',(0,y,z),(410,24,26),M['wood'],4)


def screen(M):
    reed=material('entry-screen-reed',(.51,.345,.16),.88)
    for index,angle in enumerate([-.36,.36,-.36]):
        before=set(bpy.context.scene.objects)
        for x in [-238,238]:B('screen rounded stile',(x,0,860),(30,34,1720),M['wood'],8)
        for z in [60,1658]:B('screen cross rail',(0,0,z),(452,34,30),M['wood'],7)
        for x in range(-210,211,21):
            points=[(x,2*math.sin(k*math.pi/2),83+k*(1558/28)) for k in range(29)]
            tube('vertical woven reed',points,3.8,reed,4)
        for z in range(85,1642,25):
            # flat slender horizontal strips: modeled open gaps, not texture cards
            B('horizontal woven cane',(0,0,z),(436,5,7),reed,1)
        group_transform(set(bpy.context.scene.objects)-before,angle,translation=((index-1)*459,0,0))
    for x,y in [(-229.5,-84),(229.5,84)]:
        for z in [260,860,1440]:C('screen hinge barrel',(x,y,z),7,45,M['brass'],s=12)


def gateleg(M,state='open'):
    # Original 300-mm central cabinet, two 600-mm leaves. Height 740.
    core=300;leaf=600
    for x in [-122,122]:
        for y in [-335,335]:B('central frame leg',(x,y,350),(38,38,700),M['wood'],5)
    for x in [-137,137]:B('drawer case side',(x,0,440),(20,680,570),M['wood'],3)
    B('central fixed tabletop',(0,0,725),(300,800,30),M['wood'],7)
    for z in [260,420,580]:
        B('central storage drawer',(0,-349,z),(244,18,143),M['sage'],3)
        C('drawer knob',(0,-365,z),12,16,M['brass'],axis='Y',s=16)
    for sign in [-1,1]:
        opened=state=='open' or state=='one' and sign==1
        before=set(bpy.context.scene.objects)
        B('hinged table leaf',(sign*450,0,725),(596,800,30),M['wood2'],7)
        for y in [-270,270]:C('leaf hinge barrel',(sign*149,y,710),5,44,M['brass'],axis='Y',s=12)
        if not opened:group_transform(set(bpy.context.scene.objects)-before,sign*math.pi/2,(sign*150,0,710),axis='Y')
        if opened:
            B('swinging gate front leg',(sign*645,-300,353),(35,35,706),M['wood'],4)
            B('swinging gate rear leg',(sign*645,300,353),(35,35,706),M['wood'],4)
            for y in [-300,300]:B('gate support rail',(sign*392,y,667),(510,24,35),M['wood'],4)
            B('gate bottom cross rail',(sign*645,0,125),(26,622,30),M['wood'],4)
        else:
            for y in [-298,298]:B('stowed gate leg',(sign*115,y,352),(32,32,704),M['wood'],3)


def banquette(M,corner=False):
    w=650 if corner else 1100;d=650 if corner else 580
    for x in [-w/2+38,w/2-38]:
        for y in [-d/2+38,d/2-38]:B('banquette square foot',(x,y,48),(46,46,96),M['wood'],6)
    open_box('finished storage plinth',w-22,d-22,305,90,M,'wood',18)
    B('closed upholstered seat',(0,-5,445),(w,d-4,80),M['sage'],24)
    B('seat shadow welt',(0,-5,410),(w-6,d-7,8),M['fabric'],3)
    back=B('upright padded banquette back',(0,d/2-51,687),(w,87,450),M['sage'],23);back.rotation_euler.x=math.radians(4)
    B('finished rear timber panel',(0,d/2-12,662),(w-8,23,467),M['wood'],5)
    for x in [-w/2+90,0,w/2-90]:tube('vertical tailored back seam',[(x,d/2-98,508),(x,d/2-115,855)],1.4,M['fabric'],5)
    if corner:
        back=B('return padded corner back',(-w/2+51,-30,687),(87,d-55,450),M['sage'],23);back.rotation_euler.y=math.radians(-4)
        B('finished return timber panel',(-w/2+12,-30,662),(23,d-65,467),M['wood'],5)
    for x in [-w/2+50,w/2-50]:C('seat hinge',(x,d/2-25,405),5,32,M['brass'],axis='X',s=12)


def loft_bed(M):
    # 1050-wide twin deck, 2080 long, ladder within 1350 overall width.
    for x in [-502,502]:
        for y in [-1012,1012]:
            B('loft structural post',(x,y,1010),(46,46,2020),M['sage'],7)
            B('post foot cap',(x,y,8),(53,53,16),M['rubber'],5)
    for x in [-501,501]:
        B('loft long bearer',(x,0,1528),(42,2075,145),M['sage'],5)
        for z in [1785,1955]:
            if x<0:B('long safety rail',(x,0,z),(34,2070,34),M['sage'],5)
            else:
                B('rail before ladder opening',(x,-907,z),(34,246,34),M['sage'],5)
                B('rail after ladder opening',(x,345,z),(34,1380,34),M['sage'],5)
        for y in ([-800,-400,0,400,800] if x<0 else [-795,-340,0,400,800]):B('guard infill upright',(x,y,1835),(24,24,270),M['sage'],4)
    for y in [-1011,1011]:
        B('end bearer',(0,y,1528),(1030,42,145),M['sage'],5)
        for z in [1785,1955]:B('end safety rail',(0,y,z),(1030,34,34),M['sage'],5)
    for y in range(-944,945,118):B('visible mattress support slat',(0,y,1576),(976,62,21),M['wood2'],3)
    B('single fitted mattress',(0,0,1678),(970,1970,180),M['fabric'],35)
    B('slate fitted cover',(0,-210,1761),(975,1550,22),M['blue'],10)
    before=set(bpy.context.scene.objects);pillow('single bed pillow',630,380,100,M,'clay');group_transform(set(bpy.context.scene.objects)-before,translation=(0,745,1770))
    for y in [-777,-357]:beam('sloped side ladder stile',(808,y,0),(524,y,1630),34,34,M['sage'])
    for z in [235,495,755,1015,1275,1535]:
        x=808-(284*z/1630)
        B('wide ladder rung',(x,-567,z),(49,440,35),M['wood'],5)
    for x in [-502,502]:
        for y in [-1012,1012]:
            for z in [1455,1590]:C('structural bolt head',(x,y-25,z),7,5,M['steel'],axis='Y',s=6)


def bar_cart(M):
    for x in [-295,295]:
        for y in [-184,184]:
            caster(x,y,0,M,24)
            B('cart timber upright',(x,y,402),(30,30,650),M['wood'],5)
    for z in [135,648]:
        B('recessed walnut serving shelf',(0,0,z),(630,425,23),M['wood2'],8)
        rounded_loop('tray raised retaining rail',620,415,26,z+41,M['brass'],5)
        for x in [-282,282]:
            for y in [-175,175]:C('rail standoff',(x,y,z+24),4,39,M['brass'],s=10)
    tube('arched push handle',[(296,-186,713),(321,-186,760),(328,-158,780),(328,158,780),(321,186,760),(296,186,713)],11,M['wood'],10)
    for x in [-280,280]:B('lower shelf end rail',(x,0,116),(28,360,32),M['wood'],4)


def recliner(M,extended=False):
    # Tailored separate back cushions, two-panel linked leg rest, upright seat.
    for x in [-285,285]:
        for y in [-280,280]:B('recliner glider foot',(x,y,35),(86,74,70),M['dark'],12)
    B('underseat chassis',(0,0,178),(690,650,176),M['dark'],14)
    B('upholstered lower base',(0,-1,262),(720,710,145),M['blue'],24)
    B('tailored seat cushion',(0,-92,439),(568,558,137),M['blue'],36)
    B('flexible upholstered lumbar bridge',(0,203,509),(568,113,114),M['blue'],24)
    for x in [-367,367]:
        B('padded closed arm side',(x,0,439),(160,739,415),M['blue'],36)
        B('rounded arm bolster',(x,-31,648),(173,715,118),M['blue'],40)
        tube('arm tailored seam',[(x,-374,567),(x,-374,630),(x,-349,675),(x,280,675)],1.5,M['fabric'],6)
    before=set(bpy.context.scene.objects)
    B('back frame shell',(0,291,766),(654,126,579),M['blue'],32)
    B('lower lumbar back cushion',(0,211,646),(600,136,257),M['blue'],32)
    B('upper back cushion',(0,255,894),(616,151,257),M['blue'],37)
    tube('back division seam',[(-287,179,772),(287,179,772)],1.8,M['fabric'],6)
    group_transform(set(bpy.context.scene.objects)-before,math.radians(-26 if extended else -5),(0,250,491),axis='X')
    if extended:
        B('extended calf cushion',(0,-613,444),(581,350,98),M['blue'],27)
        B('extended foot pad',(0,-870,400),(566,190,74),M['blue'],24)
        for x in [-218,218]:
            for a,b in [((x,-230,240),(x,-647,402)),((x,-330,390),(x,-635,264)),((x,-627,267),(x,-866,362))]:beam('articulated scissor linkage',a,b,21,9,M['steel'])
            for y,z in [(-330,390),(-627,267),(-647,402),(-866,362)]:C('footrest linkage pivot',(x,y,z),8,14,M['dark'],axis='X',s=12)
    else:
        B('closed calf rest',(0,-368,317),(587,75,200),M['blue'],23)
        B('folded foot panel',(0,-339,168),(568,61,78),M['blue'],17)
    tube('side recline handle',[(453,-40,367),(469,-45,396),(475,-28,465)],11,M['wood'],10)
    C('handle axle',(447,-40,367),13,20,M['steel'],axis='X',s=16)


def overbed(M):
    for y in [-248,248]:
        B('low wheeled base runner',(0,y,58),(750,40,32),M['steel'],6)
        for x in [-333,333]:caster(x,y,0,M,17)
    B('offset base crossbar',(-290,0,58),(48,530,35),M['steel'],6)
    B('lower telescoping mast',(-290,0,470),(65,65,820),M['steel'],7)
    B('upper telescoping mast',(-290,0,800),(45,45,300),M['dark'],5)
    B('height clamp block',(-290,0,846),(76,75,49),M['dark'],7)
    tube('height release handle',[(-261,-35,850),(-208,-50,838),(-188,-55,821)],7,M['dark'],8)
    B('top cantilever beam',(0,0,928),(672,47,38),M['steel'],5)
    B('rounded laminate overbed top',(0,0,970),(780,430,30),M['wood2'],14)
    rounded_loop('shallow raised table lip',768,418,32,986,M['wood'],3)


def create(catalog_id,M):
    # The kitchen palette intentionally includes glazed materials. Cloth needs
    # its own matte materials, preserving separate repaintable stable keys.
    if catalog_id in {'loose-cushion','loose-lumbar-cushion','throw-blanket','throw-blanket-draped','folding-dining-chair','folding-dining-chair-stored','dining-banquette','dining-banquette-corner','loft-bed','manual-recliner','manual-recliner-extended'}:
        M=dict(M)
        M['blue']=material('entry-slate-upholstery',(.13,.27,.34),.96)
        M['clay']=material('entry-terracotta-textile',(.47,.18,.105),.97)
        if catalog_id!='loft-bed':M['sage']=material('entry-sage-upholstery',(.23,.34,.26),.96)
    dispatch={
        'hall-tree':lambda:hall_tree(M),'coat-stand':lambda:coat_stand(M),
        'loose-cushion':lambda:pillow('square accent cushion',450,450,125,M,'clay'),
        'loose-lumbar-cushion':lambda:pillow('lumbar accent cushion',530,290,105,M,'blue'),
        'fabric-cubby-bin':lambda:cubby_bin(M),'underbed-drawer':lambda:underbed_drawer(M),
        'throw-blanket':lambda:throw(M),'throw-blanket-draped':lambda:throw(M,True),
        'entry-console':lambda:console(M),'woven-basket':lambda:basket(M),
        'rolling-clothes-rack':lambda:clothes_rack(M),'tilt-shoe-cabinet':lambda:shoe_cabinet(M),
        'stackable-shoe-rack':lambda:shoe_rack(M),'standing-photo-frame':lambda:photo_frame(M),
        'extending-table':lambda:dining_table(M),'extending-table-open':lambda:dining_table(M,True),
        'dressing-table':lambda:dressing_table(M),'folding-dining-chair':lambda:folding_chair(M),
        'folding-dining-chair-stored':lambda:folding_chair(M,True),'folding-screen':lambda:screen(M),
        'gateleg-table':lambda:gateleg(M,'open'),'gateleg-table-closed':lambda:gateleg(M,'closed'),
        'gateleg-table-one-leaf':lambda:gateleg(M,'one'),
        'dining-banquette':lambda:banquette(M),'dining-banquette-corner':lambda:banquette(M,True),
        'loft-bed':lambda:loft_bed(M),'bar-cart':lambda:bar_cart(M),
        'manual-recliner':lambda:recliner(M),'manual-recliner-extended':lambda:recliner(M,True),
        'overbed-table':lambda:overbed(M),
    }
    if catalog_id not in dispatch:raise KeyError(catalog_id)
    dispatch[catalog_id]()


def support_surfaces(catalog_id):
    """Conservative true planes, raw mm, z is Blender Y before driver mapping."""
    surfaces={
        'hall-tree':[("shoe", "Open shoe shelf",0,0,710,280,185,240),("seat", "Oak bench seat",0,-5,750,310,460,650)],
        'entry-console':[("lower", "Lower display shelf",0,0,965,205,212,440),("top", "Console top",0,0,1050,250,780,900)],
        'tilt-shoe-cabinet':[("top", "Closed cabinet top",0,0,910,220,1282,700)],
        'extending-table':[("top", "Compact dining top",0,0,1360,810,750,900)],
        'extending-table-open':[("top", "Extended dining top",0,0,1960,810,750,900)],
        'dressing-table':[("left", "Left dressing worktop",-160,0,435,410,752,700)],
        'gateleg-table':[("top", "Both supported leaves",0,0,1460,760,740,900)],
        'gateleg-table-closed':[("top", "Folded central top",0,0,260,760,740,900)],
        'gateleg-table-one-leaf':[("top", "Central top and right leaf",300,0,860,760,740,900)],
        'dining-banquette':[("seat", "Flat straight banquette seat",0,-32,1000,460,485,300)],
        'dining-banquette-corner':[("seat", "Corner banquette seat",43,-43,460,460,485,300)],
        'manual-recliner':[("seat", "Flat upright recliner seat",0,-97.5,480,450,507.5,300)],
        'loft-bed':[("mattress", "Flat covered mattress, clear of pillow",0,-225,880,1390,1772,600)],
        'bar-cart':[("lower", "Lower serving tray",0,0,545,340,146.5,475),("upper", "Upper serving tray",0,0,545,340,659.5,800)],
        'overbed-table':[("top", "Inside the overbed top lip",0,0,720,370,985,600)],
    }
    keys=('id','label','x','z','width','depth','height','clearance')
    return [dict(zip(keys,s)) for s in surfaces.get(catalog_id,[])]
