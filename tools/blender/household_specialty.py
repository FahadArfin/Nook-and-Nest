"""HOME-073–084 original family, fitness and garden models; millimetres.
HOME-072 is covered by existing high-chair and is deliberately not duplicated.
Only adds editable parts to the active scene. Parent owns save/export/review.
"""
import math
import bpy
from mathutils import Vector
from build_kitchen_essentials import B,C,mesh,tube,ring,lathe,rounded_loop,material
from studio_geometry import text


def beam(n,a,b,w,d,m,bevel=3):
    a,b=Vector(a),Vector(b);o=B(n,(a+b)/2,(w,d,(b-a).length),m,bevel)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o


def wheel(n,p,r,w,M):
    C(n+' tread',p,r,w,M['rubber'],axis='X',s=32)
    for sign in [-1,1]:
        x=p[0]+sign*(w/2+.5)
        C(n+' hub',(x,p[1],p[2]),r*.65,2,M['dark'],axis='X',s=24)
        C(n+' axle',(x+sign*1.5,p[1],p[2]),r*.14,3,M['steel'],axis='X',s=16)
        for i in range(8):
            a=i*math.tau/8
            tube(n+' spoke',[(x,p[1]+r*.2*math.cos(a),p[2]+r*.2*math.sin(a)),
                 (x,p[1]+r*.56*math.cos(a),p[2]+r*.56*math.sin(a))],r*.028,M['steel'],4)


def _crate(M):
    B('removable molded base tray',(0,0,20),(596,920,32),M['rubber'],12)
    rounded_loop('raised tray rim',588,912,16,38,M['dark'],5)
    for x in [-293,293]:
        for y in [-455,455]:tube('rounded cage corner',[(x,y,40),(x,y,610)],4,M['dark'],6)
        for z in [52,613]:tube('cage long edge',[(x,-455,z),(x,455,z)],4,M['dark'],6)
        for j in range(22):
            y=-443+j*42.2;tube('side vertical wire',[(x,y,46),(x,y,613)],2,M['dark'],6)
        for z in range(82,613,46):tube('side horizontal wire',[(x,-455,z),(x,455,z)],2,M['dark'],6)
    for y in [-455,455]:
        for z in [52,613]:tube('cage short edge',[(-293,y,z),(293,y,z)],4,M['dark'],6)
    for x in range(-276,277,46):
        tube('rear vertical wire',[(x,455,50),(x,455,613)],2,M['dark'],6)
        tube('roof long wire',[(x,-455,613),(x,455,613)],2,M['dark'],6)
    for z in range(82,613,46):tube('rear horizontal wire',[(-290,455,z),(290,455,z)],2,M['dark'],6)
    for y in range(-436,437,46):tube('roof cross wire',[(-290,y,613),(290,y,613)],2,M['dark'],6)
    # Front has a separate closed door, frame, hinge eyes and sliding latch.
    for x in [-280,-245,245,280]:tube('front outside door wire',[(x,-455,52),(x,-455,613)],2,M['dark'],6)
    for z in [72,590]:tube('front door opening frame',[(-245,-455,z),(245,-455,z)],4,M['dark'],6)
    tube('closed door perimeter',[(-222,-461,88),(-222,-461,574),(222,-461,574),(222,-461,88),(-222,-461,88)],3,M['dark'],6)
    for x in range(-184,185,46):tube('door upright',[(x,-461,90),(x,-461,574)],2,M['dark'],6)
    for z in range(110,574,46):tube('door horizontal',[(-222,-461,z),(222,-461,z)],2,M['dark'],6)
    for z in [160,475]:ring('door hinge eye',(-233,-456,z),7,2,M['steel'],axis='Z',steps=12)
    tube('slide latch',[(180,-470,365),(259,-470,365),(259,-470,385)],3,M['steel'],6)
    for x in [194,220]:B('latch guide',(x,-466,365),(8,10,12),M['dark'],1)
    tube('folded carry handle',[(-65,-10,616),(-65,-10,629),(65,-10,629),(65,-10,616)],4,M['rubber'],8)


