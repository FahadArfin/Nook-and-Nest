"""48 original researched outdoor assemblies, authored in millimetres.

Individual construction parts remain editable; parent driver saves/export/renders.
Only creates parts in its caller's owned scene. No external object downloads.
Pools are above-ground basins, moving mechanisms have explicit fixed poses.
"""
import math
import bpy
from mathutils import Vector, Matrix
from build_kitchen_essentials import B, C, mesh, tube, lathe, rounded_loop, material
from household_geometry import ring


def palette(M):
    m=dict(M)
    for key,name,color,rough,metal,alpha in [
        ('teak','outdoor-teak-grain',(.43,.245,.105),.72,0,1),
        ('teak2','outdoor-teak-grain-light',(.54,.34,.17),.73,0,1),
        ('end','outdoor-teak-endgrain',(.31,.17,.075),.8,0,1),
        ('cedar','outdoor-cedar-grain',(.46,.255,.135),.81,0,1),
        ('rope','outdoor-rope-fiber',(.39,.31,.215),.95,0,1),
        ('slate','outdoor-slate-canvas',(.075,.18,.23),.96,0,1),
        ('sagecloth','outdoor-sage-canvas',(.22,.32,.225),.96,0,1),
        ('claycloth','outdoor-clay-canvas',(.42,.17,.09),.97,0,1),
        ('ivorycloth','outdoor-ivory-canvas',(.61,.55,.425),.96,0,1),
        ('powder','outdoor-graphite-powdercoat',(.04,.065,.071),.63,.2,1),
        ('greenmetal','outdoor-forest-powdercoat',(.08,.19,.145),.62,.2,1),
        ('stone','outdoor-limestone',(.51,.475,.395),.84,0,1),
        ('basalt','outdoor-honed-basalt',(.095,.11,.115),.65,0,1),
        ('water','outdoor-water',(.06,.32,.38),.17,.05,.64),
        ('liner','outdoor-pool-liner',(.11,.33,.42),.58,0,1),
        ('acrylic','outdoor-spa-acrylic',(.66,.67,.61),.3,0,1),
        ('soil','outdoor-potting-soil',(.08,.047,.025),.98,0,1),
        ('bronze','outdoor-brushed-bronze',(.29,.17,.085),.42,.75,1),
        ('ceramic','outdoor-kamado-ceramic',(.31,.075,.035),.4,0,1),
    ]:m[key]=material(name,color,rough,metal,alpha)
    m['glow']=material('outdoor-warm-led',(.95,.58,.22),.5,0,1,.65)
    return m


def beam(name,a,b,w,d,mat,bevel=3):
    a,b=Vector(a),Vector(b)
    o=B(name,(a+b)/2,(w,d,(b-a).length),mat,bevel)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o


def sheet(name,vertices,faces,mat,thickness=3):
    o=mesh(name,vertices,faces,mat)
    mod=o.modifiers.new('real thin fabric body','SOLIDIFY');mod.thickness=thickness
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def bolt(name,p,mat,r=5,axis='Y'):
    C(name+' recessed washer',p,r*1.4,1.8,mat,axis=axis,s=16)
    q=list(p);q['XYZ'.index(axis)]+=2
    C(name+' hex head',q,r,3,mat,axis=axis,s=6)


def plank(name,p,size,M,index=0):
    o=B(name,p,size,M['teak2' if index%4==0 else 'teak'],min(3,min(size)*.16))
    # Discrete end-grain caps are physical joins, not pasted retailer imagery.
    axis=0 if size[0]>=size[1] else 1
    for sign in [-1,1]:
        cap=list(size);cap[axis]=.45;center=list(p);center[axis]+=sign*(size[axis]/2+.12)
        B(name+' exposed end grain',center,cap,M['end'],0)
    return o


def pad(name,p,size,M,key='slate',bevel=26,tilt=0):
    o=B(name,p,size,M[key],min(bevel,min(size)*.3))
    # A flat central face accepts supported loose cushions; edge piping is separate.
    seam=rounded_loop(name+' boxed seam',size[0]-12,size[1]-12,24,p[2]+size[2]/2-10,M[key],2.2,y=p[1])
    seam.location.x+=p[0]
    if tilt:
        bpy.context.view_layer.update()
        t=Matrix.Translation(Vector(p))@Matrix.Rotation(tilt,4,'X')@Matrix.Translation(-Vector(p))
        for part in [o,seam]:part.matrix_world=t@part.matrix_world
    return o


def legs(w,d,h,M,key='powder',r=19):
    for x in [-w/2,w/2]:
        for y in [-d/2,d/2]:
            beam('splayed load-bearing leg',(x*1.04,y*1.04,15),(x,y,h),r*2,r*2,M[key],4)
            B('rubber floor glide',(x*1.04,y*1.04,9),(r*2+3,r*2+3,18),M['rubber'],4)


def caster(p,M,r=32):
    x,y,z=p
    C('caster swivel plate',(x,y,z+r*2+7),r*.75,7,M['steel'],s=16)
    for q in [-1,1]:B('caster fork',(x+q*r*.35,y,z+r+10),(5,r*1.6,r*1.5),M['steel'],2)
    C('caster tread',(x,y,z+r),r,r*.6,M['rubber'],axis='X',s=20)
    C('caster hub',(x,y,z+r),r*.46,r*.64,M['steel'],axis='X',s=16)
    B('wheel brake lever',(x,y+r*.9,z+r*1.5),(r*.45,r*.65,5),M['powder'],2)


def handle(name,x,y,z,w,M,axis='X'):
    if axis=='X':pts=[(x-w/2,y,z),(x-w/2,y-25,z),(x+w/2,y-25,z),(x+w/2,y,z)]
    else:pts=[(x,y,z-w/2),(x,y-25,z-w/2),(x,y-25,z+w/2),(x,y,z+w/2)]
    tube(name,pts,7,M['steel'],8)


def chair_rope(M):
    legs(480,470,425,M,r=15)
    rounded_loop('continuous seat frame',528,525,48,410,M['powder'],15)
    for x in [-275,275]:
        tube('swept arm and back upright',[(x,-235,423),(x,-242,626),(x,-205,653),(x,210,653),(x,244,788)],16,M['powder'],8)
        plank('teak arm cap',(x,-8,656),(44,390,25),M)
    tube('curved back top rail',[(-275,244,788),(-190,278,805),(0,297,808),(190,278,805),(275,244,788)],16,M['powder'],10)
    for i in range(27):
        x=-250+i*500/26;y=257+34*(1-(x/270)**2)
        tube('vertical doubled rope back',[(x,230,420),(x,y,787),(x+5,y,787),(x+5,230,420)],3,M['rope'],5)
    for j in range(12):
        z=445+j*27
        tube('interlaced horizontal rope',[(x,249+30*(1-(x/270)**2)+2*math.sin(i*math.pi),z) for i,x in enumerate(range(-250,251,25))],2.8,M['rope'],5)
    for x in range(-240,241,18):tube('seat woven strap',[(x,-225,416),(x,225,416)],3.5,M['rope'],5)
    pad('tailored dining pad',(0,-18,450),(489,465,58),M,'ivorycloth',16)
    for x in [-235,235]:bolt('arm fixing',(x,195,653),M['bronze'],4)


def chair_sling(M):
    for x in [-322,322]:
        beam('front angled timber leg',(x,-335,24),(x,-208,507),53,61,M['teak'],5)
        beam('long rear timber rail',(x,381,24),(x,-298,521),52,61,M['teak'],5)
        beam('back sling rail',(x,55,354),(x,328,742),45,58,M['teak'],5)
        plank('wide lounge arm',(x,-14,520),(60,558,34),M)
        bolt('folding frame pivot',(x+30,-20,319),M['bronze'],8,'X')
    for y,z in [(-286,410),(73,357),(331,740)]:beam('sling cross rail',(-322,y,z),(322,y,z),34,44,M['teak'],5)
    pts=[(-285,-290,430),(285,-290,430),(-285,-90,358),(285,-90,358),(-285,80,371),(285,80,371),(-285,331,739),(285,331,739)]
    o=mesh('continuous tensioned canvas sling',pts,[(0,1,3,2),(2,3,5,4),(4,5,7,6)],M['sagecloth'])
    mod=o.modifiers.new('sewn fabric thickness','SOLIDIFY');mod.thickness=5
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for x in [-281,281]:tube('sling bound side hem',[(x,-290,432),(x,-90,361),(x,80,374),(x,331,741)],4,M['sagecloth'],6)
    for x in [-318,318]:B('floor glides',(x,345,10),(61,84,20),M['rubber'],6)


def chair_woven(M):
    legs(710,650,270,M,r=18)
    rounded_loop('basket lower rim',805,775,110,320,M['powder'],13)
    # Curved U-shaped shell remains visibly open between actual strands.
    outline=[(-405,-328+j*48.8) for j in range(10)]
    outline += [(405*math.cos(math.pi-j*math.pi/26),160+245*math.sin(j*math.pi/26)) for j in range(27)]
    outline += [(405,160-j*48.8) for j in range(1,11)]
    for z in range(340,772,24):
        tube('horizontal woven shell course',[(x,y,z) for x,y in outline],5.7,M['rope'],5)
    for i,(x,y) in enumerate(outline):
        tube('interlaced basket upright',[(x+(2 if j%2 else -2),y,323+j*24) for j in range(20)],4.4,M['rope'],5)
    tube('basket rolled top rim',[(x,y,796) for x,y in outline],15,M['rope'],8)
    pad('boxed lounge cushion',(0,-35,427),(704,695,136),M,'sagecloth',33)
    pad('tailored fitted back pad',(0,300,647),(681,143,291),M,'sagecloth',27,-.1)


