"""Original HOME-115–134 models. Editable millimetre assemblies, no scene clearing.
Parent serializes official Blender MCP, exports and reviews final models.
"""
import math
import bpy
from mathutils import Matrix,Vector
from build_kitchen_essentials import B,C,mesh,tube,ring,lathe,rounded_loop,material
from studio_geometry import text,cavity
from household_specialty import beam,wheel
from household_utilities import _cut,_grille


def _drumkit(M):
    for x in [-415,415]:
        for y in [-263,283]:
            C('four post rack leg',(x,y,391),20,734,M['dark'],s=20)
            B('rack rubber foot',(x,y,20),(71,90,40),M['rubber'],12)
        tube('side curved rack rail',[(x,-263,746),(x+(-45 if x<0 else 45),0,765),(x,283,746)],20,M['dark'],10)
    tube('front cross rack rail',[(-415,-263,746),(0,-363,778),(415,-263,746)],20,M['dark'],10)
    for x,y,z,r in [(-90,120,718,132),(-200,-259,833,112),(105,-272,846,112),(395,101,755,114)]:
        C('pad mounting collar',(x,y,z-51),25,51,M['dark'],s=20)
        tube('pad bracket arm',[(x,y,z-55),(x,y-77,z-55),(x,y-77,750)],11,M['steel'],8)
        C('drum pad shell',(x,y,z),r,42,M['dark'],s=40)
        C('taut mesh drum head',(x,y,z+23),r-13,3,M['fabric'],s=40)
        ring('rubber pad rim',(x,y,z+25),r-5,6,M['rubber'],steps=40)
        for j in range(6):
            a=j*math.tau/6;C('pad tuning lug',(x+(r-2)*math.cos(a),y+(r-2)*math.sin(a),z+7),4,22,M['steel'],s=8)
    for x,y,z in [(-453,-395,1084),(416,-377,1117),(-420,186,977)]:
        tube('cymbal support boom',[(x*.88,y*.57,751),(x*.88,y*.57,z-102),(x,y,z)],9,M['steel'],8)
        lathe('shaped rubber cymbal pad',[(0,z+17),(36,z+17),(60,z+8),(158,z-6),(163,z-2),(153,z+6),(62,z+18),(31,z+33),(0,z+33)],M['rubber'],48,center=(x,y,0))
        C('cymbal wing cap',(x,y,z+39),12,13,M['dark'],s=16)
    for x in [-220,100]:
        B('floor pedal base',(x,291,24),(95,235,37),M['dark'],8)
        p=B('hinged pedal plate',(x,289,51),(72,198,15),M['steel'],4);p.rotation_euler.x=.16
        for y in [227,257,287,317]:B('pedal grip rib',(x,y,65),(61,3,3),M['rubber'],0)
    B('kick tower floor plate',(100,152,20),(143,250,37),M['dark'],6)
    B('kick trigger supporting upright',(100,82,124),(38,34,204),M['dark'],5)
    C('kick trigger pad',(100,110,205),71,38,M['rubber'],axis='Y',s=32)
    tube('kick beater arm',[(100,199,53),(100,176,218)],7,M['steel'],8)
    C('kick beater',(100,154,218),22,35,M['cream'],axis='Y',s=20)
    B('control module',(-469,34,834),(162,158,55),M['dark'],10)
    B('module display',(-469,5,863),(99,55,3),M['light'],3)
    for x in [-512,-479,-445]:C('module control button',(x,62,864),7,3,M['cream'],s=12)
    tube('bound signal harness',[(-456,31,805),(-420,30,710),(-414,-250,689),(0,-334,715),(400,-244,699)],4,M['rubber'],6)


def _throne(M):
    C('padded drum throne',(0,0,513),181,72,M['rubber'],s=48)
    C('seat mounting plate',(0,0,470),109,16,M['dark'],s=32)
    C('threaded height post',(0,0,346),21,245,M['steel'],s=20)
    for z in range(275,458,18):ring('height adjustment thread',(0,0,z),21,1.2,M['dark'],steps=20)
    C('tripod collar',(0,0,248),34,80,M['dark'],s=20)
    for i in range(3):
        a=i*math.tau/3;tube('tripod brace',[(0,0,282),(202*math.cos(a),202*math.sin(a),27)],13,M['steel'],8)
        B('rubber throne foot',(202*math.cos(a),202*math.sin(a),19),(57,55,38),M['rubber'],10)