def _playyard(M):
    net=material('play-yard-soft-mesh',(.36,.43,.44),.95,0,.16)
    B('low padded floor',(0,0,39),(730,1050,55),M['fabric'],15)
    rounded_loop('floor binding',744,1064,25,56,M['blue'],8)
    rounded_loop('padded top rail',722,1036,27,625,M['blue'],14)
    for sx in [-1,1]:
        for sy in [-1,1]:
            beam('angled folding leg',(sx*388,sy*548,20),(sx*347,sy*498,621),30,32,M['dark'],6)
            B('wide rubber foot',(sx*388,sy*548,13),(44,50,26),M['rubber'],9)
            C('leg hinge hub',(sx*347,sy*508,579),16,37,M['steel'],axis='Y',s=20)
    # Transparent mesh plus actual bounded threads, framed by separate binding.
    for x in [-357,357]:
        mesh('long mesh side',[(x,-513,60),(x,513,60),(x,513,617),(x,-513,617)],[(0,1,2,3)],net)
        for y in range(-491,492,45):tube('long mesh vertical thread',[(x,y,68),(x,y,608)],.7,M['cream'],4)
        for z in range(82,608,39):tube('long mesh cross thread',[(x,-510,z),(x,510,z)],.7,M['cream'],4)
    for y in [-516,516]:
        mesh('end mesh panel',[(-357,y,60),(357,y,60),(357,y,617),(-357,y,617)],[(0,1,2,3)],net)
        for x in range(-337,338,45):tube('end mesh vertical thread',[(x,y,70),(x,y,607)],.7,M['cream'],4)
        for z in range(82,608,39):tube('end mesh cross thread',[(-348,y,z),(348,y,z)],.7,M['cream'],4)
    tube('zippered side entry outline',[(-220,-522,83),(-220,-522,383),(-201,-522,412),(201,-522,412),(220,-522,383),(220,-522,83)],5,M['blue'],6)
    C('zip slider',(210,-528,403),5,4,M['steel'],axis='Y',s=12)
    tube('zip pull',[(210,-529,402),(213,-529,385),(220,-529,386)],2,M['steel'],6)


def _tower(M):
    for x in [-264,264]:
        for y in [-264,264]:B('upright timber post',(x,y,489),(45,49,962),M['wood'],8)
        B('wide stabilizer foot',(x,0,32),(71,850,64),M['wood'],12)
        for z in [170,498,811,946]:B('side horizontal rail',(x,0,z),(43,555,46),M['wood2'],7)
        for y in [-90,90]:B('upper side safety rail',(x,y,735),(32,34,380),M['wood'],6)
    for z in [523,812,946]:B('back cross rail',(0,265,z),(543,45,48),M['wood2'],7)
    B('broad adjustable standing platform',(0,35,506),(538,527,32),M['wood2'],7)
    for y,z in [(-330,178),(-233,338)]:B('entry step',(0,y,z),(515,146,32),M['wood'],7)
    for x in [-268,268]:
        for z in range(396,677,70):C('platform adjustment pin',(x,-268,z),5,3,M['steel'],axis='Y',s=12)
    for x in [-250,250]:
        for z in [170,498,811,946]:C('rounded joinery bolt',(x,-294,z),6,2,M['steel'],axis='Y',s=12)


def _weightbench(M):
    for y in [-533,537]:
        B('wide steel stabilizer',(0,y,52),(600,74,65),M['dark'],8)
        for x in [-274,274]:B('rubber stabilizer end',(x,y,43),(52,83,77),M['rubber'],8)
        beam('tapered vertical support',(0,y,83),(0,y*.8,350),72,58,M['dark'],5)
    B('central box section spine',(0,0,308),(91,1250,83),M['dark'],6)
    for y,length in [(-175,880),(425,280)]:B('separate upholstered pad',(0,y,426),(305,length,88),M['blue'],23)
    for x in [-61,61]:
        B('incline ladder rail',(x,-80,247),(12,790,30),M['steel'],3)
        for y in range(-370,251,90):B('incline ladder notch',(x,y,270),(12,20,21),M['steel'],2)
    tube('front transport handle',[(-90,644,280),(-90,690,280),(90,690,280),(90,644,280)],12,M['dark'],8)
    for x in [-209,209]:wheel('rear transport wheel',(x,-560,52),42,26,M)
    C('backrest pivot pin',(0,260,358),13,144,M['steel'],axis='X',s=20)