def sofa(M):
    legs(1990,740,295,M,r=20)
    for x in [-1028,1028]:
        for y in [-391,391]:B('full-height arm post',(x,y,473),(43,43,486),M['powder'],6)
        B('open arm top rail',(x,0,709),(48,825,39),M['powder'],5)
        B('arm lower rail',(x,0,327),(35,800,30),M['powder'],3)
        for y in range(-370,371,34):tube('side mesh upright',[(x,y,350),(x,y,690)],2.2,M['rope'],4)
        for z in range(366,690,35):tube('side mesh horizontal',[(x,-373,z),(x,373,z)],2,M['rope'],4)
    for y in [-375,375]:B('long structural seat rail',(0,y,308),(2075,43,49),M['powder'],5)
    for x in range(-920,921,115):B('ventilated seat slat',(x,0,322),(55,756,25),M['powder'],2)
    for x in [-661,0,661]:
        pad('boxed seat cushion',(x,-27,423),(646,708,150),M,'slate',35)
        pad('tailored back cushion',(x,338,627),(646,145,289),M,'slate',30,-.13)
    for z in [485,735]:B('rear frame cross rail',(0,402,z),(2095,40,33),M['powder'],4)
    for x in range(-980,981,70):tube('rear tensioned strap',[(x,397,390),(x,397,718)],3,M['rope'],5)


def daybed(M):
    legs(1670,1820,255,M,'teak',39)
    for x in [-882,882]:plank('long daybed side rail',(x,0,299),(82,1970,125),M)
    for y in [-952,952]:plank('broad daybed end rail',(0,y,299),(1805,78,125),M)
    for j in range(24):plank('individual bed platform slat',(0,-894+j*77.7,352),(1677,70,30),M,j)
    pad('deep terracotta daybed mattress',(0,-29,461),(1690,1840,173),M,'claycloth',42)
    for x in [-867,867]:
        plank('daybed upright',(x,850,577),(68,69,460),M)
        plank('low daybed arm cap',(x,150,618),(88,1450,40),M)
        plank('front mortised arm support',(x,-540,475),(58,62,250),M)
    for z in [607,740]:plank('back cross rail',(0,872,z),(1760,48,59),M)
    for x in [-423,423]:
        pad('fitted broad back pad',(x,791,672),(826,171,255),M,'ivorycloth',28,-.15)
    for x in [-882,882]:
        for y in [-882,882]:bolt('visible rail joining bolt',(x,y,310),M['bronze'],8,'X')


def egg(M):
    ring('wide stable circular base',(0,0,45),515,26,M['powder'],steps=64)
    tube('swept suspension mast',[(0,425,45),(0,484,482),(0,430,1110),(0,282,1684),(0,93,1952),(0,-55,1990)],34,M['powder'],12)
    for x in [-350,350]:beam('mast base brace',(x,370,52),(0,461,356),35,35,M['powder'],5)
    for j in range(8):ring('suspension chain link',(0,-57,1930-j*25),16,4,M['steel'],axis='Y' if j%2 else 'X',steps=12)
    tube('basket suspension yoke',[(-70,65,1723),(0,-57,1762),(70,65,1723)],9,M['steel'],8)
    # Partial ellipsoid wire cage with an intentionally open front, not a blob.
    for i in range(29):
        a=i*math.pi/28
        pts=[]
        for j in range(27):
            t=.12+j*2.90/26
            pts.append((430*math.sin(t)*math.cos(a),45+420*math.sin(t)*math.sin(a),1100+637*math.cos(t)))
        tube('egg basket meridian',pts,5,M['rope'],5)
    for j in range(25):
        t=.16+j*2.8/24
        tube('egg basket interlaced course',[(430*math.sin(t)*math.cos(i*math.pi/32),45+420*math.sin(t)*math.sin(i*math.pi/32),1100+637*math.cos(t)) for i in range(33)],4.3,M['rope'],5)
    tube('bound egg opening',[(430*math.sin(i*math.tau/64),40,1100+637*math.cos(i*math.tau/64)) for i in range(65)],13,M['rope'],8)
    pad('egg seat pad',(0,65,710),(520,350,140),M,'ivorycloth',42)
    pad('egg fitted back cushion',(0,300,980),(470,110,400),M,'ivorycloth',38,-.2)


def zero_gravity(M):
    for x in [-321,321]:
        tube('continuous reclining seat side',[(x,-748,439),(x,-356,361),(x,190,469),(x,561,1016)],17,M['powder'],10)
        tube('front folding leg',[(x,-486,28),(x,-402,29),(x,185,707),(x,266,728)],17,M['powder'],8)
        tube('rear folding leg',[(x,612,28),(x,507,28),(x,-149,705)],17,M['powder'],8)
        plank('wood capped arm',(x,20,728),(57,540,27),M)
        C('circular locking hinge',(x,15,580),38,22,M['powder'],axis='X',s=24)
        C('locking hinge center',(x,15,580),13,25,M['steel'],axis='X',s=16)
    for y,z in [(-748,439),(561,1016)]:beam('sling end crossbar',(-321,y,z),(321,y,z),28,28,M['powder'],5)
    segments=[(-735,455),(-356,383),(181,490),(544,1019)]
    v=[(x,y,z) for y,z in segments for x in [-266,266]]
    o=mesh('tensioned reclining textile',v,[(0,1,3,2),(2,3,5,4),(4,5,7,6)],M['slate'])
    mod=o.modifiers.new('canvas thickness','SOLIDIFY');mod.thickness=5;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for sign in [-1,1]:
        for a,b in zip(segments,segments[1:]):
            for i in range(13):
                t=i/13;y=a[0]*(1-t)+b[0]*t;z=a[1]*(1-t)+b[1]*t
                t2=min(1,t+.04);yy=a[0]*(1-t2)+b[0]*t2;zz=a[1]*(1-t2)+b[1]*t2
                tube('individual elastic lacing',[(sign*268,y,z),(sign*310,yy,zz),(sign*268,yy+12,zz+5)],2.4,M['rope'],5)
    pad('neck support cushion',(0,494,952),(460,83,177),M,'slate',23,-.55)


def bistro(M):
    for x in [-211,211]:
        beam('folding front frame',(x,-238,11),(x,208,763),24,21,M['greenmetal'],4)
        beam('folding rear frame',(x,227,11),(x,-191,467),25,21,M['greenmetal'],4)
        bolt('folding hinge',(x+14,0,378),M['steel'],6,'X')
        B('nylon foot',(x,-238,10),(31,36,20),M['rubber'],4)
        B('nylon rear foot',(x,227,10),(31,36,20),M['rubber'],4)
    for j in range(7):B('pressed seat slat',(0,-188+j*54,464+4*math.sin(j*math.pi/6)),(448,45,15),M['greenmetal'],4)
    for z in [705,792]:
        tube('gently bowed back slat',[(-224,216,z),(-150,239,z),(0,255,z),(150,239,z),(224,216,z)],20,M['greenmetal'],6)
    for y,z in [(-230,77),(220,87)]:beam('lower foot cross brace',(-211,y,z),(211,y,z),17,17,M['greenmetal'],3)


def dining_extended(M):
    for x in [-914,914]:
        for y in [-390,390]:beam('trestle splayed leg',(x,y,20),(x*.91,y*.9,668),83,85,M['teak'],6)
        plank('end trestle tie',(x,0,242),(86,854,80),M)
        plank('end apron',(x,0,672),(76,950,95),M)
    plank('long underframe stretcher',(0,0,244),(1920,90,95),M)
    for y in [-410,410]:plank('long apron',(0,y,673),(2230,65,95),M)
    for x,l in [(-725,865),(0,500),(725,865)]:
        for j in range(10):plank('table leaf slat',(x,-449+j*99.8,730),(l,91,40),M,j)
    for x in [-1173,1173]:plank('breadboard tabletop end',(x,0,730),(54,1000,40),M)
    for x in [-248,248]:B('extension leaf joint',(x,0,724),(3,977,15),M['end'],0)
    for x in [-914,914]:
        for y in [-431,431]:bolt('trestle carriage bolt',(x,y,258),M['bronze'],10)


def dining_ceramic(M):
    legs(1930,790,710,M,r=26)
    for y in [-414,414]:B('inset rectangular apron',(0,y,696),(1980,44,72),M['powder'],5)
    for x in [-973,973]:B('short apron',(x,0,696),(44,806,72),M['powder'],5)
    B('honed ceramic slab',(0,0,738),(2100,950,24),M['basalt'],9)
    B('slab bonded underlayer',(0,0,722),(2070,920,9),M['powder'],4)
    for x in [-960,960]:
        for y in [-380,380]:bolt('table corner fixing',(x,y,680),M['steel'],5)