def _shredder(M):
    bin=B('removable paper collection bin',(0,0,169),(226,349,325),M['dark'],24)
    _cut(bin,B('bin window opening cutter',(0,-173,177),(108,50,185),M['glass'],13))
    B('recessed bin window backing',(0,-150,177),(104,2,181),M['rubber'],10)
    B('separate lift-off cutter head',(0,0,368),(240,370,83),M['cream'],18)
    B('recessed feed slit',(0,-12,409),(197,9,3),M['rubber'],3)
    for x in [-85,85]:B('feed slot guide mark',(x,-12,412),(1,15,1),M['steel'],0)
    B('top control slider track',(56,98,410),(80,16,3),M['dark'],3)
    B('power slider',(38,98,414),(23,13,5),M['blue'],2)
    B('bin viewing window',(0,-175,177),(108,3,185),M['glass'],14)
    for z in [94,111,128,145,162]:B('visible shredded strip',(0,-172,z),(72,1,3),M['paper'],0)
    for x in [-122,122]:B('head lifting grip',(x,0,375),(3,132,22),M['rubber'],5)
    _grille('rear motor ventilation',0,185,364,159,40,M,8,mat=M['dark'],depth=4)


def _perforated_panel(M):
    vs=[];fs=[];w=43;h=47
    for ix in range(12):
        for iz in range(7):
            x=-236.5+ix*w;z=41+iz*h
            outer=[(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]
            inner=[(-3.5,-10),(3.5,-10),(3.5,10),(-3.5,10)]
            base=len(vs)
            for y in [-4,4]:
                vs.extend([(x+px,y,z+pz) for px,pz in outer+inner])
            for j in range(4):
                k=(j+1)%4
                fs.extend([(base+j,base+k,base+4+k,base+4+j),
                           (base+8+j,base+12+j,base+12+k,base+8+k),
                           (base+4+j,base+4+k,base+12+k,base+12+j)])
    return mesh('perforated board with 84 true slots',vs,fs,M['cream'])


def _pegboard(M):
    _perforated_panel(M)
    for x in [-266,266]:B('rounded panel side edge',(x,0,195),(25,8,350),M['cream'],3)
    for z in [21,369]:B('rounded panel top bottom',(0,0,z),(558,8,13),M['cream'],3)
    for x in [-188,188]:
        B('wide tabletop support foot',(x,0,7),(79,160,14),M['dark'],5)
        B('foot upright clamp',(x,0,38),(49,18,51),M['dark'],4)
    B('small hanging shelf',(-119,-48,196),(214,85,9),M['wood'],3)
    for x in [-201,-37]:tube('shelf hook',[(x,-45,191),(x,-8,191),(x,-8,234),(x,5,234)],3,M['steel'],6)
    cup=lathe('open hanging pen cup',[(0,0),(33,0),(36,7),(39,98),(35,98),(31,9),(0,9)],M['blue'],32,center=(137,-43,82))
    for x in [120,153]:tube('cup hanging hook',[(x,-8,165),(x,-8,197),(x,6,197)],3,M['steel'],6)


def _footrest(M):
    for x in [-224,224]:
        tube('side tubular cradle',[(x,-167,15),(x,-182,30),(x,-70,128),(x,128,128),(x,172,22),(x,153,14)],11,M['steel'],10)
        for y in [-160,160]:B('rubber floor pad',(x,y,9),(38,59,18),M['rubber'],6)
    C('tilt axle',(0,0,89),12,447,M['steel'],axis='X',s=20)
    plate=B('tilted broad foot platform',(0,0,103),(440,315,21),M['dark'],12);plate.rotation_euler.x=math.radians(15)
    for y in range(-133,134,22):
        z=115+y*math.sin(math.radians(15))
        o=B('non slip tread rib',(0,y*math.cos(math.radians(15)),z),(412,5,5),M['rubber'],1);o.rotation_euler.x=math.radians(15)


def _ramp(M):
    # Sloped board is a box-section beam with its width running across the ramp.
    beam('long inclined timber deck',(0,-847,30),(0,469,591),382,26,M['wood'],4)
    beam('carpet tread',(0,-841,48),(0,463,608),358,13,M['fabric'],3)
    for x in [-193,193]:
        beam('incline side lip',(x,-849,49),(x,472,613),24,40,M['wood'],4)
        beam('landing support leg',(x,745,15),(x,745,596),32,40,M['wood'],5)
        beam('diagonal underside brace',(x,-20,21),(x,728,585),25,35,M['wood2'],4)
        B('non slip leg pad',(x,745,9),(45,58,18),M['rubber'],4)
    B('upper landing',(0,660,601),(407,427,28),M['wood'],5)
    B('landing carpet',(0,661,622),(360,394,12),M['fabric'],4)
    B('back landing cross brace',(0,743,256),(383,29,31),M['wood'],4)


def _easel(M):
    for x in [-294,294]:
        for sy in [-1,1]:beam('splayed timber easel leg',(x,sy*218,17),(x,sy*14,1093),37,38,M['wood'],5)
        C('top folding hinge',(x,0,1078),14,67,M['steel'],axis='Y',s=16)
        tube('side limit strap',[(x,-143,391),(x,143,391)],7,M['fabric'],6)
    for y,mat in [(-104,M['dark']),(104,M['cream'])]:
        B('separate drawing face',(0,y,762),(552,10,589),mat,5)
        for x in [-281,281]:B('drawing board vertical frame',(x,y,762),(27,23,630),M['wood'],4)
        for z in [456,1068]:B('drawing board cross frame',(0,y,z),(578,23,26),M['wood'],4)
        B('paint tray bottom',(0,y*1.72,426),(652,125,15),M['blue'],5)
        B('paint tray front lip',(0,y*2.23,443),(649,13,34),M['blue'],4)
    C('paper roll spindle',(0,42,1002),14,589,M['wood'],axis='X',s=20)
    C('separate paper roll',(0,42,1002),45,419,M['paper'],axis='X',s=40)
    # Original small house/chalk scene, no copied art.
    tube('chalk roof',[(-142,-111,746),(0,-111,867),(142,-111,746)],3,M['cream'],6)
    tube('chalk house walls',[(-108,-111,751),(-108,-111,582),(108,-111,582),(108,-111,751)],3,M['cream'],6)
    tube('chalk door',[(-28,-111,584),(-28,-111,674),(28,-111,674),(28,-111,584)],3,M['clay'],6)
    ring('chalk sun',(165,-111,954),35,3,M['clay'],axis='Y',steps=24)


def _stroller(M):
    for x in [-194,194]:
        for y in [-311,303]:
            wheel('stroller wheel',(x,y,66),66,31,M)
            B('wheel fork',(x,y,115),(24,48,52),M['dark'],5)
        tube('curved push chassis',[(x,-311,125),(x,-79,491),(x,286,852),(x,350,1016)],15,M['dark'],10)
        tube('folding front strut',[(x,303,121),(x,-136,576)],14,M['steel'],10)
        C('folding joint cap',(x,-46,524),28,12,M['dark'],axis='X',s=24)
    tube('soft push handle',[(-194,350,1016),(-172,369,1041),(172,369,1041),(194,350,1016)],18,M['rubber'],10)
    B('under seat basket bottom',(0,6,150),(344,476,11),M['fabric'],4)
    for x in [-172,172]:B('open basket fabric side',(x,6,206),(10,486,114),M['fabric'],3)
    for y in [-232,244]:B('open basket fabric end',(0,y,206),(344,10,114),M['fabric'],3)
    B('tailored stroller seat',(0,-80,476),(350,305,53),M['blue'],15)
    back=B('reclined tailored back',(0,100,684),(347,46,384),M['blue'],18);back.rotation_euler.x=math.radians(-17)
    B('foot support',(0,-304,358),(307,136,21),M['dark'],7)
    for x in [-76,76]:tube('visible shoulder harness',[(x,118,832),(x,64,649),(0,-141,511)],10,M['rubber'],6)
    tube('adjustable lap harness',[(-149,-105,509),(0,-141,527),(149,-105,509)],9,M['rubber'],6)
    B('harness centre buckle',(0,-150,527),(42,14,39),M['dark'],5)
    # Canopy is tailored segmented barrel mesh with ribs, never an ellipsoid.
    vs=[];steps=10
    for x in [-181,181]:
        for i in range(steps+1):
            a=math.radians(10+80*i/steps);vs.append((x,124-263*math.sin(a),811+210*math.cos(a)))
    fs=[(i,i+1,steps+2+i,steps+1+i) for i in range(steps)]
    mesh('segmented fabric canopy',vs,fs,M['blue'])
    for i in [0,5,10]:
        a=math.radians(10+80*i/steps);y=124-263*math.sin(a);z=811+210*math.cos(a)
        tube('canopy support rib',[(-181,y,z),(181,y,z)],3,M['dark'],6)
    for x in [-181,181]:tube('canopy bound edge',[vs[i+(0 if x<0 else steps+1)] for i in range(steps+1)],4,M['fabric'],6)
    for x in [-181,181]:
        C('canopy pivot hinge',(x,104,725),19,24,M['dark'],axis='X',s=20)
        tube('curved canopy support stay',[(x,104,725),(x,113,827),(x,93,931),(x,78,1017)],8,M['dark'],8)


def _hutch(M):
    # Sheltered house occupies the rear third; run is an actual open wire cage.
    B('removable hutch tray',(0,687,28),(830,766,39),M['dark'],12)
    for x in [-412,412]:B('rounded shelter side',(x,687,389),(30,780,706),M['sage'],12)
    B('shelter back access panel',(0,1064,375),(825,27,664),M['sage'],12)
    front=B('shelter front',(0,311,375),(825,25,664),M['sage'],10)
    _cut(front,B('arched entry cutter',(0,311,281),(312,80,377),M['dark'],65))
    B('shelter roof',(0,687,765),(885,814,77),M['sage'],30)
    B('rear access handle',(0,1082,625),(131,26,22),M['dark'],6)
    _grille('shelter ventilation',0,1080,483,342,87,M,14,mat=M['sage'],depth=5)
    for y in [-1071,-736,-401,-66,269]:
        tube('run supporting arch',[(-485,y,18),(-485,y,519),(-408,y,676),(0,y,821),(408,y,676),(485,y,519),(485,y,18)],6,M['dark'],8)
    for y in range(-1063,273,55):
        tube('run transverse wire',[(-481,y,25),(-481,y,515),(-404,y,672),(0,y,815),(404,y,672),(481,y,515),(481,y,25)],1.7,M['dark'],4)
    for sign in [-1,1]:
        for z in range(50,521,55):tube('run side wire',[(sign*481,-1071,z),(sign*481,280,z)],1.7,M['dark'],4)
        for x,z in [(400,672),(320,703),(240,733),(160,762),(80,791)]:tube('run roof wire',[(sign*x,-1071,z),(sign*x,280,z)],1.7,M['dark'],4)
    for x in range(-440,441,55):
        top=815-143*abs(x)/404 if abs(x)<=404 else 672-(abs(x)-404)*157/77
        tube('front access door wire',[(x,-1076,30),(x,-1076,top)],1.7,M['dark'],4)
    for z in range(55,516,55):tube('front door horizontal',[(-472,-1076,z),(472,-1076,z)],1.7,M['dark'],4)
    for z in range(550,800,50):
        half=481-(z-515)*77/157 if z<=672 else (815-z)*404/143
        tube('front arch horizontal wire',[(-half,-1076,z),(half,-1076,z)],1.7,M['dark'],4)
    B('run door latch',(411,-1081,308),(86,13,14),M['steel'],3)


def _catbridge(M):
    for x in [-537,537]:
        B('wall landing platform',(x,0,242),(226,360,29),M['wood'],5)
        for xx in [x-65,x+65]:
            B('wall cleat',(xx,169,163),(25,17,198),M['steel'],3)
            beam('landing diagonal bracket',(xx,159,75),(xx,-135,224),16,19,M['steel'],3)
    for i in range(18):
        x=-401+i*47.2;z=86+139*(abs(x)/423)**2
        o=B('individual bridge slat',(x,0,z),(43,325,18),M['wood' if i%3 else 'wood2'],4)
        o.rotation_euler.y=-math.atan(278*x/(423**2))
    for y in [-147,147]:
        pts=[(-428+i*856/32,y,86+139*(abs(-428+i*856/32)/423)**2) for i in range(33)]
        tube('load rope under slats',pts,7,M['fabric'],8)
        tube('sagging side rope rail',[(x,y,z+65) for x,y,z in pts],6,M['fabric'],8)
    for x in [-420,420]:
        for y in [-147,147]:C('landing rope post',(x,y,260),12,79,M['wood'],s=16)


def _dumbbells(M):
    for x in [-446,446]:
        for y in [-231,231]:beam('rack leaning end frame',(x,y,30),(x,y*.5,752),47,48,M['dark'],5)
        B('broad rack foot',(x,0,26),(83,594,51),M['rubber'],8)
    for tier,z in enumerate([251,511,744]):
        y=135-tier*93
        for yy in [y-84,y+84]:B('angled weight saddle rail',(0,yy,z),(926,39,31),M['steel'],4)
        for xx in [-307,-102,103,308]:
            C('dumbbell steel grip',(xx,y,z+55),12,151,M['steel'],axis='Y',s=20)
            for yy in [y-86,y+86]:C('rubber hex dumbbell head',(xx,yy,z+55),47+tier*4,43,M['rubber'],axis='Y',s=6)
            for yy in [y-31,y,y+31]:ring('grip knurl band',(xx,yy,z+55),12,1,M['dark'],axis='Y',steps=12)


def _ladder(M):
    for x in [-231,231]:
        for sy in [-1,1]:
            beam('splayed ladder side rail',(x,sy*384,35),(x*.69,sy*66,1173),47,48,M['clay'],5)
            B('molded non slip boot',(x,sy*386,28),(78,80,55),M['rubber'],10)
        beam('hinged spreader',(x*.88,-227,604),(x*.88,227,604),17,11,M['steel'],2)
        C('spreader hinge',(x*.88,0,604),12,22,M['steel'],axis='X',s=16)
    for z in [246,484,721,958]:
        y=-384+(z-35)*318/1138;w=458-(z-35)*140/1138
        B('broad aluminium step',(0,y,z),(w,112,26),M['steel'],4)
        for yy in [-38,-19,0,19,38]:B('step traction groove',(0,y+yy,z+14),(w-12,2,2),M['dark'],0)
        B('rear ladder horizontal',(0,-y,z),(w,23,28),M['steel'],3)
    B('molded tool top',(0,0,1190),(387,190,60),M['clay'],13)
    for x in [-102,102]:C('top tool recess',(x,0,1221),21,2,M['dark'],s=20)


def _bikerack(M):
    B('vertical wall spine',(0,16,353),(96,22,702),M['dark'],7)
    for z in [80,619]:C('wall mount fixing',(0,2,z),7,4,M['steel'],axis='Y',s=16)
    C('pivot hinge',(0,-12,369),23,455,M['steel'],s=24)
    tube('front wheel cradle',[(-44,-15,433),(-44,-230,252),(-32,-287,261),(32,-287,261),(44,-230,252),(44,-15,433)],12,M['steel'],10)
    B('cradle tire contact pad',(0,-206,287),(86,99,26),M['rubber'],9)
    B('lower tire rest',(0,-3,46),(135,55,86),M['dark'],10)


def _stored_bike(M):
    before=set(bpy.context.scene.objects)
    # Author in cycling pose, then rotate the whole original assembly into storage.
    for y in [-529,529]:
        ring('commuter tire',(0,y,350),335,18,M['rubber'],axis='X',steps=64)
        for x in [-12,12]:
            ring('alloy wheel rim',(x,y,350),311,6,M['steel'],axis='X',steps=64)
            for i in range(24):
                a=i*math.tau/24;tube('stainless bicycle spoke',[(x,y,350),(x,y+303*math.cos(a),350+303*math.sin(a))],1.3,M['steel'],4)
        C('bicycle wheel hub',(0,y,350),18,107,M['steel'],axis='X',s=20)
    pts={'rear':(0,-529,350),'bb':(0,-80,324),'seat':(0,-182,809),'head':(0,418,810),'fork':(0,491,618),'front':(0,529,350)}
    for a,b in [('rear','bb'),('rear','seat'),('bb','seat'),('seat','head'),('bb','fork'),('head','fork')]:tube('original commuter frame',[pts[a],pts[b]],18,M['blue'],10)
    for x in [-37,37]:tube('front fork',[(x,491,618),(x,529,350)],12,M['steel'],8)
    tube('seat post',[(0,-182,809),(0,-207,936)],13,M['steel'],8)
    outline=[(-62,-382),(-86,-365),(-91,-326),(-78,-290),(-39,-254),(-25,-151),(-12,-130),
             (12,-130),(25,-151),(39,-254),(78,-290),(91,-326),(86,-365),(62,-382)]
    count=len(outline);verts=[(x,y,z) for z in [936,979] for x,y in outline]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    saddle=mesh('shaped narrow nose commuter saddle',verts,faces,M['rubber'])
    bevel=saddle.modifiers.new('Soft saddle edges','BEVEL');bevel.width=8;bevel.segments=3
    bpy.context.view_layer.objects.active=saddle;bpy.ops.object.modifier_apply(modifier=bevel.name)
    tube('saddle centre relief',[(0,-337,981),(0,-233,981)],3,M['dark'],6)
    for x in [-23,23]:tube('bent saddle mounting rail',[(x,-334,937),(x,-305,924),(x,-194,924),(x,-174,937)],4,M['steel'],6)
    tube('handlebar stem',[(0,418,810),(0,395,963)],16,M['steel'],8)
    tube('swept commuter handlebar',[(-316,301,999),(-199,361,988),(0,395,963),(199,361,988),(316,301,999)],13,M['steel'],10)
    for x in [-269,269]:tube('rubber handle grip',[(x-43,312,998),(x+43,312,998)],18,M['rubber'],10)
    C('front chain ring',(35,-80,324),92,8,M['steel'],axis='X',s=48)
    for sign in [-1,1]:
        tube('pedal crank',[(sign*40,-80,324),(sign*40,-80+sign*137,324)],10,M['steel'],8)
        B('commuter pedal',(sign*92,-80+sign*137,324),(95,79,19),M['rubber'],3)
    tube('fixed chain outline',[(43,-529,375),(43,-80,416),(43,9,324),(43,-80,232),(43,-529,325),(43,-553,350),(43,-529,375)],3,M['dark'],6)
    tube('front brake cable',[(215,352,990),(148,434,827),(57,479,634)],2.5,M['rubber'],6)
    rot=Matrix.Rotation(math.pi/2,4,'X')
    for o in set(bpy.context.scene.objects)-before:o.matrix_world=rot@o.matrix_world


def _shopvac(M):
    lathe('drum canister',[(0,79),(171,79),(191,104),(208,356),(205,390),(194,400),(0,400)],M['clay'],48)
    C('motor lid',(0,0,421),215,47,M['dark'],s=48)
    B('top motor housing',(0,0,479),(299,254,98),M['dark'],25)
    tube('raised carrying handle',[(-83,0,518),(-83,0,562),(83,0,562),(83,0,518)],13,M['dark'],10)
    for x in [-160,160]:
        for y in [-157,157]:
            B('caster outrigger',(x,y,84),(99,82,34),M['dark'],8)
            wheel('canister caster',(x,y,41),41,31,M)
    for x in [-210,210]:B('lid retaining latch',(x,0,390),(17,58,70),M['steel'],5)
    C('front suction hose port',(0,-204,307),36,27,M['dark'],axis='Y',s=24)
    pts=[]
    for i in range(81):
        a=i*math.tau/80;pts.append((224*math.sin(a),224*math.cos(a),309+12*math.sin(a)))
    tube('parked corrugated hose coil',pts,17,M['rubber'],8)
    for i in range(40):
        a=i*math.tau/40
        # Short band segments give a restrained ribbed reading at normal scale.
        p=(224*math.sin(a),224*math.cos(a),309+12*math.sin(a))
        o=C('hose corrugation band',p,19,5,M['dark'],s=12)
        o.rotation_euler=Vector((224*math.cos(a),-224*math.sin(a),12*math.cos(a))).to_track_quat('Z','Y').to_euler()
    tube('stored wand',[(167,152,148),(167,152,548)],17,M['dark'],10)
    B('wide stored floor nozzle',(106,147,551),(205,51,43),M['dark'],9)
    B('motor rocker switch',(0,-130,489),(47,9,28),M['red'],4)


def _greenhouse(M):
    for x in [-906,906]:
        for y in [-606,606]:B('greenhouse corner post',(x,y,802),(31,31,1604),M['steel'],3)
        for z in [32,1580]:B('side base and eave rail',(x,0,z),(36,1250,43),M['steel'],3)
        for y in [-201,201]:B('side glazing mullion',(x,y,812),(23,24,1534),M['steel'],2)
        for y in [-404,0,404]:B('clear side panel',(x,y,812),(3,384,1488),M['glass'],0)
    for y in [-606,606]:
        B('end base rail',(0,y,31),(1850,35,45),M['steel'],3)
        B('end eave crossbar',(0,y,1580),(1820,28,33),M['steel'],2)
        for x in [-912,912]:beam('gable glazing bar',(x,y,1592),(0,y,2092),29,29,M['steel'],2)
        mesh('clear triangular gable',[(-891,y,1595),(891,y,1595),(0,y,2078)],[(0,1,2)],M['glass'])
    for y in [-606,-202,202,606]:
        for x in [-912,912]:beam('roof glazing rafter',(x,y,1590),(0,y,2092),25,28,M['steel'],2)
    B('roof ridge',(0,0,2091),(33,1250,18),M['steel'],2)
    for sign in [-1,1]:
        mesh('clear roof sheets',[(sign*900,-596,1598),(0,-596,2088),(0,596,2088),(sign*900,596,1598)],[(0,1,2,3)],M['glass'])
    # Front door and flanking panels are separate static frames; not architecture.
    for x in [-583,583]:B('front side glazing',(x,-606,813),(586,3,1480),M['glass'],0)
    for x in [-286,286]:B('closed front door stile',(x,-614,821),(26,29,1558),M['steel'],2)
    for z in [54,830,1592]:B('closed front door rail',(0,-614,z),(574,29,24),M['steel'],2)
    B('front door glass',(0,-614,821),(537,3,1506),M['glass'],0)
    B('door lever',(225,-637,829),(62,23,13),M['dark'],3)
    for x in [-600,0,600]:B('rear glazing panel',(x,606,813),(577,3,1480),M['glass'],0)
    for x in [-298,298]:B('rear vertical mullion',(x,606,813),(23,23,1500),M['steel'],2)
    # One outlined closed roof vent, fully inside its fixed roof pose.
    for y in [-168,170]:beam('roof vent edge',(452,y,1841),(24,y,2074),22,18,M['dark'],2)
    for x,z in [(452,1841),(24,2074)]:B('roof vent crossbar',(x,0,z),(21,355,20),M['dark'],2)


def _shed(M):
    B('raised shed floor',(0,0,44),(1855,1173,88),M['dark'],9)
    for x in [-909,909]:
        for y in [-574,574]:B('shed corner stile',(x,y,927),(65,62,1790),M['dark'],6)
        for z in range(140,1740,137):B('horizontal side wall panel',(x,0,z),(37,1100,129),M['sage'],4)
    for z in range(140,1740,137):B('rear wall board',(0,576,z),(1777,36,129),M['sage'],4)
    for x in [-446,446]:
        door=B('closed framed shed door',(x,-583,907),(847,38,1665),M['sage'],7)
        _cut(door,B('front window opening cutter',(x,-583,1458),(512,100,331),M['glass'],0))
        for xx in [x-407,x+407]:B('door vertical reinforcing stile',(xx,-609,904),(41,21,1671),M['dark'],3)
        for z in [132,656,1154,1725]:B('door cross rail',(x,-609,z),(808,21,37),M['dark'],3)
        for xx in [x-266,x+266]:B('front window frame upright',(xx,-610,1458),(19,23,370),M['dark'],3)
        for zz in [1282,1634]:B('front window frame crossbar',(x,-610,zz),(551,23,19),M['dark'],3)
        B('small clear front window',(x,-624,1458),(512,3,331),M['glass'],0)
        for xx in [x-835/2]:
            for z in [287,991,1611]:C('door hinge barrel',(xx,-620,z),10,89,M['steel'],s=16)
    B('double door locking hasp',(0,-638,904),(132,18,36),M['steel'],4)
    for y in [-577,577]:
        mesh('solid gable panel',[(-916,y,1772),(916,y,1772),(0,y,2198)],[(0,1,2)],M['sage'])
        _grille('gable ventilation',0,y-6,1913,237,88,M,13,mat=M['dark'],depth=5)
    for sign in [-1,1]:
        mesh('layered pitched roof',[(sign*950,-610,1754),(0,-610,2210),(0,610,2210),(sign*950,610,1754),
             (sign*950,-610,1725),(0,-610,2181),(0,610,2181),(sign*950,610,1725)],
             [(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4)],M['dark'])
        for x in [sign*150,sign*350,sign*550,sign*750]:
            z=2210-abs(x)*456/950;B('raised roof seam',(x,0,z+2),(5,1215,4),M['steel'],1)


def _composter(M):
    C('faceted compost drum',(0,0,665),367,704,M['dark'],axis='X',s=10)
    for x in [-362,362]:
        C('drum reinforcing end',(x,0,665),351,17,M['sage'],axis='X',s=10)
        C('central drum bearing',(x,0,665),49,46,M['steel'],axis='X',s=24)
        for y in [-380,380]:
            beam('wide A frame stand',(x,y,35),(x,0,665),39,42,M['steel'],4)
            B('stand rubber foot',(x,y,22),(68,83,44),M['rubber'],7)
    C('rotation axle',(0,0,665),24,831,M['steel'],axis='X',s=24)
    B('large removable access hatch',(0,-353,675),(480,29,377),M['sage'],18)
    B('hatch inset panel',(0,-373,675),(432,13,328),M['dark'],13)
    for x in [-140,140]:B('hatch rotating latch',(x,-388,526),(70,17,27),M['steel'],5)
    B('hatch carry grip',(0,-389,813),(133,23,23),M['rubber'],6)
    # End-face vents sit outside the cap; front-face marks were buried in the drum.
    for x in [-372,372]:
        for y in [-153,-92,-31,31,92,153]:B('end cap recessed air vent',(x,y,859),(3,39,10),M['rubber'],2)
    C('rotation locking pin',(409,0,645),9,80,M['steel'],axis='X',s=16)
    B('lock pin grip',(453,0,645),(13,45,29),M['red'],4)


def _barrel(M):
    lathe('hollow ribbed water barrel',[(0,14),(310,14),(330,40),(375,704),(378,746),(370,768),(354,768),(350,729),(308,45),(0,45)],M['sage'],64)
    for z in [76,217,358,499,640,747]:ring('molded strengthening hoop',(0,0,z),329+z*.055,8,M['sage'],steps=64)
    C('removable barrel lid',(0,0,780),385,29,M['dark'],s=64)
    C('lid raised centre grip',(0,0,798),52,8,M['dark'],s=32)
    C('low tap threaded boss',(0,-341,136),25,32,M['brass'],axis='Y',s=24)
    tube('garden tap spout',[(0,-362,136),(0,-395,136),(0,-406,119),(0,-406,102)],13,M['brass'],10)
    B('tap turn lever',(0,-374,164),(70,13,8),M['blue'],3)
    C('capped overflow boss',(0,371,650),22,21,M['dark'],axis='Y',s=24)


def _hosereel(M):
    B('exterior wall fixing plate',(0,192,231),(136,23,333),M['dark'],9)
    for x in [-44,44]:
        for z in [106,359]:C('wall bracket fastener',(x,179,z),7,4,M['steel'],axis='Y',s=12)
    C('vertical swivel pivot',(0,146,232),20,285,M['steel'],s=20)
    B('oval enclosed reel shell',(0,-35,230),(248,354,355),M['sage'],75)
    for x in [-126,126]:
        C('reel side cover',(x,-35,230),139,7,M['dark'],axis='X',s=48)
        C('side hub cap',(x*1.025,-35,230),36,6,M['sage'],axis='X',s=24)
    B('front hose guide',(0,-217,161),(85,31,46),M['dark'],9)
    tube('short stowed hose',[(0,-232,158),(0,-248,113),(48,-234,64),(93,-184,58)],11,M['rubber'],8)
    tube('short connector hose',[(0,104,126),(61,137,74),(73,185,94)],10,M['rubber'],8)
    B('nozzle holder',(105,-110,85),(21,52,71),M['dark'],4)
    C('stored spray nozzle',(105,-109,117),18,107,M['brass'],s=20)
    C('nozzle grip',(105,-109,78),23,63,M['dark'],s=20)


def _clothesline(M):
    C('rotary line centre mast',(0,0,988),24,1976,M['steel'],s=24)
    C('ground socket sleeve',(0,0,88),35,176,M['dark'],s=24)
    C('sliding arm collar',(0,0,1261),47,169,M['dark'],s=24)
    C('upper hinge cap',(0,0,1795),58,80,M['dark'],s=24)
    for x,y in [(-1280,-1280),(-1280,1280),(1280,-1280),(1280,1280)]:
        tube('folding overhead arm',[(0,0,1779),(x,y,2035)],17,M['steel'],8)
        tube('diagonal arm brace',[(0,0,1300),(x*.57,y*.57,1925)],12,M['steel'],8)
        C('arm end plug',(x,y,2035),21,27,M['dark'],s=16)
    for r in [278,438,598,758,918,1078,1240]:
        z=1779+256*r/1280
        tube('taut square drying line',[(-r,-r,z),(-r,r,z),(r,r,z),(r,-r,z),(-r,-r,z)],2.8,M['blue'],6)
    B('sliding collar release',(48,0,1271),(29,73,53),M['blue'],7)


def _barrow(M):
    cavity('deep pressed steel tray',(0,-260,339),635,851,306,M['sage'],exponent=4,wall=9)
    rounded_loop('rolled tray rim',625,841,103,645,M['sage'],7,y=-260)
    wheel('single barrow tire',(0,-573,176),176,101,M)
    C('wheel axle',(0,-573,176),14,476,M['steel'],axis='X',s=20)
    for x in [-218,218]:
        beam('long steel handle',(x,-566,250),(x,702,617),39,38,M['dark'],5)
        beam('soft handle grip',(x,563,577),(x,715,621),48,47,M['rubber'],8)
        B('axle bearing plate',(x,-573,213),(25,75,100),M['steel'],4)
        C('axle retaining cap',(x*1.073,-573,176),20,10,M['dark'],axis='X',s=20)
        tube('parked resting leg',[(x,96,445),(x,197,31),(x,333,31),(x,397,530)],17,M['steel'],10)
        beam('tray underside brace',(x,-585,279),(x,69,331),29,37,M['steel'],4)
    for y in [-481,129]:B('tray supporting cross brace',(0,y,333),(451,47,34),M['steel'],4)
    B('resting leg cross brace',(0,267,48),(443,26,26),M['steel'],3)


BUILDERS={'electronic-drum-kit':_drumkit,'drum-throne':_throne,'paper-shredder':_shredder,
 'desktop-pegboard':_pegboard,'desk-footrest':_footrest,'indoor-pet-ramp':_ramp,
 'kids-drawing-easel':_easel,'compact-stroller':_stroller,'rabbit-hutch-and-run':_hutch,
 'cat-wall-bridge':_catbridge,'home-dumbbell-rack':_dumbbells,'folding-step-ladder':_ladder,
 'wall-bicycle-storage':_bikerack,'stored-commuter-bicycle':_stored_bike,
 'shop-canister-vacuum':_shopvac,'compact-greenhouse':_greenhouse,'compact-garden-shed':_shed,
 'compost-tumbler':_composter,'rainwater-barrel':_barrel,'wall-hose-reel':_hosereel,
 'rotary-outdoor-clothesline':_clothesline,'steel-wheelbarrow':_barrow}


def create(catalog_id,M):
    before=set(bpy.context.scene.objects);BUILDERS[catalog_id](M)
    parts=list(set(bpy.context.scene.objects)-before)
    for o in parts:o['catalog_id']=catalog_id;o['source_family']='HOME-115–134';o['fixed_pose']=True
    return parts