def _rower(M):
    B('long sliding monorail',(0,329,287),(115,1610,77),M['steel'],7)
    B('rail upper rolling track',(0,331,329),(90,1604,7),M['dark'],2)
    for y,w,z in [(1115,400,86),(-957,610,127)]:
        B('ground stabilizer',(0,y,z),(w,72,54),M['dark'],8)
        for x in [-w/2+26,w/2-26]:B('rubber stabilizer cap',(x,y,z),(52,83,64),M['rubber'],8)
        beam('frame support',(0,y,z+20),(0,y,280 if y>0 else 425),65,60,M['dark'],5)
    B('sliding seat carriage',(0,481,351),(260,238,31),M['dark'],7)
    B('shaped padded rowing seat',(0,483,392),(335,259,54),M['rubber'],18)
    for x in [-118,118]:
        for y in [399,557]:C('carriage roller',(x,y,337),18,22,M['dark'],axis='X',s=16)
    C('fan core',(0,-843,511),224,185,M['dark'],axis='X',s=64)
    for x in [-98,98]:
        ring('fan cage perimeter',(x,-843,511),248,9,M['dark'],axis='X',steps=64)
        C('fan centre hub',(x,-843,511),43,7,M['steel'],axis='X',s=28)
        for i in range(32):
            a=i*math.tau/32
            tube('fan guard spoke',[(x,-843+48*math.cos(a),511+48*math.sin(a)),(x,-843+239*math.cos(a),511+239*math.sin(a))],2.2,M['steel'],4)
    beam('front backbone',(0,-460,286),(0,-843,450),110,86,M['dark'],6)
    for x in [-153,153]:
        o=B('angled strapped footplate',(x,-438,374),(136,270,22),M['dark'],8);o.rotation_euler.x=.58
        tube('heel cup edge',[(x-59,-333,312),(x,-317,301),(x+59,-333,312)],8,M['rubber'],8)
        B('foot strap',(x,-454,407),(137,32,6),M['blue'],2)
    tube('monitor articulated arm',[(0,-889,694),(0,-744,1009),(0,-653,1076)],19,M['dark'],10)
    B('monitor housing',(0,-638,1092),(173,52,128),M['dark'],9)
    B('monitor static screen',(0,-668,1102),(142,2,75),M['light'],3)
    text('original monitor graphic','2:14',(0,-671,1103),24,M['dark'])
    tube('pull chain',[(0,-650,459),(0,-420,502)],2.5,M['steel'],6)
    tube('rowing pull handle',[(-187,-406,505),(-95,-421,504),(95,-421,504),(187,-406,505)],14,M['rubber'],10)


def _workbench(M):
    for i in range(10):B('laminated hardwood top board',(-823.5+i*183,0,873),(183,635,54),M['wood' if i%3 else 'wood2'],3)
    for x in [-757,757]:
        for y in [-239,239]:
            B('adjustable outer leg sleeve',(x,y,576),(88,88,541),M['dark'],6)
            B('telescopic lower leg',(x,y,215),(65,65,350),M['steel'],4)
            for z in [326,375,424,473]:C('height adjustment bore',(x,y-46,z),5,2,M['steel'],axis='Y',s=12)
            C('leveling foot screw',(x,y,31),13,25,M['steel'],s=16)
            C('broad leveling pad',(x,y,13),41,25,M['rubber'],s=24)
        B('side under-top cross member',(x,0,822),(88,548,46),M['dark'],4)
    B('rear lower cross brace',(0,244,300),(1551,52,56),M['dark'],5)
    for y in [-244,244]:B('top longitudinal beam',(0,y,818),(1537,48,49),M['dark'],4)


