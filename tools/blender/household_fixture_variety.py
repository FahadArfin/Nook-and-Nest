"""Original P2 kitchen, bath and laundry fixtures, HOME-085--092 and HOME-106.

Geometry-only millimetre construction; the root MCP driver owns save/export.
"""
import math
import bpy
import bmesh
from mathutils import Vector
from build_kitchen_essentials import B,C,mesh,tube,ring,lathe,rounded_loop,material
from studio_geometry import text
from household_entry import beam,open_box,caster,group_transform


def shell(name,profiles,mat,exponent=2.0,center=(0,0,0),steps=64):
    """Closed rim/bottom cross-section swept round a superellipse, genuine cavity."""
    vs=[];fs=[]
    for rx,ry,z in profiles:
        for i in range(steps):
            a=i*math.tau/steps;c,s=math.cos(a),math.sin(a)
            vs.append((center[0]+rx*math.copysign(abs(c)**(2/exponent),c),center[1]+ry*math.copysign(abs(s)**(2/exponent),s),center[2]+z))
    for j in range(len(profiles)):
        for i in range(steps):
            a=j*steps+i;b=j*steps+(i+1)%steps;c=((j+1)%len(profiles))*steps+(i+1)%steps;d=((j+1)%len(profiles))*steps+i
            fs.append((a,b,c,d))
    o=mesh(name,vs,fs,mat)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    for p in o.data.polygons:p.use_smooth=True
    return o


def knob(x,y,z,M,cross=False):
    C('valve base rose',(x,y,z),20,8,M['steel'],s=24)
    C('valve stem',(x,y,z+17),9,26,M['steel'],s=20)
    tube('quarter-turn valve handle',[(x-25,y,z+30),(x+25,y,z+30)],5,M['steel'],8)
    if cross:tube('cross handle second bar',[(x,y-25,z+30),(x,y+25,z+30)],5,M['steel'],8)


def pot_filler(M):
    C('wall escutcheon',(-278,48,120),35,15,M['brass'],axis='Y',s=40)
    C('wall escutcheon inner step',(-278,36,120),26,12,M['brass'],axis='Y',s=32)
    tube('wall elbow', [(-278,30,120),(-278,-8,120),(-278,-19,135)],13,M['brass'],12)
    for x,y,z in [(-278,-19,144),(-11,-19,144),(266,-51,102)]:
        C('layered swivel collar',(x,y,z),19,54,M['brass'],s=24)
        ring('joint gasket',(x,y,z-15),19,1.3,M['dark'],steps=24)
    tube('first articulated horizontal arm',[(-278,-19,153),(-11,-19,153)],12,M['brass'],12)
    tube('second articulated horizontal arm',[(-11,-19,125),(266,-51,125)],11,M['brass'],12)
    for x,y,z in [(-278,-19,184),(266,-51,141)]:
        C('shutoff handle collar',(x,y,z),10,26,M['brass'],s=20)
        tube('quarter turn lever',[(x,y,z+9),(x+46,y,z+9),(x+57,y,z+16)],5,M['brass'],8)
    C('downward outlet tube',(266,-51,60),12,55,M['brass'],s=24)
    lathe('hollow aerator nozzle',[(8,25),(14,25),(15,32),(15,40),(9,40)],M['steel'],32,(266,-51,0))
    C('recessed aerator',(266,-51,34),8,2,M['dark'],s=24)
    for x in [-289,-267]:C('wall plate fixing',(x,38,120),3,3,M['steel'],axis='Y',s=8)