def folding_table(M):
    for x in [-365,365]:
        beam('crossed folding leg',(x,-245,12),(x,210,690),32,41,M['teak'],4)
        beam('crossed folding leg',(x,245,12),(x,-210,690),32,41,M['teak'],4)
        bolt('gate pivot',(x+23,0,351),M['bronze'],7,'X')
    for j in range(9):plank('compact slatted table top',(-402+j*100.5,0,724),(94,600,32),M,j)
    for y in [-219,219]:plank('top underside bearer',(0,y,690),(855,42,39),M)
    for y in [-190,190]:B('under-leaf hinge',(0,y,697),(54,42,5),M['steel'],1)
    for x in [-365,365]:B('anti-slip floor shoe',(x,-245,10),(45,50,20),M['rubber'],4)


def conversation_table(M):
    C('recessed plinth',(0,0,28),259,56,M['basalt'],s=64)
    C('stone pedestal core',(0,0,214),286,335,M['stone'],s=64)
    for i in range(48):
        a=i*math.tau/48
        C('fluted pedestal reed',(286*math.cos(a),286*math.sin(a),218),9,315,M['stone'],s=8)
    lathe('broad stone tabletop',[(0,390),(480,390),(498,398),(500,410),(492,420),(0,420)],M['stone'],96)
    ring('fine inset rim',(0,0,419),470,1.5,M['basalt'],steps=96)


def post_foot(x,y,M,size=140):
    B('bolted anchor shoe',(x,y,9),(size+65,size+65,18),M['powder'],5)
    for dx in [-size*.43,size*.43]:
        for dy in [-size*.43,size*.43]:bolt('anchor fastener',(x+dx,y+dy,20),M['steel'],7,'Z')


def pergola(M):
    for x in [-1890,1890]:
        for y in [-1390,1390]:
            post_foot(x,y,M,150);B('hollow aluminium post',(x,y,1215),(150,150,2410),M['powder'],6)
            B('post concealed gutter face',(x+55,y,1020),(17,151,1990),M['powder'],2)
    for y in [-1425,1425]:B('deep perimeter gutter beam',(0,y,2370),(4000,150,245),M['powder'],8)
    for x in [-1925,1925]:B('perimeter end gutter',(x,0,2370),(150,2860,245),M['powder'],8)
    for j in range(23):
        y=-1312+j*119.3
        o=B('individually tilted roof louver',(0,y,2390),(3730,140,30),M['steel'],7);o.rotation_euler.x=.42
        for x in [-1856,1856]:C('louver pivot pin',(x,y,2390),8,24,M['steel'],axis='X',s=12)
    B('louver linkage rail',(1815,0,2430),(17,2650,18),M['powder'],3)
    tube('manual winding crank',[(1835,-1275,2330),(1835,-1275,1930),(1762,-1275,1930),(1762,-1275,1850)],9,M['steel'],8)


def gazebo(M):
    for x in [-1880,1880]:
        for y in [-1575,1575]:
            post_foot(x,y,M,180);B('heavy cedar post',(x,y,1120),(180,180,2240),M['cedar'],8)
            beam('long-side knee brace',(x,y,1695),(x-math.copysign(470,x),y,2240),83,95,M['cedar'],6)
            beam('end-side knee brace',(x,y,1695),(x,y-math.copysign(470,y),2240),83,95,M['cedar'],6)
    for y in [-1610,1610]:B('double end beam',(0,y,2245),(4020,160,225),M['cedar'],6)
    for x in [-1930,1930]:B('double side beam',(x,0,2245),(160,3400,225),M['cedar'],6)
    # True hip roof planes with a short ridge; underside remains open and raftered.
    corners=[(-2145,-1840,2410),(2145,-1840,2410),(2145,1840,2410),(-2145,1840,2410)]
    ridge=[(-310,0,3150),(310,0,3150)]
    verts=corners+ridge
    roof=mesh('standing seam hip roof shell',verts,[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)],M['powder'])
    mod=roof.modifiers.new('roof metal thickness','SOLIDIFY');mod.thickness=16;bpy.context.view_layer.objects.active=roof;bpy.ops.object.modifier_apply(modifier=mod.name)
    for ci,ri in [(0,4),(1,5),(2,5),(3,4)]:
        a=verts[ci];b=verts[ri]
        beam('diagonal hip rafter',(a[0],a[1],a[2]-78),(b[0],b[1],b[2]-78),85,100,M['cedar'],4)
    for side in [-1,1]:
        for x in range(-1800,1801,300):
            ridge_x=max(-310,min(310,x));beam('individual roof rafter',(x,side*1745,2355),(ridge_x,0,3085),48,105,M['cedar'],4)
            hip_y=max(0,(abs(x)-310)/1835*1840)
            hip_z=3150-hip_y/1840*740
            tube('parallel standing roof seam',[(x,side*1834,2425),(x,side*hip_y,hip_z+15)],7,M['powder'],6)
        for y in range(-1500,1501,300):
            hip_x=310+abs(y)/1840*1835
            hip_z=3150-abs(y)/1840*740
            tube('hip-end standing roof seam',[(side*2139,y,2425),(side*hip_x,y,hip_z+15)],7,M['powder'],6)
    beam('ridge cap',(-320,0,3160),(320,0,3160),65,35,M['powder'],5)
    for x in [-1900,1900]:
        for y in [-1660,1660]:
            for z in [2185,2265]:bolt('gazebo exposed carriage bolt',(x,y,z),M['steel'],10)


def awning(M):
    C('rear fabric roller',(0,1280,489),52,3500,M['steel'],axis='X',s=32)
    B('protective wall cassette',(0,1300,492),(3600,155,96),M['powder'],22)
    for x in [-1570,-530,530,1570]:B('wall mounting bracket',(x,1330,443),(94,44,160),M['powder'],4)
    for x in [-1300,1300]:
        tube('lateral articulated arm',[(x,1240,426),(x*.48,32,290),(x,-1275,152)],22,M['powder'],8)
        for xx,yy,zz in [(x,1240,426),(x*.48,32,290),(x,-1275,152)]:C('lateral elbow pivot',(xx,yy,zz),33,44,M['steel'],s=20)
    for j in range(18):
        x=-1750+j*200
        sheet('individual sewn canopy stripe',[(x,1250,520),(x+200,1250,520),(x+200,-1280,197),(x,-1280,197)],[(0,1,2,3)],M['sagecloth' if j%2 else 'ivorycloth'])
        B('hanging front valance stripe',(x+100,-1282,119),(200,7,155),M['sagecloth' if j%2 else 'ivorycloth'],1)
        tube('stitched fabric panel seam',[(x,1250,522),(x,-1280,199)],1.7,M['rope'],5)
    beam('front fabric tension bar',(-1790,-1278,190),(1790,-1278,190),45,48,M['powder'],6)
    ring('manual crank eye',(-1777,1230,410),21,5,M['steel'],axis='X',steps=20)


def parasol(M):
    for x in [-1240,-830]:
        for y in [-230,230]:B('separate ballast quarter',(x,y,79),(391,441,150),M['basalt'],16)
    B('mast base plate',(-1035,0,164),(330,380,23),M['powder'],5)
    tube('offset support mast',[(-1035,0,165),(-1035,0,1530),(-861,0,2200),(-403,0,2548),(210,0,2590)],44,M['powder'],12)
    B('sliding canopy carriage',(-1035,0,1350),(117,110,198),M['powder'],17)
    tube('canopy diagonal stay',[(-1020,0,1630),(-185,0,2455)],20,M['steel'],8)
    C('winding crank hub',(-1093,0,1350),34,31,M['steel'],axis='X',s=24)
    tube('winding crank',[(-1110,0,1350),(-1144,0,1350),(-1144,74,1280),(-1200,74,1280)],11,M['powder'],8)
    center=Vector((260,0,2470));vs=[center+Vector((0,0,110))]
    for i in range(16):
        a=i*math.tau/16;r=1560 if i%2==0 else 1475
        vs.append(center+Vector((r*math.cos(a),r*math.sin(a),-230 if i%2==0 else -278)))
    sheet('scalloped octagonal canopy',vs,[(0,i+1,(i+1)%16+1) for i in range(16)],M['ivorycloth'])
    for i in range(8):
        a=i*math.tau/8;end=center+Vector((1560*math.cos(a),1560*math.sin(a),-235))
        tube('underside umbrella rib',[center+Vector((0,0,75)),end],9,M['powder'],6)
        tube('rib stretcher',[center+Vector((0,0,-185)),center*.0+Vector((260+675*math.cos(a),675*math.sin(a),2423))],7,M['steel'],6)
    lathe('vented crown cap',[(0,2634),(120,2620),(340,2540),(348,2548),(0,2650)],M['ivorycloth'],48,center=(260,0,0))
    C('central suspension tube',(260,0,2425),24,380,M['powder'],s=20)