def _treadmill(M):
    before=set(bpy.context.scene.objects)
    B('steel running deck chassis',(0,0,116),(835,1880,102),M['dark'],22)
    B('recessed continuous running belt',(0,55,174),(545,1580,16),M['rubber'],5)
    for x in [-366,366]:
        B('raised standing side rail',(x,40,189),(120,1633,49),M['dark'],9)
        for y in [-550,-250,50,350,650]:B('rail anti-slip strip',(x,y,215),(91,77,3),M['rubber'],1)
    B('sculpted front motor hood',(0,-783,266),(774,287,165),M['dark'],32)
    for x in range(-252,253,42):B('motor hood vent',(x,-838,351),(17,123,3),M['steel'],1)
    for x in [-364,364]:
        beam('console upright',(x,-688,225),(x,-490,1263),68,83,M['dark'],10)
        tube('running support handrail',[(x,-547,1155),(x,-277,1093),(x,20,1077)],30,M['rubber'],10)
        for y in [-770,756]:B('deck isolation foot',(x,y,35),(80,108,70),M['rubber'],10)
    console=B('console control housing',(0,-485,1340),(881,245,188),M['dark'],27);console.rotation_euler.x=math.radians(-12)
    screen_case=B('operator display housing',(0,-343,1368),(329,24,168),M['rubber'],12);screen_case.rotation_euler.x=math.radians(-12)
    screen=B('tilted original display',(0,-328,1365),(289,5,132),M['light'],6);screen.rotation_euler.x=math.radians(-12)
    label=text('static treadmill screen','3.8',(0,-322,1364),39,M['dark']);label.rotation_euler=(math.radians(102),0,math.pi)
    for x in [-309,309]:
        C('recessed console cupholder',(x,-537,1437),44,8,M['rubber'],s=28)
        B('console control group',(x,-349,1333),(90,7,36),M['steel'],6)
    B('emergency key dock',(0,-351,1272),(50,18,34),M['red'],7)
    for x in [-300,300]:C('rear roller end cap',(x,943,157),27,8,M['steel'],axis='Y',s=24)
    # Face the runner's entry toward catalog front, exposing the useful controls.
    from mathutils import Matrix
    turn=Matrix.Rotation(math.pi,4,'Z')
    for o in set(bpy.context.scene.objects)-before:o.matrix_world=turn@o.matrix_world


def _bike(M):
    for y in [-464,476]:
        C('ground stabilizer',(0,y,56),31,560,M['dark'],axis='X',s=24)
        for x in [-257,257]:C('rubber stabilizer cap',(x,y,51),40,42,M['rubber'],axis='X',s=20)
    for a,b in [((0,-464,82),(0,262,853)),((0,476,82),(0,-211,617)),((0,-211,617),(0,262,853)),((0,-420,86),(0,418,86))]:
        beam('welded training frame',a,b,74,80,M['dark'],8)
    C('weighted steel flywheel',(0,-259,374),248,47,M['steel'],axis='X',s=64)
    for x in [-28,28]:
        ring('flywheel dark outer band',(x,-259,374),233,13,M['rubber'],axis='X',steps=64)
        C('flywheel hub',(x,-259,374),31,12,M['dark'],axis='X',s=24)
    B('drive belt guard',(42,-39,351),(49,533,189),M['dark'],34)
    beam('sliding saddle post',(0,228,686),(0,312,1017),46,49,M['steel'],4)
    B('saddle slider',(0,323,1015),(56,227,30),M['dark'],5)
    outline=[(-87,436),(-119,414),(-123,369),(-103,323),(-49,278),(-34,205),(-15,186),
             (15,186),(34,205),(49,278),(103,323),(123,369),(119,414),(87,436)]
    count=len(outline);verts=[(x,y,z) for z in [1035,1070] for x,y in outline]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    saddle=mesh('shaped continuous riding saddle',verts,faces,M['rubber'])
    bevel=saddle.modifiers.new('Soft saddle edges','BEVEL');bevel.width=9;bevel.segments=3
    bpy.context.view_layer.objects.active=saddle;bpy.ops.object.modifier_apply(modifier=bevel.name)
    tube('saddle centre relief',[(0,394,1071),(0,285,1071)],4,M['dark'],6)
    beam('handlebar riser',(0,-334,628),(0,-421,1103),54,55,M['steel'],5)
    tube('multi grip handlebar',[(-255,-280,1136),(-255,-474,1181),(-214,-524,1181),(214,-524,1181),(255,-474,1181),(255,-280,1136)],21,M['rubber'],10)
    B('small cycle display',(0,-438,1186),(117,92,23),M['dark'],7)
    B('cycle screen',(0,-438,1199),(88,63,2),M['light'],3)
    C('crank axle',(0,120,380),29,172,M['steel'],axis='X',s=24)
    for sign in [-1,1]:
        tube('crank arm',[(sign*89,120,380),(sign*89,120+sign*135,380)],14,M['steel'],8)
        B('independent pedal',(sign*136,120+sign*135,380),(93,84,24),M['rubber'],5)
        tube('toe strap',[(sign*165,120+sign*135-32,392),(sign*165,120+sign*135,435),(sign*165,120+sign*135+32,392)],5,M['dark'],6)
    C('resistance knob',(0,-62,805),28,22,M['red'],s=24)