def island_hood(M):
    # Four separate folded metal sides form an open plenum, with real filters.
    for sign in [-1,1]:
        verts=[(-450,sign*300,50),(450,sign*300,50),(310,sign*185,168),(-310,sign*185,168)]
        o=mesh('tapered long canopy side',verts,[(0,1,2,3)],M['steel']);solid=o.modifiers.new('Folded metal thickness','SOLIDIFY');solid.thickness=6
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
        verts=[(sign*450,-300,50),(sign*450,300,50),(sign*310,185,168),(sign*310,-185,168)]
        o=mesh('tapered canopy end',verts,[(0,1,2,3)],M['steel']);solid=o.modifiers.new('Folded metal thickness','SOLIDIFY');solid.thickness=6
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
    rounded_loop('folded lower canopy rim',894,594,12,47,M['steel'],5)
    B('recessed plenum ceiling',(0,0,128),(770,470,10),M['dark'],3)
    for x in [-270,0,270]:
        B('filter recessed dark backing',(x,0,72),(245,404,8),M['dark'],2)
        for y in [-204,204]:B('filter frame rail',(x,y,62),(250,9,16),M['steel'],2)
        for dx in [-123,123]:B('filter frame end',(x+dx,0,62),(9,408,16),M['steel'],2)
        for yy in range(-185,186,25):B('stainless baffle fin',(x,yy,60),(227,9,19),M['steel'],2)
        B('filter release latch',(x,-174,45),(35,18,7),M['dark'],2)
    for x in [-365,365]:
        C('task light bezel',(x,-230,43),27,8,M['steel'],s=32)
        C('task light lens',(x,-230,38),22,3,M['light'],s=32)
    B('chimney upper housing',(0,0,500),(305,270,682),M['steel'],5)
    B('chimney telescoping seam',(0,0,600),(310,275,14),M['dark'],2)
    B('ceiling fixing plate',(0,0,838),(385,345,24),M['steel'],5)
    for x in [-158,158]:
        for y in [-135,135]:C('ceiling plate screw',(x,y,824),4,3,M['dark'],s=8)
    B('side control strip',(0,-292,78),(180,10,32),M['dark'],4)
    for x in [-57,-19,19,57]:C('control push button',(x,-299,78),7,3,M['steel'],axis='Y',s=16)


def freezer(M):
    for x in [-377,377]:B('insulated side wall',(x,0,841),(67,688,1580),M['cream'],11)
    B('insulated rear wall',(0,318,841),(754,48,1580),M['cream'],8)
    for z in [62,1620]:B('insulated cap',(0,0,z),(800,688,46),M['cream'],9)
    for x in [-311,311]:B('white inner freezer liner',(x,0,843),(9,574,1495),M['paper'],5)
    for z in [190,505,820,1135,1450]:
        for x in range(-288,289,48):tube('interior freezer wire shelf',[(x,-271,z),(x,268,z)],3,M['steel'],6)
        for y in [-265,265]:tube('wire shelf edge',[(-301,y,z),(301,y,z)],4,M['steel'],8)
    for x in [-330,330]:
        for y in [-274,274]:C('freezer adjustable foot',(x,y,24),26,48,M['dark'],s=20)
    B('dark front gasket',(0,-351,844),(788,15,1528),M['rubber'],17)
    B('closed insulated freezer door',(0,-387,844),(792,60,1535),M['cream'],19)
    for z in [224,1415]:B('door hinge housing',(390,-354,z),(31,57,71),M['steel'],5)
    tube('raised utility door handle',[(-297,-421,826),(-297,-466,841),(-297,-466,1186),(-297,-421,1201)],17,M['steel'],12)
    B('front temperature control recess',(0,-420,1360),(162,8,70),M['dark'],6)
    text('freezer temperature','-18',(0,-426,1362),25,M['light'])
    C('door lock rose',(-310,-421,548),14,4,M['steel'],axis='Y',s=20)
    B('lock key slot',(-310,-424,548),(3,2,12),M['dark'],.5)
    B('lower grille background',(0,-346,62),(664,10,71),M['dark'],3)
    for z in [35,49,63,77,91]:B('lower vent slat',(0,-355,z),(650,7,5),M['steel'],1)


def microwave(M):
    # Openable source construction, fixed closed drawer in the catalog.
    for x in [-284,284]:B('microwave side shell',(x,0,205),(18,568,390),M['steel'],5)
    for z in [16,394]:B('microwave cap',(0,0,z),(582,568,22),M['steel'],4)
    B('microwave back',(0,279,205),(576,14,376),M['steel'],3)
    open_box('drawer cooking cavity',516,500,240,63,M,'steel',13)
    for x in [-265,265]:B('drawer sliding guide',(x,0,149),(17,502,24),M['dark'],3)
    B('drawer outer fascia',(0,-294,179),(600,30,302),M['steel'],7)
    B('recessed dark drawer panel',(0,-312,177),(524,8,226),M['dark'],5)
    B('smoked inner window',(0,-318,183),(475,3,170),M['glass'],4)
    tube('horizontal drawer handle',[(-215,-313,304),(-215,-341,303),(215,-341,303),(215,-313,304)],10,M['steel'],10)
    control=B('slightly angled control fascia',(0,-289,372),(598,38,63),M['dark'],5);control.rotation_euler.x=math.radians(-12)
    text('microwave clock','12:00',(-154,-313,373),19,M['light'])
    for x in [3,45,87,129,171,213]:B('microwave control key',(x,-313,372),(28,3,19),M['steel'],3)
    for x in range(-245,246,35):B('top cabinet ventilation slot',(x,225,407),(16,61,2),M['dark'],1)