def shade_sail(M):
    anchors=[Vector((-1980,-1680,2690)),Vector((1980,-1680,2380)),Vector((0,1770,2780))]
    for a in anchors:
        post_foot(a.x,a.y,M,100);C('shade post',(a.x,a.y,a.z/2),50,a.z,M['powder'],s=20)
    center=sum(anchors,Vector())/3-Vector((0,0,180));v=[center];edge=[]
    for n in range(3):
        a,b=anchors[n],anchors[(n+1)%3]
        for j in range(13):
            t=j/13;p=a.lerp(b,t);inset=(center-p).normalized()*160*math.sin(t*math.pi);p+=inset;p.z-=40*math.sin(t*math.pi)
            edge.append(p)
    v+=edge;sheet('tensioned triangular woven sail',v,[(0,i+1,(i+1)%len(edge)+1) for i in range(len(edge))],M['claycloth'])
    tube('reinforced catenary perimeter hem',edge+[edge[0]],6,M['rope'],6)
    for a in anchors:
        direction=(center-a).normalized();tube('corner tension cable',[a,a+direction*180],5,M['steel'],6)
        ring('corner tension eye',tuple(a+direction*85),18,4,M['steel'],steps=16)


def basin_rect(name,w,d,h,floor,M,wall=35,key='liner'):
    B(name+' recessed floor',(0,0,floor/2),(w,d,floor),M[key],min(18,floor*.3))
    for x in [-w/2+wall/2,w/2-wall/2]:B(name+' side wall',(x,0,(floor+h)/2),(wall,d,h-floor),M[key],8)
    for y in [-d/2+wall/2,d/2-wall/2]:B(name+' end wall',(0,y,(floor+h)/2),(w-2*wall,wall,h-floor),M[key],8)


def pool_rect(M):
    basin_rect('welded rectangular vinyl liner',5490,2740,1286,28,M,18)
    for y in [-1385,1385]:
        tube('long tubular top rail',[(-2730,y,1287),(2730,y,1287)],33,M['powder'],12)
        for x in [-2420,-1452,-484,484,1452,2420]:
            tube('splayed long side support',[(x,y,1280),(x,y*1.22,39),(x+250,y*1.22,39)],29,M['powder'],10)
            B('side brace ground shoe',(x,y*1.22,17),(205,126,34),M['dark'],8)
            C('top rail clamp',(x,y,1256),39,95,M['steel'],axis='X',s=16)
    for x in [-2765,2765]:
        tube('short tubular top rail',[(x,-1360,1287),(x,1360,1287)],33,M['powder'],12)
        for y in [-770,770]:
            tube('splayed end support',[(x,y,1270),(x*1.06,y,36)],29,M['powder'],10)
            B('end brace ground shoe',(x*1.06,y,17),(140,170,34),M['dark'],8)
    B('still pool water below coping',(0,0,1120),(5415,2665,8),M['water'],12)
    for x in [-1700,1500]:
        C('liner plumbing flange',(x,-1380,350),56,27,M['cream'],axis='Y',s=24)
        C('capped water coupling',(x,-1404,350),32,44,M['powder'],axis='Y',s=20)
    for y in [-1348,1348]:tube('welded liner hem',[(-2730,y,1218),(2730,y,1218)],4,M['liner'],6)


def pool_round(M):
    lathe('hollow round pool liner',[(0,0),(2131,0),(2134,1150),(2115,1200),(2094,1200),(2094,34),(0,34)],M['liner'],96)
    ring('steel top perimeter rail',(0,0,1188),2150,32,M['powder'],steps=96)
    for i in range(16):
        a=i*math.tau/16;u=Vector((math.cos(a),math.sin(a),0))
        tube('vertical pool support',[u*2150+Vector((0,0,1180)),u*2200+Vector((0,0,35))],27,M['powder'],10)
        C('wide support foot',u*2200+Vector((0,0,14)),50,28,M['dark'],s=16)
        C('top rail joint',u*2150+Vector((0,0,1190)),41,48,M['steel'],s=16)
    C('recessed still water',(0,0,1030),2084,8,M['water'],s=96)
    for x in [-360,360]:
        C('liner outlet flange',(x,-2125,320),52,24,M['cream'],axis='Y',s=24)
        C('outlet cap',(x,-2154,320),29,40,M['powder'],axis='Y',s=20)


def plunge(M):
    basin_rect('raised plunge shell',2510,1910,1145,70,M,95,'acrylic')
    for x in [-1265,1265]:
        for j in range(19):B('cedar side cladding',(x,-924+j*102.6,557),(38,96,1100),M['cedar'],3)
    for y in [-965,965]:
        for j in range(25):B('cedar end cladding',(-1230+j*102.5,y,557),(96,38,1100),M['cedar'],3)
    for x in [-1220,1220]:plank('broad plunge coping',(x,0,1170),(155,2000,60),M)
    for y in [-922,922]:plank('end plunge coping',(0,y,1170),(2295,155,60),M)
    B('submerged sitting bench',(0,600,550),(2270,450,195),M['acrylic'],28)
    for j in range(3):B('submerged entry step',(-835,-455+j*245,200+j*150),(580,270,110),M['acrylic'],18)
    B('recessed plunge water',(0,0,971),(2360,1760,8),M['water'],10)
    for x in [-850,850]:C('pool side return jet',(x,874,781),32,8,M['steel'],axis='Y',s=24)


def spa(M):
    basin_rect('acrylic spa shell',1970,1970,796,112,M,96,'acrylic')
    for axis in [0,1]:
        for sign in [-1,1]:
            for j in range(21):
                p=[-943+j*94.3,sign*993,407];sz=[87,30,740]
                if axis:p=[p[1],p[0],p[2]];sz=[30,87,740]
                B('individual spa cabinet batten',p,sz,M['cedar'],3)
    rounded_loop('thick rounded spa lip',1950,1950,155,812,M['acrylic'],28)
    for x in [-633,633]:
        for y in [-633,633]:
            B('molded corner spa seat',(x,y,361),(512,512,214),M['acrylic'],71)
            B('sculpted raised seat back',(x,y*.99,625),(385,325,310),M['acrylic'],78)
            B('soft inset headrest',(x,y*1.3,790),(300,110,73),M['dark'],25)
            for dx in [-62,62]:
                C('stainless massage jet',(x+dx,y-math.copysign(169,y),662),22,9,M['steel'],axis='Y',s=20)
                C('jet dark nozzle',(x+dx,y-math.copysign(175,y),662),9,11,M['dark'],axis='Y',s=16)
    B('still spa water',(0,0,673),(1733,1733,6),M['water'],40)
    B('spa control recess',(0,-971,805),(208,75,31),M['powder'],10)
    B('spa control LCD',(0,-978,825),(110,48,3),M['light'],5)
    for x in [-79,79]:C('spa control button',(x,-976,826),8,4,M['steel'],s=12)
    for x in [-780,780]:C('waterfall accent light',(x,-872,716),14,7,M['light'],axis='Y',s=16)


def pool_ladder(M):
    for x in [-288,288]:
        tube('continuous pool ladder handrail',[(x,-681,20),(x,-312,1430),(x,-259,1807),(x,-182,1898),(x,0,1910),(x,182,1898),(x,259,1807),(x,312,1430),(x,681,20)],28,M['steel'],12)
        tube('lower spreader brace',[(x,-535,337),(x,535,337)],14,M['steel'],8)
        for y in [-681,681]:B('molded ladder foot',(x,y,24),(74,88,48),M['rubber'],14)
    B('top safety platform',(0,0,1410),(618,523,72),M['cream'],10)
    for sign in [-1,1]:
        for j in range(5):
            z=250+j*250;y=sign*(638-j*66)
            B('non-slip molded ladder tread',(0,y,z),(565,176,43),M['cream'],10)
            for k in range(7):B('tread anti-slip rib',(0,y-68+k*22,z+23),(540,5,3),M['dark'],1)
            for x in [-296,296]:bolt('ladder step fixing',(x,y,z),M['steel'],7,'X')
    for j in range(9):B('platform grip rib',(0,-200+j*50,1447),(572,8,4),M['dark'],1)


def pool_lounger(M):
    profile=[(-960,243),(-735,231),(-435,242),(-155,266),(105,335),(327,467),(552,626),(759,687),(961,677)]
    for x in [-298,298]:
        tube('flowing structural side runner',[(x,y,z-26) for y,z in profile],27,M['cream'],10)
        for y,z in [(-695,232),(560,625)]:beam('curved lounger ground strut',(x,y,20),(x,y,z-34),39,45,M['cream'],8)
    for i in range(29):
        pos=i*(len(profile)-1)/28;k=min(len(profile)-2,int(pos));t=pos-k
        a,b=profile[k],profile[k+1];y=a[0]*(1-t)+b[0]*t;z=a[1]*(1-t)+b[1]*t
        o=B('separate marine polymer slat',(0,y,z),(720,62,28),M['cream'],9)
        o.rotation_euler.x=math.atan2(b[1]-a[1],b[0]-a[0])
    for x in [-300,300]:
        for y,z in [(-730,215),(550,620)]:bolt('lounger flush fixing',(x,y,z),M['steel'],4,'Z')