def _toolcabinet(M):
    B('steel drawer cabinet shell',(0,0,544),(661,575,777),M['blue'],12)
    for x in [-260,260]:
        for y in [-217,217]:
            B('caster fork',(x,y,97),(39,67,58),M['steel'],5)
            wheel('swivel workshop caster',(x,y,52),52,35,M)
            B('caster brake tab',(x,y-26,113),(43,32,9),M['dark'],2)
    B('drawer shadow reveal',(0,-291,557),(613,7,728),M['dark'],3)
    bottoms=[189,330,461,572,663,744,825];heights=[132,122,102,82,72,72,87]
    for i,(z,h) in enumerate(zip(bottoms,heights)):
        B('separate metal drawer %02d'%i,(0,-297,z+h/2),(600,8,h),M['blue'],3)
        B('full width folded drawer pull',(0,-314,z+h-17),(561,29,13),M['steel'],3)
        B('drawer label window',(-222,-304,z+21),(77,2,15),M['paper'],1)
    B('top protective rubber mat',(0,0,947),(655,570,13),M['rubber'],5)
    for x in [-326,326]:B('top retaining side edge',(x,0,951),(7,575,18),M['dark'],2)
    tube('side push handle',[(333,-177,832),(359,-177,832),(359,177,832),(333,177,832)],10,M['steel'],8)
    C('drawer lock',(251,-305,911),8,4,M['steel'],axis='Y',s=16)


def _mower(M):
    B('chamfered cutting deck',(0,-422,181),(531,721,177),M['sage'],46)
    B('deck bumper',(0,-726,130),(520,63,72),M['dark'],17)
    for x in [-273,273]:
        wheel('front mower wheel',(x,-631,83),83,47,M)
        wheel('rear mower wheel',(x,-169,109),109,49,M)
    B('motor top cover',(0,-409,314),(302,321,139),M['dark'],34)
    B('removable battery hatch',(0,-395,389),(254,242,19),M['sage'],12)
    B('battery hatch grip',(0,-450,403),(114,23,13),M['rubber'],4)
    for x in [-118,118]:
        for y in [-484,-454,-424,-394,-364]:B('motor cooling vent',(x,y,383),(17,13,3),M['steel'],1)
    bagverts=[(-181,-90,131),(181,-90,131),(173,359,71),(-173,359,71),
              (-217,-108,408),(217,-108,408),(200,416,355),(-200,416,355)]
    mesh('tapered sewn grass collector',bagverts,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],M['fabric'])
    tube('collector rigid upper frame',[bagverts[i] for i in [4,7,6,5]],9,M['dark'],8)
    for pair in [(0,4),(3,7),(2,6),(1,5),(3,2)]:tube('fabric collector binding',[bagverts[i] for i in pair],4,M['dark'],6)
    tube('collector lifting strap',[(-55,279,369),(-55,279,392),(55,279,392),(55,279,369)],6,M['rubber'],8)
    for x in [-245,245]:
        tube('folding push handle',[(x,-145,260),(x,321,709),(x,678,1070)],16,M['dark'],10)
        C('handle folding joint',(x,-104,307),29,20,M['steel'],axis='X',s=24)
        C('folding wing grip',(x+12,-104,307),19,12,M['sage'],axis='X',s=12)
    tube('padded horizontal push grip',[(-245,678,1070),(245,678,1070)],24,M['rubber'],12)
    tube('operator bail bar',[(-236,658,1080),(-212,680,1090),(212,680,1090),(236,658,1080)],7,M['steel'],8)
    B('handle control pod',(161,662,1081),(93,46,34),M['sage'],9)
    tube('restrained control cable',[(-225,659,1061),(-228,319,698),(-217,-111,308)],3,M['rubber'],6)