def microwave_cabinet(M):
    # 610 x 610 mm clear host bay, independent from its appliance.
    worktop=material('surface-stone',(.37,.395,.38),.72)
    for x in [-315,315]:B('sage cabinet side',(x,0,480),(20,630,780),M['sage'],4)
    B('open-bay rear panel',(0,308,660),(610,12,420),M['wood2'],3)
    B('appliance bay support',(0,0,430),(610,610,26),M['wood2'],4)
    B('upper front stabilizer',(0,299,856),(610,24,25),M['wood'],3)
    B('independent stone worktop',(0,0,883),(650,650,34),worktop,7)
    B('lower cabinet floor',(0,0,111),(610,610,22),M['wood2'],3)
    B('lower drawer face',(0,-319,277),(610,22,297),M['sage'],5)
    tube('lower drawer brass pull',[(-80,-333,370),(-80,-347,370),(80,-347,370),(80,-333,370)],6,M['brass'],8)
    B('recessed toe kick',(0,-252,58),(585,18,116),M['dark'],2)
    for x in [-270,270]:
        for y in [-240,240]:C('cabinet leveling foot',(x,y,47),23,94,M['dark'],s=16)


def bidet(M):
    ceramic=material('fixture-warm-porcelain',(.80,.79,.73),.27)
    shell('molded bidet pedestal',[(0,0,0),(135,212,0),(146,223,20),(133,208,45),(102,165,85),(102,166,230),(145,237,275),(0,0,275)],ceramic,2.8,center=(0,16,0))
    shell('hollow oval bidet basin',[(0,0,267),(126,205,267),(173,281,311),(191,307,349),(190,307,370),(171,278,373),(149,244,345),(115,184,295),(70,110,280),(0,0,280)],ceramic,2.4,center=(0,-10,0))
    B('raised rear faucet deck',(0,251,356),(297,115,51),ceramic,19)
    for x in [-99,99]:knob(x,243,381,M,True)
    C('vertical spray mounting rose',(0,-73,288),20,8,M['steel'],s=24)
    C('vertical spray nozzle',(0,-73,302),12,24,M['steel'],s=24)
    C('spray perforation',(0,-73,316),7,2,M['dark'],s=16)
    C('drain bezel',(0,73,287),23,4,M['steel'],s=32)
    C('recessed drain',(0,73,289),17,2,M['dark'],s=24)
    for a in range(0,360,60):
        x=10*math.cos(math.radians(a));y=73+10*math.sin(math.radians(a));C('drain strainer hole',(x,y,291),2,1,M['steel'],s=8)
    C('rear diverter control',(0,259,397),14,33,M['steel'],s=20)
    C('overflow bezel',(0,193,334),12,4,M['steel'],axis='Y',s=24)
    C('overflow hollow mouth',(0,190,334),8,3,M['dark'],axis='Y',s=20)