def towel_valet(M):
    for x in [-421,421]:
        for y in [-222,222]:B('valet corner stile',(x,y,579),(50,50,1158),M['teak'],5)
    for z in [110,570,1128]:
        for j in range(8):plank('open slatted shelf',(-372+j*106.2,0,z),(95,436,25),M,j)
    B('lower cubby divider',(0,0,340),(25,445,439),M['teak'],4)
    B('upper cubby divider',(0,91,850),(25,246,540),M['teak'],4)
    for x in [-402,402]:
        for z in [673,836,1000]:tube('towel hanging rail',[(x,-222,z),(x,222,z)],12,M['bronze'],8)
    for j in range(8):plank('rear ventilated slat',(-372+j*106.2,219,837),(83,25,545),M,j)
    for x in [-350,-80]:B('removable hamper corner',(x,0,302),(18,353,333),M['rope'],4)
    B('hamper bottom',(-215,0,139),(292,352,14),M['rope'],3)
    for y in [-176,176]:
        for z in range(160,441,35):B('hamper woven batten',(-215,y,z),(292,12,16),M['rope'],3)


def solar_shower(M):
    B('anchored shower plinth',(0,160,17),(330,310,34),M['steel'],9)
    # Solid section is swept up and over with a real separate outlet face.
    path=[(0,185,36),(0,181,900),(0,160,1690),(0,90,2040),(0,-53,2200),(0,-241,2255),(0,-380,2225)]
    for a,b in zip(path,path[1:]):beam('formed aluminium shower section',a,b,132,75,M['powder'],18)
    B('integrated shower rose',(0,-379,2190),(180,120,25),M['steel'],10)
    for x in range(-66,67,22):
        for y in range(-418,-340,22):C('individual shower nozzle',(x,y,2176),3,3,M['dark'],s=8)
    C('mixer valve',(0,126,1170),35,50,M['steel'],axis='Y',s=24)
    tube('mixer lever',[(0,95,1170),(0,74,1248)],8,M['steel'],8)
    tube('low foot tap',[(0,153,401),(0,13,401),(0,-14,369)],16,M['steel'],8)
    C('foot tap control',(0,76,436),20,11,M['steel'],s=16)
    for x in [-122,122]:
        for y in [51,269]:bolt('shower anchor bolt',(x,y,35),M['steel'],8,'Z')


def kamado(M):
    for x in [-213,213]:
        for y in [-213,213]:
            caster((x,y,0),M,42);beam('wheeled grill cradle',(x,y,86),(x*.85,y*.85,566),31,31,M['powder'],5)
    ring('lower cradle support',(0,0,419),233,18,M['powder'],steps=48)
    lathe('ribbed ceramic lower vessel',[(0,370),(188,370),(210,395),(250,485),(278,660),(282,772),(266,781),(0,781)],M['ceramic'],64)
    lathe('ceramic domed grill lid',[(0,799),(280,799),(278,866),(249,968),(197,1050),(90,1096),(0,1098)],M['ceramic'],64)
    for z,r in [(445,231),(480,249),(519,259),(559,268),(599,275),(640,280),(681,283),(720,284),(841,281),(880,272),(921,257),(960,234),(995,211),(1028,180)]:ring('ceramic molded body rib',(0,0,z),r,2.2,M['ceramic'],steps=64)
    for z in [782,800]:ring('stainless lid band',(0,0,z),282,6,M['powder'],steps=64)
    C('adjustable chimney vent',(0,0,1150),66,104,M['powder'],s=32)
    C('chimney rain cap',(0,0,1200),76,20,M['powder'],s=32)
    for i in range(8):
        a=i*math.tau/8;B('chimney vent gap',(63*math.cos(a),63*math.sin(a),1164),(20,10,24),M['dark'],2)
    for x in [-425,425]:
        for j in range(5):plank('folded side shelf slat',(x,-193+j*94,787),(315,85,23),M,j)
        for y in [-174,174]:beam('side shelf bracket',(math.copysign(250,x),y,690),(x,y,770),18,18,M['powder'],3)
    handle('front grill handle',0,-300,881,270,M)
    B('rear lid hinge',(0,310,810),(180,77,187),M['powder'],13)
    for x in [-65,65]:C('spring hinge barrel',(x,330,840),23,137,M['steel'],s=20)
    B('ash slider vent',(0,-259,499),(147,20,77),M['steel'],5)
    for x in range(-55,56,22):B('ash air slot',(x,-271,499),(10,2,39),M['dark'],2)
    C('temperature gauge',(0,-262,1000),34,15,M['steel'],axis='Y',s=32)
    C('temperature dial',(0,-271,1000),29,2,M['cream'],axis='Y',s=32)
    tube('thermometer needle',[(0,-274,1000),(15,-274,1016)],1.5,M['dark'],5)


def smoker(M):
    for x in [-338,338]:
        for y in [-230,230]:beam('smoker cart leg',(x,y,48),(x*.87,y*.87,650),39,39,M['powder'],5)
    for x in [-339,339]:C('smoker transport wheel',(x,225,84),84,40,M['rubber'],axis='X',s=32)
    B('lower cart shelf',(0,0,223),(715,435,28),M['powder'],5)
    # A distinct barrel-shaped cookbox and seam are true radial construction.
    o=lathe('barrel cookbox',[(0,-330),(229,-330),(254,-290),(254,290),(229,330),(0,330)],M['powder'],48)
    o.rotation_euler.y=math.pi/2;o.location=(0,0,816)
    for x in [-310,310]:ring('end cap rolled seam',(x,0,816),248,5,M['steel'],axis='X',steps=48)
    tube('curved lid separation',[(-302,-202,962),(0,-202,962),(302,-202,962)],2.7,M['dark'],6)
    handle('barrel lid handle',0,-260,908,470,M)
    B('side pellet hopper',(421,40,837),(145,430,377),M['powder'],12)
    B('separate hopper lid',(421,40,1033),(158,442,25),M['steel'],7)
    B('pellet controller',(421,-184,861),(101,14,136),M['dark'],8)
    B('controller display',(421,-193,887),(72,3,45),M['light'],3)
    C('controller dial',(421,-199,818),18,10,M['steel'],axis='Y',s=20)
    B('folded side shelf',(-419,0,788),(169,465,27),M['steel'],7)
    for j in range(3):tube('utensil hook',[(-481,-110+j*110,780),(-491,-110+j*110,739),(-470,-110+j*110,731)],5,M['steel'],8)
    tube('grease drain pipe',[(80,166,598),(100,190,526)],15,M['steel'],8)
    lathe('hanging grease cup',[(0,419),(52,419),(62,526),(56,533),(49,438),(0,438)],M['steel'],24,center=(100,190,0))
    B('rear chimney',(0,237,997),(113,65,251),M['powder'],9)
    B('chimney cap',(0,237,1148),(159,113,24),M['powder'],7)


def cabinet_shell(w,d,h,M):
    for x in [-w/2+18,w/2-18]:B('folded weatherproof side panel',(x,0,h/2+25),(36,d,h-50),M['steel'],5)
    B('rear service panel',(0,d/2-14,h/2+25),(w-55,28,h-50),M['steel'],4)
    B('cabinet underside',(0,0,99),(w-40,d-34,35),M['powder'],5)
    for x in [-w*.38,w*.38]:
        for y in [-d*.35,d*.35]:
            C('adjustable threaded foot',(x,y,47),11,54,M['steel'],s=16)
            C('rubber levelling pad',(x,y,13),27,26,M['rubber'],s=20)
    for z in range(185,760,49):B('rear ventilation fold',(0,d/2+1,z),(w*.56,3,9),M['powder'],2)


def sink_cabinet(M):
    cabinet_shell(812,608,853,M)
    for x in [-202,202]:
        B('louvered cabinet door',(x,-309,479),(393,25,735),M['powder'],5)
        for z in range(179,795,38):
            o=B('door folded steel louver',(x,-326,z),(363,19,24),M['steel'],3);o.rotation_euler.x=.18
        handle('vertical cabinet pull',x+(-142 if x>0 else 142),-341,532,155,M,'Z')
    for x in [-343,343]:B('sink side rim',(x,0,877),(134,650,38),M['steel'],6)
    for y in [-271,271]:B('sink end rim',(0,y,877),(555,108,38),M['steel'],6)
    B('recessed sink bottom',(0,0,657),(520,398,24),M['steel'],20)
    for x in [-266,266]:B('sink inner wall',(x,0,758),(20,417,220),M['steel'],7)
    for y in [-208,208]:B('sink inner end',(0,y,758),(520,20,220),M['steel'],7)
    C('sink drain',(0,0,671),33,6,M['dark'],s=24)
    ring('drain strainer lip',(0,0,675),29,3,M['steel'],steps=24)
    for i in range(5):B('drain strainer slot',(-16+i*8,0,676),(3,27,2),M['steel'],1)
    tube('gooseneck outdoor faucet',[(0,270,895),(0,270,1130),(0,255,1170),(0,192,1180),(0,74,1180),(0,37,1144)],16,M['steel'],12)
    C('faucet base',(0,270,901),29,26,M['steel'],s=24)
    tube('faucet side lever',[(37,270,918),(69,270,973)],7,M['steel'],8)