def _deckbox(M):
    B('chest recessed bottom',(0,0,63),(1442,654,57),M['dark'],9)
    for x in [-716,716]:
        B('side frame stile',(x,0,457),(45,665,792),M['dark'],9)
        B('recessed side grip',(x*1.01,0,690),(9,188,41),M['rubber'],8)
    for y in [-340,340]:
        for z in [141,274,407,540,673,806]:B('weatherproof horizontal panel',(0,y,z),(1431,31,125),M['sage'],5)
        for x in [-690,690]:B('vertical end stile',(x,y,453),(42,35,790),M['dark'],5)
    for x in [-711,711]:
        for z in [141,274,407,540,673,806]:B('end panel',(x,0,z),(27,651,125),M['sage'],5)
    B('overhanging closed chest lid',(0,0,876),(1520,730,48),M['dark'],16)
    for y in [-298,-180,-60,60,180,298]:B('subtle lid board join',(0,y,900),(1450,2,1),M['sage'],0)
    B('front latch recess',(0,-368,824),(67,6,43),M['rubber'],4)
    B('front metal latch',(0,-374,826),(27,7,25),M['steel'],3)
    for x in [-559,559]:
        C('rear lid hinge',(x,338,849),14,111,M['steel'],axis='X',s=16)
        for y in [-269,269]:B('short block foot',(x,y,22),(95,84,44),M['rubber'],7)


def _wheelie(M):
    # Tapered outer and inner rings form an actual open molded receptacle beneath lid.
    profile=[(222,232,83),(277,288,905),(265,277,930),(250,261,919),(207,217,109)]
    verts=[]
    for wx,dy,z in profile:verts += [(-wx,-dy,z),(wx,-dy,z),(wx,dy,z),(-wx,dy,z)]
    faces=[(i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j) for i in range(4) for j in range(4)]
    faces+=[(0,3,2,1),(16,17,18,19)]
    obj=mesh('hollow tapered bin body',verts,faces,M['sage'])
    mod=obj.modifiers.new('Molded edge rounding','BEVEL');mod.width=17;mod.segments=3
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    for x in [-257,257]:wheel('large refuse transport wheel',(x,270,117),117,81,M)
    C('rear wheel axle',(0,270,117),12,560,M['steel'],axis='X',s=16)
    B('deep hinged refuse lid',(0,5,966),(608,644,85),M['dark'],30)
    for x in [-200,200]:C('lid hinge knuckle',(x,318,944),22,63,M['dark'],axis='X',s=20)
    tube('rear push handle',[(-216,305,952),(-216,356,1028),(216,356,1028),(216,305,952)],22,M['dark'],12)
    B('front reinforced rim',(0,-292,920),(546,31,31),M['dark'],8)
    B('lid lift grip',(0,-324,980),(177,29,26),M['dark'],8)
    for x in [-161,161]:beam('front molded stiffening rib',(x,-238,115),(x,-286,877),17,7,M['sage'],3)
    B('original identification panel',(0,-282,731),(141,3,90),M['cream'],7)
    text('generic refuse marking','BIN',(0,-287,733),34,M['dark'])


BUILDERS={'wire-dog-crate':_crate,'portable-play-yard':_playyard,
 'toddler-learning-tower':_tower,'adjustable-weight-bench':_weightbench,
 'rowing-machine':_rower,'garage-workbench':_workbench,'folding-treadmill':_treadmill,
 'indoor-exercise-bike':_bike,'rolling-tool-cabinet':_toolcabinet,
 'cordless-lawn-mower':_mower,'weatherproof-deck-box':_deckbox,'outdoor-wheelie-bin':_wheelie}


def create(catalog_id,M):
    before=set(bpy.context.scene.objects);BUILDERS[catalog_id](M)
    parts=list(set(bpy.context.scene.objects)-before)
    for obj in parts:
        obj['catalog_id']=catalog_id;obj['source_family']='HOME-073–084';obj['fixed_pose']=True
    return parts


def support_surfaces(catalog_id):
    """True horizontal planes in raw mm; driver maps centres and exact scale."""
    surfaces={
        'garage-workbench':[("top","Hardwood workbench top",0,0,1810,615,900,1000)],
        # Mat centre947 plus half-thickness6.5 =953.5; side lips end at960.
        'rolling-tool-cabinet':[("top","Tool cabinet rubber mat",0,0,610,530,953.5,800)],
    }
    keys=('id','label','x','z','width','depth','height','clearance')
    return [dict(zip(keys,s)) for s in surfaces.get(catalog_id,[])]