def walkin_tub(M):
    ceramic=material('fixture-ivory-acrylic',(.77,.785,.74),.33)
    shell('deep walk-in tub shell',[(0,0,13),(692,342,13),(738,385,48),(750,400,910),(746,397,938),(711,361,947),(668,319,912),(636,289,172),(580,258,136),(0,0,136)],ceramic,6.0)
    B('integral seated platform',(-420,0,410),(466,536,548),ceramic,41)
    back=B('integral angled seat back',(-650,0,713),(47,540,418),ceramic,19);back.rotation_euler.y=math.radians(-6)
    # Separate sealed access door and genuine external seal reveal.
    B('access door recessed gasket',(281,-397,504),(531,10,802),M['rubber'],35)
    B('closed access door outer panel',(281,-410,508),(514,19,782),ceramic,34)
    for x in [52,509]:
        for z in [279,756]:B('door hinge knuckle',(x,-423,z),(25,23,48),M['steel'],5)
    C('door latch pivot',(93,-432,803),19,13,M['steel'],axis='Y',s=24)
    tube('door latch lever',[(93,-443,803),(99,-455,861),(163,-457,883)],9,M['steel'],10)
    # Grab rail mounted to inner side and separate flexible handshower.
    tube('interior grab rail',[(-462,311,691),(-441,271,711),(152,271,711),(173,311,691)],17,M['steel'],12)
    for x in [-462,173]:C('grab rail wall rose',(x,310,691),25,8,M['steel'],axis='Y',s=24)
    knob(435,318,958,M)
    tube('tub spout',[(526,318,950),(526,318,1017),(474,271,1032),(417,237,1009)],14,M['steel'],12)
    C('handshower deck mount',(652,220,958),22,15,M['steel'],s=24)
    tube('handshower wand grip',[(651,218,960),(639,204,1026)],15,M['steel'],12)
    head=B('handshower spray head',(631,187,1040),(57,27,84),M['steel'],13);head.rotation_euler.x=math.radians(-17)
    B('handshower perforated face',(630,172,1042),(43,4,63),M['dark'],9)
    tube('short flexible shower hose',[(652,220,953),(643,252,868),(620,275,832),(590,269,872),(591,244,952)],7,M['steel'],10)
    C('floor drain surround',(346,11,143),36,7,M['steel'],s=40)
    C('floor drain strainer',(346,11,148),27,2,M['dark'],s=32)
    for x in [140,340,540]:
        for y in [-272,272]:C('small jet bezel',(x,y,362),15,7,M['steel'],axis='Y',s=24)
    for x in [-74,-28,18,64,110,156,202,248,294,340,386,432]:B('floor anti-slip rib',(x,0,145),(8,362,3),ceramic,1)


def towel_rail(M):
    for x in [-258,258]:
        C('vertical heating manifold',(x,-15,425),17,850,M['steel'],s=24)
        for z in [86,761]:
            C('wall mounting rose',(x,74,z),28,10,M['steel'],axis='Y',s=24)
            C('wall bracket standoff',(x,27,z),12,86,M['steel'],axis='Y',s=20)
    for z in [49,111,173,235,364,426,488,550,679,741,803]:
        tube('gently bowed towel rung',[(-258,-15,z),(-183,-33,z),(0,-43,z),(183,-33,z),(258,-15,z)],11,M['steel'],10)
    C('discreet lower connector',(258,-15,19),23,39,M['steel'],s=20)
    tube('short power connection',[(258,-15,10),(261,7,0),(258,61,0)],5,M['dark'],8)
    C('warm power indicator',(263,-36,23),3,2,M['light'],axis='Y',s=10)


def steamer(M):
    B('rounded steamer base',(0,0,122),(326,348,198),M['sage'],42)
    for x in [-132,132]:
        for y in [-137,137]:caster(x,y,0,M,17)
    B('removable translucent water reservoir',(0,76,227),(226,152,126),M['glass'],25)
    B('reservoir lower frame',(0,84,173),(234,164,20),M['dark'],8)
    tube('reservoir carrying handle',[(-57,80,286),(-57,80,312),(57,80,312),(57,80,286)],7,M['sage'],8)
    C('telescoping pole lower',(0,15,699),17,1020,M['steel'],s=20)
    C('telescoping pole upper',(0,15,1374),12,525,M['steel'],s=20)
    for z in [793,1176]:B('pole locking collar',(0,15,z),(48,48,37),M['dark'],8)
    tube('shaped garment hanger',[(-191,15,1496),(-145,15,1512),(-68,15,1572),(0,15,1619),(68,15,1572),(145,15,1512),(191,15,1496)],12,M['dark'],10)
    tube('hanger lower rail',[(-189,15,1496),(189,15,1496)],9,M['dark'],10)
    hose=[(-95,-140,165),(-128,-176,284),(-154,-182,492),(-151,-164,742),(-140,-142,979),(-124,-113,1210),(-97,-83,1411)]
    tube('flexible reinforced steam hose',hose,14,M['dark'],10)
    # Reinforcement follows the actual hose centerline and tangent; separate
    # source meshes remain editable without detached approximate ring centers.
    for z in range(325,1175,34):
        a,b=next((Vector(a),Vector(b)) for a,b in zip(hose,hose[1:]) if a[2]<=z<=b[2])
        t=(z-a.z)/(b.z-a.z);center=a.lerp(b,t);axis=(b-a).normalized()
        u=axis.cross(Vector((1,0,0))).normalized();v=axis.cross(u).normalized()
        tube('hose reinforcement rib',[center+15*(u*math.cos(k*math.tau/16)+v*math.sin(k*math.tau/16)) for k in range(17)],2,M['rubber'],6)
    wand=B('detachable steam head grip',(-85,-66,1466),(45,55,130),M['sage'],16);wand.rotation_euler.x=math.radians(-15)
    B('broad steam nozzle head',(-76,-62,1550),(152,73,47),M['sage'],17)
    B('perforated steam plate',(-76,-101,1552),(123,5,29),M['steel'],7)
    for x in [-124,-108,-92,-76,-60,-44,-28]:C('steam aperture',(x,-105,1552),3,2,M['dark'],axis='Y',s=8)
    C('front rotary output dial',(0,-178,163),28,11,M['dark'],axis='Y',s=28)
    B('dial position tick',(0,-185,182),(3,3,9),M['cream'],1)