def fridge(M):
    cabinet_shell(608,609,875,M)
    B('countertop cap',(0,0,885),(620,640,30),M['basalt'],6)
    for x in [-272,272]:B('insulated glass door stile',(x,-310,496),(52,43,705),M['steel'],7)
    for z in [158,833]:B('glass door top bottom rail',(0,-310,z),(510,43,42),M['steel'],6)
    B('transparent fridge glazing',(0,-314,495),(490,5,635),M['glass'],3)
    B('dark interior rear',(0,245,503),(492,10,663),M['dark'],5)
    for z in [225,388,551,714]:
        for x in range(-225,226,28):tube('refrigerator shelf wire',[(x,-253,z),(x,252,z)],2.5,M['steel'],5)
        for y in [-253,253]:tube('shelf edge rail',[(-230,y,z),(230,y,z)],4,M['steel'],6)
    handle('vertical fridge door pull',212,-337,549,418,M,'Z')
    B('fridge toe vent frame',(0,-310,86),(576,36,106),M['powder'],4)
    for j in range(9):B('front cooling grille',(0,-330,47+j*10),(540,5,4),M['steel'],1)
    B('small temperature readout',(-161,-336,826),(68,5,21),M['light'],3)


def drawers(M):
    cabinet_shell(800,600,855,M)
    B('honed stone prep worktop',(0,0,883),(820,650,34),M['basalt'],7)
    for z,h in [(229,245),(484,245),(739,225)]:
        B('separate drawer box front',(0,-307,z),(760,35,h),M['steel'],7)
        B('recessed drawer pull shadow',(0,-327,z+h*.34),(632,5,24),M['dark'],3)
        B('folded drawer pull lip',(0,-337,z+h*.34+9),(641,21,11),M['steel'],3)


def bar_island(M):
    for x in [-797,797]:B('bar end panel',(x,0,505),(50,653,960),M['teak'],5)
    for z in [122,540,1007]:B('rear serving shelf',(0,25,z),(1560,560,33),M['teak2'],4)
    for j in range(33):plank('teak front bar batten',(-785+j*49.1,-313,542),(41,38,940),M,j)
    B('stone overhanging bar slab',(0,-13,1034),(1800,800,52),M['basalt'],10)
    for x in [-514,0,514]:B('rear bottle cubby divider',(x,83,780),(25,422,438),M['teak'],3)
    for x in [-716,716]:tube('footrail standoff',[(x,-330,204),(x,-392,204)],13,M['steel'],8)
    tube('continuous front footrail',[(-815,-392,204),(815,-392,204)],20,M['steel'],10)
    for x in [-760,760]:
        for y in [-264,264]:C('bar adjustable glide',(x,y,20),28,40,M['rubber'],s=16)


def cooler(M):
    teal=material('outdoor-cooler-teal',(.06,.285,.278),.5,.15)
    for x in [-346,346]:
        for y in [-198,198]:caster((x,y,0),M,32);B('cooler leg',(x,y,287),(37,37,420),teal,6)
    B('lower open tray',(0,0,159),(736,437,27),teal,8)
    B('insulated cooler body',(0,0,620),(785,479,361),teal,35)
    for x in [-200,200]:
        B('separate insulated split lid',(x,0,817),(393,493,61),M['cream'],19)
        handle('lid lift handle',x,-20,850,110,M)
    for x in [-442,442]:tube('wide side carrying loop',[(math.copysign(389,x),-140,685),(x,-140,685),(x,140,685),(math.copysign(389,x),140,685)],12,M['steel'],8)
    B('bottle opener plate',(-211,-245,663),(43,13,65),M['steel'],4)
    tube('bottle opener hoop',[(-225,-254,679),(-225,-267,660),(-199,-267,660),(-199,-254,679)],5,M['steel'],6)
    B('removable bottle cap catcher',(-211,-265,522),(94,62,148),teal,9)
    C('side drain outlet',(399,111,493),18,22,M['steel'],axis='X',s=20)
    for x in [-201,201]:B('rear lid hinge',(x,240,789),(61,24,50),M['steel'],4)


def prep_table(M):
    for x in [-505,505]:
        for y in [-244,244]:caster((x,y,0),M,36);C('trolley tubular leg',(x,y,461),22,721,M['steel'],s=20)
    B('rolled upper prep worktop',(0,0,874),(1120,650,38),M['steel'],10)
    B('lower steel undershelf',(0,0,264),(1060,559,27),M['steel'],6)
    for y in [-300,300]:B('folded worktop apron',(0,y,839),(1072,19,56),M['steel'],3)
    tube('trolley push handle',[(544,-237,810),(625,-237,810),(625,237,810),(544,237,810)],18,M['steel'],10)
    tube('front hanging rail',[(-475,-303,750),(475,-303,750)],11,M['steel'],8)
    for x in [-350,-175,0,175,350]:tube('removable utensil hook',[(x,-303,758),(x,-324,747),(x,-332,718),(x,-309,707)],4,M['steel'],6)


def raised_bed(M):
    w,d=2350,1150
    # Repeated offset rings create real continuous corrugated sheet relief.
    def outline(z,offset=0):
        r=255+offset;pts=[]
        for x,y,start in [(w/2-255,d/2-255,0),(-w/2+255,d/2-255,90),(-w/2+255,-d/2+255,180),(w/2-255,-d/2+255,270)]:
            for j in range(13):
                a=math.radians(start+j*90/12);pts.append((x+r*math.cos(a),y+r*math.sin(a),z))
        return pts
    loops=[outline(z,7*math.sin(z*math.tau/60)) for z in range(0,436,15)]
    v=[p for loop in loops for p in loop];n=len(loops[0])
    wall=mesh('continuous corrugated galvanized planter panels',v,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(loops)-1) for i in range(n)],M['greenmetal'])
    mod=wall.modifiers.new('galvanized sheet thickness','SOLIDIFY');mod.thickness=2;bpy.context.view_layer.objects.active=wall;bpy.ops.object.modifier_apply(modifier=mod.name)
    tube('protected upper planter rim',outline(441)+[outline(441)[0]],8,M['dark'],6)
    soil=outline(336,-28);bottom=[(x,y,300) for x,y,z in soil]
    mesh('recessed rounded soil mass',bottom+soil,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],M['soil'])
    for x in [-835,0,835]:
        for y in [-580,580]:
            for z in range(40,421,60):bolt('planter overlapping panel rivet',(x,y,z),M['steel'],4)


def trough(name,p,w,d,h,M):
    x,y,z=p
    B(name+' floor',(x,y,z+12),(w-28,d-28,24),M['cedar'],3)
    for xx in [-w/2+13,w/2-13]:B(name+' end',(x+xx,y,z+h/2),(26,d,h),M['cedar'],4)
    for yy in [-d/2+13,d/2-13]:
        for j in range(3):B(name+' side plank',(x,y+yy,z+(j+.5)*h/3),(w-50,26,h/3-3),M['cedar'],4)
    B(name+' recessed soil',(x,y,z+h-55),(w-65,d-65,12),M['soil'],4)
    for xx in [-w/2+20,w/2-20]:
        for yy in [-d/2,d/2]:bolt(name+' fixing',(x+xx,y+yy,z+h*.6),M['bronze'],4)


def vertical_planter(M):
    for x in [-416,416]:
        beam('ladder planter upright',(x,217,18),(x,120,1480),54,58,M['cedar'],5)
        beam('splayed rear leg',(x,-215,18),(x,119,1280),42,48,M['cedar'],5)
    for j in range(3):trough('separate herb planting trough',(0,-100+j*65,285+j*455),900,350,243,M)
    for x in [-416,416]:beam('lower frame spreader',(x,-210,126),(x,218,126),35,36,M['cedar'],3)


def trellis(M):
    for x in [-541,541]:
        B('steel stabilizing foot',(x,0,21),(115,500,42),M['powder'],6)
        B('screen structural post',(x,110,922),(65,65,1842),M['powder'],6)
    for j in range(21):B('individual horizontal cedar screen slat',(0,91,590+j*59),(1200,38,48),M['cedar'],4)
    trough('integrated narrow screen planter',(0,-61,33),1120,320,399,M)
    for x in [-541,541]:
        for z in [690,1280,1760]:bolt('concealed frame fastener',(x,64,z),M['steel'],5)


def bin_store(M):
    B('raised storage floor',(0,0,36),(1398,770,72),M['powder'],10)
    for x in [-708,708]:
        B('rear corner stile',(x,382,598),(42,47,1190),M['powder'],6)
        for j in range(13):B('molded side weatherboard',(x,0,87+j*83),(36,771,79),M['greenmetal'],4)
    for j in range(13):B('molded rear weatherboard',(0,386,87+j*83),(1387,35,79),M['greenmetal'],4)
    for x in [-351,351]:
        B('separate framed bin-store door',(x,-390,605),(681,41,1075),M['powder'],9)
        for j in range(12):B('door weatherboard insert',(x,-416,137+j*81),(631,18,76),M['greenmetal'],4)
        for z in [257,928]:B('external hinge plate',(math.copysign(681,x),-426,z),(44,13,99),M['steel'],4)
        handle('bin-store door handle',x*.15,-432,669,120,M,'Z')
    B('overhanging lift lid',(0,0,1196),(1455,820,108),M['powder'],18)
    for x in [-480,480]:B('lid hinge',(x,399,1153),(92,33,85),M['steel'],6)
    for j in range(7):B('rear ventilation slot',(-210+j*70,406,1070),(50,3,14),M['dark'],3)
    B('padlock latch plate',(0,-442,618),(56,9,40),M['steel'],3)


def log_store(M):
    for x in [-532,532]:
        for y in [-258,258]:B('log-store upright',(x,y,773),(68,68,1495),M['cedar'],5)
    for j in range(11):B('raised ventilated floor board',(-500+j*100,0,150),(87,555,36),M['cedar'],4)
    for x in [-548,548]:
        for j in range(10):
            o=B('overlapping side board',(x,0,240+j*121),(27,565,140),M['cedar'],3);o.rotation_euler.y=.035
    for z in [305,590,875,1160,1430]:B('rear air-gap cross board',(0,275,z),(1080,27,114),M['cedar'],3)
    roof=B('pitched roof boarding',(0,0,1590),(1200,650,44),M['cedar'],5);roof.rotation_euler.x=-.1
    roof=B('separate dark roofing felt',(0,0,1616),(1196,648,8),M['basalt'],2);roof.rotation_euler.x=-.1
    for x in [-561,561]:beam('roof edge fascia',(x,-326,1645),(x,326,1580),30,67,M['cedar'],4)
    for x in [-500,500]:
        for z in [145,735,1350]:bolt('store framing bolt',(x,-289,z),M['steel'],7)


def planter_bench(M):
    for x in [-818,818]:trough('deep end planter',(x,0,0),564,600,680,M)
    for j in range(6):plank('thick joined bench seat',(0,-242+j*96.8,455),(1220,86,57),M,j)
    for x in [-532,532]:B('hidden bench crossbearer',(x,0,395),(65,537,61),M['cedar'],5)
    for x in [-570,570]:
        for y in [-209,209]:bolt('seat attachment bolt',(x,y,485),M['bronze'],5,'Z')


def obelisk(M):
    for x,y in [(-260,-260),(-260,260),(260,260),(260,-260)]:
        tube('tapered obelisk upright',[(x,y,0),(x*.85,y*.85,660),(x*.48,y*.48,1350),(0,0,1818)],10,M['greenmetal'],8)
    for z,r in [(270,309),(640,271),(980,224),(1320,157),(1590,91)]:ring('graduated climbing support',(0,0,z),r,7,M['greenmetal'],steps=40)
    C('finial collar',(0,0,1818),24,31,M['bronze'],s=20)
    lathe('shaped obelisk finial',[(0,1821),(23,1825),(35,1847),(29,1871),(0,1900)],M['bronze'],24)


def mushroom_heater(M):
    lathe('vented fuel cylinder shroud',[(0,0),(215,0),(238,36),(211,595),(169,655),(0,655)],M['steel'],48)
    for a in [-.45,-.25,-.05,.15,.35]:
        x=215*math.sin(a);y=-215*math.cos(a);B('lower housing ventilation',(x,y,133),(20,3,64),M['dark'],3)
    C('heater support mast',(0,0,1172),42,1058,M['steel'],s=24)
    C('burner core',(0,0,1850),126,299,M['dark'],s=32)
    for i in range(32):
        a=i*math.tau/32;tube('burner mesh vertical wire',[(131*math.cos(a),131*math.sin(a),1705),(131*math.cos(a),131*math.sin(a),1994)],2,M['steel'],5)
    for z in range(1720,1991,24):ring('burner mesh ring',(0,0,z),132,2,M['steel'],steps=32)
    lathe('spun mushroom reflector',[(0,2140),(77,2140),(150,2127),(398,2040),(405,2048),(398,2062),(147,2160),(74,2170),(0,2170)],M['steel'],64)
    C('reflector finial',(0,0,2178),13,64,M['steel'],s=16)
    C('control collar',(0,0,1635),71,108,M['powder'],s=24)
    C('heat control knob',(0,-75,1630),21,23,M['dark'],axis='Y',s=20)
    for x in [-145,145]:C('housing transport wheel',(x,197,56),54,35,M['rubber'],axis='X',s=24)


def pyramid_heater(M):
    B('pyramid heater base',(0,0,40),(560,560,80),M['powder'],12)
    for x in [-233,233]:
        for y in [-233,233]:beam('tapered structural corner',(x,y,70),(x*.48,y*.48,2168),24,24,M['steel'],4)
    for y in [-237,237]:
        B('fuel cabinet panel',(0,y,385),(464,21,618),M['steel'],7)
        for z in range(130,630,43):B('fuel cabinet louver',(0,y+math.copysign(12,y),z),(403,3,10),M['dark'],2)
    for x in [-237,237]:B('fuel cabinet side',(x,0,385),(21,454,618),M['steel'],7)
    lathe('clear central heat tube',[(67,728),(76,728),(76,2109),(67,2109)],M['glass'],32)
    for side in [-1,1]:
        for i in range(11):
            t=-1+i/5
            tube('protective cage upright',[(t*207,side*207,765),(t*114,side*114,2132)],3,M['powder'],5)
            tube('protective cage side upright',[(side*207,t*207,765),(side*114,t*114,2132)],3,M['powder'],5)
    for z in range(795,2130,95):
        half=207-(z-765)/1367*93;rounded_loop('protective cage cross ring',half*2,half*2,8,z,M['powder'],3)
    lathe('small pyramid reflector',[(0,2134),(95,2134),(245,2220),(258,2241),(0,2270)],M['steel'],4)
    C('ignition button',(0,-254,663),13,8,M['dark'],axis='Y',s=20)
    C('control knob',(92,-252,665),23,14,M['powder'],axis='Y',s=20)


def festoon(M):
    for x in [-1500,1500]:
        C('weighted post base',(x,0,52),240,104,M['basalt'],s=48)
        C('garden light pole',(x,0,1275),24,2450,M['powder'],s=20)
        C('pole joining sleeve',(x,0,1250),28,80,M['steel'],s=20)
    points=[(-1500+i*75,0,2470-320*math.sin(i*math.pi/40)) for i in range(41)]
    tube('drooping festoon cable',points,6,M['dark'],6)
    for i in range(9):
        x=-1250+i*312.5;z=2470-320*math.sin((x+1500)*math.pi/3000)
        tube('bulb drop cable',[(x,0,z),(x,0,z-83)],4,M['dark'],6)
        C('weatherproof lamp socket',(x,0,z-88),18,32,M['powder'],s=16)
        lathe('warm festoon bulb',[(0,z-188),(18,z-184),(30,z-168),(34,z-145),(27,z-122),(17,z-105),(0,z-105)],M['glow'],24,center=(x,0,0))


def lantern(M):
    B('stepped lantern base',(0,0,20),(230,230,40),M['bronze'],8)
    for x in [-96,96]:
        for y in [-96,96]:B('lantern corner post',(x,y,168),(13,13,270),M['bronze'],3)
    for x in [-97,97]:B('side clear glass',(x,0,168),(3,180,256),M['glass'],1)
    for y in [-97,97]:B('front rear clear glass',(0,y,168),(180,3,256),M['glass'],1)
    B('top frame',(0,0,300),(219,219,23),M['bronze'],5)
    mesh('peaked ventilated cap',[(-115,-115,312),(115,-115,312),(115,115,312),(-115,115,312),(0,0,377)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],M['bronze'])
    for x in [-55,0,55]:B('cap air vent',(x,-58,345),(24,5,12),M['dark'],2)
    tube('swing lantern handle',[(-55,0,370),(-65,0,430),(-44,0,457),(44,0,457),(65,0,430),(55,0,370)],7,M['bronze'],8)
    C('LED candle body',(0,0,132),54,182,M['cream'],s=32)
    lathe('warm LED candle tip',[(0,224),(9,225),(12,236),(6,252),(0,267)],M['glow'],16)


def torch(M):
    C('garden stake',(0,0,539),14,1078,M['powder'],s=16)
    lathe('tapered torch reservoir',[(0,1050),(45,1060),(96,1330),(104,1398),(90,1421),(0,1421)],M['bronze'],32)
    C('wick collar',(0,0,1434),29,33,M['steel'],s=24)
    C('unlit cotton wick',(0,0,1455),10,23,M['rope'],s=12)
    tube('snuffer cap tether',[(81,0,1400),(106,0,1365),(115,0,1415),(93,0,1480)],3,M['steel'],6)
    lathe('tethered snuffer cap',[(0,1480),(35,1480),(31,1500),(0,1510)],M['bronze'],24,center=(90,0,0))


def watering_can(M):
    lathe('genuinely hollow watering can',[(0,0),(92,0),(108,24),(103,252),(89,275),(73,275),(76,260),(87,35),(0,25)],M['steel'],48)
    ring('rolled watering can rim',(0,0,273),88,4,M['steel'],steps=48)
    tube('arched top carrying handle',[(-88,0,240),(-81,0,325),(-40,0,359),(41,0,359),(78,0,325),(86,0,240)],12,M['greenmetal'],10)
    tube('rear D handle',[(-93,0,226),(-170,0,226),(-184,0,206),(-184,0,84),(-170,0,64),(-93,0,64)],12,M['greenmetal'],10)
    # Tapered spout segments remain separate real components.
    beam('tapered pouring spout',(87,0,73),(389,0,292),33,38,M['steel'],12)
    stem=Vector((389,0,292));direction=Vector((.8,0,.6))
    rose=C('rose perforated head',stem+direction*37,62,31,M['steel'],s=32);rose.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
    for j in range(4):
        rr=12+j*13
        for i in range(8+j*4):
            a=i*math.tau/(8+j*4);p=stem+direction*54+Vector((-.6*rr*math.sin(a),rr*math.cos(a),.8*rr*math.sin(a)))
            o=C('rose water perforation',p,2.4,1.5,M['dark'],s=8);o.rotation_euler=direction.to_track_quat('Z','Y').to_euler()