def heater(M):
    for x in [-215,215]:
        for z in [138,660]:B('wall fixing tab',(x,151,z),(43,18,54),M['steel'],4)
    B('layered appliance rear pan',(0,8,404),(470,271,548),M['steel'],10)
    B('removable front enamel panel',(0,-133,404),(449,23,527),M['cream'],12)
    for x in [-202,202]:
        for z in [169,639]:C('front service screw',(x,-148,z),4,3,M['steel'],axis='Y',s=8)
    B('recessed front controller',(0,-148,414),(177,9,93),M['dark'],7)
    text('heater temperature','49',(-34,-155,419),30,M['light'])
    for x in [35,66]:B('heater control key',(x,-156,415),(20,3,22),M['steel'],3)
    for x,r in [(-103,37),(102,48)]:
        lathe('top vent connection collar',[(r-5,674),(r,674),(r,714),(r-5,714)],M['steel'],32,(x,5,0))
        ring('vent collar rolled bead',(x,5,709),r,3,M['steel'],steps=32)
    for x,marker in [(-158,'red'),(-53,'steel'),(60,'blue'),(158,'steel')]:
        C('bottom service pipe',(x,0,105),13,55,M['brass'],s=20)
        C('service union nut',(x,0,96),20,25,M['brass'],s=6)
        C('isolating valve body',(x,0,58),19,48,M['brass'],s=20)
        tube('valve quarter-turn lever',[(x,-6,59),(x,-48,59),(x,-61,66)],6,M[marker],8)
        C('capped service outlet',(x,0,24),16,19,M['brass'],s=20)
    tube('condensate stub',[(217,37,155),(218,37,91),(217,37,25)],9,M['cream'],10)
    B('small service information plaque',(0,-148,259),(182,2,59),M['paper'],2)
    for z,w in [(274,140),(264,132),(254,116),(244,128)]:B('plaque abstract instruction rule',(0,-150,z),(w,1,2),M['dark'],0)


def create(catalog_id,M):
    functions={
        'kitchen-pot-filler':pot_filler,'kitchen-island-hood':island_hood,
        'kitchen-upright-freezer':freezer,'kitchen-microwave-drawer':microwave,
        'kitchen-microwave-drawer-cabinet':microwave_cabinet,
        'bath-standalone-bidet':bidet,'bath-walk-in-tub':walkin_tub,
        'bath-heated-towel-rail':towel_rail,'laundry-garment-steamer':steamer,
        'utility-tankless-water-heater':heater,
    }
    if catalog_id not in functions:raise KeyError(catalog_id)
    functions[catalog_id](M)


def support_surfaces(catalog_id):
    planes={
        'kitchen-microwave-drawer-cabinet':[
            ('appliance-bay','Empty microwave appliance bay',0,-4,605,610,443,420),
            ('worktop','Independent cabinet worktop',0,0,610,610,900,900)],
    }
    keys=('id','label','x','z','width','depth','height','clearance')
    return [dict(zip(keys,s)) for s in planes.get(catalog_id,[])]