def pool_equipment(M):
    B('equipment service pad',(0,0,22),(960,550,44),M['basalt'],12)
    lathe('sand filter pressure vessel',[(0,45),(185,45),(207,95),(232,206),(237,394),(211,535),(144,598),(0,614)],M['cream'],48,center=(-204,0,0))
    for z,r in [(91,201),(127,218),(477,226),(518,217)]:ring('filter tank reinforcing rib',(-204,0,z),r,6,M['cream'],steps=48)
    C('multiport valve body',(-204,0,652),102,100,M['powder'],s=24)
    tube('multiport selector handle',[(-204,0,705),(-204,0,759),(-85,0,759)],16,M['powder'],8)
    C('pressure gauge',(-204,-100,687),32,24,M['steel'],axis='Y',s=24)
    C('pressure gauge face',(-204,-114,687),28,3,M['cream'],axis='Y',s=24)
    tube('pressure gauge needle',[(-204,-117,687),(-193,-117,705)],1.5,M['dark'],5)
    C('pump motor',(286,105,158),96,279,M['powder'],axis='Y',s=32)
    for i in range(12):
        a=i*math.tau/12;beam('motor cooling fin',(286+98*math.cos(a),-5,158+98*math.sin(a)),(286+98*math.cos(a),227,158+98*math.sin(a)),7,12,M['steel'],2)
    C('transparent strainer basket',(286,-142,224),94,205,M['glass'],s=32)
    C('strainer lid',(286,-142,331),101,24,M['powder'],s=32)
    for x in [212,360]:B('pump mounting foot',(x,58,70),(30,242,28),M['powder'],3)
    for points in [[(-106,0,651),(15,0,651),(67,-81,560),(92,-142,303),(197,-142,247)],[(286,-237,217),(286,-261,143),(111,-261,107)]]:
        tube('curved pool plumbing hose',points,25,M['dark'],10)
    for p in [(-103,0,650),(197,-142,247)]:ring('hose screw clamp',p,28,4,M['steel'],axis='X',steps=20)


def deck_step(M):
    for x in [-418,418]:
        B('lower stringer',(x,0,92),(77,631,144),M['powder'],6)
        B('upper stringer',(x,164,246),(77,301,145),M['powder'],6)
    for z,y in [(173,-164),(350,164)]:
        for j in range(4):plank('spa access tread slat',(0,y-120+j*80,z),(1000,72,40),M,j)
        for x in [-418,418]:
            for yy in [y-107,y+107]:bolt('recessed tread fixing',(x,yy,z+20),M['steel'],4,'Z')
    for x in [-418,418]:
        for y in [-242,242]:B('rubber step floor pad',(x,y,10),(92,88,20),M['rubber'],5)


BUILDERS={
    'outdoor-rope-dining-chair':chair_rope,'outdoor-teak-sling-chair':chair_sling,
    'outdoor-woven-club-chair':chair_woven,'outdoor-aluminium-sofa':sofa,
    'outdoor-teak-daybed':daybed,'outdoor-hanging-egg-chair':egg,
    'outdoor-zero-gravity-chair':zero_gravity,'outdoor-steel-bistro-chair':bistro,
    'outdoor-extendable-dining-table':dining_extended,'outdoor-ceramic-dining-table':dining_ceramic,
    'outdoor-folding-balcony-table':folding_table,'outdoor-round-conversation-table':conversation_table,
    'outdoor-louvered-pergola':pergola,'outdoor-timber-gazebo':gazebo,
    'outdoor-retractable-awning':awning,'outdoor-cantilever-parasol':parasol,
    'outdoor-triangle-shade-sail':shade_sail,'pool-rectangular-frame':pool_rect,
    'pool-round-frame':pool_round,'pool-timber-plunge':plunge,'outdoor-square-hot-tub':spa,
    'outdoor-pool-ladder':pool_ladder,'outdoor-pool-lounger':pool_lounger,
    'outdoor-pool-towel-valet':towel_valet,'outdoor-solar-shower':solar_shower,
    'outdoor-kamado-grill':kamado,'outdoor-pellet-smoker':smoker,
    'outdoor-sink-cabinet':sink_cabinet,'outdoor-fridge-cabinet':fridge,
    'outdoor-drawer-cabinet':drawers,'outdoor-bar-island':bar_island,
    'outdoor-cooler-cart':cooler,'outdoor-stainless-prep-table':prep_table,
    'outdoor-raised-garden-bed':raised_bed,'outdoor-vertical-planter':vertical_planter,
    'outdoor-trellis-screen':trellis,'outdoor-bin-store':bin_store,'outdoor-log-store':log_store,
    'outdoor-planter-bench':planter_bench,'outdoor-garden-obelisk':obelisk,
    'outdoor-patio-heater':mushroom_heater,'outdoor-pyramid-heater':pyramid_heater,
    'outdoor-string-light-poles':festoon,'outdoor-caged-lantern':lantern,
    'outdoor-citronella-torch':torch,'outdoor-watering-can':watering_can,
    'outdoor-pool-equipment':pool_equipment,'outdoor-deck-step':deck_step,
}


def create(catalog_id,M):
    if catalog_id not in BUILDERS:raise KeyError(catalog_id)
    BUILDERS[catalog_id](palette(M))
    if catalog_id in {'outdoor-caged-lantern','outdoor-watering-can'}:
        scene=bpy.context.scene
        scene['household_support_center_mm']=[0,0,0]
        scene['household_support_footprint_mm']=[230,230] if catalog_id=='outdoor-caged-lantern' else [184,184]
        scene['household_support_footprint_shape']='rectangle' if catalog_id=='outdoor-caged-lantern' else 'circle'


def support_surfaces(catalog_id):
    """Actual conservative flat usable surfaces, author mm before driver mapping.

    Deliberately no swimming-water/pool-lip/roof support planes. A roof is not a
    tabletop and these props do not provide pedestrian or safety simulation.
    """
    planes={
        'outdoor-rope-dining-chair':[('seat','Flat dining cushion',0,-18,430,400,479,250)],
        'outdoor-woven-club-chair':[('seat','Flat club seat cushion',0,-50,600,520,495,220)],
        'outdoor-aluminium-sofa':[(f'seat-{i}','Flat sofa seat cushion',x,-70,545,475,498,250) for i,x in enumerate([-661,0,661])],
        'outdoor-teak-daybed':[('mattress','Flat daybed mattress',0,-185,1560,1300,547.5,350)],
        'outdoor-hanging-egg-chair':[('seat','Flat hanging-chair cushion',0,45,410,190,780,150)],
        'outdoor-extendable-dining-table':[('top','Extended teak dining top',0,0,2320,920,750,1200)],
        'outdoor-ceramic-dining-table':[('top','Ceramic dining top',0,0,2040,890,750,1200)],
        'outdoor-folding-balcony-table':[('top','Compact balcony table top',0,0,810,540,740,900)],
        'outdoor-round-conversation-table':[('top','Round stone top',0,0,650,650,420,800)],
        'outdoor-pool-towel-valet':[('left-lower','Lower right cubby',205,0,340,355,122.5,410),('left-upper','Upper left cubby',-205,-13,342,322,582.5,510),('right-upper','Upper right cubby',205,-13,342,322,582.5,510)],
        'outdoor-sink-cabinet':[('left-rim','Left sink preparation strip',-343,0,95,440,896,220),('right-rim','Right sink preparation strip',343,0,95,440,896,220)],
        'outdoor-fridge-cabinet':[('top','Drinks fridge top',0,0,558,578,900,900)],
        'outdoor-drawer-cabinet':[('top','Stone preparation worktop',0,0,760,590,900,900)],
        'outdoor-bar-island':[('top','Stone bar overhang',0,-13,1700,700,1060,900),
            ('prep-left','Left center serving cubby',-257,45,435,390,556.5,420),
            ('prep-right','Right center serving cubby',257,45,435,390,556.5,420),
            ('prep-end-left','Left end serving cubby',-650,45,190,390,556.5,420),
            ('prep-end-right','Right end serving cubby',650,45,190,390,556.5,420)],
        'outdoor-stainless-prep-table':[('top','Steel trolley worktop',0,0,1030,560,893,900),('lower','Open trolley undershelf',0,0,970,470,277.5,495)],
        'outdoor-planter-bench':[('seat','Clear central bench seat',0,0,1040,430,483.5,500)],
        'outdoor-deck-step':[('lower','Lower spa access tread',0,-164,910,245,193,130),('upper','Upper spa access tread',0,164,910,245,370,500)],
    }
    keys=('id','label','x','z','width','depth','height','clearance')
    return [dict(zip(keys,p)) for p in planes.get(catalog_id,[])]
